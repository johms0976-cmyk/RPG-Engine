/* ============================================================
   CONTRACTORS — PSG 21-24.

   Mercenaries are deliberately thinner than PCs: four numbers
   instead of a sheet. Combat (which doubles as their Armor Save),
   Instinct (a catch-all for every Save and every other Stat),
   Hits (they die in one or two), and Loyalty (rolled on hire,
   and rolled again whenever their interests and yours part).

   The design goal here is that a contractor is a *liability with
   a skill attached*. They cost an advance and a salary, they have
   a private reason for being aboard, and the Loyalty Save is the
   mechanism by which that reason eventually surfaces.
   ============================================================ */
import { checkPure, evalDicePure, pick, rollDie, nextFloat } from "./rng.js";
import { emit, emitAll } from "./store.js";

/* ---------------- the role table (PSG 22) ---------------- */

export const MERC_ROLES = {
  archaeologist: { name: "Archaeologist", hits: 1, combat: 20, instinct: 15, loyalty: "5d10", advance: 500, salary: 750, loadout: "excavation", skills: ["Archaeology"] },
  asteroidMiner: { name: "Asteroid Miner", hits: 2, combat: 25, instinct: 25, loyalty: "4d10", advance: 125, salary: 500, loadout: "excavation", skills: ["Rimwise", "Asteroid Mining"] },
  android: { name: "Android", hits: 2, combat: 25, instinct: 35, loyalty: "5d10", advance: 1000, salary: 5000, loadout: "any", skills: [], pickSkills: { trained: 1, expert: 1 }, android: true },
  captain: { name: "Captain", hits: 3, combat: 30, instinct: 40, loyalty: "5d10", advance: 2000, salary: 8000, loadout: "exploration", skills: ["Piloting", "Vehicle Specialization", "Command"] },
  courier: { name: "Courier", hits: 2, combat: 20, instinct: 30, loyalty: "6d10", advance: 75, salary: 250, loadout: "exploration", skills: ["Zero-G", "Rimwise"] },
  doctor: { name: "Doctor", hits: 1, combat: 15, instinct: 25, loyalty: "6d10", advance: 2000, salary: 6000, loadout: "examination", skills: ["First Aid", "Pathology"] },
  engineer: { name: "Engineer", hits: 2, combat: 25, instinct: 25, loyalty: "6d10", advance: 750, salary: 4000, loadout: "exploration", skills: ["Mechanical Repair", "Engineering"] },
  gunner: { name: "Gunner", hits: 2, combat: 30, instinct: 25, loyalty: "5d10", advance: 500, salary: 1500, loadout: "exploration", skills: ["Gunnery"] },
  marineGrunt: { name: "Marine Grunt", hits: 2, combat: 25, instinct: 25, loyalty: "4d10", advance: 150, salary: 600, loadout: "extermination", skills: ["Military Training"] },
  marineOfficer: { name: "Marine Officer", hits: 2, combat: 30, instinct: 35, loyalty: "6d10", advance: 500, salary: 2000, loadout: "any", skills: ["Military Training", "Command"] },
  marineSpecialist: { name: "Marine Specialist", hits: 3, combat: 35, instinct: 30, loyalty: "5d10", advance: 275, salary: 1500, loadout: "extermination", skills: ["Military Training", "Weapon Specialization"] },
  navigator: { name: "Navigator", hits: 1, combat: 15, instinct: 20, loyalty: "5d10", advance: 400, salary: 2000, loadout: "exploration", skills: ["Astrogation"] },
  pilot: { name: "Pilot", hits: 1, combat: 15, instinct: 25, loyalty: "5d10", advance: 500, salary: 3000, loadout: "exploration", skills: ["Piloting"] },
  priest: { name: "Priest", hits: 1, combat: 15, instinct: 20, loyalty: "4d10", advance: 60, salary: 200, loadout: null, skills: ["Theology"] },
  psychologist: { name: "Psychologist", hits: 1, combat: 15, instinct: 15, loyalty: "5d10", advance: 250, salary: 1000, loadout: "examination", skills: ["Psychology"] },
  researcher: { name: "Researcher", hits: 1, combat: 15, instinct: 10, loyalty: "5d10", advance: 400, salary: 1500, loadout: "examination", skills: [], pickOne: ["Biology", "Geology", "Computers", "Mathematics", "Art", "Chemistry", "Genetics", "Planetology", "Physics"] },
  sophontologist: { name: "Sophontologist", hits: 1, combat: 15, instinct: 10, loyalty: "6d10", advance: 500, salary: 1750, loadout: "examination", skills: ["Sophontology"] },
  surgeon: { name: "Surgeon", hits: 1, combat: 15, instinct: 20, loyalty: "6d10", advance: 2000, salary: 7000, loadout: "examination", skills: ["First Aid", "Pathology", "Surgery"] },
  voidUrchin: { name: "Void Urchin", hits: 2, combat: 25, instinct: 40, loyalty: "3d10", advance: 40, salary: 100, loadout: null, skills: ["Rimwise", "Mysticism"] },
};

export const ROLE_KEYS = Object.keys(MERC_ROLES);

/* ---------------- scum (PSG 23) ---------------- */

export const SCUM = [
  { name: "Whiskey Tango Ronin", note: "Only obeys their master. Refuses stealthy solutions.", quirk: "refusesStealth" },
  { name: "The Witness", note: "Impeccably polite. Will witness to you, and will hurt anyone who mocks the faith.", quirk: "proselytises" },
  { name: "The Sex Bot", note: "Cannot handle weapons. No scientific knowledge. Relentlessly frank about your appearance.", quirk: "noWeapons", android: true },
  { name: "The Wretch", note: "Stress gains are doubled while they are nearby.", quirk: "doubleStress" },
  { name: "The Preening Pseudo-Intellectual", note: "Intellect rolls at Disadvantage while they are nearby.", quirk: "intellectDisadvantage" },
  { name: "The Dude", note: "Half-arses every task. Minimises work on principle.", quirk: "halfArses" },
  { name: "The Rich Kid", note: "Slumming it for the authenticity. Their family will notice if they die.", quirk: "connected" },
];

export const SCUM_STATS = { hits: 1, combat: 15, instinct: 15, loyalty: "3d10", advance: 100, salary: 200 };

/* ---------------- motivations (PSG 24) ---------------- */

const DEBTS = ["a crime syndicate", "a repossession agent", "an advance from another captain they ran with",
  "a separatist militia", "unpaid taxes", "a jumped bail bond", "a pawn shop holding their gear",
  "a brothel", "a loan shark", "a ponzi scheme that took everything"];
const HUNTS = ["a former partner", "a bounty hunter", "a petty official", "a mining magnate",
  "a military commander", "a parent", "a loan shark", "a snitch", "their sibling", "an obscenely wealthy scion"];
const SECRETS = ["part of a cult", "a spy", "smuggling something extremely illegal",
  "a saboteur, opportunistically", "undercover secret police", "infected, and spreading it",
  "a recruiter, evaluating this ship for someone else", "a con artist",
  "a serial killer hiding from the law", "a bounty hunter, and the bounty is you"];

export function rollMotivation(rng) {
  const [band, r1] = rollDie(rng, 100);
  const [n, r2] = rollDie(r1, 10);
  if (band <= 49) return [{ kind: "debt", text: `Needs to pay off ${DEBTS[n - 1]}.`, secret: false }, r2];
  if (band <= 80) return [{ kind: "hunt", text: `Is hunting down ${HUNTS[n - 1]}.`, secret: false }, r2];
  return [{ kind: "secret", text: `Is secretly ${SECRETS[n - 1]}.`, secret: true }, r2];
}

/* ---------------- names ---------------- */

const SURNAMES = ["Okonkwo", "Vasquez", "Lindqvist", "Bhatt", "Moreau", "Oyelaran", "Kowalczyk",
  "Ferreira", "Nakamura", "Adeyemi", "Petrov", "Haddad", "Sørensen", "Ibarra", "Novak", "Chukwu"];
const FIRSTS = ["Marta", "Deon", "Iben", "Rook", "Salla", "Teo", "Nadia", "Casper", "Yuki",
  "Bram", "Odile", "Sig", "Halina", "Emeka", "Wren", "Otto"];

export function rollName(rng) {
  const [a, r1] = pick(rng, FIRSTS);
  const [b, r2] = pick(r1, SURNAMES);
  return [`${a} ${b}`, r2];
}

/* ---------------- negotiation (PSG 21.2) ---------------- */

export const NEGOTIATION_TERMS = [
  { id: "noShare", label: "No share of earnings", mod: -20 },
  { id: "noQuarters", label: "No quarters of their own aboard", mod: -5 },
  { id: "knownDangerous", label: "The job is known to be dangerous", mod: -10 },
  { id: "lowAdvance", label: "Advance below the standard rate", mod: -5 },
  { id: "monthPlus", label: "Hiring for at least a month", mod: +5 },
  { id: "bulk", label: "Hiring four or more from the same crew", mod: +10 },
];

export const negotiationMod = (terms = []) =>
  NEGOTIATION_TERMS.filter((t) => terms.includes(t.id)).reduce((n, t) => n + t.mod, 0);

/* ---------------- creation ---------------- */

let MERC_SEQ = 0;

/**
 * Roll up a contractor. Pure: returns [merc, rng].
 * `roleKey` may be "scum" for the desperate end of the market.
 */
export function makeHireling(rng, roleKey, opts = {}) {
  const scum = roleKey === "scum";
  let r = rng;
  let base, scumEntry = null;

  if (scum) {
    const [entry, r1] = pick(r, SCUM);
    r = r1; scumEntry = entry;
    base = { ...SCUM_STATS, name: entry.name, skills: [], loadout: null, android: !!entry.android };
  } else {
    base = MERC_ROLES[roleKey];
    if (!base) return [null, rng];
  }

  const [loyalty, r2] = evalDicePure(r, base.loyalty);
  r = r2;
  const [name, r3] = scum ? [base.name, r] : rollName(r);
  r = r3;
  const [motivation, r4] = rollMotivation(r);
  r = r4;

  let skills = [...(base.skills || [])];
  if (base.pickOne) {
    const [s, r5] = pick(r, base.pickOne);
    r = r5; skills.push(s);
  }

  const merc = {
    id: `mrc${++MERC_SEQ}`,
    name,
    role: scum ? "scum" : roleKey,
    roleName: base.name,
    scumNote: scumEntry ? scumEntry.note : null,
    quirk: scumEntry ? scumEntry.quirk : null,
    android: !!base.android,
    hits: base.hits,
    maxHits: base.hits,
    combat: base.combat,
    instinct: base.instinct,
    loyalty,
    maxLoyalty: loyalty,
    skills,
    loadout: base.loadout,
    advance: base.advance,
    salary: base.salary,
    motivation,
    motivationRevealed: false,
    share: opts.share ?? false,
    xp: 0,
    level: 0,
    alive: true,
    owed: 0,
    monthsServed: 0,
    nextOfKin: opts.nextOfKin || null,
    orders: "follow",
    notes: [],
  };
  return [merc, r];
}

/* ---------------- the slice ---------------- */

export const hirelingActions = {
  offer: (roleKey, terms) => ({ type: "HIRE/OFFER", roleKey, terms }),
  hire: (merc) => ({ type: "HIRE/ACCEPT", merc }),
  dismiss: (id, paid) => ({ type: "HIRE/DISMISS", id, paid }),
  loyaltyCheck: (id, why) => ({ type: "HIRE/LOYALTY", id, why }),
  hurt: (id, hits, why) => ({ type: "HIRE/HURT", id, hits, why }),
  attack: (id, targetCombat, dmg) => ({ type: "HIRE/ATTACK", id, targetCombat, dmg }),
  orders: (id, orders) => ({ type: "HIRE/ORDERS", id, orders }),
  paySalaries: (months) => ({ type: "HIRE/PAY", months }),
  awardXp: (n) => ({ type: "HIRE/XP", n }),
};

export function hirelingSlice(state, action) {
  const list = state.hirelings || [];
  const find = (id) => list.find((m) => m.id === id);
  const replace = (id, patch) => list.map((m) => (m.id === id ? { ...m, ...patch } : m));

  switch (action.type) {
    /* Roll up a candidate and run the negotiation check. */
    case "HIRE/OFFER": {
      const [merc, r1] = makeHireling(state.rng, action.roleKey, { share: !(action.terms || []).includes("noShare") });
      if (!merc) return state;
      const mod = negotiationMod(action.terms);
      const target = Math.max(1, Math.min(99, (state.negotiatorIntellect || 30) + mod));
      const [chk, r2] = checkPure(r1, target);

      let next = { ...state, rng: r2 };
      next = emitAll(next, [
        ["system", `${merc.name} — ${merc.roleName}. Hits ${merc.hits}, Combat ${merc.combat}%, Instinct ${merc.instinct}%, Loyalty ${merc.loyalty}.`],
        ["system", `Wants ${merc.advance}cr up front and ${merc.salary}cr a month.${merc.scumNote ? `\n${merc.scumNote}` : ""}`],
        [chk.success ? "rollgood" : "rollbad",
          `NEGOTIATION · Intellect ${state.negotiatorIntellect || 30}%${mod ? (mod > 0 ? `+${mod}` : mod) : ""}=${target}% · rolled ${String(chk.value).padStart(2, "0")} · ${chk.success ? "THEY TAKE IT" : "THEY WALK"}`],
      ]);

      if (!chk.success) {
        return emit({ ...next, candidate: null }, "system",
          merc.scumNote
            ? "Even this one has standards, which should tell you something."
            : "They shoulder their bag and go back to waiting for a better ship.");
      }
      return { ...next, candidate: merc };
    }

    case "HIRE/ACCEPT": {
      const merc = action.merc || state.candidate;
      if (!merc) return state;
      let next = { ...state, hirelings: [...list, merc], candidate: null };
      next = emit(next, "good", `${merc.name} signs on as ${merc.roleName}. ${merc.advance}cr advance.`);
      if (merc.motivation.secret) {
        next = emit(next, "system", "[The Warden notes their reason for shipping out. You do not get to see it.]");
      } else {
        next = emit(next, "system", merc.motivation.text);
      }
      return next;
    }

    case "HIRE/DISMISS": {
      const m = find(action.id);
      if (!m) return state;
      let next = { ...state, hirelings: list.filter((x) => x.id !== action.id) };
      if (!action.paid && m.owed > 0) {
        next = emit(next, "horror",
          `${m.name} leaves owed ${m.owed}cr. Their next-of-kin is on file, and so, now, are you. Expect a warrant officer at the next port.`);
        next = { ...next, bounties: [...(next.bounties || []), { who: m.name, amount: Math.floor(m.owed / 2) }] };
      } else {
        next = emit(next, "system", `${m.name} is paid off and gone.`);
      }
      return next;
    }

    /* The Loyalty Save: rolled when their interests and yours diverge. */
    case "HIRE/LOYALTY": {
      const m = find(action.id);
      if (!m) return state;
      const owedPenalty = m.owed > 0 ? -10 : 0;
      const target = Math.max(1, Math.min(99, m.loyalty + owedPenalty));
      const [chk, r1] = checkPure(state.rng, target);
      let next = emit({ ...state, rng: r1 }, chk.success ? "rollgood" : "rollbad",
        `LOYALTY · ${m.name} ${m.loyalty}%${owedPenalty ? ` ${owedPenalty} (unpaid)` : ""} · rolled ${String(chk.value).padStart(2, "0")} · ${chk.success ? "STAYS" : "LOOKS AFTER THEMSELVES"}${action.why ? ` — ${action.why}` : ""}`);

      if (chk.success) return next;

      next = emit(next, "horror", `${m.name} does the arithmetic and comes out ahead somewhere else.`);
      if (chk.critFail && m.motivation.secret && !m.motivationRevealed) {
        next = emit(next, "horror", `And now you know why they were really here. ${m.motivation.text}`);
        return { ...next, hirelings: replace(m.id, { motivationRevealed: true, orders: "self" }) };
      }
      return { ...next, hirelings: replace(m.id, { orders: "self" }) };
    }

    case "HIRE/HURT": {
      const m = find(action.id);
      if (!m) return state;
      const hits = Math.max(0, m.hits - (action.hits || 1));
      let next = { ...state, hirelings: replace(m.id, { hits, alive: hits > 0 }) };
      next = emit(next, hits > 0 ? "dmg" : "horror",
        hits > 0
          ? `${m.name} takes a hit${action.why ? ` — ${action.why}` : ""}. ${hits}/${m.maxHits}.`
          : `${m.name} is dead. They named a next-of-kin when they signed, and you agreed to it.`);
      if (hits <= 0 && m.owed > 0) {
        next = { ...next, debts: [...(next.debts || []), { to: m.nextOfKin || `${m.name}'s next-of-kin`, amount: m.owed }] };
      }
      if (hits <= 0) next = { ...next, demands: [...(next.demands || []), { kind: "crewWitnessedDeath", name: m.name }] };
      return next;
    }

    /* Contractors always go last in the turn order (PSG 21.4). */
    case "HIRE/ATTACK": {
      const m = find(action.id);
      if (!m || !m.alive) return state;
      if (m.orders === "self") return emit(state, "system", `${m.name} is not taking your orders any more.`);
      if (m.quirk === "noWeapons") return emit(state, "system", `${m.name} cannot handle a weapon and will not pretend otherwise.`);

      const [chk, r1] = checkPure(state.rng, m.combat);
      let next = emit({ ...state, rng: r1 }, chk.success ? "rollgood" : "rollbad",
        `${m.name} — COMBAT ${m.combat}% · rolled ${String(chk.value).padStart(2, "0")} · ${chk.success ? "HIT" : "MISS"}`);
      if (!chk.success) return next;

      const [raw, r2] = evalDicePure(next.rng, action.dmg || "1d10");
      const dmg = raw * (chk.critHit ? 2 : 1);
      next = { ...next, rng: r2, pendingEnemyDamage: dmg };
      return emit(next, "dmg", `${dmg} damage${chk.critHit ? " — critical" : ""}.`);
    }

    case "HIRE/ORDERS":
      return { ...state, hirelings: replace(action.id, { orders: action.orders }) };

    case "HIRE/PAY": {
      const months = action.months || 1;
      const total = list.filter((m) => m.alive).reduce((n, m) => n + m.salary * months, 0);
      if (!total) return state;
      const funds = state.credits || 0;
      if (funds >= total) {
        return emit({ ...state, credits: funds - total, hirelings: list.map((m) => ({ ...m, owed: 0, monthsServed: m.monthsServed + months })) },
          "item", `Salaries paid: ${total.toLocaleString()}cr.`);
      }
      return emit({
        ...state,
        credits: 0,
        hirelings: list.map((m) => (m.alive ? { ...m, owed: m.owed + m.salary * months, monthsServed: m.monthsServed + months } : m)),
      }, "horror", `You are ${(total - funds).toLocaleString()}cr short on wages. People remember that.`);
    }

    /* 1 XP for surviving — they don't get the PC survival bonus. */
    case "HIRE/XP": {
      const n = action.n != null ? action.n : 1;
      return { ...state, hirelings: list.map((m) => (m.alive ? { ...m, xp: m.xp + n } : m)) };
    }

    default:
      return state;
  }
}

/** Contractors act last, in hire order. Used by the combat screen. */
export const hirelingTurnOrder = (list) => list.filter((m) => m.alive && m.orders !== "self");

/** Aggregate quirk effects for the modifier system. */
export function hirelingModifiers(list = []) {
  const live = list.filter((m) => m.alive);
  return {
    doubleStress: live.some((m) => m.quirk === "doubleStress"),
    intellectDisadvantage: live.some((m) => m.quirk === "intellectDisadvantage"),
    // Androids present: Fear Saves at Disadvantage (PSG class rules).
    androidPresent: live.some((m) => m.android),
  };
}
