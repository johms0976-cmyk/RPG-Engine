/* ============================================================
   PLAYTEST — does the module actually RUN?

   The suite is very good at asserting that units behave. It had no
   way to notice that a module could not finish. 1077 tests were
   green on the day Dead Weight shipped with three hooks that threw
   the moment they fired, including the one on its own ninety-minute
   countdown, because no test ever fired a `run:` hook and nothing
   ever executed an effect chain end to end.

   This is the harness the playtest report asked for as its last
   recommendation. It does not assert anything about *content* —
   that is the author's business and a test would only ossify it.
   It asserts that every effect chain a module can reach survives
   being executed, using the engine's own `runEffects` rather than
   a reimplementation of it, and that the module has a reachable
   way to stop.

   An unhandled throw anywhere in here is a failure, because in the
   engine a throw inside an effect list does not merely lose that
   effect: it abandons the rest of the chain. That is what turned
   Dead Weight's `ignition` from a bad line into a module that
   printed its ending and then carried on forever.

     npm run playtest              every module on the shelf
     npm run playtest deadweight   just the one

   Exit code 1 on any failure, so CI fails the build.
   ============================================================ */
import MODULES from "../src/modules/index.js";
import { createWorld } from "../src/engine/world.js";
import { runEffects } from "../src/engine/effects.js";

const only = process.argv[2] || null;
const shelf = only ? MODULES.filter((m) => m.id === only) : MODULES;

if (!shelf.length) {
  console.error(`No module "${only}". Have: ${MODULES.map((m) => m.id).join(", ")}`);
  process.exit(1);
}

/* ---------------- a table that exists but is not real ----------

   Enough api for an effect chain to run without a React tree. It
   records rather than renders, and every mutation a chain might
   make lands somewhere a later assertion can read.

   Deliberately NOT shared with `tests/module-hooks.test.js`. That
   file's stub is a fixture for one narrow question and this one
   grows as modules gain surface; wiring them together would mean a
   change made for the harness could quietly weaken the test.
   ---------------------------------------------------------------- */
function table(mod) {
  const world = createWorld(mod, 7);
  const said = [];
  const pc = {
    id: "pc1", name: "TEST", cls: "teamster", room: world.room,
    stats: { strength: 40, speed: 40, intellect: 40, combat: 40 },
    saves: { sanity: 30, fear: 35, body: 30, armor: 35 },
    health: 60, maxHealth: 60, stress: 2, resolve: 0,
    skills: [], items: [], ammo: {}, spare: {}, uses: {}, buffs: [],
    conditions: [], credits: 0, alive: true, unconscious: false,
    meters: {}, tracks: {},
  };
  const api = {
    mod,
    items: { ...(mod.items || {}) },
    world: () => world,
    pc: () => pc,
    crew: () => [pc],
    rng: () => 0.5,
    ctx: () => ({ world, mod, pc, crew: [pc], items: mod.items || {} }),
    ended: () => !!world.ended,
    roomOf: () => world.room,
    pcsIn: () => [pc],
    crewRooms: () => [world.room],
    alone: () => false,
    split: () => false,
    say: (tone, text) => said.push({ tone, text }),
    sayIn: (room, tone, text) => said.push({ room, tone, text }),
    sayOthers: () => {}, npcSay: () => {}, whisper: () => {}, whisperTo: () => {},
    flag: (k, v = true) => { world.flags[k] = v; },
    meter: () => {}, give: () => {}, take: () => {},
    stress: () => {}, stressCrew: () => {},
    heal: () => {}, hurt: () => {}, panic: () => {},
    addCondition: () => {}, addBuff: () => {},
    advance: (m) => { world.clock += m || 0; },
    advanceNow: (m) => { world.clock += m || 0; },
    noise: () => {}, vanish: () => {}, rollTable: () => {},
    setThreat: (id, patch) => { world.threats[id] = { ...(world.threats[id] || {}), ...patch }; },
    setNpc: () => {}, startTrack: () => {}, awardXp: () => {},
    countdown: (c) => { if (c && c.id) world.countdowns[c.id] = { ...c, left: c.minutes }; },
    stopCountdown: (id) => { delete world.countdowns[id]; },
    offerRest: () => {}, setMarks: () => {},
    rollNow: () => ({ success: true, roll: 50, target: 50 }),
    ask: () => {}, startCombat: () => {},
    endGame: (id) => { world.ended = id; },
    moveTo: (r) => { world.room = r; },
    run: (name) => { const f = (mod.hooks || {})[name]; if (f) f(api, {}); },
    effects: (list) => runEffects(list, api, {}),
  };
  return { api, world, said, pc };
}

/* ---------------- running one thing, safely ---------------- */

const failures = [];
let checks = 0;

/** Execute `fn`, and record rather than rethrow. The point of the
    harness is the full list of what is broken, not the first item. */
function attempt(mod, what, fn) {
  checks++;
  try { fn(); return true; } catch (e) {
    failures.push({ mod: mod.id, what, err: e && e.message ? e.message : String(e) });
    return false;
  }
}

/** Every `run:` name anywhere in a value, however deeply nested. */
function runNames(node, found = new Set(), seen = new WeakSet()) {
  if (!node || typeof node !== "object") return found;
  if (seen.has(node)) return found;
  seen.add(node);
  if (Array.isArray(node)) { for (const v of node) runNames(v, found, seen); return found; }
  for (const [k, v] of Object.entries(node)) {
    if (k === "run" && typeof v === "string") found.add(v);
    else if (v && typeof v === "object") runNames(v, found, seen);
  }
  return found;
}

/* ---------------- the walk ---------------- */

for (const mod of shelf) {
  const rooms = Object.entries(mod.rooms || {});
  console.log(`\n=== ${mod.id} — ${mod.title || ""} (${rooms.length} rooms) ===`);

  /* 1. Opening. Countdowns declared here are the ones whose `onZero`
        is the module's own ending in at least one module, so this
        also populates `world.countdowns` for step 5. */
  {
    const { api } = table(mod);
    attempt(mod, "onStart", () => runEffects(mod.onStart, api, {}));
  }

  /* 2. Every room's first-entry chain, each on a fresh table so a
        chain that ends the game does not mask the next one. */
  for (const [rid, room] of rooms) {
    if (!room.onFirstEnter) continue;
    const { api, world } = table(mod);
    world.room = rid;
    attempt(mod, `rooms.${rid}.onFirstEnter`, () => runEffects(room.onFirstEnter, api, {}));
  }

  /* 3. Every feature a player can touch. `effects` is the chain;
        `gives` and `handout` are checked for dangling references,
        which is the other half of "the module cannot be finished". */
  for (const [rid, room] of rooms) {
    for (const [fid, f] of Object.entries(room.features || {})) {
      if (f.effects) {
        const { api, world } = table(mod);
        world.room = rid;
        attempt(mod, `rooms.${rid}.features.${fid}.effects`, () => runEffects(f.effects, api, {}));
      }
      for (const id of (f.gives || [])) {
        checks++;
        if (!(mod.items || {})[id]) {
          failures.push({ mod: mod.id, what: `rooms.${rid}.features.${fid}.gives`, err: `no such item "${id}"` });
        }
      }
      if (f.handout && !(mod.handouts || {})[f.handout]) {
        checks++;
        failures.push({ mod: mod.id, what: `rooms.${rid}.features.${fid}.handout`, err: `no such handout "${f.handout}"` });
      }
    }
  }

  /* 4. Exits that go nowhere. A typo here is a room the table can
        see and never reach, and it is silent at runtime.

        `to: "@id"` is not a room — it is the documented shorthand for
        an exit that ends the session (see `defineModule.js`, and
        `look.js` filters them out of the visible exit list). Those
        are checked against `endings` instead, which is the same
        question asked of the right table. */
  const endingExits = new Set();
  for (const [rid, room] of rooms) {
    for (const e of (room.exits || [])) {
      checks++;
      const to = String(e.to || "");
      if (to.startsWith("@")) {
        endingExits.add(to.slice(1));
        if (!(mod.endings || {})[to.slice(1)]) {
          failures.push({ mod: mod.id, what: `rooms.${rid}.exits`, err: `exit ends the game as "${to.slice(1)}", which is not in \`endings\`` });
        }
        continue;
      }
      if (!(mod.rooms || {})[e.to]) {
        failures.push({ mod: mod.id, what: `rooms.${rid}.exits`, err: `exit to unknown room "${e.to}"` });
      }
    }
  }

  /* 5. Countdown expiry. THE §1 CASE. A ninety-minute module whose
        `onZero` throws is a module that prints its ending and then
        does not stop. */
  {
    const { api, world } = table(mod);
    attempt(mod, "onStart (for countdowns)", () => runEffects(mod.onStart, api, {}));
    for (const [cid, c] of Object.entries(world.countdowns || {})) {
      if (!c.onZero) continue;
      const t = table(mod);
      attempt(mod, `countdowns.${cid}.onZero`, () => runEffects(c.onZero, t.api, {}));
    }
  }

  /* 6. Item use, free actions, devices. */
  for (const [id, chain] of Object.entries(mod.itemUse || {})) {
    const { api } = table(mod);
    attempt(mod, `itemUse.${id}`, () => runEffects(chain, api, {}));
  }
  for (const [i, a] of (mod.actions || []).entries()) {
    if (!a || !a.effects) continue;
    const { api } = table(mod);
    attempt(mod, `actions[${i}] ${a.label || ""}`, () => runEffects(a.effects, api, {}));
  }
  for (const [id, d] of Object.entries(mod.devices || {})) {
    for (const [oi, opt] of ((d && d.options) || []).entries()) {
      if (!opt || !opt.effects) continue;
      const { api } = table(mod);
      attempt(mod, `devices.${id}.options[${oi}]`, () => runEffects(opt.effects, api, {}));
    }
  }

  /* 7. The director's own chains, including the pressure hook that
        moves the threat. */
  const d = mod.director || {};
  for (const [i, step] of (d.escalate || []).entries()) {
    if (!step || !step.effects) continue;
    const { api } = table(mod);
    attempt(mod, `director.escalate[${i}] ${step.label || ""}`, () => runEffects(step.effects, api, {}));
  }
  if (d.pressure) {
    const { api } = table(mod);
    attempt(mod, `director.pressure ("${d.pressure}")`, () => {
      const f = (mod.hooks || {})[d.pressure];
      if (typeof f !== "function") throw new Error(`director.pressure names "${d.pressure}", which is not a hook`);
      f(api, {});
    });
  }

  /* 8. Every hook reached through `{ run: … }`, called the way the
        engine calls it — `fn(api, vars)`, vars empty. */
  for (const name of runNames(mod)) {
    const f = (mod.hooks || {})[name];
    checks++;
    if (typeof f !== "function") {
      failures.push({ mod: mod.id, what: `run:"${name}"`, err: "named by an effect but not defined in hooks" });
      continue;
    }
    const { api } = table(mod);
    attempt(mod, `hooks.${name}`, () => f(api, {}));
  }

  /* 9. Can it stop? Every id passed to `endGame` anywhere in the
        module, and every ending declared, have to agree — an ending
        nothing reaches is dead content, and an `endGame("x")` with
        no `endings.x` is a session that ends on a blank screen. */
  const declared = new Set(Object.keys(mod.endings || {}));
  checks++;
  if (!declared.size) {
    failures.push({ mod: mod.id, what: "endings", err: "module declares no endings" });
  }

  const reached = new Set();
  for (const name of runNames(mod)) {
    const f = (mod.hooks || {})[name];
    if (typeof f !== "function") continue;
    const t = table(mod);
    try { f(t.api, {}); } catch { /* already recorded in step 8 */ }
    if (t.world.ended) reached.add(t.world.ended);
  }
  for (const src of [mod.onStart, mod.rooms, mod.itemUse, mod.actions, mod.director]) {
    JSON.stringify(src, (k, v) => {
      if (k === "endGame" && typeof v === "string") reached.add(v);
      return v;
    });
  }

  for (const id of endingExits) reached.add(id);

  for (const id of reached) {
    checks++;
    if (!declared.has(id)) {
      failures.push({ mod: mod.id, what: "endings", err: `something ends the game as "${id}", which is not in \`endings\`` });
    }
  }
  console.log(`  endings declared: ${[...declared].join(", ") || "(none)"}`);
  console.log(`  reachable in this walk: ${[...reached].join(", ") || "(none — see note below)"}`);
  if (declared.size && !reached.size) {
    console.log("  note: no ending was reached by hooks alone. That is normal for");
    console.log("        modules that end through play rather than a countdown.");
  }
}

/* ---------------- verdict ---------------- */

console.log(`\n${"-".repeat(60)}`);
if (!failures.length) {
  console.log(`playtest: ${checks} checks across ${shelf.length} module(s), no failures.`);
  process.exit(0);
}
console.log(`playtest: ${failures.length} failure(s) out of ${checks} checks.\n`);
for (const f of failures) console.log(`  [${f.mod}] ${f.what}\n      ${f.err}`);
console.log("");
process.exit(1);
