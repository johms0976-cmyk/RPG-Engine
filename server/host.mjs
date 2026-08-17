/* ============================================================
   THE TABLE SERVER — static files + a WebSocket relay.

   This process holds no game state and knows no rules. The one
   authoritative copy of the game lives in the host browser tab.
   All this does is hand out the app, route intents to the host,
   and fan snapshots back out to the phones.

   Run:  npm run host
   ============================================================ */
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import QRCode from "qrcode";

const ROOT = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const PORT = Number(process.env.PORT) || 8080;
const MAX_PLAYERS = Number(process.env.MAX_PLAYERS) || 6;

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ico": "image/x-icon",
};

/* ---------------- who we are on the network ---------------- */

function lanAddresses() {
  const out = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== "IPv4" || a.internal) continue;
      // 169.254.x.x is a self-assigned address — it means DHCP failed and
      // nothing else will be able to reach us on it.
      if (a.address.startsWith("169.254.")) continue;
      out.push({ name, address: a.address });
    }
  }
  return out;
}

const addrs = lanAddresses();
const primary = addrs[0] ? `http://${addrs[0].address}:${PORT}` : `http://localhost:${PORT}`;
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
      if (msg.t === "snapshot") { lastSnapshot = msg; broadcast(msg); }
      else if (msg.t === "denied") {
        for (const [sock, p] of players) if (p.clientId === msg.to) send(sock, msg);
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

server.listen(PORT, "0.0.0.0", () => {
  const line = "─".repeat(46);
  console.log(`\n${line}\n  MOTHERSHIP ENGINE — table server\n${line}`);
  console.log(`  Warden screen : ${primary}/?mode=host`);
  console.log(`  Players join  : ${primary}`);
  if (addrs.length > 1) {
    console.log(`\n  Other addresses on this machine:`);
    for (const a of addrs.slice(1)) console.log(`    ${a.address}  (${a.name})`);
    console.log(`  If phones can't connect, try one of those instead.`);
  }
  console.log(`\n  Up to ${MAX_PLAYERS} players. Ctrl-C to stop.\n${line}\n`);
});
