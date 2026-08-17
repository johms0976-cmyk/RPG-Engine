/* ============================================================
   IMPORT VALIDATION — is this character legal, or did somebody
   open the file in a text editor?

   An importable character is a cheat file. Two defences, and both
   are wanted: this validator catches accidents and clumsy edits,
   and the Warden approval queue catches intent. Neither is
   sufficient alone. A determined cheat can always produce a file
   that decomposes correctly — the point is to make it visible
   work rather than a two-second edit, and to put every import in
   front of the Warden regardless.

   Findings are graded, never fatal on their own. The Warden
   decides; this only tells them where to look.
   ============================================================ */
import { CLASSES, SKILL_COST, SKILL_BONUS, skillTier, canTakeSkill, SAVE_KEYS, STAT_KEYS } from "./rules.js";

const ERROR = "error";     // cannot be true of any legally made character
const SUSPECT = "suspect"; // possible, but only via unusual play
const NOTE = "note";       // worth the Warden's eye, not an accusation

const finding = (level, what, detail) => ({ level, what, detail });

/** 6d10 lands between 6 and 60. Class bonuses shift the window. */
function statWindow(cls, key) {
  const bonus = (CLASSES[cls] && CLASSES[cls].bonus[key]) || 0;
  return { min: 6 + bonus, max: 60 + bonus };
}

/** Levelling grants at most +5 and +3 to stats per level (option A),
    or +4 and +4 to saves (option B) — never both in one level. */
const LEVEL_STAT_HEADROOM = (level) => level * 8;
const LEVEL_SAVE_HEADROOM = (level) => level * 8;

export function validateCharacter(file, { modules } = {}) {
  const out = [];
  const pc = file && file.pc;
  if (!pc) return { ok: false, findings: [finding(ERROR, "structure", "No character in the file.")] };

  const cls = CLASSES[pc.cls];
  if (!cls) {
    return { ok: false, findings: [finding(ERROR, "class", `Unknown class "${pc.cls}".`)] };
  }

  const level = pc.level || 0;

  /* ---- stats ---- */
  for (const k of STAT_KEYS) {
    const v = pc.stats ? pc.stats[k] : undefined;
    if (typeof v !== "number" || !Number.isFinite(v)) {
      out.push(finding(ERROR, "stats", `${k} is not a number.`));
      continue;
    }
    const { min, max } = statWindow(pc.cls, k);
    const ceiling = Math.min(85, max + LEVEL_STAT_HEADROOM(level));
    if (v < min) out.push(finding(ERROR, "stats", `${k} of ${v} is below the minimum 6d10 roll of ${min}.`));
    if (v > 85) out.push(finding(ERROR, "stats", `${k} of ${v} exceeds the hard cap of 85.`));
    else if (v > ceiling) {
      out.push(finding(ERROR, "stats",
        `${k} of ${v} is above ${ceiling} — the most a level ${level} ${pc.cls} could reach.`));
    } else if (v > max && level === 0) {
      out.push(finding(ERROR, "stats", `${k} of ${v} is above the 6d10 maximum and the character has never levelled.`));
    }
  }

  // Four stats all in the top of the range is legal and vanishingly rare.
  const rolled = STAT_KEYS.map((k) => (pc.stats[k] || 0) - ((cls.bonus[k]) || 0));
  const total = rolled.reduce((a, b) => a + b, 0);
  if (level === 0 && total > 220) {
    out.push(finding(SUSPECT, "stats", `Rolled total of ${total} across four 6d10 — possible, but the top ~1% of characters.`));
  }

  /* ---- saves ---- */
  for (const k of SAVE_KEYS) {
    const v = pc.saves ? pc.saves[k] : undefined;
    if (typeof v !== "number") { out.push(finding(ERROR, "saves", `${k} save is not a number.`)); continue; }
    const base = cls.saves[k];
    if (v > 85) out.push(finding(ERROR, "saves", `${k} save of ${v} exceeds the cap of 85.`));
    else if (v < base) out.push(finding(SUSPECT, "saves", `${k} save of ${v} is below the ${pc.cls} starting value of ${base}.`));
    else if (v > base + LEVEL_SAVE_HEADROOM(level) + 15) {
      // +15 of slack for armour, which raises the Armor Save legitimately.
      out.push(finding(ERROR, "saves", `${k} save of ${v} is beyond what level ${level} allows (base ${base}).`));
    }
  }

  /* ---- health ---- */
  const expected = Math.max(1, (pc.stats.strength || 0) * 2);
  if (pc.maxHealth !== expected) {
    out.push(finding(ERROR, "health", `Max Health is ${pc.maxHealth}, but Strength ${pc.stats.strength} gives ${expected}.`));
  }
  if ((pc.health || 0) > (pc.maxHealth || 0)) {
    out.push(finding(ERROR, "health", "Current Health is above Max Health."));
  }

  /* ---- skills ---- */
  const skills = pc.skills || [];
  const dupes = skills.filter((s, i) => skills.indexOf(s) !== i);
  if (dupes.length) out.push(finding(ERROR, "skills", `Listed twice: ${[...new Set(dupes)].join(", ")}.`));

  const unknown = skills.filter((s) => !skillTier(s));
  if (unknown.length) out.push(finding(ERROR, "skills", `Not real skills: ${unknown.join(", ")}.`));

  const fixed = new Set(cls.fixedSkills);
  for (const s of cls.fixedSkills) {
    if (!skills.includes(s)) out.push(finding(NOTE, "skills", `A ${pc.cls} should have ${s} and doesn't.`));
  }

  // Prerequisites, walked in the order the skills could have been taken.
  for (const s of skills) {
    if (!skillTier(s) || skillTier(s) === "trained") continue;
    const others = skills.filter((x) => x !== s);
    if (!canTakeSkill({ skills: others }, s).ok) {
      out.push(finding(ERROR, "skills", `${s} is held without its prerequisite.`));
    }
  }

  // Point economy. Creation points, plus 2 per level, minus what was spent.
  const chosen = skills.filter((s) => !fixed.has(s) && skillTier(s));
  const picked = cls.pick ? Math.min(cls.pick.count, chosen.filter((s) => cls.pick.from.includes(s)).length) : 0;
  const spentOn = chosen.filter((s) => !(cls.pick && cls.pick.from.includes(s) && picked));
  const spent = spentOn.reduce((a, s) => a + (SKILL_COST[skillTier(s)] || 0), 0);
  const budget = cls.points + level * 2;
  if (spent > budget) {
    out.push(finding(ERROR, "skills",
      `${spent} skill points' worth held, but a level ${level} ${pc.cls} has only ${budget}.`));
  }

  /* ---- the rest ---- */
  if ((pc.resolve || 0) > 5) out.push(finding(ERROR, "resolve", "Resolve is capped at 5."));
  if ((pc.resolve || 0) > level) {
    out.push(finding(SUSPECT, "resolve", `Resolve ${pc.resolve} at level ${level} — Resolve is only gained by levelling.`));
  }
  if ((pc.stress || 0) < 0) out.push(finding(ERROR, "stress", "Stress cannot be negative."));
  if ((pc.credits || 0) < 0) out.push(finding(ERROR, "credits", "Credits cannot be negative."));
  if ((pc.credits || 0) > 100000) out.push(finding(SUSPECT, "credits", `${pc.credits}cr is a lot to be carrying.`));

  if (modules && pc.items) {
    const known = new Set(Object.keys(modules.items || {}));
    const strangers = pc.items.filter((i) => known.size && !known.has(i));
    if (strangers.length) {
      out.push(finding(NOTE, "gear", `Carrying gear this module doesn't define: ${strangers.slice(0, 6).join(", ")}.`));
    }
  }

  const errors = out.filter((f) => f.level === ERROR);
  return {
    ok: errors.length === 0,
    clean: out.length === 0,
    findings: out,
    errors: errors.length,
    suspect: out.filter((f) => f.level === SUSPECT).length,
  };
}

export const summarise = (result) =>
  result.clean ? "Legal — nothing unusual."
    : result.ok ? `Legal, ${result.findings.length} thing${result.findings.length === 1 ? "" : "s"} worth a look.`
      : `${result.errors} impossible value${result.errors === 1 ? "" : "s"}.`;
