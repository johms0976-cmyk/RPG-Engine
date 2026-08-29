/* ============================================================
   THE COMMON LISTENERS — what every table says, in every module.

   `rungListen` is the only rung that reacts to what a player
   SAID rather than to what the state IS. It is the closest thing
   the empty chair has to a Warden noticing an idea, and it fires
   from module-authored `listeners`.

   At 2.16.0 there were fifteen of them in Ypsilon 14, fourteen in
   Another Bug Hunt and eight in Dead Weight. A live Warden makes
   somewhere north of two hundred reactive judgements in the same
   three hours. So the empty chair's ability to answer a specific
   idea was bounded at roughly fifteen pre-anticipated ideas per
   module, and everything else fell through to the oracle — a
   weighted yes/no that, by design, does not update the world.

   That is not an engine limit. `defineModule` supports gated
   exits with multiple routes, threat tactics and morale,
   counters, tracks, meters, clocks, devices, listeners and a
   predicate language, and the shipped modules use a fraction of
   it. The engine can already do more than any module asks. The
   binding constraint is authored contingency, and the cheapest
   way to buy a lot of it at once is to notice that most of those
   fifteen listeners were never module-specific in the first
   place.

   "We should split up." "What's in the vents?" "I barricade the
   door." "Is anyone hurt?" "Can we call for help?" Every table
   says these, in every module, in every horror game ever
   written. Ypsilon 14 authored answers to three of them. Dead
   Weight authored answers to none.

   So they move here, once, and every module gets them — including
   the ones nobody has written yet.

   ------------------------------------------------------------
   WHAT THIS IS NOT

   It is not invention. INV-1 and INV-6 hold exactly as before:
   every sentence below was written by a person, into this
   repository, by hand, and `rungListen` selects among them
   without composing anything. A generic listener is authored
   content that happens to be authored once instead of three
   times.

   It is not a fallback for missing module content either — that
   would be the thing INV-1's consequence forbids, where absent
   content gets filled in rather than left silent. The test is
   whether the line could be false. A line that says "the vents
   are too small to crawl through" is a claim about a ship and
   belongs to the module. A line that says splitting up in an
   unfamiliar place is how people get separated is a claim about
   people, and it is true on every ship there has ever been.

   THAT IS THE WHOLE EDITORIAL RULE FOR THIS FILE:

     A generic listener may observe. It may never assert a fact
     about the room, the ship, the threat or the module.

   Concretely — every line below is one of:

     · a fact about human beings under stress
     · a restatement of something the player just said, so they
       know they were heard
     · a question back to the table
     · a fact the ENGINE owns and can therefore verify at the
       moment of speaking (how many people are in this room, how
       much time is left on a countdown)

   None of them describe anything. When a module wants the door
   to actually be barricadable, that is a module `action` with
   effects, and the module-specific listener wins anyway — see
   `mergeListeners`.

   ------------------------------------------------------------
   TONE

   `warden` throughout, deliberately. These are the voice of the
   referee observing the table, not the voice of the ship. A
   generic line delivered in `room` tone would be claiming to
   describe a place it knows nothing about, which is exactly the
   line this file must not cross.
   ============================================================ */

/** The pack. Ordered by how often a table says the thing, because
    `rungListen` returns the first match against the most recent
    line and there is no scoring. */
export const COMMON_LISTENERS = [
  {
    id: "common_split_up",
    phrases: [
      "split up", "splitting up", "we split", "go alone", "on my own",
      "cover more ground", "separately", "you go that way", "i'll go",
    ],
    effects: [{
      say:
        "Splitting up covers ground and it is how people end up somewhere with nobody "
        + "who can confirm what happened. Decide out loud who is going with whom — the "
        + "one thing worse than splitting up is finding out later that you had.",
      tone: "warden",
    }],
  },
  {
    id: "common_barricade",
    phrases: [
      "barricade", "block the door", "blocking the door", "jam the door",
      "wedge the door", "hold the door", "seal the door", "weld the door",
    ],
    effects: [{
      say:
        "Blocking a door works on the thing on the other side of it and on nothing else. "
        + "It also takes the door away from you. Say what you are using and whether you "
        + "are staying on this side of it.",
      tone: "warden",
    }],
  },
  {
    id: "common_hurt",
    phrases: [
      "is anyone hurt", "anyone hurt", "who's hurt", "who is hurt",
      "how bad is it", "check on", "are you okay", "are you ok",
    ],
    effects: [{
      say:
        "Ask them. Everyone can see their own sheet and nobody else's — the only way "
        + "the table finds out how bad it is, is if somebody says so out loud, and "
        + "people under pressure routinely do not.",
      tone: "warden",
    }],
  },
  {
    id: "common_call_for_help",
    phrases: [
      "call for help", "radio for help", "send a distress", "mayday",
      "contact the company", "call corporate", "signal for help", "call it in",
    ],
    effects: [{
      say:
        "Assume anyone who could help is a long way away and was never coming quickly. "
        + "The question worth asking is not whether the message sends — it is who else "
        + "is listening on that frequency.",
      tone: "warden",
    }],
  },
  {
    id: "common_stay_together",
    phrases: [
      "stay together", "stick together", "nobody goes alone", "buddy system",
      "we stay as a group", "keep together",
    ],
    effects: [{
      say:
        "Slower, and much harder to pick off one at a time. It is the correct call and "
        + "it will cost you the clock. Decide whether you can afford it.",
      tone: "warden",
    }],
  },
  {
    id: "common_search_body",
    phrases: [
      "search the body", "search the corpse", "check the body", "loot the body",
      "go through his pockets", "go through her pockets", "search him", "search her",
    ],
    effects: [{
      say:
        "Somebody has to actually do it, with their hands, while the others watch. "
        + "Say who.",
      tone: "warden",
    }],
  },
  {
    id: "common_set_a_trap",
    phrases: [
      "set a trap", "lay a trap", "ambush", "lure it", "bait it",
      "trap it", "draw it out", "set a snare",
    ],
    effects: [{
      say:
        "A trap needs three things named out loud: what draws it in, what happens when "
        + "it arrives, and where you are standing when it does. Two out of three is how "
        + "people get caught in their own.",
      tone: "warden",
    }],
  },
  {
    id: "common_who_is_that",
    phrases: [
      "can we trust", "do we trust", "i don't trust", "dont trust",
      "he's lying", "she's lying", "they're lying", "something's off about",
    ],
    effects: [{
      say:
        "Worth saying out loud, and worth remembering that everybody here is frightened "
        + "and that frightened people lie about small things for ordinary reasons.",
      tone: "warden",
    }],
  },
  {
    id: "common_rest",
    phrases: [
      "take a rest", "get some rest", "catch our breath", "sit down for a minute",
      "take five", "regroup", "stop and think",
    ],
    effects: [{
      say:
        "Stopping is a real move and it costs real time. If somebody is carrying Stress "
        + "they cannot spend, this is when it comes off.",
      tone: "warden",
    }],
  },
  {
    id: "common_weapons",
    phrases: [
      "shoot it", "open fire", "light it up", "empty the mag", "unload on it",
      "kill it", "just shoot",
    ],
    effects: [{
      say:
        "It might work. Count what you have left before you find out, because the "
        + "answer to 'how many rounds' is one of the few things nobody gets to improvise.",
      tone: "warden",
    }],
  },
  {
    id: "common_fire",
    phrases: [
      "burn it", "set it on fire", "use fire", "torch it", "flamethrower",
      "light it on fire",
    ],
    effects: [{
      say:
        "Fire is the oldest answer there is. In a sealed environment it is also a "
        + "competitor for the air you are breathing.",
      tone: "warden",
    }],
  },
  {
    id: "common_hide",
    phrases: [
      "hide", "we hide", "stay quiet", "keep quiet", "don't move",
      "hold still", "play dead",
    ],
    effects: [{
      say:
        "Hiding works until something looks. Say where, and say what happens if it "
        + "comes in anyway — a hiding place with one exit is a room you chose to be "
        + "cornered in.",
      tone: "warden",
    }],
  },
  {
    id: "common_leave",
    phrases: [
      "let's just leave", "just leave", "get out of here", "abandon", "call it",
      "we should go", "screw this", "leave them",
    ],
    effects: [{
      say:
        "Leaving is always available and it is usually survivable. What it is not is "
        + "free — somebody at this table will have to say out loud what you are leaving "
        + "behind.",
      tone: "warden",
    }],
  },
  {
    id: "common_plan",
    phrases: [
      "what's the plan", "what is the plan", "so what do we do", "what do we do now",
      "any ideas", "thoughts", "what now",
    ],
    effects: [{
      say:
        "Somebody has to answer that, and the person who asked it is allowed to be the "
        + "one who does.",
      tone: "warden",
    }],
  },
  {
    id: "common_together_decision",
    phrases: [
      "let's vote", "we should vote", "put it to a vote", "show of hands",
      "majority", "who's with me", "whos with me",
    ],
    effects: [{
      say:
        "Take the vote. Somebody is going to be outvoted and still has to walk through "
        + "the door with everyone else, which is the interesting part.",
      tone: "warden",
    }],
  },
  {
    id: "common_quiet_player",
    phrases: [
      "what do you think", "you've been quiet", "youve been quiet",
      "haven't heard from", "havent heard from", "what about you",
    ],
    effects: [{
      say: "Good. Give them the room.",
      tone: "warden",
    }],
  },
  {
    id: "common_document",
    phrases: [
      "take a photo", "record this", "document it", "write it down",
      "take notes", "log this", "get it on camera",
    ],
    effects: [{
      say:
        "Somebody who survives this will be asked what happened, and 'we were fairly "
        + "sure' is not an answer that gets anybody paid.",
      tone: "warden",
    }],
  },
  {
    id: "common_sample",
    phrases: [
      "take a sample", "get a sample", "collect a sample", "bag it",
      "specimen", "swab it",
    ],
    effects: [{
      say:
        "Taking a sample means carrying it. Decide who, and decide whether it is going "
        + "in the same bag as anything you intend to eat.",
      tone: "warden",
    }],
  },
  {
    id: "common_backtrack",
    phrases: [
      "go back", "head back", "retrace", "back the way we came", "return to",
    ],
    effects: [{
      say:
        "The way you came is a route you have already walked, which makes it faster and "
        + "means nothing about whether it is the same as you left it.",
      tone: "warden",
    }],
  },
  {
    id: "common_time",
    phrases: [
      "how long have we got", "how much time", "how long do we have",
      "what's the time", "how long has it been",
    ],
    effects: [{
      say:
        "Check the clock on the screen — it is the same one the module is reading, and "
        + "it has not been rounding in your favour.",
      tone: "warden",
    }],
  },
];

/* ============================================================
   THE MERGE

   Module-specific listeners win. Always, and without a tie-break
   worth arguing about: an author who wrote a listener for "the
   vents" wrote it because their vents are specific, and a generic
   line about vents firing instead would be the software talking
   over the author. So module entries are placed first, and
   `rungListen` returns on its first match.

   An author can also silence a generic entry by id — declare a
   listener with the same `id` and no effects, and it takes the
   slot and does nothing. That matters for modules where a common
   assumption is false: a module set on a station with no radio at
   all does not want `common_call_for_help` musing about who else
   is listening.

   Opting out of the pack entirely is `director.commonListeners =
   false`, which exists for the same reason `tactics` defaults to
   `weakest` — nothing existing should change behaviour because a
   new capability arrived.
   ============================================================ */

/**
 * @param director  a module's `director` export, or null
 * @returns the listener list `rungListen` should walk, module-first
 */
export function mergeListeners(director) {
  const own = (director && Array.isArray(director.listeners) ? director.listeners : []).filter(Boolean);
  if (director && director.commonListeners === false) return own;

  const overridden = new Set(own.map((l) => l && l.id).filter(Boolean));
  const generic = COMMON_LISTENERS.filter((l) => !overridden.has(l.id));

  /* An author-declared entry that says NOTHING is a silencer: it
     claimed the id in order to suppress the generic one, and it
     must not then be offered to the table as an empty Move.

     "Says nothing" means neither `effects` NOR `label`, and the
     second half of that was learned the expensive way. The first
     version of this checked `effects` alone, which deleted every
     label-only listener in the codebase — a form `rungListen` has
     always supported and returns as a first-class field. Six
     tests caught it. A silencer is an entry with no voice at all,
     not an entry with one kind of voice. */
  const speaking = own.filter(
    (l) => (l.effects && l.effects.length) || l.label,
  );

  return [...speaking, ...generic];
}

export default COMMON_LISTENERS;
