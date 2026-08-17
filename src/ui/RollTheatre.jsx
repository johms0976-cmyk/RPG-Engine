/* ============================================================
   ROLL THEATRE — the d100 as an event rather than a log line.

   Mothership's whole emotional shape is the moment between
   asking for the roll and reading it. Resolving that into a line
   of scrollback throws the moment away. This takes the screen,
   shows the target it was measured against, and makes a critical
   unmistakable — a critical in Mothership is matching digits, so
   the doubles are what the eye should land on.
   ============================================================ */
import React, { useEffect, useState } from "react";
import { pad } from "../engine/dice.js";

const verdictOf = (r) =>
  r.critHit ? { cls: "is-crit-success", text: "Critical success" }
    : r.critFail ? { cls: "is-crit-fail", text: "Critical failure" }
      : r.success ? { cls: "is-success", text: "Success" }
        : { cls: "is-fail", text: "Failure" };

export function RollTheatre({ roll, onDone, holdMs = 2600 }) {
  const [settling, setSettling] = useState(true);

  useEffect(() => {
    if (!roll) return;
    setSettling(true);
    const a = setTimeout(() => setSettling(false), 480);
    const b = onDone ? setTimeout(onDone, holdMs) : null;
    return () => { clearTimeout(a); if (b) clearTimeout(b); };
  }, [roll, onDone, holdMs]);

  if (!roll) return null;
  const v = verdictOf(roll);
  const crit = roll.critHit || roll.critFail;
  const shown = pad(roll.value);

  return (
    <div className="roll-theatre" role="status" aria-live="polite">
      <div className="roll-target">
        {roll.who} · {roll.label} · needs {roll.target} or under
      </div>

      <div className={`roll-face ${settling ? "is-settling" : ""} ${crit ? "is-crit" : ""} ${v.cls}`}>
        {shown}
      </div>

      <div className={`roll-verdict ${v.cls}`}>{v.text}</div>

      <div className="roll-margin">
        {crit
          ? "Matching digits."
          : roll.success
            ? `Under by ${roll.margin}.`
            : `Over by ${Math.abs(roll.margin)}.`}
        {roll.mode && roll.mode !== "none" && (
          <> · rolled with {roll.mode === "advantage" ? "Advantage" : "Disadvantage"}
            {roll.all && roll.all.length > 1 && ` (${roll.all.map((x) => pad(x.value)).join(" / ")})`}
          </>
        )}
      </div>

      {roll.breakdown && roll.breakdown.length > 0 && (
        <div className="roll-note">
          {roll.breakdown.map((b) => b.why || b.label).filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}

/** Which way a modifier cuts, shown as a badge rather than buried in text. */
export function ModeBadge({ mode }) {
  if (!mode || mode === "none") return null;
  const adv = mode === "advantage";
  return (
    <span className={`sig ${adv ? "sig-adv" : "sig-dis"}`}>
      {adv ? "▲ Advantage" : "▼ Disadvantage"}
    </span>
  );
}

export default RollTheatre;
