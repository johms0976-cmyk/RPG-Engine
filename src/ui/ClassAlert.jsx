/* ============================================================
   CLASS ALERT — "why did that just happen to me?"

   The four class rules in Mothership that act on somebody other
   than their owner are the only rules in the game a player cannot
   look up when they fire, because the sheet they are written on
   belongs to another person. At a shared table the Warden says it
   out loud. On six phones the Stress simply appears, and the
   player who gained it has no idea a class rule exists.

   So the engine tags those events (see engine/crew.js) and this
   is where they surface: a card, on the phone of the person it
   landed on, naming the rule and who it came from.

   It is a card and not a takeover on purpose. Panic and death
   earn the whole screen. This is a footnote arriving at the
   moment it becomes relevant — it should be readable and then
   gone, not something to escape from. It also does not block: the
   OutcomeSheet underneath still has to be dismissed, so nothing
   is skipped by tapping this away.
   ============================================================ */
import React, { useEffect } from "react";

/** Long enough to read twenty words, short enough not to sit on
    the buttons during a fight. Dismissable at any point. */
const LIFE_MS = 9000;

export default function ClassAlert({ alert, onDismiss }) {
  useEffect(() => {
    if (!alert) return undefined;
    const t = setTimeout(() => onDismiss && onDismiss(), LIFE_MS);
    return () => clearTimeout(t);
  }, [alert, onDismiss]);

  if (!alert) return null;

  return (
    <div className="classfx" role="status" aria-live="polite">
      <button type="button" className="classfx-card" onClick={onDismiss}
        aria-label={`${alert.title}. ${alert.body}. Tap to dismiss.`}>
        <span className="classfx-kicker">
          {alert.kicker}{alert.who ? ` · ${alert.who}` : ""}
        </span>
        <strong className="classfx-title">{alert.title}</strong>
        <span className="classfx-body">{alert.body}</span>
      </button>
    </div>
  );
}
