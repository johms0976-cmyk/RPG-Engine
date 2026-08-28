/* ============================================================
   NEEDBUILD — is dist/ older than the source that made it?

   This used to be four lines of PowerShell written inline in
   Play.bat, inside an `if exist (...)` block, split across five
   lines with caret continuations, inside a `for /f usebackq`
   backtick command, containing pipes and braces and parentheses
   that cmd.exe also wants to interpret.

   That is four escaping layers deep and it is not worth being
   clever about. Every character in it had to survive cmd's block
   parser, then cmd's caret parser, then the backtick command
   parser, then PowerShell. One stray quote anywhere in that and
   the failure is a syntax error attributed to the wrong line.

   The logic is nine lines of Node. Node is already a hard
   requirement two checks earlier in Play.bat, so this adds no
   dependency, and it drops PowerShell — and every machine whose
   ExecutionPolicy says no — out of the startup path entirely.

   Exit: 0 = dist is current, skip the build
         1 = rebuild (also the answer when anything is unclear)
   ============================================================ */
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/* fileURLToPath, not URL.pathname - on Windows the latter yields
   "/C:/..." and every stat below would miss, reporting "rebuild"
   forever. A wrong answer in that direction is only a wasted build,
   which is exactly why it could sit here unnoticed. */
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

/* package-lock.json is in here on purpose. An Update.bat run can
   change a dependency without touching a single file in src/, and
   what gets bundled changes with it. */
const WATCH = ["src", "public", "index.html", "package.json",
  "package-lock.json", "vite.config.js"];

const STAMP = join(ROOT, "dist", "index.html");

if (!existsSync(STAMP)) process.exit(1);

function newest(path) {
  let s;
  try {
    s = statSync(path);
  } catch {
    return 0;
  }
  if (s.isFile()) return s.mtimeMs;
  let max = 0;
  for (const e of readdirSync(path, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const t = newest(join(path, e.name));
    if (t > max) max = t;
  }
  return max;
}

try {
  const src = Math.max(...WATCH.map((p) => newest(join(ROOT, p))));
  const built = statSync(STAMP).mtimeMs;
  /* Equal counts as stale. A build that finishes inside the same
     millisecond as the edit that triggered it is not a thing worth
     optimising for, and guessing wrong in this direction costs a
     rebuild rather than a session spent staring at old code. */
  process.exit(built > src ? 0 : 1);
} catch {
  process.exit(1);
}
