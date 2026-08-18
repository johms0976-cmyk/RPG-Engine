/* ============================================================
   OUTCOME SHEET — the beat after the tap.

   Two shapes for one idea. A receipt is a strip that says the tap
   landed and then gets out of the way. A consequence is a card
   that covers the buttons until it is dismissed, because "you take
   4 damage" should not be something you scroll past on the way to
   your next action.

   Everything here reuses the feed's own `k-` classes, so a Stress
   line looks the same on the card as it does in the log. That is
   deliberate: the card is the log, held still for a moment.
   ============================================================ */
import React, { useEffect, useRef } from "react";
// (no kit imports needed — this file styles itself from theme.css + phone.css)

/* The card's headline. Ordered by how much it matters — a search that
   also broke your nerve is a Panic card, not a search card. */
const HEADING = [
  ["panic", "PANIC"],
  ["dmg", "YOU ARE HURT"],
  ["horror", "SOMETHING IS WRONG"],
  ["alarm", "ALARM"],
  ["stress", "STRESS"],
  ["rollbad", "FAILED"],
  ["rollgood", "MADE IT"],
  ["handout", "YOU FOUND SOMETHING"],
  ["item", "YOU FOUND SOMETHING"],
  ["whisper", "ONLY YOU HEAR THIS"],
  ["move", "YOU MOVED"],
  ["search", "YOU LOOKED"],
];

function headingFor(lines) {
  const kinds = new Set(lines.map((l) => l.kind));
  for (const [kind, label] of HEADING) if (kinds.has(kind)) return label;
  return "WHAT HAPPENED";
}

export default function OutcomeSheet({ outcome, onDismiss }) {
  const btn = useRef(null);

  /* Focus lands on the dismiss button so a keyboard or switch user is
     not stranded behind a card they cannot see the edges of, and so
     Enter does the obvious thing. */
  useEffect(() => {
    if (outcome && outcome.hold && btn.current) btn.current.focus();
  }, [outcome]);

  useEffect(() => {
    if (!outcome || !outcome.hold) return undefined;
    const onKey = (e) => { if (e.key === "Escape" || e.key === "Enter") onDismiss(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [outcome, onDismiss]);

  if (!outcome) return null;

  const body = (
    <div className="outcome-lines feed">
      {outcome.lines.map((l) => (
        <p key={l.id} className={`k-${l.kind}`}>{l.text}</p>
      ))}
    </div>
  );

  /* ---- receipt: it landed, nothing else to say ---- */
  if (!outcome.hold) {
    return (
      <div className="outcome-receipt" role="status" aria-live="polite">
        {body}
      </div>
    );
  }

  /* ---- consequence: read it before you carry on ---- */
  return (
    <div className="outcome-scrim" onClick={onDismiss}>
      <section
        className="outcome-card"
        role="alertdialog"
        aria-modal="true"
        aria-label={headingFor(outcome.lines)}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="outcome-head">
          <span className="outcome-rule" aria-hidden="true" />
          <h2>{headingFor(outcome.lines)}</h2>
        </header>

        <div className="outcome-body">{body}</div>

        {/* A native button rather than <Btn>, because this one needs a
            ref and the kit's Btn is not a forwardRef component. */}
        <button ref={btn} type="button" className="btn accent outcome-go" onClick={onDismiss}>
          <span>Carry on</span>
        </button>
      </section>
    </div>
  );
}
