/* ============================================================
   RESUME — surviving the host tab dying.

   The phones already recover from almost anything. `localStorage`
   holds `{ clientId, name, pcId }`, so a handset that goes to
   sleep, loses wifi, or is closed and reopened re-announces itself
   and lands back on the same character without the player doing
   anything.

   The Warden's tab had none of that. The single authoritative
   `useGame` instance lives in one browser tab, and if that tab
   crashes, is refreshed, or gets closed by a laptop deciding to
   install an update, the session is gone — mid-scene, with six
   people watching. It is the most catastrophic failure mode the
   architecture has and it was also the least defended.

   The engine's own autosave nearly covers it, but not quite: it
   writes on a 700ms debounce keyed to the module and a slot name,
   and it does not know whether the session it is saving is a
   networked one. What a table needs is narrower and louder:

     · the last broadcast snapshot, written on every broadcast,
       because that is by definition the last state every phone
       agreed on
     · the claims, so the phones reattach to the same characters
       rather than to a list of free names
     · enough metadata to say "this was twelve minutes ago, six
       players, Riley is dead" before anybody presses anything

   Resuming is deliberately a decision rather than an automatism.
   A host tab opening to a half-remembered session it silently
   restores is worse than one that asks, because the second most
   common reason for the tab to reload is that the Warden wanted
   to start something else.

   Written to localStorage under one key, replaced rather than
   accumulated. This is a crash mat, not a save system —
   engine/storage.js is the save system and it is still doing its
   job underneath.
   ============================================================ */

const KEY = "mothership:table:resume";

const ok = () => { try { return typeof localStorage !== "undefined"; } catch { return false; } };

/** How stale a resume point can be before it is offered with a
    warning rather than a suggestion. Two hours is one session. */
export const STALE_MS = 2 * 60 * 60 * 1000;

/**
 * Write the crash mat. Called from the broadcast effect in useHost,
 * so it is exactly the state the phones last saw.
 *
 * Throttled by the caller rather than here: the broadcast already
 * only fires when something changed.
 */
export function keepResume({ modId, phase, state, claims, lobby, safety }) {
  if (!ok() || !state) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify({
      v: 1,
      at: Date.now(),
      modId,
      phase,
      claims: claims || {},
      lobby: lobby || [],
      safety: safety || null,
      world: state.w,
      crew: state.crew,
      activeId: state.activeId,
      houseRules: state.houseRules,
      /* The tail of the feed, not all of it. A resumed table needs
         to know what was just happening; it does not need three
         hours of scrollback, and the quota is not infinite. */
      feed: (state.feed || []).slice(-120),
    }));
    return true;
  } catch {
    /* Quota, private mode, a locked-down browser. A table that
       cannot write a crash mat should still be able to play. */
    return false;
  }
}

/** Read it back, or null. */
export function readResume() {
  if (!ok()) return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.world || !parsed.crew || !parsed.crew.length) return null;
    return parsed;
  } catch { return null; }
}

export function dropResume() {
  if (!ok()) return;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** One line describing what is on offer, for the button. */
export function describeResume(r) {
  if (!r) return null;
  const mins = Math.max(0, Math.round((Date.now() - (r.at || 0)) / 60000));
  const alive = (r.crew || []).filter((c) => c.alive !== false).length;
  const when = mins < 1 ? "moments ago"
    : mins < 60 ? `${mins} minute${mins === 1 ? "" : "s"} ago`
      : `${Math.round(mins / 60)} hour${Math.round(mins / 60) === 1 ? "" : "s"} ago`;
  return {
    when,
    stale: Date.now() - (r.at || 0) > STALE_MS,
    crew: `${alive} of ${(r.crew || []).length} still standing`,
    claimed: Object.values(r.claims || {}).filter(Boolean).length,
    text: `${(r.crew || []).map((c) => c.name).join(", ")} · ${when}`,
  };
}

/** The shape `useGame.begin(crew, restored)` expects. */
export function restoreFrom(r) {
  if (!r) return null;
  return {
    world: r.world,
    crew: r.crew,
    activeId: r.activeId || (r.crew[0] && r.crew[0].id) || null,
    houseRules: r.houseRules,
    feed: r.feed || [],
  };
}
