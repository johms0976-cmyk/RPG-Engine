/* ============================================================
   STORE — 60 lines of state container with no React in it.

   The whole point of #30: the game core must be runnable, and
   therefore testable, without mounting a component. A test can
   do this and never touch jsdom:

       const s = createStore(reduce, initShip(falstaff));
       s.dispatch(shipDamage(40));
       expect(s.getState().ship.hull).toBe(...);

   Reducers here are pure but they DO emit. Rather than firing
   callbacks mid-reduction (which would make them impure), a
   reducer appends narration to `state.out`. The store drains
   `out` after every dispatch and hands the lines to listeners —
   so the React layer can pipe them straight into the feed and
   the core never has to know a feed exists.
   ============================================================ */

export function createStore(reducer, initialState) {
  let state = initialState;
  const listeners = new Set();
  const emitters = new Set();
  let depth = 0;
  let queue = [];

  function drain() {
    if (!state.out || !state.out.length) return [];
    const lines = state.out;
    state = { ...state, out: [] };
    return lines;
  }

  function dispatch(action) {
    if (!action || !action.type) return state;

    // Re-entrant dispatches (a reducer's consequence dispatching
    // another action via middleware) are queued, not nested.
    if (depth > 0) { queue.push(action); return state; }

    depth++;
    try {
      state = reducer(state, action);
      const lines = drain();
      if (lines.length) emitters.forEach((fn) => fn(lines, action, state));
      listeners.forEach((fn) => fn(state, action));
    } finally {
      depth--;
    }

    while (queue.length) {
      const next = queue.shift();
      dispatch(next);
    }
    return state;
  }

  return {
    getState: () => state,
    dispatch,
    /** Replace state wholesale — used by save/load. */
    hydrate(next) { state = next; listeners.forEach((fn) => fn(state, { type: "@@hydrate" })); },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** Narration sink. Receives (lines, action, state). */
    onEmit(fn) { emitters.add(fn); return () => emitters.delete(fn); },
  };
}

/* ---------------- reducer helpers ---------------- */

/** Append narration from inside a reducer. Returns the new state. */
export const emit = (state, kind, text, extra) =>
  (text == null || text === "")
    ? state
    : { ...state, out: [...(state.out || []), { kind, text: String(text), extra }] };

/** Append several lines at once. `lines` is [[kind, text], ...]. */
export const emitAll = (state, lines) =>
  lines.reduce((s, [k, t, x]) => emit(s, k, t, x), state);

/** Compose slice reducers that each own one key of the root state. */
export function combineSlices(slices) {
  const keys = Object.keys(slices);
  return function root(state, action) {
    let next = state;
    for (const k of keys) {
      // Slices receive the ROOT state so they can emit and read
      // siblings (ship crits need to know who is aboard), but they
      // may only write their own key plus `out` and `rng`.
      const result = slices[k](next, action);
      if (result !== next) next = result;
    }
    return next;
  };
}
