/* ============================================================
   ODDS — the one number a Mothership player cannot work out in
   their head, and the one they most need.

   A Panic Check is 2d10 against current Stress: roll OVER and
   you hold it together and shed a point; roll equal or under and
   you go to the Panic Effect table. `useGame.doPanic` implements
   exactly that, and this file is the arithmetic of the same
   sentence — kept separate, and pure, so the two cannot drift
   and so the drawn odds can be tested.

   Why it matters enough to have a file: 2d10 is a triangular
   distribution, not a flat one, and every intuition a player
   brings from d20 games is wrong about it. Stress 8 is a 28%
   chance of panicking. Stress 12 is 64%. Those are completely
   different games and they look identical on a row of pips —
   four segments versus six, on a twenty-segment bar, at arm's
   length, in a dark room.

   Nobody is going to do this arithmetic at the table, so the
   phone should. A player who can see the number gets to make the
   decision the game is actually about: push on, or spend the
   scene calming down.
   ============================================================ */

/** Ways to roll each total on 2d10. Triangular, peaking at 11. */
export function ways(total) {
  if (total < 2 || total > 20) return 0;
  return 10 - Math.abs(total - 11);
}

/** P(2d10 <= n), as a fraction of 100 outcomes. */
export function atMost(n) {
  let out = 0;
  for (let s = 2; s <= Math.min(20, Math.floor(n)); s += 1) out += ways(s);
  return out / 100;
}

/**
 * The chance a Panic Check fails — i.e. that you Panic.
 * Rolling *equal to or under* your Stress is the failure, so this
 * is simply P(2d10 <= stress).
 */
export function panicChance(stress) {
  const s = Math.max(0, Math.floor(Number(stress) || 0));
  if (s < 2) return 0;
  if (s >= 20) return 1;
  return atMost(s);
}

/** The chance you hold it together — and shed a point of Stress
    for having done so, which players routinely forget is the only
    Stress relief available mid-scene. */
export const holdChance = (stress) => 1 - panicChance(stress);

/** Rounded percentage, for display. */
export const pct = (p) => Math.round(p * 100);

/* Bands, so the strip can change colour without the reader having
   to interpret a number. The boundaries are where the decision
   changes rather than round numbers: under a fifth is a risk you
   take without thinking, over half is a risk you take on purpose. */
export function panicBand(stress) {
  const p = panicChance(stress);
  if (p <= 0) return "none";
  if (p < 0.2) return "low";
  if (p < 0.5) return "real";
  if (p < 0.85) return "likely";
  return "certain";
}

/**
 * What a Panic Effect would most likely be, if one happened now.
 * Median 2d10 is 11; Resolve comes straight off the total (PSG
 * 26.3), and a total of 1 or less means no effect at all.
 *
 * Returned as a total rather than a table row so the caller can
 * decide how much of the answer to show — the row's *name* is a
 * spoiler on a screen a player glances at, but the fact that the
 * likely outcome is off the bottom of the table is not.
 */
export function likelyEffectTotal(stress, resolve = 0) {
  return 11 + Math.max(0, Math.floor(stress || 0)) - Math.max(0, Math.floor(resolve || 0));
}

/**
 * One short sentence for a tooltip or a screen reader. Deliberately
 * states the *rule* as well as the number, because a player who
 * only sees "64%" does not know which way is bad.
 */
export function panicOddsSentence(stress) {
  const s = Math.max(0, Math.floor(Number(stress) || 0));
  if (s < 2) return "A Panic Check now is impossible to fail: 2d10 cannot roll under 2.";
  const p = pct(panicChance(s));
  return `A Panic Check now is 2d10 against Stress ${s}. Rolling over holds — ${100 - p}% — and sheds a point. ${p}% says you Panic.`;
}
