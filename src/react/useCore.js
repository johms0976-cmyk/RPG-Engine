/* ============================================================
   REACT BINDING — the thin half of #30.

   Deliberately small. Everything interesting is in src/core;
   this file's only jobs are:
     1. hold the store across renders,
     2. subscribe with useSyncExternalStore so React 18 tears
        nothing during concurrent renders,
     3. pipe core narration into the existing game feed,
     4. hand back demands so the host can apply them to real PCs.

   If this file grows past a screenful, logic has leaked out of
   the core and should be pushed back in.
   ============================================================ */
import { useRef, useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { createCore, coreActions, initialCoreState, serializeCore, deserializeCore } from "../core/index.js";

export function useCore({ seed, credits, houseRules, onNarrate, onDemand, restore } = {}) {
  const storeRef = useRef(null);
  if (!storeRef.current) {
    storeRef.current = createCore({
      state: restore ? deserializeCore(restore) : initialCoreState({ seed, credits, houseRules }),
    });
  }
  const store = storeRef.current;

  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);

  // Core narration -> the game feed. Registered once.
  const narrate = useRef(onNarrate);
  narrate.current = onNarrate;
  useEffect(() => store.onEmit((lines) => {
    if (!narrate.current) return;
    for (const l of lines) narrate.current(l.kind, l.text, l.extra);
  }), [store]);

  // Demands are things only the host can do — hurt a PC, advance
  // the clock, grant a skill. Drained on every change.
  const demand = useRef(onDemand);
  demand.current = onDemand;
  useEffect(() => {
    if (!state.demands || !state.demands.length) return;
    const list = state.demands;
    store.dispatch(coreActions.clearDemands());
    if (demand.current) for (const d of list) demand.current(d);
  }, [state.demands, store]);

  const dispatch = useCallback((action) => store.dispatch(action), [store]);

  const actions = useMemo(() => {
    const bound = {};
    for (const [k, fn] of Object.entries(coreActions)) {
      bound[k] = (...args) => store.dispatch(fn(...args));
    }
    return bound;
  }, [store]);

  const snapshot = useCallback(() => serializeCore(store.getState()), [store]);

  // Memoised deliberately. A fresh object here would change identity on
  // every render, so any consumer with `core` in an effect's dependency
  // array would re-run that effect forever — which is exactly how the
  // context push in App.jsx used to spin. Now the identity only moves
  // when the state actually does.
  return useMemo(
    () => ({ state, dispatch, do: actions, store, snapshot }),
    [state, dispatch, actions, store, snapshot]
  );
}

export default useCore;
