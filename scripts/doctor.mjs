/* ============================================================
   DOCTOR — why can't anything reach the table server?

   Run it in a second terminal while `npm run host` is running:

       npm run doctor

   It answers three questions in order, because they fail in that
   order: is there a build, is the server listening, and can each
   of this machine's own addresses actually be connected to. The
   third is the one that catches a firewall — a blocked port looks
   exactly like a machine that isn't there, which is why the browser
   says "timed out" instead of "refused".
   ============================================================ */
import http from "node:http";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { networkInterfaces, platform, hostname } from "node:os";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT) || 8080;
const DIST = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const TIMEOUT = 4000;

const VIRTUAL = /(vethernet|virtualbox|vmware|hyper-?v|wsl|docker|loopback|tailscale|zerotier|tap-|tun|bluetooth|npcap|vpn|utun|hamachi)/i;

const ok = (s) => `  [ OK ]   ${s}`;
const bad = (s) => `  [ BAD ]  ${s}`;
const info = (s) => `           ${s}`;
const rule = () => console.log("─".repeat(58));

function interfaces() {
  const out = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== "IPv4" || a.internal) continue;
      out.push({
        name,
        address: a.address,
        virtual: VIRTUAL.test(name),
        selfAssigned: a.address.startsWith("169.254."),
      });
    }
  }
  return out;
}

/* Classify a connection attempt. The distinction between a refusal and a
   silent timeout is the whole diagnosis: refused means the packets arrived
   and nothing was listening; timed out means they were swallowed. */
function probe(address) {
  return new Promise((done) => {
    const req = http.get(
      { host: address, port: PORT, path: "/net/health", timeout: TIMEOUT },
      (res) => {
        res.resume();
        done(res.statusCode === 200 ? "ok" : `http ${res.statusCode}`);
      }
    );
    req.on("timeout", () => { req.destroy(); done("timeout"); });
    req.on("error", (e) => done(e.code === "ECONNREFUSED" ? "refused" : e.code || "error"));
  });
}

console.log("");
rule();
console.log("  MOTHERSHIP ENGINE — connection doctor");
rule();
console.log(info(`node ${process.version} on ${platform()}, host "${hostname()}", port ${PORT}`));
console.log("");

/* ---- 1. is there a build to serve? ---- */
if (existsSync(resolve(DIST, "index.html"))) {
  console.log(ok("A build exists in dist/"));
} else {
  console.log(bad("No build in dist/ — run `npm run build`, or use `npm run host`"));
}

/* ---- 2. is the server listening at all? ---- */
const loop = await probe("127.0.0.1");
if (loop === "ok") {
  console.log(ok(`The server is running and answering on http://localhost:${PORT}`));
} else if (loop === "refused") {
  console.log(bad(`Nothing is listening on port ${PORT}.`));
  console.log(info("Start it with `npm run host` in another terminal, then re-run this."));
  console.log("");
  rule();
  process.exit(0);
} else {
  console.log(bad(`localhost:${PORT} gave "${loop}" — unexpected. Security software?`));
}

/* ---- 3. can this machine's own addresses be reached? ---- */
const nics = interfaces();
console.log("");
if (!nics.length) {
  console.log(bad("No network adapters with a usable IPv4 address."));
  console.log(info("This PC isn't on a network, so no phone can join it."));
} else {
  console.log(info("Testing each address on this machine:"));
  console.log("");
}

const results = [];
for (const nic of nics) {
  const state = nic.selfAssigned ? "self-assigned" : await probe(nic.address);
  results.push({ ...nic, state });
  const label = `http://${nic.address}:${PORT}`.padEnd(28);
  const note = nic.virtual ? " (virtual adapter)" : "";
  if (state === "ok") console.log(ok(`${label} reachable — ${nic.name}${note}`));
  else if (state === "timeout") console.log(bad(`${label} TIMED OUT — ${nic.name}${note}`));
  else if (state === "self-assigned") console.log(bad(`${label} DHCP failed — ${nic.name}`));
  else console.log(bad(`${label} ${state} — ${nic.name}${note}`));
}

/* ---- the verdict ---- */
const reachable = results.filter((r) => r.state === "ok" && !r.virtual);
const timedOut = results.filter((r) => r.state === "timeout");

console.log("");
rule();
console.log("  VERDICT");
rule();

if (reachable.length) {
  console.log("");
  console.log("  These work. Give a phone on the same wifi one of them:");
  for (const r of reachable) console.log(`      http://${r.address}:${PORT}`);
  console.log("");
  console.log(`  Warden screen on this PC:  http://${reachable[0].address}:${PORT}/?mode=host`);
  console.log(`  Force the QR code to use one:  ADVERTISE=${reachable[0].address} npm run serve`);
} else if (timedOut.length) {
  console.log("");
  console.log("  The server is running, but connections to it are being");
  console.log("  swallowed rather than refused. That is a firewall, not a bug.");
  console.log("");
  if (platform() === "win32") {
    console.log("  Windows — run PowerShell **as Administrator** and paste:");
    console.log("");
    console.log(`      New-NetFirewallRule -DisplayName "Mothership Engine" \``);
    console.log(`        -Direction Inbound -Action Allow -Protocol TCP \``);
    console.log(`        -LocalPort ${PORT} -Profile Private`);
    console.log("");
    console.log("  Then make sure your wifi is a Private network, not Public:");
    console.log("      Settings → Network & internet → Wi-Fi → your network → Private");
    console.log("");
    console.log("  To undo it later:");
    console.log(`      Remove-NetFirewallRule -DisplayName "Mothership Engine"`);
    console.log("");
    console.log("  If you run Norton / McAfee / ESET / Bitdefender, it has its own");
    console.log("  firewall that ignores the rule above. Allow node.exe there too.");
  } else if (platform() === "darwin") {
    console.log("  macOS — System Settings → Network → Firewall → Options,");
    console.log("  and allow incoming connections for node.");
  } else {
    console.log(`  Linux — allow the port, e.g.  sudo ufw allow ${PORT}/tcp`);
  }
} else {
  console.log("");
  console.log("  Nothing conclusive. The server answers on localhost, so you can");
  console.log(`  still play on this PC alone at http://localhost:${PORT}/?mode=host`);
}

console.log("");
console.log("  Other things worth ruling out:");
console.log("    • Phone on mobile data or a guest wifi — it must be the same network.");
console.log("    • Router has AP isolation / client isolation on — devices can't see");
console.log("      each other. It's a checkbox in the router's wireless settings.");
console.log("    • A VPN client on this PC capturing the whole network stack.");
console.log("    • You typed the address of a virtual adapter. Use one marked OK above.");
console.log("");
rule();
console.log("");
