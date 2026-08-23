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

export const director = { escalate, pressure, onFail, rolls, attacks, endings, rate };
export default director;
