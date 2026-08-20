/* ============================================================
   SERVICE WORKER REGISTRATION

   Separate from main.jsx because it is the one piece of the boot
   path that must be trivially skippable: a dev server with a
   stale worker attached is a genuinely confusing afternoon, and
   the table server has no use for one either.

   Registration is DECLINED when:

     · not a production build     — vite dev, where a cached
                                    bundle would fight HMR
     · the page is not secure     — service workers require https
                                    or localhost, and the table
                                    server speaks plain http over
                                    the LAN by design
     · ?mode=host or ?mode=client — a tab that is part of a live
                                    table. The Warden's laptop and
                                    the phones are talking to a
                                    relay on the same wifi; an
                                    interposed cache there can only
                                    subtract.

   The offline promise is aimed at the single-player and hosted-demo
   case, which is exactly where it is safe.
   ============================================================ */

export function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;
  if (!self.isSecureContext) return;

  const mode = new URLSearchParams(location.search).get("mode");
  if (mode === "host" || mode === "client") return;

  window.addEventListener("load", () => {
    /* Relative to the document, so one build registers correctly at a
       project page, a domain root, or a subdirectory. */
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {
      /* A refused registration is not an error worth showing anybody.
         The app works; it just will not work in a tunnel. */
    });
  });
}

export default registerServiceWorker;
