/* ============================================================
   CONDITIONS — what the word on your sheet actually does.

   `pc.conditions` is an array of strings, and until now the phone
   rendered it as an array of strings: a row of grey tags reading
   "Cowardice", "Rattled — Disadvantage", "Descent into Madness".

   Every one of those is a Panic Effect. Panic Effects are the
   most consequential thing that happens to a Mothership
   character — they are the reason the game is about Stress and
   not about Health — and they were arriving as a single word
   with no rule attached, on the one screen the player has.

   At a physical table this is fine, because the effect was read
   aloud off the table on page 27 thirty seconds earlier and the
   player wrote it in the margin. On six separate phones with the
   Warden's screen invisible, nobody read it aloud, nothing was
   written in a margin, and "Cowardice" is a word.

   THE RULE ABOUT WHERE THE TEXT COMES FROM

   Wherever a condition corresponds to a row of PANIC_TABLE, the
   text is taken *from that row* rather than retyped here. There
   is one authority for what Cowardice does and it is the table
   the engine rolls on. Retyping it would create a second one,
   and the second one would be wrong within a year.

   The rest — Held, Comatose, Injured, Dazed, Withdrawal risk —
   are engine conditions with no table row, so they are written
   out once, here, with the rule they actually implement.

   WHAT IS DELIBERATELY NOT EXPLAINED

   secrets.js hides Hallucinating, Paranoid, DeathDrive and
   Broken from the person who has them. Those never reach this
   file for their owner, because they never reach their phone. If
   one appears here it is because you are reading *somebody
   else's* sheet, and watching a crewmate be Paranoid without
   them knowing it is the entire point of the mechanic. So the
   text is written in the third person for exactly those four.
   ============================================================ */

import { PANIC_TABLE } from "./rules.js";

/** Row of PANIC_TABLE by name, so the text has one home. */
const byName = (n) => PANIC_TABLE.find((r) => r.name === n);

/** Panic-table conditions, keyed by the string useGame.js pushes. */
function fromTable(name, rowName) {
  const row = byName(rowName || name);
  return row ? { name: row.name, text: row.t, from: "panic" } : null;
}

/* Engine conditions with no table row. One sentence of rule each,
   in the second person, phrased as what it costs you right now. */
const ENGINE = {
  Held: {
    name: "Held",
    text: "Something has hold of you. Tearing free is a Strength Check and it takes your whole turn — no attacking, no moving, no reloading until you are out.",
    from: "combat",
  },
  Comatose: {
    name: "Comatose",
    text: "You went to 0 Health and passed the Body Save. You are unconscious. When you wake, and in what state, is on a table the Warden rolled in private.",
    from: "body",
  },
  Injured: {
    name: "Injured",
    text: "Disadvantage on every Stat Check — Strength, Speed, Intellect, Combat. Saves are unaffected.",
    from: "body",
  },
  Dazed: {
    name: "Dazed",
    text: "Disadvantage on everything for a few minutes. You came round hard.",
    from: "body",
  },
  "Withdrawal risk": {
    name: "Withdrawal risk",
    text: "You noticed how much you wanted that. The Warden is now allowed to make it a problem.",
    from: "gear",
  },
  Phobia: {
    name: "Phobia",
    text: "Permanent. Meeting the thing means a Fear Save at Disadvantage or 1d10 Stress. What the thing is has not been written on your sheet — you will find out the way anyone finds out.",
    from: "panic",
  },
};

/* The four the owner is never shown. Third person on purpose:
   the only person reading these is somebody watching it happen. */
const OBSERVED = {
  Hallucinating: "They are having trouble telling what is really in front of them. They have not been told this.",
  Paranoid: "Whenever anybody rejoins their group they must make a Fear Save or take Stress. They have not been told this.",
  Deathdrive: "Meeting a stranger or a known enemy means a Sanity Save or they attack it immediately. They have not been told this.",
  Broken: "They Panic again every time a nearby crew member fails a Save. They have not been told this.",
};

/**
 * What does this condition string mean?
 *
 * Matching is by prefix, because the engine stamps parameterised
 * conditions — `Advantage (3d10 minutes)`, `Rattled — Disadvantage`,
 * `Dazed — Disadvantage` — and the parameter is the bit that
 * varies. The prefix is the bit that carries the rule.
 *
 * @returns {{name:string, text:string, from:string, detail?:string}|null}
 */
export function explainCondition(cond) {
  const c = String(cond || "").trim();
  if (!c) return null;

  // Timed Advantage from an adrenaline result. The duration is in
  // the string and is the useful half, so it is kept.
  if (c.startsWith("Advantage (")) {
    const dur = c.slice(11).replace(/\)$/, "");
    return {
      name: "Adrenaline",
      text: "Advantage on all rolls — roll twice and take the better outcome.",
      detail: dur ? `Lasts ${dur} from when it landed.` : undefined,
      from: "panic",
      good: true,
    };
  }

  if (c.startsWith("Rattled")) {
    return {
      ...fromTable("Rattled"),
      detail: "You screamed. Anything that hunts by sound now knows roughly where you are.",
    };
  }

  if (c.startsWith("Dazed")) return ENGINE.Dazed;
  if (c.startsWith("Injured")) return ENGINE.Injured;

  for (const key of Object.keys(OBSERVED)) {
    if (c.startsWith(key)) {
      return { name: key, text: OBSERVED[key], from: "hidden", observed: true };
    }
  }

  if (ENGINE[c]) return ENGINE[c];

  const table = fromTable(c);
  if (table) return table;

  /* A module's own condition — Ypsilon 14 stamps INFECTED and
     BEING DEVOURED. There is no generic rule to quote and
     inventing one would be worse than saying nothing, so this
     says the true thing: it is real, it is on your sheet, and
     the person who knows what it does is in the room. */
  return {
    name: c,
    text: "This came from the situation you are in rather than from the rulebook. The Warden knows what it does. Asking is allowed.",
    from: "module",
  };
}

/** Is this condition working for you rather than against you? */
export function isBoon(cond) {
  const e = explainCondition(cond);
  return !!(e && e.good);
}

/**
 * Sort order for display: the things that are currently costing
 * you something first, boons last. A player scanning their own
 * sheet mid-scene is looking for the problem.
 */
export function orderConditions(list) {
  return [...(list || [])].sort((a, b) => Number(isBoon(a)) - Number(isBoon(b)));
}
