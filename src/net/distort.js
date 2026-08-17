/* ============================================================
   DISTORTION — making the client lie.

   The engine knows a character is Hallucinating. In a shared-screen
   game that knowledge has nowhere to go but the log, which tells the
   player the one thing they must not know. Here, the host sends that
   player's phone a snapshot that is simply wrong, and sends everyone
   else the truth. The Warden's screen shows both.

   Rules this follows, learned from every table where a Warden has
   tried to run hallucinations by hand:

     - Lies are consistent. The same phantom room stays in the same
       place for as long as the condition lasts, because a door that
       moves is read as a bug, not as horror.
     - Lies are deniable. Nothing invented is load-bearing; a phantom
       exit leads nowhere and searching a phantom object finds nothing,
       so the fiction survives the player testing it.
     - Lies are seeded, not random. Derived from the world seed and the
       character, so a reconnecting phone sees the same false world.
   ============================================================ */
import { makeRng } from "../engine/oracle.js";

const has = (pc, c) => (pc.conditions || []).includes(c);

/** Deterministic per character per condition, so reconnects are stable. */
const seedFor = (w, pcId, salt) => {
  let h = 2166136261 ^ (w.seed >>> 0);
  for (const ch of `${pcId}:${salt}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

const PHANTOM_ROOMS = [
  { name: "Maintenance Crawl", desc: "A hatch you are fairly sure was not there before." },
  { name: "Cold Storage", desc: "Frost on the inside of the glass. Something behind it." },
  { name: "Observation", desc: "A window onto nothing. The stars are in the wrong places." },
  { name: "Crew Quarters B", desc: "Six bunks. Your name is on one of them." },
];

const PHANTOM_LINES = [
  { kind: "room", text: "Something moves at the edge of the light and is gone when you look." },
  { kind: "room", text: "You hear your own name, from the corridor behind you." },
  { kind: "npc", text: "Somebody is breathing on the open channel. Nobody answers when you ask." },
  { kind: "room", text: "The wall is warm. It should not be warm." },
];

/** A phantom room hung off the crew's current location. Consistent for
    the duration because both the pick and the anchor come from the seed. */
function phantomRoom(state, pcId) {
  const rng = makeRng(seedFor(state.w, pcId, "room"));
  const pick = PHANTOM_ROOMS[Math.floor(rng() * PHANTOM_ROOMS.length)];
  return { id: `__phantom_${pcId}`, name: pick.name, desc: pick.desc, phantom: true };
}

export function distortForHallucination(state, pcId) {
  const rng = makeRng(seedFor(state.w, pcId, "feed") + (state.feed.length >> 2));
  const out = { ...state };
  const ghost = phantomRoom(state, pcId);

  // A door that isn't there. Listed as an exit, goes nowhere.
  out.phantomExit = { id: ghost.id, name: ghost.name, from: state.w.room };

  // An occasional line in the feed that nobody else received. Tied to
  // feed length so it appears at a stable point in the scrollback
  // rather than flickering in and out on every snapshot.
  if (rng() < 0.34 && state.feed.length) {
    const line = PHANTOM_LINES[Math.floor(rng() * PHANTOM_LINES.length)];
    out.feed = [...state.feed, { id: -Math.abs(seedFor(state.w, pcId, `l${state.feed.length}`)), ...line, phantom: true, clock: state.w.clock }];
  }
  return out;
}

/** Paranoia doesn't invent things — it misreports the people around you.
    Crew health and stress read a little worse than they are. */
export function distortForParanoia(state, pcId) {
  const rng = makeRng(seedFor(state.w, pcId, "para"));
  return {
    ...state,
    crew: state.crew.map((c) => {
      if (c.id === pcId || c.alive === false) return c;
      const drift = 1 + Math.floor(rng() * 3);
      return { ...c, stress: Math.min(20, c.stress + drift) };
    }),
  };
}

/** Under Broken, your own numbers are the unreliable ones. */
export function distortForBroken(state, pcId) {
  const rng = makeRng(seedFor(state.w, pcId, "broke"));
  return {
    ...state,
    crew: state.crew.map((c) => {
      if (c.id !== pcId) return c;
      const wrong = Math.max(1, Math.round(c.health * (0.75 + rng() * 0.5)));
      return { ...c, health: Math.min(c.maxHealth, wrong) };
    }),
  };
}

/** Apply whatever this character is currently suffering. Order matters
    only in that each step reads the output of the last. */
export function distort(state, pcId) {
  if (!state || !pcId) return state;
  const pc = state.crew.find((c) => c.id === pcId);
  if (!pc || pc.alive === false) return state;

  let out = state;
  if (has(pc, "Hallucinating")) out = distortForHallucination(out, pcId);
  if (has(pc, "Paranoid")) out = distortForParanoia(out, pcId);
  if (has(pc, "Broken")) out = distortForBroken(out, pcId);
  return out;
}

/** What the Warden's screen shows: which players are being lied to,
    so they can play into it instead of forgetting it is happening. */
export function distortionsActive(state) {
  if (!state) return [];
  return state.crew
    .filter((c) => c.alive !== false && (c.conditions || []).some((x) => ["Hallucinating", "Paranoid", "Broken"].includes(x)))
    .map((c) => ({
      pcId: c.id,
      name: c.name,
      kinds: (c.conditions || []).filter((x) => ["Hallucinating", "Paranoid", "Broken"].includes(x)),
    }));
}
