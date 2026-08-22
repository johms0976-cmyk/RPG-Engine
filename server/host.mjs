/* ============================================================
   THE TABLE SERVER — static files + a WebSocket relay.

   This process holds no game state and knows no rules. The one
   authoritative copy of the game lives in the host browser tab.
   All this does is hand out the app, route intents to the host,
   and fan snapshots back out to the phones.

   Run:  npm run host

   Environment overrides:
     PORT=3000          listen on a different port
     BIND=127.0.0.1     bind to one interface only (default 0.0.0.0)
     ADVERTISE=10.0.0.5 force the address printed and put in the QR
     MAX_PLAYERS=12     raise the player cap (default 8)
     HOST_TOKEN=abc123  fix the Warden's token instead of generating one
     OPEN_HOST=1        disable the token entirely (don't; see below)

   ------------------------------------------------------------
   THE TRUST MODEL, STATED

   This is a LAN server for a table of friends. It speaks ws://,
   not wss://, and it does not know who anybody is. That is a
   deliberate trade — a self-signed certificate costs every phone
   at the table a browser warning, and the threat is not a
   motivated attacker, it is the flat's other wifi clients.

   But "we trust the LAN" was doing more work than it could bear.
   Two things are now authenticated, because the cost of getting
   them wrong is the session rather than a packet:

     · BECOMING THE WARDEN. `?role=host` used to be a claim, and
       newest-wins meant anyone who could reach the socket could
       take the authority and disconnect the real Warden. It now
       requires the session token printed below.

     · BEING A PARTICULAR PLAYER. `clientId` used to be supplied
       by the phone and broadcast to every other phone, so a
       player could read someone else's out of the roster and
       reconnect as them — collecting the private, distorted
       snapshot that secrets.js and distort.js exist to protect.
       The server assigns it now, and it never goes on the wire
       to anybody but its owner.
   ============================================================ */
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { WebSocketServer } from "ws";
import QRCode from "qrcode";
import { HOST_TO_CLIENT, PEER_MODES } from "../src/net/protocol.js";

const ROOT = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const PORT = Number(process.env.PORT) || 8080;
const BIND = process.env.BIND || "0.0.0.0";
/* Eight, not six. `crewSize.max` in a module is six, and the cap
   used to be six too, so a table of six with a spare phone — or one
   player reconnecting before the relay has reaped their dead socket
   — got `denied: full` and no way to understand why. The cap exists
   to stop a stranger wandering in, not to be exactly the size of
   the party. */
const MAX_PLAYERS = Number(process.env.MAX_PLAYERS) || 8;

/* ---------------- the Warden's token ----------------

   Short and typeable, because the failure mode we are designing
   for is a Warden reading it off a terminal and typing it into a
   phone-sized box, not a cryptanalyst. 40 bits of base32 is ~1e12
   guesses; the relay also rate-limits upgrades, so an online
   attack against it is not a thing that finishes during a
   session.

   OPEN_HOST=1 restores the old behaviour for anyone who genuinely
   wants it — a solo Warden on an air-gapped laptop, or a test
   harness. It prints a warning, because silently unauthenticated
   is how this got shipped the first time. */
const OPEN_HOST = process.env.OPEN_HOST === "1";
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no l/i/o/0/1
const makeToken = (n = 8) => {
  const bytes = randomBytes(n);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
};
const SESSION_TOKEN = OPEN_HOST ? null : (process.env.HOST_TOKEN || makeToken());

/** Constant-time compare that does not leak length. */
function tokenOk(given) {
  if (OPEN_HOST) return true;
  if (!given || typeof given !== "string") return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(SESSION_TOKEN);
  if (a.length !== b.length) return false;
  try { return timingSafeEqual(a, b); } catch { return false; }
}

/* ---------------- rate limiting ----------------

   useIntentGate throttles a *cooperative* client — it is a UX
   device, not a control. A phone with the console open has no
   limit at all, and one player holding down Search is enough to
   make the host tab unusable for the other five.

   So: a token bucket per socket. Generous enough that nobody
   playing normally will ever see it (a burst of 30, refilling at
   10/sec) and low enough that a loop is stopped dead. Over budget
   messages are dropped silently rather than answered, because
   answering is work and the answer is what the flooder wants. */
const BUCKET_MAX = 30;
const BUCKET_REFILL_PER_SEC = 10;
/** Failed host-token attempts before that address is refused outright. */
const MAX_HOST_TRIES = 10;
const hostTries = new Map();       // ip -> count

function allow(state) {
  const now = Date.now();
  const elapsed = (now - state.last) / 1000;
  state.last = now;
  state.tokens = Math.min(BUCKET_MAX, state.tokens + elapsed * BUCKET_REFILL_PER_SEC);
  if (state.tokens < 1) return false;
  state.tokens -= 1;
  return true;
}

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ico": "image/x-icon",
  /* Modules may ship recordings — see modules/ypsilon14/audio.js.
     Served as octet-stream these mostly work and then mysteriously
     do not on one person's handset, which is the worst way to find
     out about a missing content-type. */
  ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".ogg": "audio/ogg",
  ".opus": "audio/ogg", ".wav": "audio/wav", ".webm": "audio/webm",
};

/** Extensions a browser will ask for in pieces. */
const SEEKABLE = new Set([".mp3", ".m4a", ".ogg", ".opus", ".wav", ".webm", ".mp4"]);

/** Is this request coming from the machine the server is running on?
    `::ffff:127.0.0.1` is what an IPv4 loopback looks like through a
    dual-stack socket, and missing it would mean the host tab never
    gets its token on exactly the setup that is most common. */
function isLoopback(req) {
  const ip = (req.socket && req.socket.remoteAddress) || "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip.startsWith("127.");
}

/** The address a socket appears to come from, for rate-limit buckets. */
const ipOf = (req) => ((req.socket && req.socket.remoteAddress) || "?").replace(/^::ffff:/, "");

/* ---------------- fail early, fail legibly ----------------
   Serving a directory that isn't there used to surface as a 404 in the
   browser long after the terminal had gone quiet. Check it up front. */

if (!existsSync(join(ROOT, "index.html"))) {
  console.error(
    `\n  No build found at ${ROOT}\n` +
    `  Run \`npm run build\` first, or just use \`npm run host\`,\n` +
    `  which builds and then starts this server.\n`
  );
  process.exit(1);
}

/* ---------------- who we are on the network ----------------

   networkInterfaces() returns adapters in whatever order the OS feels
   like. On a Windows machine with Hyper-V, WSL, VirtualBox, Docker or a
   VPN client installed, the first non-internal IPv4 is very often a
   virtual adapter that no phone on the wifi can reach — and a browser
   pointed at an address nothing answers on reports a *timeout*, not a
   refusal. So rank them instead of trusting the order. */

const VIRTUAL = /(vethernet|virtualbox|vmware|hyper-?v|wsl|docker|loopback|tailscale|zerotier|tap-|tun|bluetooth|npcap|vpn|utun|hamachi)/i;

function scoreAddress({ name, address }) {
  let score = 0;
  if (/^192\.168\./.test(address)) score += 40;          // home wifi, overwhelmingly
  else if (/^10\./.test(address)) score += 30;            // also common on home routers
  else if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) score += 10; // often Docker
  if (VIRTUAL.test(name)) score -= 50;                    // almost never the wifi
  if (/^(wi-?fi|wlan|en0|wlp)/i.test(name)) score += 15;  // named like real wifi
  if (/^(ethernet|eth0|enp)/i.test(name)) score += 12;
  return score;
}

function lanAddresses() {
  const out = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== "IPv4" || a.internal) continue;
      // 169.254.x.x is self-assigned — it means DHCP failed and nothing
      // else on the network will be able to reach us on it.
      if (a.address.startsWith("169.254.")) continue;
      out.push({ name, address: a.address, virtual: VIRTUAL.test(name) });
    }
  }
  return out.sort((a, b) => scoreAddress(b) - scoreAddress(a));
}

const addrs = lanAddresses();
const advertised =
  process.env.ADVERTISE ||
  (addrs[0] ? addrs[0].address : "localhost");
const primary = `http://${advertised}:${PORT}`;
const localUrl = `http://localhost:${PORT}`;

let qrSvg = "";
try { qrSvg = await QRCode.toString(primary, { type: "svg", margin: 1 }); } catch { /* optional */ }

/* ---------------- static files ---------------- */

/* MEDIA IS NOT FETCHED, IT IS SEEKED.

   Everything this server handed out until now was small and was
   wanted whole: a bundle, a stylesheet, a font. Audio is neither.
   Safari — which is every iPhone at the table, whatever browser is
   painted on the front of it — opens a media element by asking for
   `Range: bytes=0-1` and expects `206 Partial Content` back. A
   server that replies 200 with the whole file is telling it the
   resource is not seekable, and Safari's response to that is to
   refuse to play at all rather than to fall back.

   So: advertise ranges, and answer them. Everything unranged
   behaves exactly as it did before. */

function rangeOf(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header || "").trim());
  if (!m) return null;
  const [, rawStart, rawEnd] = m;
  if (rawStart === "" && rawEnd === "") return null;
  // "bytes=-500" means the last 500 bytes, not "up to 500".
  let start = rawStart === "" ? size - Number(rawEnd) : Number(rawStart);
  let end = rawStart === "" || rawEnd === "" ? size - 1 : Number(rawEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  start = Math.max(0, start);
  end = Math.min(size - 1, end);
  if (start > end) return { unsatisfiable: true };
  return { start, end };
}

async function serveFile(res, path, req = null) {
  try {
    const s = await stat(path);
    if (!s.isFile()) throw new Error("not a file");

    const ext = extname(path);
    const type = MIME[ext] || "application/octet-stream";
    const seekable = SEEKABLE.has(ext);

    if (seekable && req && req.headers.range) {
      const r = rangeOf(req.headers.range, s.size);
      if (r && r.unsatisfiable) {
        res.writeHead(416, { "content-range": `bytes */${s.size}` });
        res.end();
        return true;
      }
      if (r) {
        const body = await readFile(path);
        res.writeHead(206, {
          "content-type": type,
          "content-range": `bytes ${r.start}-${r.end}/${s.size}`,
          "accept-ranges": "bytes",
          "content-length": r.end - r.start + 1,
          // Bundled media is content-hashed by Vite, so it may be held
          // for the whole evening rather than re-fetched on every seek.
          "cache-control": "public, max-age=86400",
        });
        res.end(body.subarray(r.start, r.end + 1));
        return true;
      }
    }

    const body = await readFile(path);
    res.writeHead(200, {
      "content-type": type,
      "content-length": s.size,
      ...(seekable
        ? { "accept-ranges": "bytes", "cache-control": "public, max-age=86400" }
        : { "cache-control": "no-cache" }),
    });
    // A HEAD is how a media element checks size and seekability.
    if (req && req.method === "HEAD") res.end();
    else res.end(body);
    return true;
  } catch { return false; }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");

  // Cheap liveness probe. `npm run doctor` uses it, and so can you:
  // load http://<ip>:8080/net/health on a phone to test reachability
  // without waiting for the whole app to boot.
  if (url.pathname === "/net/health") {
    res.writeHead(200, { "content-type": "text/plain", "cache-control": "no-cache" });
    return res.end("ok");
  }
  if (url.pathname === "/net/qr.svg") {
    res.writeHead(200, { "content-type": "image/svg+xml", "cache-control": "no-cache" });
    return res.end(qrSvg || "<svg xmlns='http://www.w3.org/2000/svg'/>");
  }
  /* THE TOKEN LEAVES HERE, AND ONLY HERE.

     The host tab runs on the same machine as this process, so it
     can be handed the token automatically and the Warden never
     sees it. A phone cannot, because a phone is not on loopback —
     it gets the same JSON with the field absent.

     A Warden who genuinely wants the host screen on another
     machine reads the token off the terminal and types it in;
     that is a deliberate speed bump on the one action that can
     end everyone else's evening. */
  if (url.pathname === "/net/info") {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-cache" });
    return res.end(JSON.stringify({
      url: primary,
      addresses: addrs,
      maxPlayers: MAX_PLAYERS,
      /* Whether a token is needed at all, so the host tab can skip
         asking for one under OPEN_HOST rather than showing an empty
         box the Warden cannot fill. */
      tokenRequired: !OPEN_HOST,
      ...(isLoopback(req) && SESSION_TOKEN ? { token: SESSION_TOKEN } : {}),
    }));
  }

  // normalize() before join() — without it a request for ../../etc/passwd
  // walks straight out of the served directory.
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  if (await serveFile(res, join(ROOT, rel), req)) return;
  // Single-page app: anything unmatched falls back to the shell.
  if (await serveFile(res, join(ROOT, "index.html"), req)) return;

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("No build found. Run `npm run build` first, or use `npm run host`.");
});

/* ---------------- the relay ---------------- */

const wss = new WebSocketServer({ server, path: "/net" });

let host = null;                 // the one host-tab socket
const players = new Map();       // ws -> { clientId, name, pcId }
let lastSnapshot = null;         // replayed to anyone who joins or reconnects

/* HOW MUCH OF A PLAYER-TO-PLAYER WHISPER THE WARDEN IS SHOWN.

   Set by the host tab, applied here, and deliberately not applied
   there. The obvious design is to forward everything to the Warden's
   screen and have it decline to render what it should not see — but
   that is a promise not to look, and this file already establishes
   (see the X-card below) that a promise is weaker than never being
   sent it. A table that agreed to "dark" has secrets that do not
   exist outside the two phones holding them.

     open  the Warden sees the text
     seen  the Warden is told a whisper happened, and between whom
     dark  the Warden is told nothing at all */
let peerMode = "seen";

const send = (ws, obj) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); };
const broadcast = (obj) => { for (const ws of players.keys()) send(ws, obj); };

/* TWO ROSTERS, AND THE DIFFERENCE IS THE POINT.

   The host needs clientId — it is the key every claim, whisper and
   per-player snapshot is routed by. The phones never did. They
   render names and work out who has which character; `clientId`
   was in their copy because it was in the object, and that
   incidental inclusion was the credential leak in §9.2.

   A phone that is never sent an identifier cannot replay one. */
const roster = (withIds = false) =>
  [...players.values()]
    .filter((p) => p.clientId)
    .map((p) => (withIds
      ? { clientId: p.clientId, name: p.name, pcId: p.pcId }
      : { name: p.name, pcId: p.pcId }));

const pushRoster = () => {
  send(host, { t: "peers", peers: roster(true) });
  broadcast({ t: "peers", peers: roster(false) });
};

/* A phone's private reconnect secret -> the id we gave it. Lives only
   here; nothing serialises it and nothing broadcasts it. */
const resumeKeys = new Map();    // resumeKey -> clientId

wss.on("connection", (ws, req) => {
  const params = new URL(req.url, "http://x").searchParams;
  const wantsHost = params.get("role") === "host";
  const ip = ipOf(req);

  ws._bucket = { tokens: BUCKET_MAX, last: Date.now() };

  if (wantsHost) {
    /* AUTHORITY IS NOW EARNED RATHER THAN CLAIMED.

       This used to be a bare string comparison against the query
       string, and newest-wins: anybody who had scanned the QR code
       — plus everybody else on the café, hotel or house wifi —
       could connect with ?role=host, become the authoritative copy
       of the game, and boot the actual Warden off their own table.
       At best the evening ended. At worst a player was holding the
       screen with everyone's secrets on it. */
    const tries = hostTries.get(ip) || 0;
    if (tries >= MAX_HOST_TRIES) {
      send(ws, { t: "denied", reason: "host-locked" });
      return ws.close();
    }
    if (!tokenOk(params.get("token"))) {
      hostTries.set(ip, tries + 1);
      console.warn(`  [auth] refused a host connection from ${ip} (${tries + 1}/${MAX_HOST_TRIES})`);
      send(ws, { t: "denied", reason: "bad-token" });
      return ws.close();
    }
    hostTries.delete(ip);

    // A second host tab would give you two authoritative copies of the
    // game diverging in real time. Only the newest one wins — but only
    // a newest one that proved it is allowed to be here at all.
    if (host && host !== ws) { send(host, { t: "denied", reason: "another-host" }); host.close(); }
    host = ws;
    send(ws, { t: "welcome", isHost: true, peers: roster(true) });
    pushRoster();
  } else {
    if (players.size >= MAX_PLAYERS) {
      send(ws, { t: "denied", reason: "full" });
      return ws.close();
    }
    /* NO SNAPSHOT BEFORE HELLO.

       This used to replay `lastSnapshot` to the socket the instant
       it connected. The generic snapshot is redaction-safe, so
       nothing private leaked — but it meant anyone who could open a
       WebSocket got a live read of the game without ever saying who
       they were. The wait is one round trip and it costs a real
       player nothing. */
    players.set(ws, { clientId: null, name: "…", pcId: null, greeted: false });
  }

  ws.on("message", (raw) => {
    // Cheap first: a flood should cost us a clock read, not a parse.
    if (!allow(ws._bucket)) return;
    if (typeof raw === "string" ? raw.length > 64000 : raw.length > 64000) return;
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (ws === host) {
      if (msg.t === "snapshot") {
        // The host packs one generic snapshot plus a per-client map of
        // redacted, distorted copies. Splitting it here is load-bearing:
        // forwarding the bundle intact would hand every phone every other
        // player's secrets, which is the exact failure the redaction is
        // there to prevent. perPlayer never leaves this function.
        const { perPlayer, ...generic } = msg;
        lastSnapshot = generic;
        for (const [sock, p] of players) {
          const mine = perPlayer && p.clientId && perPlayer[p.clientId];
          send(sock, mine || generic);
        }
        return;
      }
      if (msg.t === "config") {
        if (PEER_MODES.includes(msg.peerWhispers)) peerMode = msg.peerWhispers;
        return;
      }
      // Anything the host addresses to one phone. The allowlist lives in
      // protocol.js so the three sides cannot drift: a message type not
      // named there goes nowhere rather than to everyone.
      if (HOST_TO_CLIENT.has(msg.t)) {
        for (const [sock, p] of players) if (p.clientId === msg.to) send(sock, msg);
        return;
      }
      return;
    }

    const me = players.get(ws);
    if (!me) return;

    /* WHO YOU ARE IS NOT YOURS TO SAY.

       `me.clientId = msg.clientId` was the whole of the old
       identity check. Combined with a roster that broadcast every
       clientId to every phone, it meant a player could read
       another player's id off a message they were legitimately
       sent, reconnect claiming it, and start receiving that
       player's per-client snapshot — the redacted, *distorted*
       one, carrying exactly the hallucination timers and phobia
       triggers that secrets.js and distort.js exist to keep from
       them. All that careful work was bypassed by reading a field.

       So the server assigns the id. What the phone keeps instead
       is a `resume` key: a secret it generated, that it sends but
       never receives from anyone else, and that nothing broadcasts.
       Reconnecting with the right key gets the same clientId — so a
       phone that slept through a scene still comes back as itself —
       and knowing another player's *name* gets you nothing, because
       the name was never the credential. */
    if (msg.t === "hello") {
      if (me.greeted) return;             // one hello per socket
      const key = typeof msg.resume === "string" && msg.resume.length >= 8
        ? msg.resume.slice(0, 64) : null;

      let id = key ? resumeKeys.get(key) : null;
      // An id already in use by a live socket is a reconnect racing its
      // own corpse, or two tabs sharing storage. The newcomer gets a
      // fresh identity rather than inheriting a claim.
      if (id && [...players.values()].some((p) => p !== me && p.clientId === id)) id = null;
      if (!id) {
        id = `c_${randomBytes(9).toString("base64url")}`;
        if (key) resumeKeys.set(key, id);
      }

      me.clientId = id;
      me.greeted = true;
      me.name = String(msg.name || "Player").slice(0, 24);
      // The one place a clientId is ever sent: to the socket it belongs to.
      send(ws, { t: "welcome", clientId: me.clientId, isHost: false, peers: roster() });
      if (lastSnapshot) send(ws, lastSnapshot);
      pushRoster();
      return;
    }

    // Everything below identifies the sender by their assigned id, so a
    // socket that never said hello has no business sending any of it.
    if (!me.clientId) return;

    if (msg.t === "claim") {
      const wanted = msg.pcId || null;
      // One character per phone, and no stealing someone else's.
      if (wanted && [...players.values()].some((p) => p !== me && p.pcId === wanted)) {
        return send(ws, { t: "denied", reason: "taken" });
      }
      me.pcId = wanted;
      send(host, { t: "claim", clientId: me.clientId, pcId: wanted });
      /* Answered to the socket that asked. The broadcast roster no
         longer identifies phones, so a phone cannot confirm its own
         claim by finding itself in the list — and being told directly
         was always the better answer than inferring it. */
      send(ws, { t: "claimed", pcId: wanted });
      pushRoster();
      return;
    }

    if (msg.t === "submit") {
      // A character offered from a phone goes to the Warden, never
      // straight into the crew. Approval is the Warden's call.
      if (!host) return send(ws, { t: "denied", reason: "no-warden" });
      send(host, { t: "submit", clientId: me.clientId, name: me.name, character: msg.character });
      return;
    }

    if (msg.t === "withdraw") {
      send(host, { t: "withdraw", clientId: me.clientId });
      return;
    }

    /* A player whispering back. Identified, unlike the safety card
       below: the Warden needs to know whose keycard it is. */
    if (msg.t === "playerwhisper") {
      if (!host) return send(ws, { t: "denied", reason: "no-warden" });
      send(host, {
        t: "playerwhisper",
        clientId: me.clientId,
        name: me.name,
        pcId: me.pcId,
        replyTo: msg.replyTo || null,
        text: String(msg.text || "").slice(0, 400),
      });
      return;
    }

    /* ONE PLAYER LEANING OVER TO ANOTHER.

       Routed by character rather than by phone, because a player
       knows who Riley is and has never seen a clientId. Two players
       plotting is Mothership content — the game runs on paranoia and
       every secret in it used to have to pass through the Warden,
       which is the one thing a conspiracy cannot do.

       The Warden's copy is governed by peerMode above and assembled
       here rather than forwarded, so "seen" cannot accidentally carry
       the text. */
    if (msg.t === "peerwhisper") {
      const toPcId = msg.toPcId || null;
      if (!toPcId || !me.pcId || toPcId === me.pcId) return;
      const text = String(msg.text || "").slice(0, 400);
      if (!text) return;

      let delivered = false;
      for (const [sock, p] of players) {
        if (p.pcId !== toPcId) continue;
        send(sock, { t: "peerwhisper", from: me.name, fromPcId: me.pcId, text });
        delivered = true;
      }
      // Told to the sender, so a whisper into a disconnected phone is
      // not mistaken for a whisper that landed.
      send(ws, { t: "ack", state: delivered ? "whispered" : "nobody-there" });

      if (host && peerMode !== "dark") {
        send(host, {
          t: "peernote",
          fromPcId: me.pcId,
          toPcId,
          text: peerMode === "open" ? text : undefined,
        });
      }
      return;
    }

    /* THE X-CARD, AND WHY IT ARRIVES NAKED.

       Everything else a phone sends is stamped with clientId so the
       host can answer it. This one is not, and that is the entire
       feature. A safety card that identifies its sender is a card
       nobody at a table of friends will press — the whole point is to
       stop the scene without having to be the person who stopped the
       scene. So the relay drops the identity here rather than asking
       the host to promise not to look at it: what never leaves this
       function cannot be displayed, logged or leaked by a bug
       upstream. The Warden learns that someone pressed it. That is
       all anyone needs. */
    if (msg.t === "safety") {
      if (!host) return;
      const level = ["check", "veil", "stop"].includes(msg.level) ? msg.level : "check";
      send(host, { t: "safety", level });
      // The sender gets a private confirmation, so they know it landed
      // without anything appearing on a screen anyone else can see.
      send(ws, { t: "safetyack", level });
      return;
    }

    /* A tap the phone's gate ate. The port of this lives in
       src/net/rtcRelay.js and the two must agree — see
       tests/rtcrelay.test.js. Ownership comes from the server's
       record, never the message, and a phone holding no character
       is reporting about nothing. */
    if (msg.t === "tap") {
      if (!host || !me.pcId) return;
      send(host, { t: "tap", clientId: me.clientId, asPc: me.pcId, action: msg.action });
      return;
    }

    if (msg.t === "intent") {
      // Server-side ownership check. The host checks again; neither
      // trusts the phone's own claim about which character it is.
      if (!me.pcId || msg.asPc !== me.pcId) return send(ws, { t: "denied", reason: "not-yours" });
      send(host, { ...msg, clientId: me.clientId, asPc: me.pcId });
    }
  });

  ws.on("close", () => {
    if (ws === host) { host = null; broadcast({ t: "hostgone" }); return; }
    players.delete(ws);
    pushRoster();
  });
});

/* ---------------- start, and say something useful ---------------- */

/* ws re-emits the http server's errors on the WebSocketServer, and an
   'error' with no listener is a hard throw — so a port clash would crash
   with a stack trace before this handler ever ran. Both get it, once. */
let dying = false;
function fatal(err) {
  if (dying) return;
  dying = true;
  if (err.code === "EADDRINUSE") {
    console.error(
      `\n  Port ${PORT} is already in use — something else has it,\n` +
      `  possibly an older copy of this server still running.\n` +
      `  Try:  PORT=3000 npm run serve      (macOS / Linux)\n` +
      `        set PORT=3000&& npm run serve  (Windows cmd)\n` +
      `        $env:PORT=3000; npm run serve  (PowerShell)\n`
    );
  } else if (err.code === "EACCES") {
    console.error(`\n  Not allowed to bind port ${PORT}. Pick a port above 1024.\n`);
  } else {
    console.error(err);
  }
  process.exit(1);
}

server.on("error", fatal);
wss.on("error", fatal);

server.listen(PORT, BIND, () => {
  const line = "─".repeat(58);
  console.log(`\n${line}\n  MOTHERSHIP ENGINE — table server\n${line}`);
  console.log(`  On this PC (always works):`);
  console.log(`    Warden screen : ${localUrl}/?mode=host`);
  console.log(`\n  For phones on the same wifi:`);
  console.log(`    Players join  : ${primary}`);
  console.log(`    Warden screen : ${primary}/?mode=host`);

  /* The token is only needed by a Warden running the host screen
     somewhere other than this machine — the local tab collects it
     from /net/info without anybody reading anything. Say so, or
     the first reaction to a printed secret is to type it in. */
  if (SESSION_TOKEN) {
    console.log(`\n  Warden token  : ${SESSION_TOKEN}`);
    console.log(`    The Warden screen on THIS PC picks this up by itself.`);
    console.log(`    You only need to type it if you run the Warden screen on`);
    console.log(`    another device. Players never need it and never see it.`);
  } else {
    console.log(`\n  ⚠  OPEN_HOST=1 — the Warden screen is unauthenticated.`);
    console.log(`     Anyone who can reach this port can take over the table.`);
  }

  if (addrs.length > 1) {
    console.log(`\n  Other addresses on this machine, best guess first:`);
    for (const a of addrs) {
      const tag = a.virtual ? "  ← virtual adapter, phones can't reach this" : "";
      console.log(`    http://${a.address}:${PORT}   (${a.name})${tag}`);
    }
    console.log(`    Pick another with:  ADVERTISE=192.168.1.20 npm run serve`);
  }
  if (!addrs.length) {
    console.log(`\n  No network adapter found with a normal address. Phones will`);
    console.log(`  not be able to join until this PC is on a wifi or ethernet.`);
  }

  console.log(`\n  If ${primary} times out, the server is fine and something is`);
  console.log(`  dropping the connection — nearly always the Windows firewall.`);
  console.log(`  Run \`npm run doctor\` in a second terminal for the exact fix.`);
  console.log(`\n  Up to ${MAX_PLAYERS} players. Ctrl-C to stop.\n${line}\n`);
});
