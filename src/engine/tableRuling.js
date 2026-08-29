/* ============================================================
   TABLE RULINGS — the fiction updating with nobody behind a
   screen.

   ------------------------------------------------------------
   THE HOLE THIS FILLS

   `director.js` names its own worst limitation in its header and
   is right to:

     "Not an improviser. A Warden rewards the clever idea the
      module never anticipated. This cannot ... What it does
      instead is answer with the oracle and a complication, and
      the fiction does not update."

   `ruling.js` was written to close the second half of that, and
   closes it well: a Warden's improvised fact becomes durable,
   parseable, save-surviving, and visible to `answerLook`, so the
   room stops contradicting the Warden ten minutes later.

   Its only entry point is `screens/warden/RulingBox.jsx`.

   That is the Warden deck, which INV-9 says a wardenless table
   cannot reach — absent, not disabled, asserted by
   `tests/wardenless.test.jsx`. So the single mechanism that lets
   the fiction update in response to something the module did not
   anticipate is unavailable to the configuration whose defining
   weakness is that the fiction does not update in response to
   something the module did not anticipate.

   INVARIANTS.md predicted this in writing:

     "A capability whose only switch is on the Warden deck does
      not exist for the configuration that most needs it. This has
      been the root cause of two shipped-but-unreachable features;
      check it before adding a third."

   This was the third.

   ------------------------------------------------------------
   WHY A SECOND VOICE, AND NOT A BUTTON

   With a Warden, one person is authorised to say what is true and
   everyone agreed to that before the session started. With nobody
   behind the screen there is no such person, and a lone button
   labelled "make this true" hands any one player the authority
   nobody granted them. The quiet failure mode is not somebody
   cheating — it is one confident player narrating the ship while
   five people watch, which is the exact table dynamic the floor
   rung exists to prevent.

   INV-10 already settled the shape. A Move addressed to a player
   can be waved off by that player alone; a Move addressed to the
   ROOM takes a second voice, because it affects everybody. A
   ruling is addressed to the room by construction — it changes
   what the room says to every phone. So it takes a second voice,
   and it takes it through the same mechanism `objection.js`
   already uses, with the same window and the same quorum, because

     "two parallel mechanisms for 'the table said no' is one more
      than anybody could reason about later"

   and two parallel mechanisms for "the table said yes" is the
   same mistake wearing a different hat.

   ------------------------------------------------------------
   INV-1 AND INV-6 ARE UNTOUCHED

   Nothing here composes a sentence. `propose` takes a string a
   human typed and carries it, unmodified, to `makeRuling`, which
   stores it verbatim — the identical contract the Warden's box
   has always had. The only thing this file decides is WHEN a
   human's sentence becomes true, never WHAT it says.

   There are no pools here, no tables, no `rng`, and no template.
   If any of those ever appear, this has become the thing the
   repository refused to build.

   ------------------------------------------------------------
   THE ONE THING IT REFUSES

   A proposal cannot be private. `makeRuling` accepts a `told`
   list and the Warden's box uses it, because a Warden legitimately
   tells one player something the others must not hear.

   A table cannot do that to itself. A secret that two players
   voted for and four players do not know about is not a secret,
   it is a faction — and worse, it would be a secret the shared
   screen is holding on behalf of some of the people reading it.
   So `told` is not a parameter here and cannot be passed. A
   wardenless table's rulings are public, always, and that is a
   property of having no Warden rather than a limitation of this
   file.
   ============================================================ */

import { makeRuling, commitRuling, SCOPE } from "./ruling.js";

/** Same window as an objection, and for the same reason: long
 *  enough that a second person has to look up, notice and reach;
 *  short enough that two proposals ten minutes apart never
 *  combine into one nobody made. */
export const PROPOSAL_WINDOW_MS = 45000;

/** Two different people. Not a majority — see the header. A
 *  referendum on every invented fact would stop the game dead,
 *  and the point is that one person cannot do it alone. */
export const PROPOSAL_QUORUM = 2;

/** How many proposals may be open at once. One.
 *
 *  Two open proposals means a player seconding "the panel comes
 *  down on four wing-nuts" while looking at a card that says "the
 *  hatch is welded", and neither of them finds out. A queue would
 *  fix that and would also mean the table debating a fact from
 *  four minutes ago, which is worse. So a new proposal replaces
 *  an unseconded one, and the replaced one is reported rather
 *  than dropped silently. */
export const MAX_OPEN = 1;

export const PROPOSAL_ERRORS = {
  OWN: "Somebody else has to agree with this one.",
  GONE: "That one has already lapsed. Say it again if you still mean it.",
  NONE: "There is nothing to agree with.",
};

export const emptyProposals = () => ({ open: null });

/**
 * Somebody typed a fact and pressed propose.
 *
 * Returns the next ledger plus what the room should be told. The
 * ruling is NOT committed here — a proposal is not yet true, and
 * the whole point of the file is the gap between saying and being.
 *
 * @param {object} ledger
 * @param {object} spec   { text, scope, room, subject, by, clock, at }
 * @param {number} now
 */
export function propose(ledger, spec = {}, now = Date.now()) {
  const base = ledger && typeof ledger === "object" ? ledger : emptyProposals();

  /* Validate through `makeRuling` rather than by re-checking the
     rules here. It already knows a THING needs a subject and a
     ROOM needs a room, and a second copy of those rules would
     drift from the first one exactly as `LADDER` drifted from
     `RUNGS`. The built ruling is held, not committed. */
  const built = makeRuling({
    text: spec.text,
    scope: spec.scope || SCOPE.ROOM,
    room: spec.room,
    subject: spec.subject,
    by: spec.by || "table",
    clock: spec.clock,
    at: now,
    /* Deliberately absent — see the header. A table cannot keep a
       secret from itself. */
    told: null,
  });
  if (built.error) return { next: base, error: built.error };

  const replaced = base.open && now - base.open.at <= PROPOSAL_WINDOW_MS ? base.open : null;

  return {
    next: {
      open: {
        ruling: built.ruling,
        by: spec.by || null,
        who: spec.by ? [spec.by] : [],
        at: now,
      },
    },
    /* The proposer's own name is not in this line. Same reasoning
       as OBJECTION_NOTED: naming who said it turns a quiet
       suggestion into a thing to have an opinion about. */
    said: PROPOSAL_NOTED,
    replaced: replaced ? replaced.ruling.text : null,
    error: null,
  };
}

/**
 * A second phone agreed.
 *
 * Returns `{ next, carried, ruling }`. When `carried` is true the
 * caller commits `ruling` to the world — this file does not touch
 * world state, so the whole threshold is assertable without a
 * host, a socket or a rendered tree, exactly as `noteObjection` is.
 */
export function second(ledger, pcId, now = Date.now()) {
  const base = ledger && typeof ledger === "object" ? ledger : emptyProposals();
  const open = base.open;

  if (!open) return { next: base, carried: false, error: PROPOSAL_ERRORS.NONE };
  if (now - open.at > PROPOSAL_WINDOW_MS) {
    return { next: emptyProposals(), carried: false, error: PROPOSAL_ERRORS.GONE };
  }
  /* The proposer cannot second themselves, and this is the whole
     mechanism rather than a detail of it. Without this line one
     player can make anything true by tapping twice, and the file
     has no purpose. */
  if (pcId && open.who.includes(pcId)) {
    return { next: base, carried: false, error: PROPOSAL_ERRORS.OWN };
  }

  const who = pcId ? [...open.who, pcId] : open.who;
  if (who.length >= PROPOSAL_QUORUM) {
    return {
      next: emptyProposals(),
      carried: true,
      /* Stamped with the moment it became true rather than the
         moment it was said, because the transcript reads as a
         record of the session and a fact that existed before
         anybody agreed to it would be a lie in the record. */
      ruling: { ...open.ruling, at: now, by: "table" },
      error: null,
    };
  }
  return { next: { open: { ...open, who } }, carried: false, error: null };
}

/** Somebody withdrew, or the room moved on. Lapsing is silent —
 *  announcing that nobody agreed with a person is a way of making
 *  them not say the next one. */
export function lapse(ledger, now = Date.now()) {
  const base = ledger && typeof ledger === "object" ? ledger : emptyProposals();
  if (!base.open) return base;
  if (now - base.open.at > PROPOSAL_WINDOW_MS) return emptyProposals();
  return base;
}

/** Commit a carried proposal. A one-line wrapper so callers never
 *  reach past this module into `ruling.js` and accidentally take
 *  the Warden path, which allows `told`. */
export const commit = (w, ruling) => commitRuling(w, ruling);

/** What the room is told when one person has proposed and nobody
 *  has agreed yet. Not a prompt: "does anyone agree?" turns a
 *  suggestion into a poll, and a poll is a thing people abstain
 *  from. */
export const PROPOSAL_NOTED =
  "Somebody put that forward as true. If anyone agrees, say so and it stands.";

/** And when it carries. The table is told the fact is now part of
 *  the ship, because the entire value of a ruling is that it stops
 *  being somebody's idea. */
export const PROPOSAL_CARRIED = "Agreed. That is true from here.";

export default { propose, second, lapse, commit };
