/* ============================================================
   TUNNEL — play with people who are not in the building.

       npm run tunnel

   ------------------------------------------------------------
   WHY THIS EXISTS AND WHY IT IS NOT PORT FORWARDING

   The obvious answer to "we're not on the same wifi" is to
   forward a port on the router. For a lot of people it cannot
   work at all: most home internet in New Zealand, Australia and
   increasingly everywhere else is behind CGNAT, meaning the
   router's "public" address is shared with hundreds of other
   customers and there is no port on it that belongs to you. No
   amount of router configuration produces one.

   It is also the wrong shape even where it works: it puts a
   plain-http server holding a session token on the open internet
   and asks a person mid-session to reason about that.

   A tunnel sidesteps both. cloudflared makes an OUTBOUND
   connection from this PC and gets back an https URL that
   forwards to it. Nothing is opened on the router, CGNAT is
   irrelevant, and the players get TLS.

   ------------------------------------------------------------
   THE RTC PATH IS STILL THERE

   src/net/rtcRelay.js does browser-to-browser with pasted codes
   and no server in the middle, and for two or three people who
   can copy a code into a chat window it is the better answer —
   nothing is exposed, no third party carries the traffic.

   It fails on symmetric NAT with no TURN server, which is most
   mobile networks. This is the fallback for when it does, and
   for tables of five who do not want to run a handshake five
   times.

   ------------------------------------------------------------
   THE TOKEN

   The table server hands the Warden token to loopback callers,
   because loopback used to mean "the person sitting at this PC".
   Through a tunnel every request arrives from loopback. Without
   the matching change in server/host.mjs, /net/info would hand
   the token to anyone on the internet who asked for it.

   This sets BEHIND_PROXY=1, which that change reads. If you have
   not applied it, do not use this script — check for the string
   BEHIND_PROXY in server/host.mjs first. This refuses to start
   without it rather than quietly publishing a takeover code.
   ============================================================ */

import { spawn, execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT) || 8080;
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const HOST_MJS = resolve(ROOT, "server", "host.mjs");

const line = "─".repeat(58);
const say = (s) => console.log(`  ${s}`);

console.log(`\n${line}\n  MOTHERSHIP ENGINE — internet tunnel\n${line}\n`);

/* ---------------- refuse to leak the token ---------------- */

if (!existsSync(HOST_MJS) || !readFileSync(HOST_MJS, "utf8").includes("BEHIND_PROXY")) {
  console.error(
    `  server/host.mjs has not been updated for tunnelling.\n\n` +
    `  Through a tunnel every request looks like it came from this\n` +
    `  machine, so /net/info would hand the Warden token to anyone\n` +
    `  on the internet who loaded it. That is a table takeover, not\n` +
    `  a theoretical risk.\n\n` +
    `  Apply the host.mjs change described in UPDATE_2.11.1.md\n` +
    `  (the isLoopback function), then run this again.\n`
  );
  process.exit(1);
}

/* ---------------- cloudflared ---------------- */

function haveCloudflared() {
  try {
    execFileSync("cloudflared", ["--version"], { stdio: "ignore", timeout: 10000 });
    return true;
  } catch { return false; }
}

if (!haveCloudflared()) {
  console.error(
    `  cloudflared is not installed, or is not on your PATH.\n\n` +
    `  It is a single executable from Cloudflare and it is free.\n\n` +
    `  Windows:  winget install --id Cloudflare.cloudflared\n` +
    `  macOS:    brew install cloudflared\n` +
    `  Linux:    see https://developers.cloudflare.com/cloudflare-one/\n` +
    `                connections/connect-networks/downloads/\n\n` +
    `  Then run  npm run tunnel  again.\n\n` +
    `  Prefer not to install anything? The pasted-code path in the\n` +
    `  app needs nothing at all — see docs/REMOTE_PLAY.md.\n`
  );
  process.exit(1);
}

/* ---------------- the server ---------------- */

say("Starting the table server...");

const server = spawn(process.execPath, [resolve(ROOT, "server", "host.mjs")], {
  stdio: "inherit",
  env: { ...process.env, BEHIND_PROXY: "1", PORT: String(PORT) },
});

const stop = () => {
  try { server.kill(); } catch { /* already gone */ }
  try { tunnel && tunnel.kill(); } catch { /* already gone */ }
};
process.on("SIGINT", () => { stop(); process.exit(0); });
process.on("SIGTERM", () => { stop(); process.exit(0); });
server.on("exit", (code) => { stop(); process.exit(code ?? 0); });

/* Give it a moment to bind before cloudflared starts probing it. */
await new Promise((r) => setTimeout(r, 2500));

/* ---------------- the tunnel ---------------- */

say("Opening the tunnel...\n");

const tunnel = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${PORT}`], {
  stdio: ["ignore", "pipe", "pipe"],
});

let announced = false;

/* cloudflared prints the assigned hostname to stderr, boxed in ASCII
   art, once. Everything else it says is noise a table does not need. */
const watch = (chunk) => {
  const text = chunk.toString();
  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  if (match && !announced) {
    announced = true;
    const url = match[0];
    console.log(`\n${line}`);
    console.log(`  THE TABLE IS ON THE INTERNET`);
    console.log(`${line}\n`);
    console.log(`  Send players this:\n`);
    console.log(`      ${url}\n`);
    console.log(`  Your Warden screen, on this PC:\n`);
    console.log(`      http://localhost:${PORT}/?mode=host\n`);
    console.log(`  Use the localhost one for yourself. It is faster, and it`);
    console.log(`  is the only address that hands you the Warden token`);
    console.log(`  automatically — the tunnel address deliberately does not.\n`);
    console.log(`  Anyone with the link can join as a player, so treat it`);
    console.log(`  like a party invitation rather than a password. It dies`);
    console.log(`  when you press Ctrl-C, and a new one is issued next time.\n`);
    console.log(`  The connection is https, so the phone gets a real padlock`);
    console.log(`  and audio and the PWA install work as they should.\n`);
    console.log(`${line}\n`);
  }
  if (/ERR|error|failed/i.test(text) && !announced) process.stderr.write(text);
};

tunnel.stdout.on("data", watch);
tunnel.stderr.on("data", watch);

tunnel.on("exit", (code) => {
  if (!announced) {
    console.error(`\n  cloudflared exited (${code}) before giving us a URL.`);
    console.error(`  Run it by hand to see why:\n`);
    console.error(`      cloudflared tunnel --url http://localhost:${PORT}\n`);
  }
  stop();
  process.exit(code ?? 0);
});

setTimeout(() => {
  if (!announced) {
    say("cloudflared is taking a while. Leave it — it sometimes needs");
    say("thirty seconds or so on a slow connection.\n");
  }
}, 15000);
