/* ============================================================
   DEAD WEIGHT — WHAT THE EMPTY CHAIR IS ALLOWED TO DO HERE.

   Same contract as `ypsilon14/director.js` and worth reading
   after it, because the two modules disagree about two things on
   purpose and the disagreements are the useful part.

   ------------------------------------------------------------
   DISAGREEMENT ONE — `attacks` IS NOT EMPTY

   Ypsilon 14 ships an empty `attacks` array with a long comment
   explaining that its threat is `unseen: true`, that `safeMove`
   refuses to start a fight with an unseen threat, and that every
   entry written there would be silently dropped.

   The Passenger can be seen. It is slow, it is forty metres away
   down a lit gantry, and a crew looking at it has time to decide.
   So this module fills the array in, and the two shipped modules
   now demonstrate both halves of that rule in content rather than
   only in the test suite.

   ------------------------------------------------------------
   DISAGREEMENT TWO — THE LADDER IS SHORT

   Ypsilon 14 has five escalation beats across a 240-minute
   window. This has three across ninety, and they are pinned to
   the countdown rather than spread evenly, because a
   ninety-minute module has no slack: a beat that lands while the
   table is mid-decision is not pacing, it is interruption.

   Beat 1 lands while cutting the cable is still an easy choice.
   Beat 2 lands at the point a crew that has not split yet has run
   out of time to split. Beat 3 lands when the burn is close
   enough that the umbilical is a commitment.

   ------------------------------------------------------------
   THE RULE, UNCHANGED

   NOTHING HERE MAY TELL THE CREW SOMETHING THEY HAVE NOT EARNED.

   There are three independent routes to the fact that the cargo
   is not ore — the manifest, the deck log, and Halloran — and
   nothing in this file is a fourth. Every line below describes
   pressure, cold, or the clock. None of them describes the thing.
   ============================================================ */

export const escalate = [
  {
    label: "the tow starts arguing",
    atClock: 20,
    effects: [
      {
        say:
          "The cable note drops a tone and comes back. On the bridge plate the mass wave crosses the "
          + "midpoint of hold one and starts back the other way, four minutes slower than last time.",
        tone: "warden",
      },
    ],
  },
  {
    label: "the cold stops being weather",
    atClock: 50,
    when: "!hold_cold",
    effects: [
      {
        say:
          "The Amaranth is eleven days into standby and the Corvid has been bleeding heat down the "
          + "umbilical the whole time. Both ships are colder than they were an hour ago and only one "
          + "of them was ever meant to be.",
        tone: "horror",
      },
      { stress: 1, why: "you can see your own breath on the tug" },
    ],
  },
  {
    label: "the burn gets close",
    atClock: 72,
    effects: [
      {
        say:
          "The drive comes up to pre-ignition and the whole tug takes on a note it has not had since "
          + "Kepler. Ninety metres of umbilical is now a distance with a deadline on it.",
        tone: "horror",
      },
      { run: "prowl" },
    ],
  },
];

/* The threat's own turn, asked for rather than decided. See
   `hooks.prowl` in index.js — cold, slow, and toward warmth. */
export const pressure = "prowl";

export const onFail = [
  "Your hands are too cold for that and you find it out the expensive way.",
  "It does not go. Whatever you have just done, the sound of it goes a long way in a ship this empty.",
  "No — and you have been at it long enough that the clock has moved while you were not looking.",
  "The cold takes it off you. Everything on this ship is eleven days into being the wrong temperature.",
];

/* ------------------------------------------------------------
   CALLED ROLLS

   Every one gated on something the crew has already seen, and
   every `reason` written as the sentence that lands on a phone —
   `safeMove` refuses any entry that cannot say why.
   ------------------------------------------------------------ */
export const rolls = [
  {
    id: "the_space",
    when: "flag:saw_the_space",
    stat: "fear", save: true,
    reason: "You have stood in the gap in the ore and worked out what moved it, and you are still on the same ship as the answer.",
  },
  {
    id: "the_long_crawl",
    when: "visited:umbilical",
    stat: "sanity", save: true,
    reason: "Ninety metres of flexible tube, four dark stretches, and no way to turn round in a hurry.",
  },
  {
    id: "committed",
    when: "flag:burn_lit",
    stat: "fear", save: true,
    reason: "The drive is lit. Whatever is on the end of that cable is coming to Tarsis with you.",
  },
  {
    id: "kerrigan",
    when: "flag:found_kerrigan",
    stat: "sanity", save: true,
    reason: "He was sitting down, with his torch on, and eleven days of minus sixty have left him exactly like that.",
  },
];

/* ------------------------------------------------------------
   ATTACKS THE DIRECTOR MAY START

   Filled in, unlike Ypsilon 14's, for the reason at the top of
   this file: the Passenger has a body and can be seen coming.

   Both entries are gated on the hold being OPEN. The threat is
   behind a locked hatch until the crew opens it, and a director
   that started a fight through a sealed hold would be inventing a
   route the module does not have.
   ------------------------------------------------------------ */
export const attacks = [
  {
    threatId: "sleeper",
    when: "flag:hold_open and room:coldhold",
    text: "It comes off the port stack, unhurried, and it is between you and the ladder.",
  },
  {
    threatId: "sleeper",
    when: "flag:hold_open and flag:burn_lit",
    text: "It is on the gantry, forty metres off, and it has stopped pretending to be cargo.",
  },
];

/* ------------------------------------------------------------
   ENDINGS THE DIRECTOR MAY NOTICE

   Only the unambiguous ones, as ever. `cut` and `burned` are
   reached by the module's own hooks — the charge and the
   ignition — and are not listed here, because they have already
   happened by the time anybody could notice them.
   ------------------------------------------------------------ */
export const endings = [
  {
    id: "frozen",
    when: "flag:hold_cold and flag:burn_lit",
    why: "the hold is back in the cold and the burn is lit",
  },
];

/* Ninety in-fiction minutes across ninety real ones. One to one,
   which is the tightest rate on the shelf and the reason this
   module can be run on a weeknight. */
export const rate = 1;

/* ------------------------------------------------------------
   WHAT THIS MODULE IS LISTENING FOR

   Same rule as everywhere: a listener answers with something the
   author wrote, never with a confirmation of the theory that
   triggered it.

   The sharpest case is `cut_it`. "Cut the cable" is the correct
   answer to this module and a table will say it out loud in the
   first ten minutes. The listener does NOT say yes. It says where
   the charge is and what cutting costs, which is true, useful,
   and leaves the decision entirely with the people making it.

   `whats_in_it` is the other one to read. A table asking what is
   in the hold is a table one step from the answer, and the reply
   is about paperwork.
   ------------------------------------------------------------ */
export const listeners = [
  {
    id: "cut_it",
    phrases: ["cut the cable", "cut it loose", "cut the tow", "drop the tow", "ditch the hopper", "release the cable"],
    effects: [
      {
        say:
          "The collar charge is in the galley locker in a yellow box, and the collar is in the engine "
          + "bay. It is a thirty-second job. It is also forty-one tonnes of tonnage you do not get "
          + "paid for, and it cannot be undone.",
        tone: "warden",
      },
    ],
  },
  {
    id: "whats_in_it",
    phrases: ["what is in the hold", "what's in the hold", "what is the cargo", "what are we carrying", "what's in it"],
    effects: [
      {
        say:
          "Forty-one tonnes of unrefined nickel-iron, according to a lading sheet stamped by four "
          + "offices, none of whose stamps are legible.",
        tone: "warden",
      },
    ],
  },
  {
    /* The theory the module most wants a table to reach on its
       own, given the least helpful true answer in the file. */
    id: "its_alive",
    phrases: ["it's alive", "it is alive", "something alive", "a creature", "a monster", "something in there"],
    effects: [
      {
        say:
          "Hold one is rated for sixty tonnes and refrigerated to minus sixty, and the Amaranth is a "
          + "rock hauler. Somebody paid for that hold to be cold.",
        tone: "warden",
      },
    ],
  },
  {
    id: "split_up",
    phrases: ["split up", "splitting up", "you stay here", "i'll go alone", "cover more ground", "two teams"],
    effects: [
      {
        say:
          "Ninety metres of umbilical, eight minutes each way, and one working suit spare. Whoever "
          + "goes is out of the conversation for a quarter of an hour.",
        tone: "warden",
      },
    ],
  },
  {
    id: "the_burn",
    phrases: ["the burn", "how long have we got", "how much time", "when do we burn", "delay the burn"],
    effects: [
      {
        say:
          "The plot is locked to Tarsis and the drive is sequenced to it. Pushing the burn back is a "
          + "bridge job and it costs fuel the contract did not buy.",
        tone: "warden",
      },
    ],
  },
  {
    id: "the_fourth_suit",
    phrases: ["fourth suit", "extra suit", "whose suit", "spare suit"],
    effects: [
      {
        say:
          "It is a size nobody aboard the Corvid wears, and it was on the rack when you undocked at "
          + "Kepler.",
        tone: "warden",
      },
    ],
  },
  {
    id: "call_it_in",
    phrases: ["call it in", "radio", "contact the company", "send a message", "报告", "mayday", "distress"],
    effects: [
      {
        say:
          "Kepler is forty hours astern and Tarsis is eleven days ahead. Anything you send arrives "
          + "after you do.",
        tone: "warden",
      },
    ],
  },
  {
    id: "halloran",
    phrases: ["wake her", "the bunk", "cold bunk", "wake him up", "open the bunk"],
    effects: [
      {
        say:
          "The bunk is eleven days into a cycle rated for four. It will open. What comes out will be "
          + "very cold and very slow and will not be hurried.",
        tone: "warden",
      },
    ],
  },
];

export const director = { escalate, pressure, onFail, rolls, attacks, endings, listeners, rate };
export default director;
