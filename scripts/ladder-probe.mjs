/* ============================================================
   WHAT THE DIRECTOR WOULD HAVE CONSIDERED.

   The playtest report's §6 finding was that a wardenless table left
   in silence gets atmosphere and nothing else, and its first
   recommendation was to instrument which rungs are ELIGIBLE over a
   long silence rather than only which one wins. `directorPlan`
   walks RUNGS in order and returns the first non-null, so a rung
   below atmosphere on the ladder is invisible from the outside even
   when its own threshold has been met — and a rung that can never
   fire at all looks exactly the same as one that is simply
   outranked.

   That distinction is the whole question, and this is the cheap
   harness the report said it would be: RUNGS is exported, every
   rung takes the same `args` object, and all of them are pure. So
   we can ask each one directly, once per simulated minute, and
   print the answer as a grid.

   Read the output as: `.` the rung declined, a letter the rung
   would have fired, and `WIN` the one `directorPlan` actually
   picked. A column of letters under a rung that never wins is a
   tuning question. A column of dots all the way across for a rung
   whose module supplies the thing it needs is a wiring bug.

     node scripts/ladder-probe.mjs [moduleId] [minutes]

   Defaults to Dead Weight, which is the module the finding came
   from, for twenty-five minutes, which is one minute past
   `WARMUP_MIN` — see the note this prints at the end.
   ============================================================ */
import MODULES from "../src/modules/index.js";
import { RUNGS, directorPlan } from "../src/engine/director.js";
import { createWorld } from "../src/engine/world.js";
import { WARMUP_MIN } from "../src/engine/pacing.js";

const wanted = process.argv[2] || "deadweight";
const MINUTES = Number(process.argv[3] || 25);

const mod = MODULES.find((m) => m.id === wanted);
if (!mod) {
  console.error(`No module "${wanted}". Have: ${MODULES.map((m) => m.id).join(", ")}`);
  process.exit(1);
}

/* A table that sat down, did exactly one thing, and then stopped.
   One action rather than none, because a session where nobody has
   ever acted is a different (and less interesting) case than one
   that started and stalled. */
const START = 1_700_000_000_000;
const w = createWorld(mod, 1);

/* Whatever the module's own opening effects would have set is not
   run here — this probe is about the ladder's thresholds, not the
   module's content, and a partially-applied onStart would make the
   grid harder to read rather than more honest. */
const crew = [
  { id: "a", name: "ALVES", alive: true, stats: {}, items: [], conditions: [] },
  { id: "b", name: "BRUNEL", alive: true, stats: {}, items: [], conditions: [] },
];

const names = RUNGS.map(([n]) => n);
/* Two characters, and checked for collisions — `safety`/`scripted`,
   `pending`/`pressure`/`pacing` and `aftermath`/`attack`/`atmosphere`
   all share a first letter, and a grid with three different columns
   labelled P is worse than no grid. */
const CODES = {
  safety: "sf", pending: "pe", combat: "co", aftermath: "af", ending: "en",
  lastCall: "lc", scripted: "sc", listen: "li", attack: "at", roll: "ro",
  npc: "np", floor: "fl", breather: "br", pressure: "PR", pacing: "PA",
  callback: "cb", atmosphere: "AT",
};
const letter = (n) => CODES[n] || n.slice(0, 2);
{
  const seen = new Set();
  for (const n of names) {
    const c = letter(n);
    if (seen.has(c)) throw new Error(`ladder-probe: duplicate code "${c}" — fix CODES`);
    seen.add(c);
  }
}

/* Everything the ladder reads about "when did X last happen".
   All anchored at the session start: the table acted once, at
   minute zero, and has done nothing since. */
const base = {
  mod, w, crew, feed: [], combat: null, pending: null, safetyCall: null,
  startedAt: START,
  lastMoveAt: START, lastAtmosphereAt: 0, lastActedAt: START, lastLineAt: START,
  lastAftermathAt: 0, lastNpcAt: 0, npcSpokeAt: {},
  pendingSince: 0, lastNudgeAt: 0, harshAt: [], lastBreatherAt: 0,
  lastCallbackAt: 0, calledBack: {}, heard: {},
  sessionEndsAt: 0, lastCallAt: 0, lastPassAt: 0, vetoes: {}, roomServedAt: {},
};

console.log(`\nmodule: ${mod.id}   silence: ${MINUTES} min   `
  + `pressure hook: ${(mod.director && mod.director.pressure) || "(none)"}\n`);
console.log(`min  ${names.map(letter).join(" ")}   winner`);
console.log(`     ${names.map(() => "--").join(" ")}`);

const everEligible = new Set();
const everWon = new Set();

for (let m = 0; m <= MINUTES; m++) {
  const now = START + m * 60_000;
  const args = { ...base, now, focus: null };

  const cells = RUNGS.map(([name, rung]) => {
    let out = null;
    try { out = rung(args); } catch { return " !"; }
    if (!out) return " .";
    everEligible.add(name);
    return letter(name);
  });

  let win = null;
  try {
    const move = directorPlan({ ...base, now });
    win = move ? (move.rung || move.kind) : "silence";
  } catch (e) { win = `THREW: ${e.message}`; }
  if (win && win !== "silence") everWon.add(win);

  console.log(`${String(m).padStart(3)}  ${cells.join(" ")}   ${win}`);
}

console.log(`\nkey: ${names.map((n) => `${letter(n)}=${n}`).join("  ")}`);

const silent = names.filter((n) => !everEligible.has(n));
console.log(`\neligible at some point : ${[...everEligible].join(", ") || "(none)"}`);
console.log(`actually won           : ${[...everWon].join(", ") || "(none)"}`);
console.log(`never eligible         : ${silent.join(", ") || "(none)"}`);

const shadowed = [...everEligible].filter((n) => !everWon.has(n));
if (shadowed.length) {
  console.log(`\nEligible but always outranked — these are the tuning`);
  console.log(`questions, because the threshold was met and the table`);
  console.log(`still never saw it:\n  ${shadowed.join(", ")}`);
}

if (MINUTES < WARMUP_MIN) {
  console.log(`\nNote: pacing.WARMUP_MIN is ${WARMUP_MIN} real minutes, so the`);
  console.log(`\`pacing\` rung (the one that spends fiction-time on the`);
  console.log(`table's behalf) CANNOT fire in a ${MINUTES}-minute window —`);
  console.log(`\`pacingOf\` returns "warmup" and the rung declines on its`);
  console.log(`first line. This is why the original twenty-minute`);
  console.log(`observation saw no passTime. Re-run with a longer window`);
  console.log(`before concluding anything about that rung's eagerness.`);
}
console.log("");
