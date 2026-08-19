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
   ============================================================ */
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
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
  if (url.pathname === "/net/info") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ url: primary, addresses: addrs, maxPlayers: MAX_PLAYERS }));
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
const roster = () =>
  [...players.values()].map((p) => ({ clientId: p.clientId, name: p.name, pcId: p.pcId }));
const pushRoster = () => {
  const list = roster();
  send(host, { t: "peers", peers: list });
  broadcast({ t: "peers", peers: list });
};

wss.on("connection", (ws, req) => {
  const isHost = new URL(req.url, "http://x").searchParams.get("role") === "host";

  if (isHost) {
    // A second host tab would give you two authoritative copies of the
    // game diverging in real time. Only the newest one wins.
    if (host && host !== ws) { send(host, { t: "denied", reason: "another-host" }); host.close(); }
    host = ws;
    send(ws, { t: "welcome", isHost: true, peers: roster() });
    pushRoster();
  } else {
    if (players.size >= MAX_PLAYERS) {
      send(ws, { t: "denied", reason: "full" });
      return ws.close();
    }
    players.set(ws, { clientId: null, name: "…", pcId: null });
    if (lastSnapshot) send(ws, lastSnapshot);
  }

  ws.on("message", (raw) => {
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

    if (msg.t === "hello") {
      me.clientId = msg.clientId || `c_${Math.random().toString(36).slice(2, 8)}`;
      me.name = String(msg.name || "Player").slice(0, 24);
      send(ws, { t: "welcome", clientId: me.clientId, isHost: false, peers: roster() });
      if (lastSnapshot) send(ws, lastSnapshot);
      pushRoster();
      return;
    }

    if (msg.t === "claim") {
      const wanted = msg.pcId || null;
      // One character per phone, and no stealing someone else's.
      if (wanted && [...players.values()].some((p) => p !== me && p.pcId === wanted)) {
        return send(ws, { t: "denied", reason: "taken" });
      }
      me.pcId = wanted;
      send(host, { t: "claim", clientId: me.clientId, pcId: wanted });
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
