/* ============================================================
   ROLL ME ONE — B.1

   Six people building Mothership characters simultaneously on
   phones is fifteen to twenty-five minutes in which nobody is
   playing anything. On a sofa, on a weeknight, that is where you
   lose two of them — and they are lost before the game has said a
   single word, which makes it the most expensive dead time in the
   whole evening.

   The wizard is good and it should stay. What it lacked was a way
   to opt out of it: one button, a whole character, playable in the
   next ten seconds, editable later during downtime when there is
   time to care.

   ------------------------------------------------------------
   WHY IT BUILDS A DRAFT AND NOT A CHARACTER

   It returns exactly the shape `CreatorPhone` already holds in
   `useState`, so the wizard can be dropped into any step
   afterwards with everything filled in. That matters more than it
   looks: a player who taps this and then wants to change one thing
   should land in the same screens as everybody else rather than in
   a separate "quick character" path that drifts out of step with
   the real one.

   It is also why this file does no validation of its own. The
   draft goes through the same `blocker` checks the wizard uses. If
   this function produced something the wizard would reject, the
   Next button says so, in the same words, in the same place.

   ------------------------------------------------------------
   THE RNG IS AN ARGUMENT

   Every function here takes `rng` and defaults it to
   `Math.random`. Nothing in this file reads the global directly,
   which is what lets the tests assert that skill points are always
   spent to zero rather than asserting it about one lucky roll.
   ============================================================ */
import {
  CLASSES, SKILL_TREE, SKILL_COST, skillTier, canTakeSkill,
  rollStats, randomFlavour,
} from "./rules.js";

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

/* SKILL_TREE is keyed by tier, so flatten once at module load
   rather than on every step of every attempt. */
const ALL_SKILLS = Object.values(SKILL_TREE).flatMap((tier) => Object.keys(tier));

/* Crew names, not character names. Deliberately plain: this is a
   working ship and these are the people who fix it, so the
   generator's job is to produce somebody who sounds like they have
   a shift pattern rather than a destiny.

   Two lists crossed rather than one list of full names, because
   four hundred combinations from forty words is the right trade
   between "never the same twice" and "a file somebody has to
   maintain". */
const FIRST = [
  "RILEY", "VOSS", "MERCER", "OKONKWO", "HALE", "SANTOS", "BRUNO", "KESS",
  "AMADI", "LEIGH", "TAKAHASHI", "NOVAK", "REYES", "DUNN", "ILIC", "MBEKI",
  "PARK", "FENN", "GRABOWSKI", "AYALA",
];
const LAST = [
  "COLE", "DRAKE", "IVES", "SOLOMON", "HART", "WREN", "MARCH", "KANE",
  "BELL", "OSEI", "QUINN", "VANCE", "ROURKE", "SIDDIQ", "LOW", "TATE",
  "ELLIS", "BAPTISTE", "NG", "HOLM",
];

/** A name nobody has to think about. */
export function randomName(rng = Math.random) {
  return `${pick(FIRST, rng)} ${pick(LAST, rng)}`;
}

/** The class's own pick-one-of-these, chosen at random.

    Returns `count` distinct skills from the class list, or fewer
    if the class offers fewer than it asks for — which would be a
    bug in `rules.js` rather than here, and is not this function's
    to fix or to hide. */
export function randomPicks(cls, rng = Math.random) {
  if (!cls.pick) return [];
  const pool = [...cls.pick.from];
  const out = [];
  while (out.length < cls.pick.count && pool.length) {
    out.push(...pool.splice(Math.floor(rng() * pool.length), 1));
  }
  return out;
}

/** Spend the class's skill points down to zero, legally.

    THE PART THAT IS NOT OBVIOUS. Skills have prerequisites and
    tiered costs, so a greedy random walk can strand points: take
    two cheap skills and the four remaining points may buy nothing
    the character qualifies for. The wizard blocks on exactly that
    (`You still have N skill points to spend`), so a random build
    that leaves points unspent produces a character the wizard will
    not let you submit — which would be worse than no button at all.

    So it retries from scratch rather than backtracking. Retrying is
    slightly wasteful and completely obvious; a backtracking spend
    would be neither, and this runs once, on a phone, when somebody
    presses a button. */
export function randomSkills(cls, rng = Math.random, tries = 40) {
  const fixed = cls.fixedSkills || [];
  let best = { picks: [], spent: [], left: cls.points };

  for (let attempt = 0; attempt < tries; attempt++) {
    const picks = randomPicks(cls, rng);
    const spent = [];
    let left = cls.points;

    for (let step = 0; step < 24 && left > 0; step++) {
      const have = [...fixed, ...picks, ...spent];
      /* Everything affordable, legal, and not already held. Built
         fresh each step because taking a skill can unlock others. */
      const open = ALL_SKILLS
        .filter((s) => !have.includes(s))
        .filter((s) => (SKILL_COST[skillTier(s)] || Infinity) <= left)
        .filter((s) => canTakeSkill({ skills: have }, s).ok);
      if (!open.length) break;
      const take = pick(open, rng);
      spent.push(take);
      left -= SKILL_COST[skillTier(take)];
    }

    if (left <= 0) return { picks, spent };
    if (left < best.left) best = { picks, spent, left };
  }

  /* Every attempt stranded points. Return the closest one rather
     than nothing: the wizard will say which step needs attention,
     which is a better outcome than a button that silently does
     nothing. */
  return { picks: best.picks, spent: best.spent };
}

/**
 * A complete draft, in the shape CreatorPhone holds.
 *
 * @param {object} mod        the module, for its loadouts
 * @param {function} rng
 */
export function randomDraft(mod, rng = Math.random) {
  const clsKey = pick(Object.keys(CLASSES), rng);
  const cls = CLASSES[clsKey];
  const { picks, spent } = randomSkills(cls, rng);
  const loadouts = Object.keys((mod && mod.loadouts) || {});
  return {
    name: randomName(rng),
    cls: clsKey,
    stats: rollStats(),
    picks,
    spent,
    /* A module with no loadouts leaves this null and the wizard
       asks for one, which is the correct behaviour and not a case
       worth special-casing here. */
    loadout: loadouts.length ? pick(loadouts, rng) : null,
    ...randomFlavour(),
  };
}

export default randomDraft;
