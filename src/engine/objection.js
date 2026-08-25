/* ============================================================
   "NOT THAT" — the table correcting the empty chair.

   THE HOLE THIS FILLS

   `useDirector` keeps a ledger. A rung the table has waved away
   enough times is retired for the rest of the session, and that
   ledger is the only correction the empty chair has: with nobody
   behind the screen there is no strip, no pause, and nothing to
   veto. Moves are simply taken.

   Two things could write to that ledger and both required a
   person. A VETO is a Warden judging a rung, which a wardenless
   table does not have. A DISPUTE is a player waving off a move
   ADDRESSED TO THEM — and that is the hole, because `describe`,
   `atmosphere`, `npcSay`, `clock` and `callback` Moves carry no
   `pcId` at all. They are the majority of what a wardenless table
   hears and they were structurally undisputable. The one
   configuration with nobody checking the ladder was also the one
   where most of the ladder's output could not be corrected.

   WHY A QUORUM RATHER THAN A BUTTON

   A dispute is believed instantly and without appeal, and that is
   right, because the person it was aimed at is the only authority
   on whether it was aimed well. Nobody else at the table is worse
   off for it.

   An atmosphere line has no such person. It was said to the room,
   so the room is the only thing that can judge it — and one
   player pressing a button is not the room. It is one player, who
   might be bored of vents while four other people are enjoying
   them. So this needs a second voice, and the threshold is exactly
   that: SOMEBODY AGREED WITH YOU. Not a majority, not a vote with
   a countdown and a result — those exist in `vote.js` and they are
   the wrong shape here, because a table stopping to hold a
   referendum on a sentence has already lost more to the
   interruption than the sentence cost.

   WHY IT IS ANONYMOUS

   The host is told which phone objected, because it has to be —
   two taps from one person is one person tapping twice, and that
   must not carry. It is never told to anyone else, and no name
   reaches the feed. Same reasoning as `C_SAFETY` and the same
   reasoning as rule 1 of the floor: a correction that identifies
   its author is a correction people stop making.

   WHY IT IS WORTH MORE THAN A DISPUTE

   `DISPUTE_WEIGHT` is 2 and `VETO_LIMIT` is 3, so it takes six
   personal disputes to retire a rung. That is a defensible number
   for one player's opinion of one moment. It is the wrong number
   for two or more people agreeing, in the same window, about a
   line said to all of them — that is strictly stronger evidence
   than a Warden's single veto, and it is weighted as one. Three
   carried objections retire a rung.

   The ledger stays per-session, deliberately, as it always was.
   ============================================================ */

/** How long a table has to agree with each other. Long enough that
 *  the second person has to look up, notice, and reach — and short
 *  enough that two objections twenty minutes apart, to two
 *  different lines, never combine into one that was never made. */
export const OBJECTION_WINDOW_MS = 45000;

/** How many DIFFERENT people it takes. Two. See above: the entire
 *  point is that it is more than one and not a referendum. */
export const OBJECTION_QUORUM = 2;

/** What a carried objection is worth in the useDirector ledger,
 *  counted in vetoes rather than in disputes. */
export const OBJECTION_VETOES = 1;

/** Fresh ledger. `{ at, who }` — when the current group of
 *  objections started, and which characters are in it. */
export const emptyObjections = () => ({ at: 0, who: [] });

/**
 * One phone said "not that".
 *
 * Returns the next ledger and whether this tap CARRIED — that is,
 * whether it completed a quorum. Pure, so the whole of the
 * threshold behaviour can be asserted without a host, a socket or
 * a rendered tree.
 *
 * Three cases and each one is deliberate:
 *
 *   · the window has lapsed  -> start again with this person alone.
 *     Not "keep the old ones and add", because a stale objection is
 *     about a line nobody remembers.
 *   · the same person again  -> counted once. Their opinion has not
 *     doubled by being repeated, and the alternative is one
 *     irritated player retiring a rung for five other people.
 *   · quorum reached         -> carry, and CLEAR. The next objection
 *     starts a fresh group, so a third and fourth tap on the same
 *     line cannot cascade into a second veto.
 */
export function noteObjection(ledger, pcId, now) {
  const base = ledger && Array.isArray(ledger.who) ? ledger : emptyObjections();
  if (!pcId) return { next: base, carried: false, n: base.who.length };

  const fresh = base.at && now - base.at <= OBJECTION_WINDOW_MS;
  const who = fresh ? base.who : [];
  if (who.includes(pcId)) {
    return { next: { at: base.at, who }, carried: false, n: who.length };
  }

  const grown = [...who, pcId];
  if (grown.length >= OBJECTION_QUORUM) {
    return { next: emptyObjections(), carried: true, n: grown.length };
  }
  return { next: { at: fresh ? base.at : now, who: grown }, carried: false, n: grown.length };
}

/** What the room is told when one person has objected and nobody
 *  has agreed yet. Says that it was heard and says nothing about
 *  who, which is the whole design. Deliberately not a prompt —
 *  "anyone else?" turns a shrug into a poll. */
export const OBJECTION_NOTED =
  "Somebody at the table waved that one off. If anyone agrees, say so.";

/** And when it carries. The rung is not named: the table said the
 *  line was wrong, not that rung 7 was wrong, and telling them
 *  which internal policy they have just retired invites them to
 *  manage the policy instead of playing. */
export const OBJECTION_CARRIED =
  "The table waved that one off. Less of it from here.";
