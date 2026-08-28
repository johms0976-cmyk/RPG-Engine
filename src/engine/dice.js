/* ============================================================
   DICE — Mothership 1e resolution. No module knowledge.

   Advantage & Disadvantage (PSG 3.3):
     "roll d% twice and use the better result" / "the worse result".
     The rulebook's own worked examples make clear that better and
     worse are judged by OUTCOME, not by raw number:
       - Abel (Str 36) rolls 23 and 45 with Advantage and takes 23.
       - Lilith (Spd 42) rolls 55 and 62 with Disadvantage and takes
         55, because 55 is a Critical Failure and therefore worse.
     So the ranking is:
        Critical Success > Success > Failure > Critical Failure
     The old implementation ranked purely by value and could hand a
     player a plain 45 over a critical 22. That is fixed here.

     Where both rolls land in the SAME band the rules are genuinely
     ambiguous (PSG 4.2 wants a high roll-under for Opposed Checks;
     the Abel example takes the low one). That case is exposed as a
     house rule: `advTieBreak: "high" | "low"`.
   ============================================================ */
import { evalDice, evalDiceVerbose, isValidDice } from "./diceParser.js";

export const d = (n) => 1 + Math.floor(Math.random() * n);
export const dN = (count, sides) =>
  Array.from({ length: count }, () => d(sides)).reduce((a, b) => a + b, 0);

/** d% : two d10s read as tens + ones, 0-99. Doubles are criticals. */
export function rollPercent(rng = Math.random) {
  const tens = Math.floor(rng() * 10);
  const ones = Math.floor(rng() * 10);
  return { value: tens * 10 + ones, tens, ones, doubles: tens === ones };
}

/** Outcome band, highest is best. Used to pick under Advantage/Disadvantage. */
export const BAND = { CRIT_FAIL: 0, FAIL: 1, SUCCESS: 2, CRIT_SUCCESS: 3 };

export function scoreRoll(r, target) {
  // 00 always succeeds, 99 always fails, regardless of target.
  const success = r.value === 0 ? true : r.value === 99 ? false : r.value <= target;
  const crit = r.doubles || r.value === 0 || r.value === 99;
  const band = crit
    ? (success ? BAND.CRIT_SUCCESS : BAND.CRIT_FAIL)
    : (success ? BAND.SUCCESS : BAND.FAIL);
  return {
    ...r, success, crit, band,
    critHit: band === BAND.CRIT_SUCCESS,
    critFail: band === BAND.CRIT_FAIL,
  };
}

/**
 * Roll under `target` on d%.
 * @param {number} target
 * @param {"none"|"advantage"|"disadvantage"} mode
 * @param {{advTieBreak?: "high"|"low", rng?: () => number}} [opts]
 */
export function check(target, mode = "none", opts = {}) {
  const rng = opts.rng || Math.random;
  const tie = opts.advTieBreak === "low" ? "low" : "high";
  const t = Math.max(1, Math.min(99, Math.round(target)));

  const raw = mode === "none" ? [rollPercent(rng)] : [rollPercent(rng), rollPercent(rng)];
  const scored = raw.map((r) => scoreRoll(r, t));

  let picked = scored[0];
  if (mode === "advantage" || mode === "disadvantage") {
    const wantBest = mode === "advantage";
    picked = scored.reduce((a, b) => {
      if (a.band !== b.band) return (wantBest ? b.band > a.band : b.band < a.band) ? b : a;
      // same band - house rule decides. "high" keeps the higher number
      // (right for Opposed Checks), "low" keeps the lower (the Abel example).
      const preferHigh = wantBest ? tie === "high" : tie === "low";
      return (preferHigh ? b.value > a.value : b.value < a.value) ? b : a;
    });
  }

  return { ...picked, target: t, mode, all: scored, margin: t - picked.value };
}

/**
 * Opposed roll-under (PSG 4.2).
 * Returns "attacker" | "defender" | "reroll" | "both-fail".
 */
export function opposedResult(att, def) {
  if (att.critFail && def.critFail) return "both-fail";
  if (att.critFail) return "defender";
  if (def.critFail) return "attacker";
  if (att.critHit && !def.critHit) return "attacker";
  if (def.critHit && !att.critHit) return "defender";
  if (att.success && !def.success) return "attacker";
  if (!att.success && def.success) return "defender";
  if (!att.success && !def.success) return "both-fail";
  if (att.value === def.value) return "reroll";
  return att.value > def.value ? "attacker" : "defender";
}

/** Convenience wrapper. `reroll` and `both-fail` both mean "no hit". */
export function opposed(att, def) {
  return opposedResult(att, def) === "attacker";
}

export const pad = (n) => String(n).padStart(2, "0");

export { evalDice, evalDiceVerbose, isValidDice };
