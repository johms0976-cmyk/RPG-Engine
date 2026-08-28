/* ============================================================
   OPEN-HOST — wait for the server, then open the Warden screen.

   Two things this has to get right, and the old inline PowerShell
   got one of them.

   IT GOT RIGHT: waiting. Polling /net/info instead of sleeping a
   fixed few seconds. On a slow machine a fixed sleep opens the
   browser before the socket is bound, and a browser that says it
   cannot reach localhost looks exactly like a firewall block —
   which sends people to Doctor.bat hunting a problem they do not
   have.

   IT GOT RIGHT: ?mode=host. A bare http://localhost:8080 means "I
   am a phone". main.jsx probes the server, finds it, and boots
   ClientShell, so the PC opens a PLAYER screen and there is no
   Warden deck anywhere. ?mode=host is the authority tab.

   IT GOT WRONG: being PowerShell. It needed -ExecutionPolicy
   Bypass, which some managed machines refuse outright, and it was
   a `start "" /min powershell` line continued across seven carets
   inside a batch file. Node is already required to run the server
   at all.

   Run:  node scripts/open-host.mjs [port]
   ============================================================ */
import { spawn } from "node:child_process";

const PORT = Number(process.argv[2]) || Number(process.env.PORT) || 8080;

const PROBE = `http://127.0.0.1:${PORT}/net/info`;
const OPEN = `http://localhost:${PORT}/?mode=host`;

/* Thirty seconds. Long enough for a cold Node start on a slow
   laptop, short enough that a server which is never coming up
   does not leave a hidden process polling all evening. */
const TRIES = 60;
const GAP = 500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function launch(cmd, args) {
  const c = spawn(cmd, args, { detached: true, stdio: "ignore" });
  /* An unhandled "error" on a ChildProcess throws. If the opener is
     not on this machine, failing to open a browser is not worth
     taking the process down for - the URL is printed either way. */
  c.on("error", () => {});
  c.unref();
}

function open(url) {
  if (process.platform === "win32") {
    /* Through cmd's own `start`, because the default browser lives
       in the shell's file association and not anywhere Node can
       see. The empty "" is start's title argument — without it,
       start takes the URL as the title and opens nothing. */
    launch("cmd", ["/c", "start", "", url]);
  } else if (process.platform === "darwin") {
    launch("open", [url]);
  } else {
    launch("xdg-open", [url]);
  }
}

for (let i = 0; i < TRIES; i++) {
  try {
    const res = await fetch(PROBE, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      open(OPEN);
      /* A beat before exiting. process.exit() straight after spawn can
         win the race against the child actually starting, and the
         symptom is a browser that opens roughly one time in five. */
      await sleep(250);
      process.exit(0);
    }
  } catch {
    /* Not up yet. That is the expected case for the first second
       or two, so it is not worth saying anything about. */
  }
  await sleep(GAP);
}

/* Falling out of the loop means the server never answered. Say so
   somewhere it might be seen, and open the page anyway — if the
   server came up on a path this probe cannot see, the browser
   will still work, and a wrong-looking page beats no page. */
console.error(`  Server did not answer on port ${PORT} within 30s - opening anyway.`);
open(OPEN);
