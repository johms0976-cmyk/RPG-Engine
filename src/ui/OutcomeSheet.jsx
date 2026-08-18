/* ============================================================
   OUTCOME SHEET — the beat after the tap.

   Renders what useOutcome decided:

     · hold: false — a RECEIPT. A strip above the action bar that
       confirms the tap landed and then leaves on its own (the
       hook owns the timer; this component just draws it).

     · hold: true — a CONSEQUENCE. A card over the buttons with a
       torn-paper rule and one way out. Dismissing it is the point:
       carrying on becomes a decision rather than momentum.

   The kinds are the feed's own kinds, so the receipt reuses the
   feed's `k-*` colour language and reads like a torn-off strip of
   the log rather than a new UI idea.
   ============================================================ */
import React, { useEffect, useRef } from "react";

/** The card's masthead, picked from the loudest line on it. */
const HEADINGS = [
  ["whisper", "Only you see this"],
  ["panic", "Panic"],
  ["horror", "Horror"],
  ["dmg", "You are hurt"],
  ["alarm", "Alarm"],
  ["rollbad", "It goes wrong"],
  ["stress", "Stress"],
  ["handout", "You are handed something"],
  ["item", "Taken"],
];

function headingFor(lines) {
  for (const [kind, label] of HEADINGS) {
    if (lines.some((l) => l.kind === kind)) return label;
  }
  return "It happens";
}

export default function OutcomeSheet({ outcome, onDismiss }) {
  const goRef = useRef(null);

  // A consequence steals focus so the keyboard lands on the way out,
  // and Escape is the same as the button.
  useEffect(() => {
    if (!outcome || !outcome.hold) return undefined;
    if (goRef.current) goRef.current.focus();
    const onKey = (e) => { if (e.key === "Escape") onDismiss && onDismiss(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [outcome, onDismiss]);

  if (!outcome || !outcome.lines || !outcome.lines.length) return null;

  /* ---- receipt: acknowledges, then fades (the hook clears it) ---- */
  if (!outcome.hold) {
    return (
      <div className="outcome-receipt" role="status" aria-live="polite">
        <div className="feed">
          {outcome.lines.map((l) => (
            <p key={l.id} className={`k-${l.kind}`}>{l.text}</p>
          ))}
        </div>
      </div>
    );
  }

  /* ---- consequence: a card that has to be dismissed ---- */
  return (
    <div className="outcome-scrim" onClick={(e) => { if (e.target === e.currentTarget) onDismiss && onDismiss(); }}>
      <div
        className="outcome-card"
        role="alertdialog"
        aria-modal="true"
        aria-label={headingFor(outcome.lines)}
      >
        <div className="outcome-head">
          <span className="outcome-rule" aria-hidden="true" />
          <h2>{headingFor(outcome.lines)}</h2>
        </div>
        <div className="outcome-body">
          <div className="outcome-lines feed">
            {outcome.lines.map((l) => (
              <p key={l.id} className={`k-${l.kind}`}>{l.text}</p>
            ))}
          </div>
        </div>
        {/* kit's Btn doesn't forward refs, and this button needs focus
            stolen onto it — so it is the one raw button in the app,
            wearing Btn's exact classes. */}
        <button ref={goRef} type="button" className="btn primary outcome-go" onClick={onDismiss}>
          <span>Carry on</span>
        </button>
      </div>
    </div>
  );
}
