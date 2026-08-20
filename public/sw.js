/* ============================================================
   THE SERVICE WORKER — the offline promise, made literal.

   The README says this engine needs no network. Until now that
   was true of the *engine* and false of *getting to* the engine:
   a table in a basement with no signal could not load the page
   that then would have worked perfectly.

   ------------------------------------------------------------
   TWO STRATEGIES, AND WHY THEY DIFFER

   NAVIGATIONS ARE NETWORK-FIRST. The HTML entry point names the
   hashed bundles, so a stale copy of it points at bundles that
   may no longer exist. Serving it from cache first is how a user
   gets welded to the version they first visited. Network first,
   cache as the fallback, means online users are always current
   and offline users still get in.

   HASHED ASSETS ARE CACHE-FIRST. Vite emits assets/index-<hash>.js
   and friends, where the hash *is* the version. The content behind
   that URL can never change, so revalidating it is pure latency —
   which at a table means six phones re-fetching identical bytes
   off a laptop's wifi in the first thirty seconds of a session.

   ------------------------------------------------------------
   WHY NOT A PRECACHE MANIFEST

   The honest answer is that generating one means a build plugin,
   and a build plugin means the SW is emitted rather than written,
   and then nobody can read it. Runtime caching costs one uncached
   first visit and buys a file a person can open and understand.
   Given the size of this project's contributor base, that is the
   right trade.

   ------------------------------------------------------------
   WHAT IS DELIBERATELY NOT CACHED

     /net/*       the table server's LAN discovery and websocket
                  upgrade. A cached answer about whether a relay
                  exists is worse than no answer.
     non-GET      never.
     cross-origin there is nothing cross-origin; if something
                  appears, it does not belong here either.
   ============================================================ */

/* Bump this to evict every previous cache. It is manual on purpose:
   an automatic build hash here would mean a cold cache on every
   deploy, throwing away assets whose hashed names prove they are
   still good. */
const VERSION = "rpg-engine-v1";
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const KEEP = new Set([SHELL, ASSETS]);

/* Relative, so this works at a project page (/RPG-Engine/), at a
   domain root, and behind the table server, from one build. */
const ENTRY = new URL("./", self.registration.scope).pathname;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll([ENTRY, `${ENTRY}manifest.webmanifest`]))
      /* A failed precache must not wedge the install. The worst case
         is that the first offline visit misses, which is the same as
         having no service worker at all. */
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Content-addressed by build hash, so it can never go stale. */
const isImmutable = (url) =>
  /\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(js|css|woff2?|png|jpe?g|svg|mp3|ogg)$/.test(url.pathname);

/** The table server. Never cached — see the header. */
const isTableServer = (url) => url.pathname.startsWith(`${ENTRY}net`) || url.pathname === "/net/info";

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isTableServer(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(ENTRY, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(ENTRY).then(
            (hit) =>
              hit ||
              new Response(
                "<!doctype html><meta charset=utf-8><title>Offline</title>" +
                  "<body style='background:#0A0A0B;color:#EDEAE3;font-family:monospace;padding:2rem'>" +
                  "<h1 style='color:#F5C518'>NO CACHED COPY</h1>" +
                  "<p>This engine runs offline once it has been loaded once. " +
                  "Open it with a connection available, then it is yours.</p>",
                { headers: { "Content-Type": "text/html; charset=utf-8" } },
              ),
          ),
        ),
    );
    return;
  }

  if (isImmutable(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSETS).then((c) => c.put(request, copy)).catch(() => {});
            }
            return res;
          }),
      ),
    );
    return;
  }

  /* Everything else — the manifest, icons, anything unhashed —
     stale-while-revalidate. Available instantly offline, and one
     load behind at worst online. */
  event.respondWith(
    caches.match(request).then((hit) => {
      const live = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(ASSETS).then((c) => c.put(request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit);
      return hit || live;
    }),
  );
});

/* The page asks for an immediate takeover after it has told the
   user an update is waiting. */
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});
