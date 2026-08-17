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
     MAX_PLAYERS=8      raise the player cap
   ============================================================ */
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import QRCode from "qrcode";

const ROOT = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const PORT = Number(process.env.PORT) || 8080;
const BIND = process.env.BIND || "0.0.0.0";
const MAX_PLAYERS = Number(process.env.MAX_PLAYERS) || 6;

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ico": "image/x-icon",
};

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

async function serveFile(res, path) {
  try {
    const s = await stat(path);
    if (!s.isFile()) throw new Error("not a file");
    const body = await readFile(path);
    res.writeHead(200, {
      "content-type": MIME[extname(path)] || "application/octet-stream",
      "cache-control": "no-cache",
    });
    res.end(body);
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
  if (await serveFile(res, join(ROOT, rel))) return;
  // Single-page app: anything unmatched falls back to the shell.
  if (await serveFile(res, join(ROOT, "index.html"))) return;

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("No build found. Run `npm run build` first, or use `npm run host`.");
});

/* ---------------- the relay ---------------- */

const wss = new WebSocketServer({ server, path: "/net" });

let host = null;                 // the one host-tab socket
const players = new Map();       // ws -> { clientId, name, pcId }
let lastSnapshot = null;         // replayed to anyone who joins or reconnects

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
      if (msg.t === "denied" || msg.t === "whisper") {
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
      send(host, { t: "submit", clientId: me.clientId, name: me.name, character: msg.character });
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
