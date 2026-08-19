/* ============================================================
   HAPTICS — the channel nobody was using.

   The client already speaks to a player through two channels:
   the screen, and (via H_SOUND) their handset's speaker. The
   third one was sitting there unused. `navigator.vibrate` costs
   nothing, needs no permission, works on every Android at the
   table, and is the correct medium for exactly three messages:

     · it is your turn
     · something happened to your body
     · the Warden is looking at you

   All three share a property that makes them worth a buzz rather
   than a line in the feed: they are things a player needs to know
   *while not looking at the phone*. A player who has put the
   handset face-down to roll dice has left the screen channel
   entirely, and that is precisely the moment the table stalls
   waiting for them.

   THREE RULES.

   1. Never decorative. A phone that buzzes on every search
      teaches its owner to ignore it, and then it cannot buzz for
      the thing that matters. There are six cues in this file and
      there should not be a seventh without deleting one.

   2. Never the only channel. Every cue here accompanies something
      visible. iOS ignores `vibrate` entirely — half the table
      will never feel any of this — so a haptic that carries
      information the screen does not carry is a bug on iPhone.

   3. Respect the room. `prefers-reduced-motion` covers vestibular
      triggers rather than vibration, but a player who has asked
      their device to stop moving things has expressed a
      preference this should honour, and the toggle is there for
      the person who finds a buzzing phone unbearable in a horror
      game — which is a reasonable thing to find.
   ============================================================ */

const KEY = "ms:haptics";

/** Patterns in ms, alternating buzz/pause. Kept short: a long
    pattern on a table phone is a noise everyone hears, and this is
    a private channel or it is nothing. */
export const CUES = {
  /* Two firm taps. The most important cue in the file and the only
     one a player is actively waiting for. */
  turn: [28, 60, 28],
  /* One hard hit. Damage should feel like a single event, because
     it is. */
  damage: [55],
  /* A stutter — Stress is not an impact, it is a wrongness. */
  stress: [14, 40, 14, 40, 14],
  /* Rising. Panic is the one cue allowed to be unpleasant. */
  panic: [20, 30, 40, 30, 70],
  /* Soft double. Someone is talking to you and only you. */
  whisper: [16, 50, 16],
  /* The Warden has put the spotlight on you: distinct from `turn`,
     because it is not a request for an action, it is attention. */
  spotlight: [40, 45, 18, 45, 40],
};

const store = {
  get() { try { return localStorage.getItem(KEY); } catch { return null; } },
  set(v) { try { localStorage.setItem(KEY, v); } catch { /* ephemeral */ } },
};

/** Off only if explicitly turned off — the default is on, because a
    cue nobody has heard of cannot be opted into. */
export const hapticsOn = () => store.get() !== "0";
export const setHaptics = (on) => store.set(on ? "1" : "0");

export function canVibrate() {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/**
 * Fire a named cue. Silently does nothing when unsupported (every
 * iPhone), when switched off, or when handed a name that is not in
 * CUES — a typo'd cue should be a no-op, not an exception thrown
 * from inside a render.
 */
export function buzz(cue) {
  if (!canVibrate() || !hapticsOn()) return false;
  const pattern = CUES[cue];
  if (!pattern) return false;
  try { return navigator.vibrate(pattern); } catch { return false; }
}

/** Stop anything in progress. Called when the shell unmounts, so a
    phone that navigates away mid-pattern does not keep buzzing. */
export function stopBuzz() {
  if (!canVibrate()) return;
  try { navigator.vibrate(0); } catch { /* ignore */ }
}

/**
 * Which cue, if any, does this outcome deserve?
 *
 * Lives here rather than in the component so the mapping is one
 * list that can be read at a glance and argued about — the
 * temptation with haptics is always to add one more, and a policy
 * spread across six call sites is one nobody can audit.
 */
export function cueFor(outcome) {
  if (!outcome) return null;
  const k = outcome.kind || outcome.type;
  if (k === "panic") return "panic";
  if (k === "damage" || k === "hurt" || k === "wound") return "damage";
  if (k === "stress") return "stress";
  if (k === "whisper" || k === "peerwhisper") return "whisper";
  if (k === "spotlight") return "spotlight";
  return null;
}
