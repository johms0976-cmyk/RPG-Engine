/* ============================================================
   HISTORY — the step back.

   A Warden who applies 2d10 to the wrong character has, until
   now, had no path back but hand-editing state. That is a real
   failure at a real table: the mistake is instant, public, and
   permanent, and the only honest fix costs more attention than
   the scene has to spare.

   The engine's state is already almost undoable. `commitW` is a
   patch over an immutable world and `commitCrew` replaces the
   crew array wholesale, so nothing is mutated in place except
   two counters. That means a step back does not need a diff
   engine — it needs a bounded ring of the last few (world, crew)
   pairs, and the discipline to only record at points a Warden
   would recognise as "a thing I just did".

   Two rules:

     1. BOUNDED. Twenty steps. This is not version control and it
        is not a save system; it is the last few minutes. An
        unbounded history is a memory leak with a nice name.

     2. LOUD. Undoing lands in the feed like everything else,
        naming what was undone. A referee who can silently
        rewind is a referee who can silently change the score,
        which is the one thing this codebase refuses to build.

   Deliberately NOT undone: the feed itself, the roll log and the
   RNG cursor. Rewinding the record of what was said would let a
   table lose lines it has already read and acted on, and
   rewinding the dice would let a Warden re-roll a result they did
   not like — which is the exact abuse the whole design is
   arranged against. The step back moves the world; the log keeps
   saying what happened, including that you took it back.
   ============================================================ */

/** How far back you can go. Twenty is about five minutes of a busy
    table, which is the window in which a mistake is still worth
    correcting rather than absorbing into the fiction. */
export const HISTORY_LIMIT = 20;

export const emptyHistory = () => [];

/**
 * Record a point to come back to.
 * @param {Array} stack  the current history
 * @param {object} entry { w, crew, label }
 */
export function pushHistory(stack, entry) {
  if (!entry || !entry.w) return stack || [];
  const next = [...(stack || []), {
    w: entry.w,
    crew: entry.crew,
    label: entry.label || "the last change",
    at: Date.now(),
  }];
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
}

/** Take the most recent point back off. Returns { entry, stack }. */
export function popHistory(stack) {
  const list = stack || [];
  if (!list.length) return { entry: null, stack: list };
  return { entry: list[list.length - 1], stack: list.slice(0, -1) };
}

/** What the button should say. */
export function historyLabel(stack) {
  const list = stack || [];
  if (!list.length) return null;
  return list[list.length - 1].label;
}
