/* ============================================================
   THE CORE — root reducer, store factory, save/load.

   This is the "headless" half of #30. It has no React import and
   never will. A test, a CLI, a Discord bot or a second renderer
   can all drive it identically:

       const core = createCore({ seed: 1 });
       core.dispatch(shipActions.install(FALSTAFF()));
       core.dispatch(shipActions.damage(30));
       core.getState().ship.hull;

   The existing useGame() hook keeps its own state for the parts
   of the game that already worked; the core owns the systems
   added in this pass (ship, contractors, downtime) and exposes a
   seam for migrating the rest one reducer at a time. That is a
   deliberate choice: a big-bang rewrite of a 1400-line hook that
   nobody can regression-test is how you lose a working game.
   ============================================================ */
import { createStore, combineSlices } from "./store.js";
import { makeRngState, seedFrom } from "./rng.js";
import { shipSlice, fightSlice, shipActions } from "./shipSlice.js";
import { hirelingSlice, hirelingActions } from "./hirelings.js";
import { downtimeSlice, downtimeActions } from "./downtime.js";

export const CORE_VERSION = 1;

export function initialCoreState({ seed, credits = 0, houseRules = {} } = {}) {
  return {
    v: CORE_VERSION,
    rng: makeRngState(seed != null ? seed : seedFrom(String(Date.now()))),
    houseRules,

    ship: null,
    fight: null,
    lastFight: null,

    hirelings: [],
    candidate: null,

    downtime: null,

    credits,
    debts: [],
    bounties: [],

    /* context the slices read but do not own — pushed in by the host */
    aboardCount: 1,
    negotiatorIntellect: 30,
    crewNames: {},
    addictionCount: 0,
    savvy: false,

    /* outbound */
    out: [],        // narration, drained by the store after each dispatch
    demands: [],    // things the host must do to real PCs
  };
}

/* ---------------- context actions ---------------- */

export const coreActions = {
  ...shipActions,
  ...hirelingActions,
  ...downtimeActions,
  /** Push host-owned facts the slices need to read. */
  context: (patch) => ({ type: "CORE/CONTEXT", patch }),
  credits: (delta) => ({ type: "CORE/CREDITS", delta }),
  clearDemands: () => ({ type: "CORE/CLEAR_DEMANDS" }),
  houseRules: (patch) => ({ type: "CORE/HOUSE", patch }),
};

function contextSlice(state, action) {
  switch (action.type) {
    case "CORE/CONTEXT":
      return { ...state, ...action.patch };
    case "CORE/CREDITS":
      return { ...state, credits: Math.max(0, (state.credits || 0) + action.delta) };
    case "CORE/CLEAR_DEMANDS":
      return state.demands && state.demands.length ? { ...state, demands: [] } : state;
    case "CORE/HOUSE":
      return { ...state, houseRules: { ...state.houseRules, ...action.patch } };
    default:
      return state;
  }
}

export const rootReducer = combineSlices({
  context: contextSlice,
  ship: shipSlice,
  fight: fightSlice,
  hirelings: hirelingSlice,
  downtime: downtimeSlice,
});

export function createCore(opts = {}) {
  const store = createStore(rootReducer, opts.state || initialCoreState(opts));
  return store;
}

/* ---------------- persistence ---------------- */

/** Everything worth saving. `out` is transient and dropped. */
export function serializeCore(state) {
  const { out, ...rest } = state;
  return { ...rest, v: CORE_VERSION };
}

export function deserializeCore(saved, fallback) {
  if (!saved || saved.v !== CORE_VERSION) return fallback || initialCoreState();
  return { ...initialCoreState(), ...saved, out: [] };
}

export * from "./ship.js";
export * from "./shipCrit.js";
export * from "./mapModel.js";
export { shipReport, makeEnemyShip, applyShipDamage } from "./shipSlice.js";
export { MERC_ROLES, ROLE_KEYS, SCUM, makeHireling, NEGOTIATION_TERMS, negotiationMod, hirelingModifiers } from "./hirelings.js";
export { CYBERMODS, ACTIVITIES, profitSaveTarget } from "./downtime.js";
export { createStore, emit, emitAll } from "./store.js";
export * from "./rng.js";
