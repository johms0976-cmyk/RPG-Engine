/* ============================================================
   ANOTHER BUG HUNT — WHAT THE EMPTY CHAIR MAY DO HERE

   The rule this file obeys is the same one Ypsilon 14's obeys:

     NOTHING HERE MAY TELL THE CREW SOMETHING THEY HAVE NOT
     EARNED.

   That rule bites unusually hard in this module, because the
   module's central fact — acid kills them, and nothing else
   does — is a discovery that costs a marine's frozen hands to
   make. A director line that said "your rifles will not work"
   would hand the table the answer to scenario one for free.
   So the beats below turn screws the crew can already feel:
   the water, the weather, the ammunition, the fact that the
   colonists outside the wire are watching them decide.

   THREE LADDERS, because three things are tightening at once
   and collapsing them into one list would mean the storm waits
   behind the carcs until somebody happens to trigger a beat.

     weather   the storm, which is on a timer and indifferent
     siege     the carcs outside, which respond to the Signal
     people    the colonists, who are watching and choosing

   WHAT IT DELIBERATELY DOES NOT DO: it never fires a mission,
   never opens the Court, never mentions Hinton, and never
   narrates a carcinid the crew have not seen. The three
   factions are reached by players choosing, and a director that
   walked a table into scenario 2b on a timer would be running a
   cutscene.
   ============================================================ */

export const escalate = [
  /* ---------------- the weather ---------------- */
  {
    track: "weather", atClock: 40, label: "the rain gets worse",
    effects: [{
      say: "The rain changes gear. It was falling; now it is arriving, and the sound of it on the roof panels makes conversation a thing you have to work at.",
      tone: "warden",
    }],
  },
  {
    track: "weather", atClock: 150, label: "the ground stops holding",
    effects: [
      { say: "The mud outside has stopped being ground and started being a fluid. Anything with wheels is now a judgement call rather than a vehicle.", tone: "warden" },
      { stress: 1, why: "the way out is going" },
    ],
  },
  {
    track: "weather", atClock: 300, when: "!flag:endgame", label: "the water is inside",
    effects: [{
      say: "There is water coming in somewhere above you and finding its way down through the decks, and it has been doing it for long enough to have chosen a route.",
      tone: "horror",
    }],
  },

  /* ---------------- the siege ---------------- */
  {
    track: "siege", atClock: 70, when: "!flag:signal_down", label: "something is keeping pace",
    effects: [{
      say: "Out past the range of the lamps, something has been keeping level with you for a while now. It is not closing. It is not leaving either.",
      tone: "horror",
    }],
  },
  {
    track: "siege", atClock: 180, when: "!flag:signal_down", label: "they are coordinating",
    effects: [
      { say: "Whatever is out there is not moving at random any more. It is moving in a way that has an outside and an inside, and you are on the inside of it.", tone: "horror" },
      { stress: 1, why: "that is a formation" },
    ],
  },
  {
    track: "siege", when: "flag:signal_down", label: "the siege lifts",
    effects: [{
      say: "It has gone very quiet outside. Not the quiet of nothing being there — the quiet of a great many things all leaving at once, in the same direction, without any hurry at all.",
      tone: "warden",
    }],
  },

  /* ---------------- the people ---------------- */
  {
    track: "people", atClock: 100, when: "flag:reached_heron and !flag:endgame", label: "the colonists are watching",
    effects: [{
      say: "Somebody in the hangar has been watching your crew talk for a while now, and has worked out that no decision has been made yet, and has told the others.",
      tone: "warden",
    }],
  },
  {
    track: "people", atClock: 220, when: "flag:reached_heron and !flag:endgame", label: "the ammunition question",
    effects: [
      { say: "The stockpile has been counted again. It is being counted more often than it is being used, and everybody has noticed that this is what people do when they are frightened.", tone: "warden" },
      { stress: 1, why: "they are counting the belts again" },
    ],
  },
  {
    track: "people", atClock: 400, when: "flag:power_out", label: "somebody says it out loud",
    effects: [{
      say: "Somebody in the dark says the thing everybody has been thinking, which is that nobody is coming, and nobody in the hangar contradicts them.",
      tone: "npc",
    }],
  },
];

/* Rolls the director may call. Every one carries a `reason`,
   which is the sentence on the player's phone — safeMove drops
   any roll without one, and correctly, because a roll the table
   was never shown the danger for is a roll they cannot play
   around. */
export const rolls = [
  {
    id: "footing", when: "room:dam", stat: "body", once: true,
    reason: "The wall is ten metres wide, the rain is going sideways, and there is sixty metres of nothing on your left.",
  },
  {
    id: "cold", when: "flag:power_out", save: "body", once: true,
    reason: "The heating went with the lights and you have been wet since you landed.",
  },
  {
    id: "nerve", when: "flag:endgame", save: "fear", once: true,
    reason: "The water is in the building and there is no longer anywhere in it that is dry.",
  },
];

/* Moments a threat may legitimately come through the door.
   Every entry names a threat that is already in the world and
   visible — safeMove refuses anything else, which is why there
   is nothing here for the nobles or for Hinton. Neither of them
   is an ambush; both are places the crew walk into. */
export const attacks = [
  {
    id: "hangar_wire", threatId: "carc", when: "flag:reached_heron and flag:wave_pending and !flag:signal_down",
    room: "hangar", count: 1, distance: 25, once: false,
    reason: "Something has come over the wire on the north side and the sandbags were never going to be the part that mattered.",
  },
  {
    id: "shaft_hatchlings", threatId: "hatchling", when: "room:chimney and flag:seen_cocoons",
    room: "chimney", count: 2, distance: 8, once: true,
    reason: "Two more of the cocoons have opened while you were on the rope, and what came out of them has not hardened.",
  },
];

/* Phrase listeners. These fire prose that was written here —
   there is no keyword-to-generated-sentence path and there must
   never be one. Each of these answers something a table will
   actually say out loud in this module. */
export const listeners = [
  {
    id: "shootit", phrases: ["shoot it", "open fire", "light it up", "empty the mag"],
    when: "flag:seen_carc and !flag:knows_acid",
    effects: [{ say: "The rounds go in and stop mattering somewhere around the second layer. It does not stagger. It reallocates.", tone: "horror" }],
  },
  {
    id: "radio", phrases: ["radio", "call for help", "hail them", "comms"],
    when: "!flag:signal_down",
    effects: [{ say: "Every channel on this planet is the same wall of structured noise, going round on a cycle, and it has been for three months.", tone: "system" }],
  },
  {
    id: "papercuts", phrases: ["paper cut", "papercut", "the cuts", "incisions"],
    when: "flag:seen_papercuts",
    effects: [{ say: "Every body you have found today has them. So does at least one person who is still walking around.", tone: "warden" }],
  },
  {
    id: "android", phrases: ["hinton", "the android", "science officer"],
    when: "flag:knows_roster",
    effects: [{ say: "His box on the chart is the only one nobody annotated. Not dead, not missing. Just not written on.", tone: "warden" }],
  },
  {
    id: "leave", phrases: ["let's leave", "get off this rock", "just go", "call the dropship"],
    when: "!flag:comms_up",
    effects: [{ say: "Nothing on this planet can call anybody. The one transmitter that could is across the dam with something living in it.", tone: "system" }],
  },
];

/* Lines drawn from after a failed roll. A room's own beats
   outrank these. */
export const onFail = [
  "It takes longer than it should and the water is higher when you look up.",
  "It works, badly, and something a long way off changes what it was doing.",
  "Somebody's lamp goes out for four seconds and comes back on, and everybody counts.",
  "You get it done. You are being watched while you do it, and you have no idea by what.",
];

export const director = {
  escalate,
  rolls,
  attacks,
  listeners,
  onFail,
  pressure: "onTick",
  /* Endings the director may reach on its own. Both are the
     module's own timers arriving rather than a judgement call —
     everything else here ends because a player chose it. */
  endings: [
    { id: "drowned", when: "flag:endgame and clock>720" },
  ],
  /* Four scenarios, each written to run three to six hours, and
     the fiction is priced in hours rather than minutes — a
     ten-hour storm across an evening. Six fiction-minutes per
     real minute keeps the timeline moving without the pacing
     rung declaring a skip at a table that is enjoying itself. */
  rate: 6,
};
