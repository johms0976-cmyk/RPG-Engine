/* ============================================================
   ROLL PREVIEW — the number, before you let go of the dice.

   THE PROBLEM THIS FIXES IS THE BIGGEST ONE IN THE PHONE CLIENT.

   The pending-roll modal said this, and only this:

       A roll is called for
       [reason]
       [press and hold — Roll Fear]

   A player at a physical table, asked for a Fear Save, looks at
   their sheet. The number is the first thing they see and it is
   the whole basis of every decision that follows: whether to
   spend the assist, whether to swallow a stim first, whether to
   argue that this should not be a roll at all. The number is not
   flavour. It is the game.

   On the phone that number was computed host-side, applied
   host-side, and shown to the player *afterwards*, in a feed
   line, as part of a result that had already happened. The
   player pressed a button labelled with a stat name and found
   out what they had been rolling against once it no longer
   mattered.

   That is a strictly worse experience than paper, and it is
   worse in the specific way that matters most to an experienced
   Mothership player: it removes the decision and leaves the
   ceremony.

   WHY THIS CAN BE DONE ON THE PHONE AT ALL

   Every input is already there. `collectModifiers` is pure and
   takes a context the client can build from its own snapshot;
   `baseValue` and `clampTarget` are pure; the module is compiled
   into every client. So the phone can compute exactly what the
   host will compute, with no protocol change and no new trust.

   And crucially: this is a *preview*, never an authority. The
   host recomputes from its own unredacted state when the roll
   actually runs. If the two ever disagree — because the phone
   was redacted out of some modifier it is not allowed to know
   about — the host wins and the player learns something. A
   preview that is occasionally an underestimate is fine. A
   preview that replaces the host's arithmetic would be a
   security hole.

   ------------------------------------------------------------
   THE ODDS

   Roll-under d% is one of the few systems where the probability
   is legible without a calculator: target 45 is a 46% chance,
   near enough. Two things make it worth computing anyway.

   First, Advantage. `1 - (1-p)²` is not something anyone does at
   the table, and the gap is large exactly where decisions live:
   a 35% roll becomes 58% with Advantage. A player deciding
   whether to burn their once-per-day assist is deciding between
   those two numbers and has never seen either.

   Second, critical failure. In Mothership a Critical Failure on
   a Save is a Panic Check, which is the thing that actually
   ends characters. Doubles above your target are that. On a
   target of 20 there are eight of them; on a target of 80 there
   is one. That is the difference between a routine roll and a
   dangerous one, it is invisible, and it is the single most
   useful number this file produces.
   ============================================================ */

import { collectModifiers } from "./modifiers.js";
import { baseValue, clampTarget, STAT_LABEL } from "./rules.js";

/* ---------------- the four bands, exactly as dice.js scores them ----------------

   00 always succeeds and 99 always fails whatever the target is;
   doubles are critical. Enumerating all 100 outcomes is cheaper
   and more honest than deriving a formula that would then have
   to be kept in step with scoreRoll() by hand. */
export function bandOdds(target) {
  const t = clampTarget(target);
  const out = { critSuccess: 0, success: 0, fail: 0, critFail: 0 };
  for (let v = 0; v < 100; v += 1) {
    const doubles = Math.floor(v / 10) === v % 10;
    const success = v === 0 ? true : v === 99 ? false : v <= t;
    const crit = doubles || v === 0 || v === 99;
    if (success) out[crit ? "critSuccess" : "success"] += 1;
    else out[crit ? "critFail" : "fail"] += 1;
  }
  for (const k of Object.keys(out)) out[k] /= 100;
  return out;
}

const ORDER = ["critFail", "fail", "success", "critSuccess"];

/**
 * Band probabilities after Advantage or Disadvantage.
 *
 * dice.js picks by band — Critical Success > Success > Failure >
 * Critical Failure — so two rolls resolve to the max band under
 * Advantage and the min band under Disadvantage. That makes this
 * an order-statistic over four ordered outcomes, computed from
 * the cumulative distribution rather than by simulating 10,000
 * pairs on every render.
 */
export function modeOdds(target, mode = "none") {
  const p = bandOdds(target);
  if (mode !== "advantage" && mode !== "disadvantage") return p;

  const cum = [];
  let run = 0;
  for (const k of ORDER) { run += p[k]; cum.push(run); }

  const out = {};
  for (let i = 0; i < ORDER.length; i += 1) {
    const atMost = cum[i];
    const below = i === 0 ? 0 : cum[i - 1];
    out[ORDER[i]] = mode === "advantage"
      // P(max = band) = P(both <= band) - P(both < band)
      ? atMost * atMost - below * below
      // P(min = band) = P(both >= band) - P(both > band)
      : (1 - below) * (1 - below) - (1 - atMost) * (1 - atMost);
  }
  return out;
}

export const successChance = (target, mode) => {
  const o = modeOdds(target, mode);
  return o.success + o.critSuccess;
};

export const critFailChance = (target, mode) => modeOdds(target, mode).critFail;

export const pct = (p) => Math.round(p * 100);

/**
 * Everything the roll prompt needs, computed from what this phone
 * already has.
 *
 * @param {object} req      the pending roll request: { kind, name, skill, tags, mode }
 * @param {object} ctx      { pc, crew, items, world, mod, houseRules }
 * @param {string|null} assist  pcId of a crew member helping, if one is selected
 */
export function previewRoll(req, ctx, assist) {
  if (!req || !ctx || !ctx.pc) return null;
  const { pc, crew = [], items = {}, world, mod, houseRules = {} } = ctx;

  const m = collectModifiers({
    world, mod, crew, items, houseRules, pc,
    kind: req.kind, name: req.name, skill: req.skill,
    tags: req.tags, mode: req.mode, assist: assist || undefined,
    situational: req.situational,
  });

  const base = baseValue(pc, req.kind, req.name, items);
  const target = clampTarget(base + m.bonus);
  const odds = modeOdds(target, m.mode);

  return {
    base,
    bonus: m.bonus,
    target,
    mode: m.mode,
    breakdown: m.breakdown,
    advCount: m.advCount,
    disCount: m.disCount,
    odds,
    success: odds.success + odds.critSuccess,
    critFail: odds.critFail,
    /* A Critical Failure on a Save is a Panic Check (PSG 26.2).
       On a Check it is merely bad. Saying which of the two you are
       about to make is most of the value of the whole panel. */
    critFailPanics: req.kind === "save",
    label: `${STAT_LABEL[req.name] || req.name}${req.kind === "save" ? " Save" : " Check"}`,
  };
}

/**
 * One sentence, for a screen reader and for anyone who would
 * rather read than parse a row of figures. Deliberately states
 * the direction — "roll under" — because every intuition brought
 * from other systems is upside down here.
 */
export function previewSentence(p) {
  if (!p) return "";
  const modeWord = p.mode === "advantage" ? " at Advantage"
    : p.mode === "disadvantage" ? " at Disadvantage" : "";
  const risk = p.critFail > 0
    ? ` ${pct(p.critFail)}% is a critical failure${p.critFailPanics ? ", which is a Panic Check" : ""}.`
    : "";
  return `${p.label}: roll d100 under ${p.target}${modeWord}. About ${pct(p.success)}% succeeds.${risk}`;
}
