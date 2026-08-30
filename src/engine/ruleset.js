/* ============================================================
   RULESETS — the seam under `rules.js`.

   This engine has always been Mothership-only, and not by
   design so much as by accumulation: four stats, four saves,
   four classes, a twenty-entry Panic table and a d10 skill
   economy were written into `rules.js` at 2.0 and thirty-one
   files import them directly. Nothing was ever *decided* to be
   Mothership-specific. It simply is.

   This is the seam that lets that stop being true.

   ------------------------------------------------------------
   READ THIS BEFORE ASSUMING #23 IS DONE. IT IS NOT.

   What ships here is the contract, the registry, and Mothership
   re-declared through it so that `rules.js` reads its numbers
   from a ruleset rather than holding them. That is the load-
   bearing half and it is genuinely load-bearing: change the stat
   list in a ruleset and the character sheet, the roll prompt,
   the Warden deck and the printed blank sheet all follow,
   because they were already reading `STAT_KEYS` and `STAT_KEYS`
   now comes from here.

   What does NOT ship is a second ruleset. A plugin interface
   with one implementation is a rename, and I am not going to
   pretend otherwise in a changelog. The reason there is no
   second one is that inventing a second role-playing game is
   not this project's job, and shipping a thin Mothership variant
   dressed up as a different system would prove nothing except
   that I can copy a file.

   The conformance test in `tests/ruleset.test.js` defines a
   deliberately different ruleset — three stats, three saves, no
   classes — and asserts the engine carries it. That is the
   honest proof the seam is real, and it is a test rather than a
   product because a test is what it is.

   What remains for #23 proper, in the order I would do it:

     1. `Creator.jsx` and `CreatorPhone.jsx` assume Mothership's
        creation FLOW — roll six dice per stat, pick a class,
        spend skill points against a three-tier tree. The data
        is generic now; the sequence is not. A ruleset would need
        to declare its creation steps.
     2. Panic is wired into `useGame` by name — `queuePanic`,
        the Stress threshold, the reroll ability. A system with
        no panic mechanic needs those to be no-ops rather than
        absent.
     3. Modules declare `loadouts` in Mothership's shape, so a
        module is currently bound to a ruleset without saying so.
        `defineModule` would need a `ruleset` field and a check.

   ------------------------------------------------------------
   THE RULESET IS CHOSEN AT LOAD, NOT AT RUNTIME

   `rules.js` exports constants, and its consumers read them at
   module scope — `WardenDeck.jsx` builds its condition list out
   of `PANIC_TABLE` the moment it is imported. Swapping rulesets
   mid-session would leave every one of those holding the old
   set, silently, with no error anywhere.

   So the choice is read once, at import, exactly as `HOSTING` is
   in `main.jsx`. `setActiveRuleset` persists a choice and says
   plainly that it takes effect on reload. A lie that requires a
   refresh to notice is worse than a reload button.

   ------------------------------------------------------------
   IT VALIDATES LIKE A MODULE, NOT LIKE A LIBRARY

   `defineRuleset` reports problems on the object rather than
   throwing, the same way `defineModule` does, and for the same
   reason: the thing being validated is somebody's work, the
   failure needs to be readable, and an exception at import time
   takes the whole app down rather than the one file that is
   wrong.
   ============================================================ */

import { dN } from "./dice.js";

export const RULESET_VERSION = 1;

/** Every ruleset needs these to exist and to be non-empty. Anything
    below this line is not something the engine can roll dice for. */
const REQUIRED = ["id", "name", "stats", "saves"];

/**
 * Fill in and check a ruleset declaration.
 *
 * Everything except `id`, `name`, `stats` and `saves` has a default,
 * and every default is the *empty* one rather than Mothership's — a
 * ruleset that forgets to declare classes should get no classes, not
 * four Mothership ones smuggled in behind it.
 */
export function defineRuleset(raw) {
  const problems = [];
  const warnings = [];
  const r = { ...(raw || {}) };

  for (const key of REQUIRED) {
    if (!r[key] || (Array.isArray(r[key]) && r[key].length === 0)) {
      problems.push(`ruleset is missing ${key}`);
    }
  }

  const stats = Array.isArray(r.stats) ? r.stats : [];
  const saves = Array.isArray(r.saves) ? r.saves : [];

  /* A key in both lists makes `baseValue` ambiguous: it switches on
     `kind`, so the same name meaning two different numbers is a bug
     that only shows up as a wrong target percentage. */
  for (const k of stats) {
    if (saves.includes(k)) problems.push(`"${k}" is both a stat and a save`);
  }

  const labels = { ...(r.labels || {}) };
  for (const k of [...stats, ...saves]) {
    if (!labels[k]) {
      labels[k] = k.charAt(0).toUpperCase() + k.slice(1);
      warnings.push(`no label for "${k}" — using "${labels[k]}"`);
    }
  }

  const classes = r.classes || {};
  for (const [key, c] of Object.entries(classes)) {
    if (!c.name) problems.push(`class "${key}" has no name`);
    for (const k of Object.keys(c.saves || {})) {
      if (!saves.includes(k)) problems.push(`class "${key}" sets an unknown save "${k}"`);
    }
    for (const k of Object.keys(c.bonus || {})) {
      if (!stats.includes(k)) problems.push(`class "${key}" bonuses an unknown stat "${k}"`);
    }
  }

  const skills = r.skills || {};
  const tree = skills.tree || {};
  const tiers = Object.keys(tree);
  for (const tier of tiers) {
    for (const [name, prereqs] of Object.entries(tree[tier] || {})) {
      for (const p of prereqs || []) {
        const known = tiers.some((t) => tree[t] && tree[t][p] !== undefined);
        if (!known) problems.push(`skill "${name}" needs unknown skill "${p}"`);
      }
    }
  }

  /* The armour save is the one save the engine treats specially —
     `armorSave` adds worn protection to it by name. A ruleset that
     names its saves differently is fine; one that declares
     `armorSave` pointing at a save it does not have is not. */
  if (r.armorSave && !saves.includes(r.armorSave)) {
    problems.push(`armorSave names "${r.armorSave}", which is not one of the saves`);
  }

  return {
    v: RULESET_VERSION,
    id: r.id || "",
    name: r.name || "",
    blurb: r.blurb || "",
    system: r.system || r.name || "",

    stats,
    saves,
    labels,
    /* Which save armour adds to, or null for a system where it does
       not. Named rather than assumed so "armor" stops being a magic
       string in `baseValue`. */
    armorSave: r.armorSave === undefined ? (saves.includes("armor") ? "armor" : null) : r.armorSave,

    classes,
    skills: {
      tree,
      bonus: skills.bonus || {},
      cost: skills.cost || {},
      time: skills.time || {},
      timeRapid: skills.timeRapid || {},
    },

    panic: {
      table: (r.panic && r.panic.table) || [],
      triggers: (r.panic && r.panic.triggers) || {},
    },
    wake: r.wake || [],

    flavour: {
      trinkets: (r.flavour && r.flavour.trinkets) || [],
      patches: (r.flavour && r.flavour.patches) || [],
    },

    /* Character creation, as numbers rather than as a flow. The flow
       is still Mothership's and lives in Creator.jsx — see the header
       for why that is the next piece of work and not this one. */
    rollStats: typeof r.rollStats === "function"
      ? r.rollStats
      : () => Object.fromEntries(stats.map((k) => [k, dN(6, 10)])),
    health: typeof r.health === "function" ? r.health : (s) => Math.max(1, (s[stats[0]] || 0) * 2),
    startingStress: r.startingStress ?? 2,
    maxWounds: r.maxWounds ?? 2,
    startingCredits: typeof r.startingCredits === "function"
      ? r.startingCredits
      : () => dN(5, 10) * 10,

    problems,
    warnings,
  };
}

/* ------------------------------------------------------------
   THE REGISTRY

   A plain map rather than anything clever. Registration is a
   side effect of importing a ruleset file, which is the same
   contract `src/modules/index.js` uses for modules and means a
   ruleset is added by adding one import.
   ------------------------------------------------------------ */

const REGISTRY = new Map();

export function registerRuleset(rs) {
  if (!rs || !rs.id) return null;
  /* A ruleset with problems is registered anyway, and the problems
     travel with it. Refusing to register would make a broken ruleset
     indistinguishable from a missing one, and "nothing happened" is
     the hardest failure to debug. */
  REGISTRY.set(rs.id, rs);
  return rs;
}

export const rulesets = () => [...REGISTRY.values()];
export const getRuleset = (id) => REGISTRY.get(id) || null;

const SETTING = "rpg-engine:ruleset";
const DEFAULT_ID = "mothership1e";

export function activeRulesetId() {
  try {
    const stored = localStorage.getItem(SETTING);
    if (stored && REGISTRY.has(stored)) return stored;
  } catch { /* no storage: the default is right */ }
  return DEFAULT_ID;
}

/**
 * Choose a ruleset for the next load.
 *
 * Returns whether a reload is needed, which is always true and is
 * returned rather than assumed so the caller has to say something to
 * the person. See the header: swapping mid-session would leave every
 * module-scope consumer holding the old numbers, silently.
 */
export function setActiveRuleset(id) {
  if (!REGISTRY.has(id)) return { ok: false, error: `No ruleset "${id}".` };
  try { localStorage.setItem(SETTING, id); } catch { return { ok: false, error: "Could not save that." }; }
  return { ok: true, reload: true };
}

/** The ruleset the engine is running, resolved once. */
export function activeRuleset() {
  return REGISTRY.get(activeRulesetId()) || REGISTRY.get(DEFAULT_ID) || null;
}

export default defineRuleset;
