/* ============================================================
   SECRETS — what a given pair of eyes is allowed to know.

   RAW is explicit that some things are determined secretly.
   Hallucinations run "for the next 2d10 hours (determined
   secretly)"; a character with a Phobia does not get told what
   triggers it. In a single-screen game there is nowhere to put
   that, so most digital Mothership tools print it in the log and
   quietly destroy the effect. With a Warden screen and a phone
   each, there finally is somewhere.

   The rule here is not "render it hidden". It is "never send it".
   A duration the phone has been given is a duration a curious
   player can find, and the whole effect turns on not knowing.
   ============================================================ */

/** Conditions the afflicted character is not told about. */
export const SECRET_CONDITIONS = new Set([
  "Hallucinating", "Paranoid", "DeathDrive", "Broken",
]);

/** Buff and effect keys whose remaining duration is the Warden's business. */
export const SECRET_DURATIONS = new Set([
  "hallucinating", "paranoid", "deathdrive", "broken", "phobia",
]);

export const VIEW = { WARDEN: "warden", PLAYER: "player", TABLE: "table" };

/** A phobia's trigger is hidden from its owner but not from the rest
    of the crew, who can watch them react to it. */
export function visibleConditions(pc, view, viewerPcId) {
  const list = pc.conditions || [];
  if (view === VIEW.WARDEN) return list;
  const isMe = pc.id === viewerPcId;
  return list.filter((c) => !(isMe && SECRET_CONDITIONS.has(c)));
}

/** Strip a character down to what this viewer may see. */
export function redactPc(pc, view, viewerPcId) {
  if (view === VIEW.WARDEN) return pc;
  const out = { ...pc, conditions: visibleConditions(pc, view, viewerPcId) };

  if (pc.id === viewerPcId) {
    // Your own secret timers vanish entirely rather than being zeroed —
    // a key present with a falsy value still tells you it exists.
    out.buffs = (pc.buffs || []).filter((b) => !SECRET_DURATIONS.has(b.kind));
    if (pc.secret) delete out.secret;
  } else {
    // Other people's sheets are their business beyond what shows.
    delete out.secret;
    out.buffs = (pc.buffs || []).filter((b) => !SECRET_DURATIONS.has(b.kind));
  }
  return out;
}

/** Feed lines can be addressed. An unaddressed line is public. */
export function visibleFeed(feed, view, viewerPcId) {
  if (view === VIEW.WARDEN) return feed;
  return feed
    .filter((line) => {
      if (line.wardenOnly) return false;
      if (line.to) return line.to === viewerPcId;
      return true;
    })
    .map((line) => (line.secretText ? { ...line, secretText: undefined } : line));
}

/** The world carries things the crew has not earned yet. */
export function redactWorld(w, view) {
  if (view === VIEW.WARDEN) return w;
  const out = { ...w };
  // Threat positions are the single biggest tell. The crew learns
  // where something is by looking at it, not by reading state.
  out.threats = Object.fromEntries(
    Object.entries(w.threats || {}).map(([id, t]) => [
      id,
      t.seen ? t : { ...t, loc: null, retreatUntil: -1, distracted: 0 },
    ]),
  );
  // Clock timers tick invisibly. The crew feels them, they don't read them.
  out.clocks = {};
  delete out.oracleMemory;
  delete out.rollLog;
  return out;
}

/** The whole redaction, applied to a snapshot's state. */
export function redactState(state, view, viewerPcId) {
  if (!state || view === VIEW.WARDEN) return state;
  return {
    ...state,
    w: redactWorld(state.w, view),
    crew: state.crew.map((c) => redactPc(c, view, viewerPcId)),
    feed: visibleFeed(state.feed || [], view, viewerPcId),
  };
}

/** Did anything actually get held back? Shown on the Warden's screen so
    they know what each player is missing without opening every sheet. */
export function secretsHeld(state, viewerPcId) {
  if (!state) return [];
  const held = [];
  const me = state.crew.find((c) => c.id === viewerPcId);
  if (me) {
    for (const c of me.conditions || []) if (SECRET_CONDITIONS.has(c)) held.push(c);
    for (const b of me.buffs || []) if (SECRET_DURATIONS.has(b.kind)) held.push(b.kind);
  }
  return held;
}
