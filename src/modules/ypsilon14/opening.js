/* ============================================================
   THE FIRST FIFTEEN MINUTES

   Ypsilon 14 is configured as the tutorial module, and
   docs/YPSILON14_WARDEN_DOSSIER.md is genuinely good — but a
   first-time Warden at minute zero is looking at six tabs and a
   text field, and the dossier is a document you read *before*,
   not a thing that helps you *during*. The gap between "I have
   read how this works" and "I am running it in front of five
   people" is where the module's stated purpose was being lost.

   So this walks the Warden through the deck's five most
   important levers while running the actual opening scene. Not a
   tutorial mode, not a sandbox: the steps below are the real
   first fifteen minutes of the real session, and by the end of
   them the table has docked, met Sonya, moved a pallet, heard
   the first wrong thing, and the Warden has used the mouth, the
   hold, the scene ring, an NPC voice and a countdown.

   THREE RULES IT FOLLOWS.

     · Every step is a thing the Warden was going to do anyway.
       Nothing here is busywork invented to demonstrate a
       feature; if a step were cut, the scene would be worse.

     · It never acts on its own. Each step says what to do and
       which control does it. Pressing it is the Warden's job,
       because a tutorial that plays the game for you teaches
       nothing and a Warden who has not touched the control has
       not learned where it is.

     · It can be dismissed at any point and never comes back
       uninvited. A Warden who knows this module does not need a
       chaperone, and the second-most annoying thing software
       does is help you after you have stopped needing it.

   `check` is optional and, where present, watches for the thing
   actually happening — so the step marks itself done when the
   Warden does it, rather than when they click "next". A step
   that ticks itself is the difference between a checklist and a
   guide.
   ============================================================ */

export const OPENING = [
  {
    id: "speak",
    title: "Say the first line out loud",
    lever: "The bar at the bottom — the field with the speaker selector.",
    body:
      "The intro text is already in the feed; the table has read it. Your first job is not to add " +
      "information, it is to make the room feel occupied. Set the speaker to SONYA and type something " +
      "impatient about the pallets. One line. The bar is the whole of your mouth and it is deliberately " +
      "the only thing on that half of the screen.",
    why: "A Warden who has spoken as an NPC in the first two minutes will do it all evening. One who has not, mostly will not.",
    check: (w) => (w.feed || []).some((l) => l.npc === "sonya"),
  },
  {
    id: "countdown",
    title: "Show them the window closing",
    lever: "Tempo tab → the CARGO TRANSFER countdown is already running.",
    body:
      "240 minutes started the moment the clamps took hold. Point at it and say what it means: six " +
      "pallets, four hours, and every single thing they do that is not loading a pallet is spending " +
      "that number. You do not need to press anything — you need them to have *seen* it.",
    why:
      "This is the module's only real pressure and it is the one thing tables reliably fail to notice until " +
      "it is gone. Naming it at minute three is worth more than any amount of atmosphere at minute two hundred.",
  },
  {
    id: "pallet",
    title: "Let them move the first pallet",
    lever: "Nothing. This is theirs.",
    body:
      "Say yes to the first sensible plan without complicating it. The first pallet should be boring and " +
      "should work, because the module needs a baseline of 'this is a job' before anything is wrong. " +
      "Watch the clock move twenty minutes and say so.",
    why: "Horror needs a normal to deviate from. A module that is strange from minute one has nowhere to go.",
    check: (w) => (w.flags && (w.flags.pallets || 0) > 0) || w.clock >= 20,
  },
  {
    id: "listen",
    title: "Give them the first wrong thing",
    lever: "The bar, as THE WARDEN — or the Props tab if you would rather hand them something.",
    body:
      "Somebody asks about Mike, or looks at the residue, or notices the cat will not go through a " +
      "particular doorway. Answer honestly and incompletely. The three-layer answers in the Dossier tab " +
      "are written for exactly this: the public line now, the private one when they push, the secret one " +
      "never. Do not volunteer the second layer.",
    why:
      "The module's paranoia comes from partial answers, not from spooky description. A Warden who gives the " +
      "private layer on the first ask has spent the whole module in ten minutes.",
  },
  {
    id: "round",
    title: "Start a round the first time four people talk at once",
    lever: "Tempo tab → ROUND. And Shift+Space to hold the table.",
    body:
      "It will happen within the first fifteen minutes and it is not a discipline problem, it is six " +
      "people on six phones with no way to see whose turn it is. Start a scene round. Each player gets " +
      "the room in an order everyone can see, and the others queue rather than being refused. If it gets " +
      "loud before you get there, Shift+Space holds everything — that is the one control worth having in " +
      "muscle memory.",
    why:
      "This is the single most useful thing the software does that a physical table cannot, and Wardens " +
      "who have not used it once by minute fifteen tend never to find it.",
    check: (w) => !!(w.tempo && w.tempo.scene),
  },
];

/** Where the Warden has got to. Steps that carry a `check` tick
    themselves; the rest advance by hand. */
export function openingProgress(w, dismissedAt = 0) {
  if (!w) return { done: [], next: null, complete: false };
  const done = [];
  for (const step of OPENING) {
    if (step.check && step.check(w)) done.push(step.id);
  }
  const next = OPENING.find((s) => !done.includes(s.id) && OPENING.indexOf(s) >= dismissedAt) || null;
  return { done, next, complete: done.length >= OPENING.length };
}

/** Long past the point where a guided opening is still an opening.
    Fifteen fiction-minutes is roughly the first scene; after the
    first pallet the Warden is running the module, not starting it. */
export const OPENING_EXPIRES_AT = 45;

export const openingLive = (w) =>
  !!w && (w.clock || 0) < OPENING_EXPIRES_AT && !(w.flags && w.flags.opening_dismissed);

export default OPENING;
