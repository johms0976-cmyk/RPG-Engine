/* ============================================================
   DECLARE DICE — the panel for a table that brought their own.

   See engine/declared.js for why this exists. This file is only
   about making it take three seconds, because a table that rolls
   real dice and then spends fifteen seconds typing has been given
   a worse experience than the button they replaced.

   THE SHAPE, AND WHY IT IS TWO GRIDS AND NOT A TEXT FIELD

   A text field is one tap plus a keyboard plus a keyboard that
   covers the thing you are looking at. Two rows of ten large
   targets is one tap for the tens and one for the ones, in the
   same order the dice are read out loud, with nothing sliding
   over the screen. It is also the layout that survives being
   used by somebody holding two dice in their other hand.

   The tens row is labelled TENS and the ones row ONES rather than
   left and right, because the single most common percentile
   mistake is reading the dice in the order they landed rather
   than the order they mean, and a table with a d100 and a d10
   does not have a "left" die at all.

   ------------------------------------------------------------
   THE READBACK IS THE FEATURE

   As soon as both digits are in, the panel says the whole thing
   back in words: "47 — over 35. Failure." That single line does
   four jobs at once. It catches the transposed 74. It teaches
   roll-under to the player who came from D&D. It puts the verdict
   on the phone before the host confirms it, so the beat lands at
   the table rather than after a round trip. And it makes a
   critical unmissable, which matters because a Critical Failure
   on a Save is a Panic Check and Panic is what actually kills
   people in this game.

   The readback is deliberately computed on the phone from the
   preview target — the same advisory arithmetic RollPrompt
   already shows and already disclaims. The host recomputes. If
   the Warden is holding a modifier back, the readback is wrong
   and the feed is right, which is the existing bargain and not a
   new one.

   ------------------------------------------------------------
   BOTH DICE UNDER ADVANTAGE, ALWAYS

   `declaredCheck` refuses to resolve one pair under Advantage,
   and this panel is the reason that refusal is survivable: it
   asks for the second roll explicitly, shows both, and shows
   which one won and why. A player watching "23 and 45 — taking
   23" learns the Advantage rule in one evening, which is more
   than the internal roller ever taught anybody.

   ------------------------------------------------------------
   AND THE WAY OUT IS ALWAYS VISIBLE

   Somebody will pick this mode and then not have dice for one
   roll. "Let the app roll this one" sits at the bottom, quietly,
   every time. A mode you cannot step out of mid-session is a
   mode a table will not step into.
   ============================================================ */
import React, { useState, useMemo, useCallback } from "react";
import { Btn } from "./kit.jsx";
import { parseDeclared, declaredCheck, declaredPairsNeeded } from "../engine/declared.js";

const FACES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** One row of ten. Radios rather than buttons so a screen reader
    announces it as the single choice it is. */
function DieRow({ label, name, value, onPick, disabled }) {
  return (
    <fieldset className="dd-row" disabled={disabled}>
      <legend className="dd-legend">{label}</legend>
      <div className="dd-faces">
        {FACES.map((f) => (
          <label key={f} className={`dd-face${value === f ? " is-on" : ""}`}>
            <input
              type="radio" name={name} value={f}
              checked={value === f}
              onChange={() => onPick(f)}
            />
            <span aria-hidden="true">{f}</span>
            <span className="sr-only">{label} {f}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A pair, as the table reads it. `null` in either slot means unset. */
function Pair({ idx, pair, setPair, disabled }) {
  const [tens, ones] = pair;
  const shown = tens != null && ones != null ? `${tens}${ones}` : "--";
  return (
    <div className="dd-pair">
      <div className="dd-pair-head">
        <span className="dd-pair-n">{shown}</span>
        {idx > 0 && <span className="dd-pair-k">second roll</span>}
      </div>
      <DieRow label="Tens" name={`dd-t-${idx}`} value={tens} disabled={disabled}
        onPick={(v) => setPair([v, ones])} />
      <DieRow label="Ones" name={`dd-o-${idx}`} value={ones} disabled={disabled}
        onPick={(v) => setPair([tens, v])} />
    </div>
  );
}

/**
 * @param {object}   preview   the object RollPrompt already computed
 *                             — needs `target` and `mode`.
 * @param {string}   label     "Roll Fear", for the confirm button.
 * @param {boolean}  isSave    whether a critical failure is a Panic Check.
 * @param {function} onDeclare called with an array of `[tens, ones]`
 *                             pairs. Flows to `resolvePending({ declared })`.
 * @param {function} onFallBack called when the player asks the app to roll.
 * @param {string}   advTieBreak the table's house rule, for the readback.
 */
export default function DeclareDice({
  preview, label = "Confirm", isSave = false,
  onDeclare, onFallBack, advTieBreak = "high",
}) {
  const mode = (preview && preview.mode) || "none";
  const need = declaredPairsNeeded(mode);
  const [pairs, setPairs] = useState(() =>
    Array.from({ length: need }, () => [null, null]));

  const setPair = useCallback((i, next) => {
    setPairs((p) => p.map((x, j) => (j === i ? next : x)));
  }, []);

  const complete = pairs.slice(0, need).every(([t, o]) => t != null && o != null);

  /* The readback. Advisory, same as everything else on this panel. */
  const verdict = useMemo(() => {
    if (!complete || !preview) return null;
    const r = declaredCheck(preview.target, mode, pairs.slice(0, need), { advTieBreak });
    if (r.error) return null;
    return r;
  }, [complete, preview, mode, pairs, need, advTieBreak]);

  const sentence = useMemo(() => {
    if (!verdict) return null;
    const n = String(verdict.value).padStart(2, "0");
    const dir = verdict.success ? "under" : "over";
    const band = verdict.critHit ? "Critical success."
      : verdict.critFail ? "Critical failure."
      : verdict.success ? "Success." : "Failure.";
    return `${n} — ${dir} ${verdict.target}. ${band}`;
  }, [verdict]);

  /* ============================================================
     THE MISREAD

     Physical dice produce one error the app cannot: transposition.
     A d100 is read tens-then-ones off two dice, somebody reads 47
     off dice showing 74, and the app has no way to know — nobody
     is checking these, by design.

     At a table with a Warden this gets solved by somebody leaning
     over. Wardenless there is nobody to lean, and the only
     existing remedy is the `rewind` vote, which stops the session,
     polls five people and rolls the clock back — a sledgehammer
     for a typo, and heavy enough that a player will usually
     shrug and take the wrong result instead. Taking a wrong
     result quietly is precisely the habit that makes a table stop
     trusting the app.

     So: swap the digits, one tap, before confirming. It only
     shows when the transposition would produce a DIFFERENT
     OUTCOME — 33 reads the same either way, and offering to
     correct something that cannot be wrong is noise that teaches
     people to ignore the control.

     Deliberately pre-confirmation only. Once declared, the roll
     has resolved and its effects have landed, and unwinding that
     is what `rewind` is for — a genuinely table-wide event that
     genuinely deserves a vote. This fixes the typo before it
     becomes one.
     ============================================================ */
  const swap = useMemo(() => {
    if (!complete || !verdict || need !== 1) return null;
    const [t, o] = pairs[0];
    if (t === o) return null;
    const alt = declaredCheck(preview.target, mode, [[o, t]], { advTieBreak });
    if (alt.error) return null;
    /* Same verdict either way — nothing worth offering. */
    if (alt.success === verdict.success
      && alt.critHit === verdict.critHit
      && alt.critFail === verdict.critFail) return null;
    return {
      value: String(alt.value).padStart(2, "0"),
      apply: () => setPairs((p) => p.map((x, j) => (j === 0 ? [o, t] : x))),
    };
  }, [complete, verdict, need, pairs, preview, mode, advTieBreak]);

  /* Under Advantage, say which of the two won. This is the whole
     rule, taught in one line, at the moment it applies. */
  const chosen = useMemo(() => {
    if (!verdict || need === 1 || !verdict.all) return null;
    const both = verdict.all.map((r) => String(r.value).padStart(2, "0")).join(" and ");
    return `${both} — taking ${String(verdict.value).padStart(2, "0")}`;
  }, [verdict, need]);

  return (
    <div className="dd stack">
      <p className="dd-ask">
        {need === 2
          ? `Roll twice with ${mode === "advantage" ? "Advantage" : "Disadvantage"} and read both in.`
          : "Read your dice in."}
      </p>

      {pairs.slice(0, need).map((p, i) => (
        <Pair key={i} idx={i} pair={p} setPair={(v) => setPair(i, v)} />
      ))}

      {chosen && <p className="dd-chosen">{chosen}</p>}

      {sentence && (
        <p
          className={`dd-verdict${verdict.critFail ? " is-crit-fail" : ""}${verdict.critHit ? " is-crit-hit" : ""}`}
          role="status"
        >
          {sentence}
          {isSave && verdict.critFail && " That is a Panic Check."}
        </p>
      )}

      {swap && (
        <button type="button" className="dd-swap" onClick={swap.apply}>
          Misread? Tap to make it {swap.value}
        </button>
      )}

      <Btn
        kind="accent"
        disabled={!complete}
        onClick={() => onDeclare(pairs.slice(0, need).map(([t, o]) => [t, o]))}
      >
        {complete ? label : need === 2 ? "Both dice first" : "Both digits first"}
      </Btn>

      <button type="button" className="dd-out" onClick={onFallBack}>
        Let the app roll this one
      </button>

      <p className="dd-caveat">
        Nobody is checking these. They are your dice and the table can see them.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------
   The stylesheet lives with the rest of the phone. Ten targets
   across a 360px screen is 32px each with gaps, which is under
   the 44px tap guideline — so the faces are 40px tall and the row
   is allowed to be tight horizontally, because a mis-tap here is
   instantly visible in the readback and one tap to fix.
   ------------------------------------------------------------ */
export const DECLARE_DICE_CSS = `
.dd { gap: 10px; }
.dd-ask { margin: 0; font-size: 13px; opacity: .8; }
.dd-pair { border: 1px solid var(--line, #2a2f36); border-radius: 6px; padding: 8px; }
.dd-pair-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px; }
.dd-pair-n { font-family: var(--mono, monospace); font-size: 30px; font-weight: 700; letter-spacing: .04em; }
.dd-pair-k { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; opacity: .55; }
.dd-row { border: 0; margin: 0 0 6px; padding: 0; }
.dd-legend { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; opacity: .55; padding: 0 0 3px; }
.dd-faces { display: grid; grid-template-columns: repeat(10, 1fr); gap: 3px; }
.dd-face { position: relative; display: grid; place-items: center; height: 40px;
  border: 1px solid var(--line, #2a2f36); border-radius: 4px; cursor: pointer;
  font-family: var(--mono, monospace); font-size: 15px; }
.dd-face input { position: absolute; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
.dd-face.is-on { background: var(--accent, #c8ff4d); color: #000; border-color: var(--accent, #c8ff4d); font-weight: 700; }
.dd-face:focus-within { outline: 2px solid var(--accent, #c8ff4d); outline-offset: 1px; }
.dd-chosen { margin: 0; font-family: var(--mono, monospace); font-size: 12px; opacity: .7; }
.dd-verdict { margin: 0; font-family: var(--mono, monospace); font-size: 15px; font-weight: 700; }
.dd-verdict.is-crit-fail { color: var(--bad, #ff5f56); }
.dd-verdict.is-crit-hit { color: var(--good, #6fe08a); }
.dd-out { background: none; border: 0; padding: 4px 0; text-decoration: underline;
  font: inherit; font-size: 12px; opacity: .6; cursor: pointer; text-align: left; }
.dd-caveat { margin: 0; font-size: 11px; opacity: .5; }
@media (prefers-reduced-motion: reduce) { .dd-face { transition: none; } }
`;
