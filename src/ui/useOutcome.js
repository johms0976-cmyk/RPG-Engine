/* ============================================================
   useOutcome — "so what actually happened?"

   The complaint this exists for: you tap "look at the showers" on
   your phone, and the only thing that changes is three new lines
   appearing at the bottom of a scrolling log you probably aren't
   looking at. There is no moment. Nothing marks the difference
   between "you found nothing" and "there is something in the
   drain". So players tap on, and miss the game.

   At a physical table the Warden supplies that beat: they stop,
   they look at you, they read the description out. This is the
   software version of stopping and looking at you.

   Two grades, because not everything deserves an interruption:

     · a RECEIPT — a small strip that fades. "You searched the
       showers." Confirmation that the tap did something, nothing
       more, because nothing more happened.

     · a CONSEQUENCE — a card you have to dismiss. Damage, Stress,
       Panic, a failed save, a handout, something found. These are
       the moments the log was swallowing, and they now sit over
       the action buttons so the next tap is a decision rather
       than momentum.

   Grading is by feed kind, not by guesswork about text.
   ============================================================ */
import { useState, useEffect, useRef, useCallback } from "react";

/** Feed kinds that stop the player. Everything else is a receipt. */
export const CONSEQUENCE_KINDS = new Set([
  "dmg", "stress", "panic", "horror", "alarm", "handout",
  "rollbad", "item", "whisper", "interject",
]);

/** Kinds that are pure background noise and shouldn't even be a
    receipt — other people's chatter and engine bookkeeping. */
const IGNORED_KINDS = new Set(["system", "roll"]);

/** A receipt this old is stale — a snapshot that arrived while the
    phone was asleep shouldn't erupt into a card on wake. */
const STALE_MS = 20000;

export const RECEIPT_MS = 3600;

/**
 * @param feed      the player's (already redacted) feed array
 * @param opts.live false while joining/creating, so the backlog
 *                  doesn't fire as a wall of cards on first paint
 */
export function useOutcome(feed, { live = true } = {}) {
  const [outcome, setOutcome] = useState(null);
  /* Seen ids rather than a length or an index. The feed is capped at
     400 entries and redaction can remove lines from the middle, so
     positions lie; ids don't. */
  const seen = useRef(null);
  const armed = useRef(false);

  const dismiss = useCallback(() => setOutcome(null), []);

  /* Raise a card for something that never went through the feed. The
     Warden's whisper is the case that matters: it arrives as its own
     socket message, and "only you can see this" is worth stopping for.
     It used to be a strip at the top that faded after four seconds. */
  const raise = useCallback((lines, { hold = true } = {}) => {
    const list = (Array.isArray(lines) ? lines : [lines]).filter(Boolean);
    if (!list.length) return;
    setOutcome({ id: `raised:${Date.now()}`, at: Date.now(), hold, lines: list });
  }, []);

  useEffect(() => {
    const list = Array.isArray(feed) ? feed : [];

    // First sight of a feed is history, not news. Record and stay quiet.
    if (!seen.current || !armed.current) {
      seen.current = new Set(list.map((f) => f.id));
      if (live && list.length >= 0) armed.current = true;
      return;
    }

    const fresh = list.filter((f) => !seen.current.has(f.id));
    if (!fresh.length) return;
    for (const f of fresh) seen.current.add(f.id);

    // Keep the set from growing without bound over a long session.
    if (seen.current.size > 800) {
      seen.current = new Set(list.map((f) => f.id));
    }

    const lines = fresh.filter((f) => !IGNORED_KINDS.has(f.kind));
    if (!lines.length) return;

    const hold = lines.some((f) => CONSEQUENCE_KINDS.has(f.kind));

    setOutcome({
      id: lines[lines.length - 1].id,
      at: Date.now(),
      hold,
      lines,
    });
  }, [feed, live]);

  // Receipts clear themselves. Consequences do not — that is the point.
  useEffect(() => {
    if (!outcome || outcome.hold) return undefined;
    const t = setTimeout(dismiss, RECEIPT_MS);
    return () => clearTimeout(t);
  }, [outcome, dismiss]);

  // A card that was raised while the phone was in a pocket is no longer
  // news by the time the screen comes back on.
  useEffect(() => {
    if (!outcome) return undefined;
    const onWake = () => {
      if (document.visibilityState === "visible" && Date.now() - outcome.at > STALE_MS) dismiss();
    };
    document.addEventListener("visibilitychange", onWake);
    return () => document.removeEventListener("visibilitychange", onWake);
  }, [outcome, dismiss]);

  return { outcome, dismiss, raise };
}
