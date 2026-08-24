/* ============================================================
   DOCTOR — why can't anything reach the table server?

   Run it in a second terminal while `npm run host` is running:

       npm run doctor          (or Doctor.bat on Windows)

   ------------------------------------------------------------
   WHAT THE OLD VERSION OF THIS FILE GOT WRONG

   It diagnosed the firewall by connecting from this machine to
   this machine's own LAN address, and reported success as proof
   that a phone could connect too.

   It is not proof. Windows routes a connection to your own IP
   through the loopback path and permits it unconditionally —
   packets that never touch a network adapter are never evaluated
   against an inbound rule. So the probe returned 200 OK on a
   machine where every real inbound connection was being dropped,
   printed "These work. Give a phone one of them", and sent the
   user off to try an address that could not possibly answer.

   A self-probe can prove the server is up. It cannot prove
   anybody else can reach it. Those are different questions and
   this version keeps them apart.

   So the firewall is diagnosed by reading the firewall, not by
   inferring it from a connection that bypasses the firewall.
   ============================================================ */

import http from "node:http";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { networkInterfaces, platform, hostname } from "node:os";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT) || 8080;
const DIST = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const TIMEOUT = 4000;
const WIN = platform() === "win32";

const VIRTUAL = /(vethernet|virtualbox|vmware|hyper-?v|wsl|docker|loopback|tailscale|zerotier|tap-|tun|bluetooth|npcap|vpn|utun|hamachi)/i;

const ok = (s) => console.log(`  [ OK ]   ${s}`);
const bad = (s) => console.log(`  [ BAD ]  ${s}`);
const warn = (s) => console.log(`  [ ??  ]  ${s}`);
const info = (s) => console.log(`           ${s}`);
const say = (s) => console.log(`  ${s}`);
const rule = () => console.log("─".repeat(58));
const gap = () => console.log("");

/* ---------------- adapters ---------------- */

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

/* ---------------- probes ---------------- */

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

/* ---------------- windows firewall, read directly ----------------

   Three questions, and the first is the one everybody misses.

   BLOCK RULES FOR NODE.EXE. The first time node opens a listening
   socket, Windows raises the "Allow node.js to communicate on
   these networks?" dialog. Cancel, Escape, clicking elsewhere, or
   simply not noticing it writes inbound BLOCK rules for that
   node.exe and keeps them forever. Block beats allow in Windows
   Firewall, so every "just add a rule for port 8080" fix on the
   internet fails silently on a machine in this state — and the
   machine gives no sign it is in this state.

   THE ALLOW RULE. Absent unless somebody added it.

   THE NETWORK CATEGORY. A rule scoped to Private is inert on a
   network Windows has filed as Public, which is the default for
   any wifi where the "make this PC discoverable?" prompt was
   dismissed. Two things that each look fine, that together do
   nothing.                                                        */

function ps(script) {
  try {
    const out = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      { encoding: "utf8", timeout: 45000, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] }
    );
    const text = out.trim();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return undefined; // undefined = couldn't ask; null = asked, empty answer
  }
}

function firewallReport() {
  const report = {};

  report.blockers = ps(`
    $r = Get-NetFirewallApplicationFilter |
         Where-Object { $_.Program -and $_.Program -like '*node.exe' } |
         Get-NetFirewallRule -ErrorAction SilentlyContinue |
         Where-Object { $_.Direction -eq 'Inbound' -and $_.Action -eq 'Block' } |
         Select-Object DisplayName, Profile, Enabled
    if ($r) { @($r) | ConvertTo-Json -Compress -Depth 3 } else { '[]' }
  `);

  report.allow = ps(`
    $r = Get-NetFirewallRule -Direction Inbound -Action Allow -Enabled True -ErrorAction SilentlyContinue |
         Where-Object { ($_ | Get-NetFirewallPortFilter).LocalPort -contains '${PORT}' } |
         Select-Object DisplayName, Profile
    if ($r) { @($r) | ConvertTo-Json -Compress -Depth 3 } else { '[]' }
  `);

  report.profiles = ps(`
    $r = Get-NetConnectionProfile -ErrorAction SilentlyContinue |
         Select-Object Name, InterfaceAlias, NetworkCategory
    if ($r) { @($r) | ConvertTo-Json -Compress -Depth 3 } else { '[]' }
  `);

  report.firewallOn = ps(`
    $r = Get-NetFirewallProfile -ErrorAction SilentlyContinue |
         Select-Object Name, Enabled
    if ($r) { @($r) | ConvertTo-Json -Compress -Depth 3 } else { '[]' }
  `);

  return report;
}

const asArray = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

/* ============================================================
   THE RUN
   ============================================================ */

gap();
rule();
say("MOTHERSHIP ENGINE — connection doctor");
rule();
info(`node ${process.version} on ${platform()}, host "${hostname()}", port ${PORT}`);
gap();

/* ---- 1. is there a build to serve? ---- */

if (existsSync(resolve(DIST, "index.html"))) {
  ok("A build exists in dist/");
} else {
  bad("No build in dist/ — run `npm run build`, or use `npm run host`");
}

/* ---- 2. is the server listening at all? ---- */

const loop = await probe("127.0.0.1");
let serverUp = false;

if (loop === "ok") {
  ok(`The server is running and answering on http://localhost:${PORT}`);
  serverUp = true;
} else if (loop === "refused") {
  bad(`Nothing is listening on port ${PORT}.`);
  info("Start it with `npm run host` (or Play.bat) in another window,");
  info("then run this again. Everything below needs it running.");
} else {
  bad(`localhost:${PORT} gave "${loop}" — unexpected. Security software?`);
}

/* ---- 3. adapters ---- */

const nics = interfaces();
gap();

if (!nics.length) {
  bad("No network adapters with a usable IPv4 address.");
  info("This PC isn't on a network, so no phone can join it.");
} else {
  const real = nics.filter((n) => !n.virtual && !n.selfAssigned);
  say("Addresses on this machine:");
  gap();
  for (const n of nics) {
    const label = `http://${n.address}:${PORT}`.padEnd(28);
    if (n.selfAssigned) bad(`${label} DHCP failed — ${n.name}`);
    else if (n.virtual) warn(`${label} virtual adapter — ${n.name} (phones can't reach this)`);
    else ok(`${label} real adapter — ${n.name}`);
  }
  gap();
  if (real.length) {
    info("These are the candidates. Whether a phone can actually open");
    info("one is decided by the firewall, checked next — this machine");
    info("connecting to its own address proves nothing either way,");
    info("because that traffic never leaves the machine.");
  } else {
    bad("Every address here is virtual or self-assigned. A phone has");
    info("nothing to connect to. Check this PC is really on the wifi.");
  }
}

/* ---- 4. the firewall, for real ---- */

gap();
rule();
say("FIREWALL");
rule();
gap();

let verdict = "unknown";

if (WIN) {
  const fw = firewallReport();

  if (fw.blockers === undefined) {
    warn("Could not read the Windows firewall rules from here.");
    info("PowerShell refused or timed out. Run Doctor.bat instead,");
    info("or check by hand in Windows Defender Firewall > Advanced.");
  } else {
    const blockers = asArray(fw.blockers);
    const allow = asArray(fw.allow);
    const profiles = asArray(fw.profiles);
    const fwProfiles = asArray(fw.firewallOn);

    /* the buried mine */
    if (blockers.length) {
      bad(`${blockers.length} inbound BLOCK rule(s) exist for node.exe.`);
      for (const b of blockers) info(`· ${b.DisplayName}  [profile ${b.Profile}]`);
      gap();
      info("This is the answer. Windows wrote these when the 'Allow");
      info("node.js to communicate...' dialog was dismissed instead of");
      info("accepted, and a block rule overrides any allow rule — so");
      info("adding a port rule on top would change nothing at all.");
      verdict = "blocked";
    } else {
      ok("No node.exe block rules. Nothing is silently dropping you.");
    }

    /* the allow rule */
    gap();
    if (allow.length) {
      ok(`An inbound allow rule exists for TCP ${PORT}:`);
      for (const a of allow) info(`· ${a.DisplayName}  [profile ${a.Profile}]`);
    } else {
      bad(`No inbound allow rule for TCP ${PORT}.`);
      info("Phones will be dropped unless the firewall is off entirely.");
      if (verdict === "unknown") verdict = "no-rule";
    }

    /* the category */
    gap();
    if (!profiles.length) {
      warn("Could not read the network category (Public vs Private).");
    } else {
      for (const p of profiles) {
        if (p.NetworkCategory === "Public") {
          bad(`"${p.Name}" (${p.InterfaceAlias}) is PUBLIC.`);
          info("A rule scoped to Private does nothing on a Public network,");
          info("and Windows blocks inbound discovery there by design.");
          if (verdict === "unknown") verdict = "public";
        } else {
          ok(`"${p.Name}" (${p.InterfaceAlias}) is ${p.NetworkCategory}.`);
        }
      }
    }

    /* firewall off entirely is worth saying out loud */
    const off = fwProfiles.filter((p) => p.Enabled === false || p.Enabled === "False" || p.Enabled === 0);
    if (off.length && !blockers.length) {
      gap();
      warn(`Firewall is OFF for: ${off.map((p) => p.Name).join(", ")}`);
      info("Connections should get through, so if they still don't, the");
      info("problem is the router or a third-party antivirus, not this.");
    }

    if (verdict === "unknown" && allow.length && !blockers.length) verdict = "clear";
  }
} else if (platform() === "darwin") {
  info("macOS — System Settings > Network > Firewall > Options,");
  info("and allow incoming connections for node.");
} else {
  info(`Linux — allow the port, e.g.  sudo ufw allow ${PORT}/tcp`);
  info("and check with:  sudo ufw status");
}

/* ---- 5. verdict ---- */

gap();
rule();
say("WHAT TO DO");
rule();
gap();

if (WIN && (verdict === "blocked" || verdict === "no-rule" || verdict === "public")) {
  say("Run the fix. It needs administrator, so it is a separate step:");
  gap();
  say("    Doctor.bat            and answer y");
  gap();
  say("  or, directly:");
  gap();
  say("    powershell -ExecutionPolicy Bypass -File scripts\\firewall.ps1");
  gap();
  say("It deletes the node.exe block rules, adds an allow rule for");
  say(`TCP ${PORT}, and offers to reclassify the wifi as Private.`);
  say("All three, in that order, because any one alone is not enough.");
} else if (WIN && verdict === "clear") {
  say("The firewall looks correct. If a phone still cannot connect,");
  say("this PC is no longer the suspect. In likelihood order:");
  gap();
  say("  1. Third-party antivirus with its own firewall — Norton,");
  say("     McAfee, ESET, Bitdefender, Avast, Kaspersky. It ignores");
  say("     everything above. Allow node.exe inbound inside it.");
  say("  2. Router AP / client isolation, which stops wifi devices");
  say("     seeing each other at all. Common on mesh systems and on");
  say("     ISP-supplied routers. Look for 'AP isolation', 'client");
  say("     isolation', or 'guest network' in the wireless settings.");
  say("  3. Phone on a different SSID — a guest network, or a 2.4/5GHz");
  say("     split published as two names, or mobile data with the");
  say("     wifi bar showing but not actually attached.");
  say("  4. A VPN on either device capturing the whole stack.");
} else if (!serverUp) {
  say("Start the server first, then run this again — most of the");
  say("questions above cannot be answered while it is down.");
} else {
  say("Nothing conclusive from here.");
  say(`Solo play still works on this PC at http://localhost:${PORT}/?mode=host`);
}

/* ---- 6. how to actually test it ---- */

const real = nics.filter((n) => !n.virtual && !n.selfAssigned);
if (real.length && serverUp) {
  gap();
  rule();
  say("TEST IT FROM THE PHONE, NOT FROM HERE");
  rule();
  gap();
  say("Type this into the phone's browser. It is one word of plain");
  say("text, so it answers instantly and tells you about the network");
  say("without the app's loading time confusing the result:");
  gap();
  for (const n of real) say(`    http://${n.address}:${PORT}/net/health`);
  gap();
  say("  says 'ok'      the network is fine — open the same address");
  say("                 without /net/health to play");
  say("  spins, times   packets are being swallowed. Firewall, or the");
  say("  out            router isolating its own clients");
  say("  refused /      wrong address, or the server stopped");
  say("  can't connect  ");
}

gap();
rule();
gap();
