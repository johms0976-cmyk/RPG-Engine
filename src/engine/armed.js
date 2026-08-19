/* ============================================================
   ARMED SEQUENCES — prep, for a tool that only had live.

   Every intervention on the Warden deck is immediate. You press
   the thing and the thing happens. That is right for the mouth —
   an interruption you have to schedule is not an interruption —
   and it is wrong for the hands, because the most useful sentence
   in Warden prep is *"when they open the pod, fire these three
   things"*, and there was nowhere to put it.

   Without prep, a Warden's options at the moment the players do
   the thing you have been waiting all session for are: remember
   all three levers, find all three levers, and press them in
   order while six people watch. What actually happens is that you
   press one, say the line badly, and forget the countdown.

   WHAT AN ARMED SEQUENCE IS. A named trigger, a list of engine
   effects, and a fire-once flag. Nothing more:

     · The effects are the *existing* effects vocabulary. This
       adds no new powers to the Warden, it adds a delay. Anything
       you can arm you could already do by hand, which is the
       property that keeps this from becoming a scripting language
       nobody asked for.

     · Triggers are checked against state the engine already
       publishes, never invented. A trigger that needed new
       instrumentation would be a trigger that silently stops
       working when a module does something unusual.

     · Everything fires *into the feed*, like any other Warden
       lever, because §5's rule holds: no referee changes the
       score silently.

   MANUAL IS A FIRST-CLASS TRIGGER. Most sequences will be armed
   with `when: "manual"` and fired by a button, because the point
   is usually not automation — it is having the three things
   bundled under one name so they arrive together and in order.
   Automatic triggers are for the ones that genuinely cannot be
   watched for reliably, like a room being entered while the
   Warden is looking at a different tab.
   ============================================================ */

/** The trigger vocabulary, and what each one watches. Deliberately
    short: every entry here is a promise to keep working. */
export const TRIGGERS = {
  manual: { label: "On my mark", blurb: "Fires only when you press it." },
  enterRoom: { label: "They enter…", blurb: "The first time any player is in this room.", arg: "room" },
  flag: { label: "When flag set…", blurb: "A module flag becomes true.", arg: "flag" },
  clockAt: { label: "At minute…", blurb: "The fiction's clock passes this.", arg: "minutes" },
  clockLeft: { label: "Countdown below…", blurb: "The shortest live countdown drops under this.", arg: "minutes" },
  npcGone: { label: "When taken…", blurb: "This NPC is killed or taken.", arg: "npc" },
  stressAt: { label: "Anyone at Stress…", blurb: "Any living character reaches this Stress.", arg: "stress" },
};

export const newSequence = (over = {}) => ({
  id: `seq_${Math.random().toString(36).slice(2, 8)}`,
  name: "Untitled",
  when: "manual",
  arg: null,
  effects: [],
  once: true,
  fired: false,
  armed: true,
  ...over,
});

/**
 * Should this sequence fire now?
 *
 * Pure over `{ w, crew }` so it is testable with a plain object and
 * so the check can run inside the host's existing snapshot pass
 * without a subscription of its own.
 */
export function shouldFire(seq, { w, crew = [] }) {
  if (!seq || !seq.armed) return false;
  if (seq.once && seq.fired) return false;
  if (!w) return false;

  switch (seq.when) {
    case "manual":
      return false;

    case "enterRoom": {
      if (!seq.arg) return false;
      // Any living character standing in it, which is not the same as
      // `w.room` once the party can split.
      return (crew || []).some((c) => c.alive !== false && (c.room || w.room) === seq.arg);
    }

    case "flag":
      return !!(seq.arg && w.flags && w.flags[seq.arg]);

    case "clockAt":
      return Number(seq.arg) > 0 && w.clock >= Number(seq.arg);

    case "clockLeft": {
      const live = Object.values(w.countdowns || {}).filter((c) => !c.paused);
      if (!live.length) return false;
      return Math.min(...live.map((c) => c.left)) <= Number(seq.arg || 0);
    }

    case "npcGone": {
      const n = seq.arg && w.npcs && w.npcs[seq.arg];
      return !!n && (n.alive === false || !!n.taken);
    }

    case "stressAt":
      return (crew || []).some((c) => c.alive !== false && (c.stress || 0) >= Number(seq.arg || 0));

    default:
      return false;
  }
}

/** Everything ready to go, in arm order. */
export const dueSequences = (list, ctx) => (list || []).filter((s) => shouldFire(s, ctx));

/** Mark one fired. Sequences live on `w.sequences`, so this is a
    plain list transform and the whole feature snapshots and saves
    with everything else. */
export const markFired = (list, id, clock = 0) =>
  (list || []).map((s) => (s.id === id ? { ...s, fired: true, firedAt: clock } : s));

export const armSequence = (list, id, armed) =>
  (list || []).map((s) => (s.id === id ? { ...s, armed } : s));

export const dropSequence = (list, id) => (list || []).filter((s) => s.id !== id);

/** A one-line description for the deck, assembled rather than
    stored so it cannot drift from the trigger it describes. */
export function describeSequence(seq, mod) {
  if (!seq) return "";
  const t = TRIGGERS[seq.when];
  if (!t) return seq.name;
  if (seq.when === "manual") return "on your mark";
  if (seq.when === "enterRoom") {
    const r = mod && mod.rooms && mod.rooms[seq.arg];
    return `when they enter ${(r && r.name) || seq.arg}`;
  }
  if (seq.when === "flag") return `when ${seq.arg} is set`;
  if (seq.when === "clockAt") return `at minute ${seq.arg}`;
  if (seq.when === "clockLeft") return `with ${seq.arg}m left on the clock`;
  if (seq.when === "npcGone") {
    const n = mod && mod.npcs && mod.npcs[seq.arg];
    return `when ${(n && n.name) || seq.arg} is gone`;
  }
  if (seq.when === "stressAt") return `when anyone hits Stress ${seq.arg}`;
  return t.label;
}
