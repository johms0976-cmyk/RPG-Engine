/* ============================================================
   PANIC TAKEOVER — the game's signature, treated like one.

   A failed Panic Check already interrupts the feed and already
   raises an OutcomeSheet. On a shared screen that is enough,
   because everyone at the table watched the Warden's face. On a
   phone it is a card with a heading, which is the same weight
   the app gives to being handed a torch.

   Panic is the thing that actually kills Mothership characters.
   It deserves the whole screen for two seconds: the effect's
   name, at size, over everything, with the phone shaking in your
   hand — and then it hands the screen back, because a mode you
   have to escape from is a different and worse idea.

   It never blocks: the OutcomeSheet behind it still has to be
   dismissed, so nothing is skipped by looking away. This is
   punctuation on top of a record, not a replacement for one.
   ============================================================ */
import React, { useEffect, useState } from "react";

export const PANIC_MS = 2600;

/** The pattern is deliberately unlike every other buzz in the app:
    long, irregular, and slightly too much. */
const PATTERN = [90, 60, 40, 40, 200];

export default function PanicTakeover({ event, onDone, muted = false }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!event) return undefined;
    setLeaving(false);
    if (!muted && navigator.vibrate) navigator.vibrate(PATTERN);
    const fade = setTimeout(() => setLeaving(true), PANIC_MS - 700);
    const gone = setTimeout(() => onDone && onDone(), PANIC_MS);
    return () => { clearTimeout(fade); clearTimeout(gone); };
  }, [event, onDone, muted]);

  if (!event) return null;

  return (
    <div className={`panicover${leaving ? " is-leaving" : ""}`} role="alert" aria-live="assertive">
      <div className="panicover-inner">
        <span className="panicover-kicker">PANIC</span>
        <strong className="panicover-name">{event.name}</strong>
        {event.detail && <span className="panicover-detail">{event.detail}</span>}
      </div>
    </div>
  );
}

/**
 * Pull the panic out of a feed line, if it is one.
 *
 * `extra.panic` is stamped by useGame's panic branch, so the normal
 * path parses nothing. The prose fallback below is kept only for
 * feed lines written before that stamp existed — a session saved
 * mid-flight and restored after an update — and it is deliberately
 * lenient rather than correct, because a takeover with a scrappy
 * subtitle beats no takeover at all.
 */
export function panicFrom(line) {
  if (!line || line.kind !== "panic") return null;

  const p = line.extra && line.extra.panic;
  if (p) {
    /* The stamp appears on the effect line only — not on holding it
       together, not on a Teamster's re-roll. This function does not
       *gate* on that, because the phone's existing behaviour is to
       take over on any panic-kind line and narrowing it here would
       be a silent change to a surface nobody asked me to touch. It
       is the shared screen that gates, in ui/TableMoment.jsx, where
       the bar is higher because the whole room is looking at it. */
    return {
      id: line.id,
      pcId: p.pcId || null,
      who: p.who || null,
      name: String(p.effect || "Panic").toUpperCase().slice(0, 28),
      detail: p.detail ? String(p.detail).slice(0, 120) : null,
    };
  }

  const text = String(line.text || "").replace(/^PANIC\s*[·:—-]\s*/i, "");
  const [head, ...rest] = text.split(/\s+[—–-]\s+/);
  return {
    id: line.id,
    pcId: null,
    who: null,
    name: (head || "Panic").trim().toUpperCase().slice(0, 28),
    detail: rest.join(" — ").trim().slice(0, 120) || null,
  };
}
