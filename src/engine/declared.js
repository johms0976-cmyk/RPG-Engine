/* ============================================================
   DECLARED DICE — giving the dice back, all the way.

   `HoldToRoll` was the right diagnosis and half the cure. It
   restored the *pause* — the second where you decide to let go —
   and it did nothing about the other half, which is that the
   number still came out of a random number generator nobody at
   the table can see.

   That matters more in Mothership than in most games, for three
   separate reasons and only one of them is superstition.

     1. THE DICE ARE THE TABLE'S PROP. A Mothership table owns
        two d10s per person and a Panic die, and the object of
        the evening is watching somebody's hand shake over them.
        Software that takes them away has removed the thing the
        players brought.

     2. TRUST IS THE ENGINE'S ONLY CURRENCY HERE. The repo makes
        a great deal — correctly — of the host being the sole
        authority and phones rendering redacted snapshots. The
        cost of that design is that a player who dies to a 97
        has no way whatsoever to check the 97. At a physical
        table the number is on the table. Here it is an
        assertion. The first time a table half-believes the app
        fudged a roll, the app is finished, and no amount of
        `tests/` fixes it because the suspicion is not about
        correctness.

     3. IT IS AN ACCESSIBILITY ROUTE NOBODY ASKED FOR AND
        SOMEBODY NEEDS. A player who cannot hold a button, cannot
        shake a phone, or is playing on a borrowed laptop with a
        dead trackpad can pick two dice up and read them out.

   ------------------------------------------------------------
   WHAT THIS IS NOT

   It is not a second rules engine. Every judgement — success,
   criticals, banding under Advantage, the 00/99 overrides — is
   `dice.js`'s, reached through the same `scoreRoll` the internal
   roller uses. The only thing this file replaces is the source
   of the two digits. If the two ever disagree, `dice.js` is
   right and `tests/declared.test.js` will say so.

   It is not a trust mechanism either, and the honest version of
   this feature says so out loud. A player who types 04 having
   rolled 84 has cheated, exactly as they could have at a
   physical table by cupping a hand. Software cannot fix that and
   should not pretend to; what it can do is make the honest case
   pleasant and leave the dishonest one visible to five other
   people who are looking at the same dice.

   ------------------------------------------------------------
   THE ONE THING THAT WOULD HAVE GONE WRONG

   Advantage and Disadvantage need TWO pairs, and the naive
   implementation asks for one, resolves, and quietly drops the
   mode — which turns the most consequential modifier in the game
   into a no-op that nobody notices for six sessions. So
   `declaredCheck` refuses rather than guesses: hand it one pair
   under Advantage and it returns `{ need: 2 }` and resolves
   nothing. The UI's job is to ask for the second die. The
   engine's job is to never silently downgrade a roll.
   ============================================================ */
import { scoreRoll } from "./dice.js";
import { clampTarget } from "./rules.js";

/** A declared roll is two d10s. Anything else is a typo. */
export const DIE_MIN = 0;
export const DIE_MAX = 9;

export const DECLARE_ERRORS = {
  EMPTY: "Nothing entered.",
  RANGE: "Each die reads 0 to 9. The tens die is the first one.",
  PARSE: "Enter two digits — the tens die, then the ones die.",
  NEED_TWO: "Advantage and Disadvantage need both rolls before anything resolves.",
};

/**
 * Normalise whatever the table typed into the same shape
 * `rollPercent` produces.
 *
 * Accepts, deliberately generously, because this is being typed by
 * somebody holding dice:
 *
 *   [4, 7]      the two dice, as the table reads them
 *   47          the percentile, as the table says it
 *   "47" "4 7"  "4,7"  "04"  "0"   the same, typed
 *
 * A bare `0` is 00, which in Mothership is an automatic success and
 * the single most misread result in the game — so it is handled
 * explicitly rather than falling through a falsy check.
 *
 * @returns {{value:number, tens:number, ones:number, doubles:boolean}|{error:string}}
 */
export function parseDeclared(input) {
  let tens = null, ones = null;

  if (Array.isArray(input)) {
    if (input.length !== 2) return { error: DECLARE_ERRORS.PARSE };
    [tens, ones] = input.map((n) => (n === "" || n == null ? NaN : Number(n)));
  } else if (typeof input === "number") {
    if (!Number.isFinite(input)) return { error: DECLARE_ERRORS.PARSE };
    if (input < 0 || input > 99 || !Number.isInteger(input)) return { error: DECLARE_ERRORS.RANGE };
    tens = Math.floor(input / 10);
    ones = input % 10;
  } else if (typeof input === "string") {
    const s = input.trim();
    if (!s) return { error: DECLARE_ERRORS.EMPTY };
    const digits = s.match(/\d/g);
    if (!digits) return { error: DECLARE_ERRORS.PARSE };
    if (digits.length === 1) { tens = 0; ones = Number(digits[0]); }
    else if (digits.length === 2) { tens = Number(digits[0]); ones = Number(digits[1]); }
    else return { error: DECLARE_ERRORS.PARSE };
  } else {
    return { error: DECLARE_ERRORS.EMPTY };
  }

  if (!Number.isInteger(tens) || !Number.isInteger(ones)) return { error: DECLARE_ERRORS.PARSE };
  if (tens < DIE_MIN || tens > DIE_MAX || ones < DIE_MIN || ones > DIE_MAX) {
    return { error: DECLARE_ERRORS.RANGE };
  }

  return { value: tens * 10 + ones, tens, ones, doubles: tens === ones };
}

/** True if this shape came back from `parseDeclared` in one piece. */
export const isDeclared = (r) => !!(r && r.error == null && Number.isInteger(r.value));

/**
 * How many pairs this roll needs before it can resolve.
 * Exported because the prompt has to decide what to render before
 * anybody has touched a die.
 */
export const declaredPairsNeeded = (mode) => (mode === "none" || !mode ? 1 : 2);

/**
 * The declared counterpart of `check()`. Same return shape, same
 * house-rule tie-break, same banding — the dice arrive from the
 * table instead of the generator.
 *
 * @param {number} target
 * @param {"none"|"advantage"|"disadvantage"} mode
 * @param {Array} declared  one entry per pair; each is anything
 *                          `parseDeclared` accepts.
 * @param {{advTieBreak?: "high"|"low"}} [opts]
 * @returns {object} the same object `check()` returns, plus
 *                   `declared: true`; or `{ error }`, or
 *                   `{ need: n }` when a pair is still missing.
 */
export function declaredCheck(target, mode = "none", declared = [], opts = {}) {
  const need = declaredPairsNeeded(mode);
  const list = (Array.isArray(declared) ? declared : [declared]).filter(
    (x) => x !== null && x !== undefined && x !== "",
  );

  if (list.length < need) {
    return { need, have: list.length, error: need === 2 ? DECLARE_ERRORS.NEED_TWO : DECLARE_ERRORS.EMPTY };
  }

  const parsed = list.slice(0, need).map(parseDeclared);
  const bad = parsed.find((p) => p.error);
  if (bad) return { error: bad.error };

  const t = clampTarget(target);
  const tie = opts.advTieBreak === "low" ? "low" : "high";
  const scored = parsed.map((r) => scoreRoll(r, t));

  let picked = scored[0];
  if (need === 2) {
    const wantBest = mode === "advantage";
    picked = scored.reduce((a, b) => {
      if (a.band !== b.band) return (wantBest ? b.band > a.band : b.band < a.band) ? b : a;
      const preferHigh = wantBest ? tie === "high" : tie === "low";
      return (preferHigh ? b.value > a.value : b.value < a.value) ? b : a;
    });
  }

  return { ...picked, target: t, mode, all: scored, margin: t - picked.value, declared: true };
}

/**
 * Panic Checks are 2d10 against Stress and are rolled *over*, so
 * they cannot go through `declaredCheck` — different dice, opposite
 * direction, no criticals. This is the small sibling.
 *
 * @param {Array<number|string>} dice two d10 faces, 1-10 as the
 *        table reads them (a 0 face is 10, which is how everybody's
 *        d10 is actually printed).
 */
export function parsePanicDice(dice) {
  const list = Array.isArray(dice) ? dice : [dice];
  if (list.length !== 2) return { error: "A Panic Check is two d10s." };
  const faces = list.map((n) => {
    const v = Number(String(n).trim());
    if (!Number.isInteger(v) || v < 0 || v > 10) return NaN;
    return v === 0 ? 10 : v; // the 0 face is a ten
  });
  if (faces.some((f) => !Number.isFinite(f))) return { error: "Each die reads 1 to 10." };
  return { total: faces[0] + faces[1], faces };
}

/* ------------------------------------------------------------
   WHOSE DICE ARE THESE, AND SHOULD ANYONE BELIEVE THEM

   The roll log already records every number. When one came from
   the table rather than the generator, the log should say so —
   not to police anybody, but because a Warden reading a session
   back wants to know whether the 97 that ended Riley was the
   app's or the room's, and because a bug report with a save
   attached is only replayable for the rolls the engine made.

   `declaredNote` is the one string that goes in the feed line and
   the transcript. It is short on purpose: this should read as a
   provenance stamp, not an accusation.
   ------------------------------------------------------------ */
export const declaredNote = (r) => (r && r.declared ? " · table dice" : "");

/**
 * Fraction of this session's rolls that came off the table. The
 * Warden's screen shows it once, in Tempo, because a table that
 * started out rolling their own and drifted back to the button has
 * told you something about how the evening is going.
 */
export function declaredShare(rollLog = []) {
  if (!rollLog.length) return 0;
  const n = rollLog.filter((r) => r && r.declared).length;
  return n / rollLog.length;
}
