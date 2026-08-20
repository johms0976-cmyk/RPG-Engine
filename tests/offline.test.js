/* ============================================================
   THE OFFLINE PROMISE, ENFORCED.

   The 2.0 changelog says the LLM Warden's removal is "enforced by
   a test that greps the source and fails the build if any
   reappear."

   No such test existed. This is it.

   That gap is the reason this file is written the way it is: a
   promise in a changelog decays, a promise in CI does not. The
   README, the library screen and NOTICE.md all tell users that
   nothing they type leaves the machine. This is what makes that
   checkable rather than asserted.

   ------------------------------------------------------------
   THE ALLOWLIST

   Three same-origin calls are legitimate and are named
   individually rather than pattern-matched, so adding a fourth
   requires editing this file and thinking about it.

     src/main.jsx      GET /net/info — the boot probe that decides
                       whether this tab is a phone at a table or a
                       single-player app. Same origin, no body.
     src/App.jsx       GET /net/info — the host tab reading the
                       join URL for the QR code.
     src/net/HostBar.jsx  the same, refreshed for the host bar.
     src/modules/ypsilon14/audio.js
                       prefetching a cassette that is bundled into
                       the build. Same origin, an asset already on
                       disk, warmed early so it does not stutter
                       when the tape is played mid-scene.

   Everything on that list is same-origin by construction. None of
   it can reach a third party, and none of it carries game state.
   ============================================================ */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "src");

const ALLOWED = new Map([
  ["src/main.jsx", 1],
  ["src/App.jsx", 1],
  ["src/net/HostBar.jsx", 1],
  ["src/modules/ypsilon14/audio.js", 1],
]);

function sources(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { sources(full, out); continue; }
    if (/\.(js|jsx|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

const FILES = sources(SRC).map((f) => ({
  path: relative(ROOT, f).split("\\").join("/"),
  text: readFileSync(f, "utf8"),
}));

/* Strip comments before grepping. Half this codebase's comments discuss
   the network calls that are deliberately absent, and a test that fails
   on the word in a comment explaining why the thing is not there would
   be actively harmful to the documentation. */
const code = (t) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("the offline promise", () => {
  it("has no model calls anywhere in src/", () => {
    const providers = /api\.anthropic\.com|api\.openai\.com|generativelanguage\.googleapis|\bopenai\b|\banthropic\b|x-api-key|Authorization:\s*Bearer/i;
    const hits = FILES.filter((f) => providers.test(code(f.text))).map((f) => f.path);
    expect(hits, `model provider reference in: ${hits.join(", ")}`).toEqual([]);
  });

  it("has no XMLHttpRequest", () => {
    const hits = FILES.filter((f) => /XMLHttpRequest/.test(code(f.text))).map((f) => f.path);
    expect(hits).toEqual([]);
  });

  it("has no fetch() outside the allowlist", () => {
    const offenders = [];
    for (const f of FILES) {
      const n = (code(f.text).match(/\bfetch\s*\(/g) || []).length;
      if (!n) continue;
      const budget = ALLOWED.get(f.path) || 0;
      if (n > budget) offenders.push(`${f.path} (${n} call${n === 1 ? "" : "s"}, ${budget} allowed)`);
    }
    expect(
      offenders,
      `Unapproved fetch(). If this is genuinely necessary and same-origin, add it to ` +
      `the allowlist in tests/offline.test.js with a reason. Offenders: ${offenders.join("; ")}`,
    ).toEqual([]);
  });

  it("only ever fetches same-origin paths", () => {
    /* An allowlisted file could still be edited to call somewhere else.
       Every fetch target in src/ must be a root-relative path. */
    const bad = [];
    for (const f of FILES) {
      for (const m of code(f.text).matchAll(/\bfetch\s*\(\s*(["'`])([^"'`]*)\1/g)) {
        if (!m[2].startsWith("/")) bad.push(`${f.path}: fetch("${m[2]}")`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("opens no websocket to an absolute foreign origin", () => {
    /* useSocket builds its URL from location.host, which is the table
       server by definition. A hardcoded ws:// or wss:// host is not. */
    const bad = [];
    for (const f of FILES) {
      for (const m of code(f.text).matchAll(/["'`](wss?:\/\/[^"'`$]+)["'`]/g)) {
        bad.push(`${f.path}: ${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("contacts third-party STUN from exactly one file, and only for RTC", () => {
    /* THE ONE HONEST EXCEPTION.

       WebRTC cannot discover a browser's public address without asking
       something outside the network. That is third-party contact, and
       the grep above would not have caught it, because a stun: URL is
       not a ws:// URL — so it is asserted here rather than left to be
       noticed by somebody later.

       What makes it acceptable, and what the docs must keep saying:

         · it happens ONLY when a table chooses remote play. Solo play,
           the hosted demo and the LAN relay never reach for it.
         · STUN is asked what an address looks like from outside. It
           carries no game data and sees no traffic.
         · there is deliberately NO TURN server, because TURN would
           relay the actual session through somebody's machine — the
           precise thing this transport exists to avoid. The cost is
           that a table behind two symmetric NATs may fail to connect,
           and the UI has to say so rather than hang.

       If a second file starts contacting STUN, or a turn: URL appears,
       this fails and somebody has to justify it. */
    const stun = FILES.filter((f) => /\bstuns?:/.test(code(f.text))).map((f) => f.path);
    expect(stun).toEqual(["src/net/rtcPeer.js"]);

    const turn = FILES.filter((f) => /["'`]turns?:/.test(code(f.text))).map((f) => f.path);
    expect(turn, "TURN would relay game traffic through a third party").toEqual([]);
  });

  it("never evaluates strings as code", () => {
    /* The dice parser exists because dice expressions used to go through
       new Function. Runtime module loading makes this matter far more:
       a loaded module is somebody else's data. */
    const bad = [];
    for (const f of FILES) {
      const c = code(f.text);
      if (/\bnew\s+Function\s*\(/.test(c)) bad.push(`${f.path}: new Function`);
      if (/(^|[^.\w])eval\s*\(/.test(c)) bad.push(`${f.path}: eval`);
    }
    expect(bad).toEqual([]);
  });
});

describe("src/core stays headless", () => {
  it("never imports React", () => {
    const hits = FILES
      .filter((f) => f.path.startsWith("src/core/"))
      .filter((f) => /from\s+["']react/.test(code(f.text)))
      .map((f) => f.path);
    expect(hits, "src/core must be drivable without a renderer").toEqual([]);
  });
});
