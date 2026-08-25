/* ============================================================
   YPSILON 14 — WHAT THE EMPTY CHAIR IS ALLOWED TO DO HERE.

   The director (see src/engine/director.js) is a loop with no
   content of its own. It can pace a room and describe it, and
   that is all it could ever do on this module, because rungs 4
   and 6 open with `if (!mod.director) return null` and this
   module had no `director` key. A table would feel that in about
   twenty minutes: the room keeps talking, and the situation never
   gets worse.

   This file is the content. It is deliberately module-authored
   rather than engine-derived, because everything here is a
   judgement about *this* module — how long is too long in the
   airlock bay, which of the ten people on this base would speak
   up unprompted, what a failed roll in the mine tunnel actually
   costs — and none of those judgements generalise.

   ------------------------------------------------------------
   THE RULE THIS FILE OBEYS

   NOTHING HERE MAY TELL THE CREW SOMETHING THEY HAVE NOT EARNED.

   `safeMove` drops a Move about a room nobody has entered or a
   threat nobody can see, but it cannot check the *content* of a
   line an author wrote. So the lines below are written to the
   same standard the atmosphere pools are: they describe pressure,
   not information. "The lights in here are on a timer somebody
   stopped resetting" is fair. "Something is in the ducting above
   you" is not, and would hand the table the answer to the module.

   ------------------------------------------------------------
   WHAT IT DELIBERATELY DOES NOT DO

   It does not fire the module's set pieces. Giovanni, the pod,
   the showers and the self-destruct are all reached by players
   doing things, and a director that walked the table through them
   on a timer would be running a cutscene. The escalation ladder
   below turns screws — noise, nerves, the base's own clock — and
   leaves every actual discovery to the crew.
   ============================================================ */

/* ------------------------------------------------------------
   THE LADDER

   Five beats, in order, gated on the clock and on what the crew
   has already found. Each fires once; `useDirector` advances
   `flags.directorStage` when it takes one.

   The clock times are chosen against the module's own arithmetic:
   six pallets at twenty minutes is two hours of a four-hour
   window, so beat 1 lands while the job is still plausible, beat
   3 lands around the point a table that has done nothing but load
   cargo is about to run out of window, and beat 5 lands after it
   has gone.

   `when` clauses keep them honest. A crew that has already found
   the goo does not need to be told the base is uneasy; a crew
   that has already got the muster does not need a second one.
   ------------------------------------------------------------ */
export const escalate = [
  {
    label: "the base notices the visitors",
    atClock: 35,
    effects: [
      {
        say:
          "Somewhere below, a pump changes note and settles again. The base is a building that is "
          + "always talking to itself, and none of the people who live in it look up any more.",
        tone: "warden",
      },
    ],
  },
  {
    label: "nobody has found Mike",
    atClock: 75,
    when: "!knows_devour",
    effects: [
      {
        say:
          "The shift board by the workspace door still has VOSS chalked against a rota nobody has "
          + "rubbed out. It has been there two days.",
        tone: "warden",
      },
      { stress: 1, why: "nobody here expects to find him" },
    ],
  },
  {
    /* Not a set piece — a nudge on the thing the module already
       cares about. `noise` is a real field the creature reads (see
       sim.js), so this is a beat with mechanical weight rather
       than a line of mood. */
    label: "the base gets loud",
    atClock: 120,
    effects: [
      {
        say:
          "The ore line starts up in the workspace, and for twenty minutes the whole rock is a drum. "
          + "You could not hear someone shouting from the next room.",
        tone: "horror",
      },
      { noise: 3, noiseRoom: "work" },
    ],
  },
  {
    label: "the crew stop pretending",
    atClock: 165,
    when: "!muster",
    effects: [
      {
        say:
          "Two of the miners have stopped working and are standing in a doorway, not talking, "
          + "watching the corridor. Nobody has told them to.",
        tone: "warden",
      },
      { run: "raiseFearBeat" },
    ],
  },
  {
    label: "the window is closing",
    atClock: 215,
    when: "!cargo_done",
    effects: [
      {
        say:
          "Traffic control pings your ship for a departure time it is not going to get. "
          + "Twenty-five minutes of window left, and six pallets do not load in twenty-five minutes.",
        tone: "alarm",
      },
    ],
  },
];

/* ------------------------------------------------------------
   THE THREAT, ASKED TO TAKE ITS TURN

   `rungPressure` fires after five real minutes of nobody doing
   anything at all. It names a module hook and nothing else: the
   director does not decide where the creature goes, because
   `thinkMonster` in sim.js already does and it does it better —
   it knows about hunger, the pod, water, decoy tapes and the
   route back to the ante-chamber to mend.

   So this is one line long, and that is the correct length.
   ------------------------------------------------------------ */
export const pressure = "directorPressure";

/* ------------------------------------------------------------
   FAILURE, NARRATED

   The mechanical consequence of a bad roll always lands. The
   sentence about it does not, and the sentence is the half a
   player remembers. These are the module-wide fallbacks; a room
   with its own `onFail` pool uses that instead.

   Written to be true after *any* failure, because that is what a
   fallback has to survive. Nothing here names a cause — the
   engine has already said what went wrong, and a second opinion
   from the director would either repeat it or contradict it.
   ------------------------------------------------------------ */
export const onFail = [
  "That does not go the way you wanted, and the noise it makes carries further than you would like.",
  "It comes apart in your hands. Somewhere down the corridor, something stops for a second and then carries on.",
  "You lose the thread of it. When you look up you have been at this longer than you thought.",
  "No. Whatever that was going to be, it is not that, and you are standing in the open while you work it out.",
  "The rock takes it off you. Ypsilon 14 is a place where things go wrong slightly faster than you can fix them.",
];

/* ------------------------------------------------------------
   CALLED ROLLS

   Every entry must be able to say why, out loud, to the player it
   lands on — `safeMove` refuses any that cannot, and that guard
   is the whole reason a director is allowed to test anybody at
   all. Read each `reason` as the sentence on the phone, because
   that is exactly what it is.

   All of them are gated on something the crew has already done or
   seen. There is no roll here for a danger nobody was shown.
   ------------------------------------------------------------ */
export const rolls = [
  {
    id: "first_goo",
    when: "flag:knows_goo",
    stat: "fear", save: true,
    reason: "You have seen what the yellow stuff does, and you are still on the rock with it.",
  },
  {
    id: "the_dark_below",
    when: "visited:depths",
    stat: "sanity", save: true,
    reason: "You are a very long way underground, in somebody else's tunnel, with the lights behind you.",
  },
  {
    id: "overdue",
    when: "flag:overstayed",
    stat: "fear", save: true,
    reason: "Your window has closed. Whatever happens now happens to people who chose to stay.",
  },
  {
    id: "watched",
    when: "flag:muster",
    stat: "sanity", save: true,
    reason: "Nine people who live here are standing in one room because they are frightened, and you are the reason they said it out loud.",
  },
];

/* ------------------------------------------------------------
   ENDINGS THE DIRECTOR MAY NOTICE

   Every id here must exist in `endings` — `rungEnding` refuses
   anything the module has not declared, so this cannot invent an
   evening's conclusion.

   Deliberately short, and deliberately only the *unambiguous*
   ones. "The crew has left the rock" is a fact. "The story has
   reached a satisfying place" is a judgement, and with the chair
   empty that judgement belongs to the table — which is what the
   `callit` vote is for.
   ------------------------------------------------------------ */
export const endings = [
  { id: "quarantine", when: "flag:airlocks_locked and flag:warned", why: "sealed and reported" },
];

/* ------------------------------------------------------------
   ATTACKS THE DIRECTOR MAY START — DELIBERATELY NONE.

   Empty rather than absent, and the difference matters: absent
   means an author has not got to it yet, and `defineModule` warns
   about it. This is a decision.

   IT is `unseen: true`, and `safeMove`'s fifth check refuses to
   start a fight with a threat the module declared unseen — for
   the same reason `unseen` exists at all. An invisible thing may
   be *moved* and must never be *narrated*, and "it attacks you
   now" is the purest form of narrating it. Every entry written
   here would be silently dropped, which is the worst possible
   outcome: content that looks like it works.

   And the thing that ought to make that call already does it
   properly. `thinkMonster` in sim.js knows about hunger, the pod,
   water, decoy tapes, noise draw, and the route back to the
   ante-chamber to mend. A director timing an ambush off a `when`
   string would be a worse monster wearing the same name.

   A module whose threat can be seen coming — a mutineer, a dog,
   anything with a body — should fill this in. This one should not.
   ------------------------------------------------------------ */
export const attacks = [];

/* ------------------------------------------------------------
   HOW OFTEN THIS MODULE EXPECTS TO MOVE

   Read by `rungPacing` through `pacingOf`. Ypsilon 14 is a
   four-hour module with a 240-minute in-fiction window, so roughly
   one fiction-minute per real-minute is the shape it was written
   for. A table drifting well under this is one the clock rung is
   allowed to mention; a table over it is going too fast and the
   director says nothing, because "hurry up" is the one thing
   pacing.js correctly refuses to say.
   ------------------------------------------------------------ */
export const rate = 1;

/* ------------------------------------------------------------
   WHAT THIS MODULE IS LISTENING FOR

   `rungListen` was added to the engine in 2.10.0 to close the last
   big gap in the empty chair — that every other rung is triggered
   by *state*, and at a real table most Warden moves are triggered
   by a sentence somebody said out loud. It shipped working, and no
   module declared a single listener, so in the only playable module
   the director still never once answered anybody. The mechanism was
   finished and the content was missing, which is the worst way for
   a feature to be absent: it looks present.

   ------------------------------------------------------------
   THE RULE, WHICH IS THE SAME RULE AS EVERYWHERE ELSE IN THIS FILE

   NOTHING HERE MAY TELL THE CREW SOMETHING THEY HAVE NOT EARNED —
   and here the rule bites harder than it does on the escalation
   ladder, because a listener fires on the exact subject somebody
   just raised. A table saying "check the vents" is a table with a
   theory, and a director that answers a correct theory with a
   confirming detail has ended the module. So the vent listener
   below answers with the grille and the cold and says nothing
   whatever about what uses them.

   The same goes double for water. Standing water is the creature's
   one hard limit, the crew are meant to work that out from the
   showers and the cat and the mess it leaves — and a listener that
   got warm when somebody said "water" would hand them the answer
   for having guessed at it. It answers about rationing and the
   pump, which is true, unhelpful and fair.

   ------------------------------------------------------------
   AND NOTHING HERE IS COMPOSED

   A listener is a phrase set and, next to it, a line THIS FILE
   wrote. The engine matches words and fires prose that already
   existed. There is no path from a keyword to a generated sentence
   and there must never be one — see INV-6.

   Matching is substring and case-insensitive, so "vent" catches
   "vents" and "the venting". That is why the phrases are longer
   than they look like they need to be: "alone" would fire on "we
   should not go alone", which means the opposite.
   ------------------------------------------------------------ */
export const listeners = [
  {
    id: "splitting_up",
    phrases: ["split up", "splitting up", "go alone", "on my own", "cover more ground", "separately"],
    effects: [
      {
        say:
          "Nine people live on this rock and none of them are in the same room as each other. "
          + "It is a base built by people who stopped finding that strange.",
        tone: "warden",
      },
    ],
  },
  {
    /* The theory the module most wants a table to arrive at on its
       own. It gets the least helpful true answer in the file. */
    id: "the_vents",
    phrases: ["the vent", "vents", "ducting", "air duct", "crawlspace"],
    effects: [
      {
        say:
          "The grilles are secured with wing bolts and painted over. Whatever moves behind them, "
          + "moves cold air, and the whole base has the sound of it running under everything else.",
        tone: "warden",
      },
    ],
  },
  {
    /* Likewise. True, and no warmer for being asked. */
    id: "the_water",
    phrases: ["the water", "standing water", "the shower", "showers", "flood", "hose"],
    effects: [
      {
        say:
          "Water on Ypsilon 14 is metered. The showers run for ninety seconds and the pump makes a "
          + "sound like something clearing its throat when they stop.",
        tone: "warden",
      },
    ],
  },
  {
    id: "asking_after_mike",
    phrases: ["mike", "voss", "the missing", "who's missing", "whos missing"],
    when: "!knows_devour",
    effects: [
      {
        say:
          "Nobody says he has gone. They say he has not been on shift, which is a different sentence "
          + "and they are all being careful to use it.",
        tone: "warden",
      },
    ],
  },
  {
    id: "the_cat",
    phrases: ["the cat", "prince", "kitty"],
    effects: [
      {
        say:
          "The cat is somewhere it can see both doors, and it has been there a while.",
        tone: "warden",
      },
    ],
  },
  {
    /* Fair game: the crew can confirm this by looking, and it is
       the single most useful thing a frightened table can learn
       about this base. */
    id: "weapons",
    phrases: ["a weapon", "weapons", "gun", "rifle", "shoot it", "kill it", "armed"],
    effects: [
      {
        say:
          "This is a mining concern. There are cutters, a rock hammer, and whatever you walked in "
          + "with — and nine people who have never needed anything else out here.",
        tone: "warden",
      },
    ],
  },
  {
    id: "calling_for_help",
    phrases: ["call for help", "radio", "distress", "mayday", "contact the company", "send a message"],
    effects: [
      {
        say:
          "The relay is up. It is also eleven hours each way to anybody who could do anything, "
          + "and the company's first question will be about the cargo.",
        tone: "warden",
      },
    ],
  },
  {
    id: "just_leave",
    phrases: ["just leave", "get off this rock", "back to the ship", "leave them", "cut our losses"],
    when: "!cargo_done",
    effects: [
      {
        say:
          "You can. The pallets stay where they are, and so does the fee, and somebody at the other "
          + "end will want to know which of those you decided was worth less.",
        tone: "warden",
      },
    ],
  },
  {
    id: "not_trusting_them",
    phrases: ["don't trust", "dont trust", "lying to us", "hiding something", "one of them"],
    effects: [
      {
        say:
          "They are frightened people who live eleven hours from anywhere, and you are six strangers "
          + "who arrived asking questions. Everyone in this room is deciding about everyone else.",
        tone: "warden",
      },
      { stress: 1, why: "you said it out loud" },
    ],
  },
  {
    id: "sealing_up",
    phrases: ["seal the", "lock the airlock", "quarantine", "shut it in", "trap it"],
    effects: [
      {
        say:
          "The airlocks answer to the workspace panel, and the panel is not subtle about it — "
          + "every door on the base reports its own state to anybody standing there.",
        tone: "warden",
      },
    ],
  },
  {
    id: "hiding",
    phrases: ["we hide", "hide in", "barricade", "lock ourselves", "stay put", "wait it out"],
    effects: [
      {
        say:
          "Nothing on this base locks from the inside. It was never built for anybody wanting to be "
          + "somewhere the others could not get to.",
        tone: "warden",
      },
    ],
  },
  {
    id: "the_goo",
    phrases: ["the goo", "yellow stuff", "the slime", "residue"],
    when: "flag:knows_goo",
    effects: [
      {
        say:
          "There is more of it than there was. Not a trail — patches, in places nothing sensible "
          + "would have to pass through.",
        tone: "horror",
      },
    ],
  },
];

export const director = { escalate, pressure, onFail, rolls, attacks, endings, listeners, rate };
export default director;
