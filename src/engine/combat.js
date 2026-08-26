/* ============================================================
   COMBAT — the Mothership violent-encounter loop.

   Structure (PSG 10-16):
     1. Every character makes a Speed Check. Those who succeed act
        BEFORE the enemies; those who fail act after.
     2. Each character gets TWO ACTIONS per round.
     3. Attacks are Opposed Checks: your Combat (plus skill, range,
        smart-link, assistance) against the target's defence.
     4. Range bands: Short = no penalty, Medium = -10, Long =
        Disadvantage, past Long = you cannot reach it.
     5. Reloading costs an action - unless you have Firearms or
        Military Training, in which case it is free.
     6. Automatic weapons empty themselves in one burst unless you
        are trained, in which case you get `burst` shots.
     7. Aiming costs your whole turn and buys Advantage on the
        next shot, as long as nothing hits you first.

   This module is pure state + resolution. It says nothing to the
   player; useGame owns the feed.
   ============================================================ */

import { check, opposedResult, evalDice, pad } from "./dice.js";
import { rangeBand, damageScale } from "./gear.js";
import { collectModifiers } from "./modifiers.js";
import { armorSave, clampTarget, baseValue } from "./rules.js";

export const ACTIONS_PER_ROUND = 2;

/** A fresh enemy instance from a module threat definition. */
export function spawnEnemy(threatId, t, index, opts = {}) {
  return {
    uid: `${threatId}#${index}`,
    threatId,
    name: t.count > 1 ? `${t.name} ${index + 1}` : t.name,
    combat: t.combat ?? 40,
    instinct: t.instinct ?? 40,
    speed: t.speed ?? 40,
    armor: t.armor ?? 0,
    maxHits: t.maxHits ?? 3,
    maxDmg: t.maxDmg ?? 999,
    hits: 0, dmg: 0, dead: false,
    distance: opts.distance ?? t.startDistance ?? (t.melee ? 2 : 15),
    distracted: 0,
    grabbed: null,      // pcId this enemy currently has hold of
    conditions: [],
  };
}

/** Patch a single enemy instance. */
export function setEnemy(combat, uid, patch) {
  return { ...combat, enemies: combat.enemies.map((e) => (e.uid === uid ? { ...e, ...patch } : e)) };
}

/** Whoever, if anyone, currently has hold of this character. */
export const grabberOf = (combat, pcId) =>
  combat.enemies.find((e) => !e.dead && e.grabbed === pcId) || null;

/** Set up a combat. `groups` is [{ threatId, count, distance }]. */
export function createCombat(mod, groups, crew, opts = {}) {
  const enemies = [];
  for (const g of groups) {
    const t = mod.threats[g.threatId];
    if (!t) continue;
    const n = g.count ?? t.count ?? 1;
    for (let i = 0; i < n; i++) enemies.push(spawnEnemy(g.threatId, t, i, { distance: g.distance }));
  }
  return {
    round: 1,
    phase: "initiative",
    enemies,
    order: [],          // [{ side:'pc'|'enemy', id }]
    turnIndex: 0,
    actors: {},         // pcId -> { actions, aiming, aimReady, stunned, prone, fled }
    targetUid: enemies[0] ? enemies[0].uid : null,
    surprise: !!opts.surprise,
    log: [],
  };
}

/**
 * Roll initiative. Everyone makes a Speed Check; success means you
 * beat the enemies to it.
 */
export function rollInitiative(combat, crew, ctx) {
  const rolls = [];
  const before = [], after = [];
  for (const pc of crew) {
    if (pc.alive === false || pc.unconscious) continue;
    const m = collectModifiers({ ...ctx, pc, kind: "stat", name: "speed", tags: ["initiative"] });
    const target = clampTarget(baseValue(pc, "stat", "speed", ctx.items) + m.bonus);
    const r = check(target, m.mode, { advTieBreak: ctx.houseRules.advTieBreak, rng: ctx.rng || Math.random });
    rolls.push({ pc, r, target });
    (r.success ? before : after).push({ side: "pc", id: pc.id });
  }
  const order = [
    ...before,
    ...combat.enemies.filter((e) => !e.dead).map((e) => ({ side: "enemy", id: e.uid })),
    ...after,
  ];
  const actors = {};
  for (const pc of crew) {
    if (pc.alive === false || pc.unconscious) continue;
    actors[pc.id] = { actions: ACTIONS_PER_ROUND, aiming: false, aimReady: false, stunned: false, prone: false, fled: false };
  }
  return { ...combat, order, actors, turnIndex: 0, phase: "acting", initiativeRolls: rolls };
}

export const currentTurn = (combat) => combat.order[combat.turnIndex] || null;
export const enemyByUid = (combat, uid) => combat.enemies.find((e) => e.uid === uid) || null;
export const liveEnemies = (combat) => combat.enemies.filter((e) => !e.dead);

/** Advance to the next actor, skipping the dead and the departed. */
export function nextTurn(combat, crew) {
  let c = { ...combat, order: [...combat.order] };
  let guard = 0;
  do {
    c.turnIndex += 1;
    if (c.turnIndex >= c.order.length) {
      // new round
      c.turnIndex = 0;
      c.round += 1;
      const actors = {};
      for (const [id, a] of Object.entries(c.actors))
        actors[id] = { ...a, actions: ACTIONS_PER_ROUND, stunned: false, aiming: false };
      c.actors = actors;
      c.enemies = c.enemies.map((e) => ({ ...e, distracted: Math.max(0, e.distracted - 1) }));
    }
    const t = c.order[c.turnIndex];
    if (!t) break;
    if (t.side === "enemy") {
      const e = enemyByUid(c, t.id);
      if (e && !e.dead) break;
    } else {
      const pc = crew.find((p) => p.id === t.id);
      const a = c.actors[t.id];
      if (pc && pc.alive !== false && !pc.unconscious && a && !a.fled) break;
    }
  } while (++guard < 200);
  return c;
}

/* ---------------- ammunition ---------------- */

export const isTrainedShooter = (pc) =>
  pc.skills.includes("Firearms") || pc.skills.includes("Military Training") ||
  pc.skills.includes("Weapon Specialization") || pc.skills.includes("Gunnery");

/** Shots consumed by pulling the trigger once. */
export function shotsForAttack(pc, weapon) {
  if (!weapon.shots) return 0;
  if (!weapon.auto) return 1;
  // Fully automatic: the whole magazine goes unless you have the
  // trigger discipline, in which case `burst` rounds.
  return isTrainedShooter(pc) ? Math.min(weapon.burst ?? 3, weapon.shots) : weapon.shots;
}

export function canFire(pc, weaponId, weapon, houseRules) {
  if (!weapon.shots) return { ok: true };
  if (houseRules.lightAmmo) return { ok: true, light: true };
  if (!houseRules.trackAmmoStrictly) return { ok: true };
  const left = pc.ammo[weaponId] ?? weapon.shots;
  const need = shotsForAttack(pc, weapon);
  if (left <= 0) return { ok: false, why: "empty", need };
  if (left < need) return { ok: true, partial: true, need: left };
  return { ok: true, need };
}

/** Reload is a free action for trained shooters (PSG 12.3). */
export function reloadCost(pc) { return isTrainedShooter(pc) ? 0 : 1; }

export function doReload(pc, weaponId, weapon) {
  const spare = pc.spare[weaponId] ?? 0;
  if (spare <= 0) return { pc, ok: false, why: "no reloads left" };
  return {
    ok: true,
    pc: {
      ...pc,
      ammo: { ...pc.ammo, [weaponId]: weapon.shots },
      spare: { ...pc.spare, [weaponId]: spare - 1 },
    },
  };
}

/* ---------------- attack resolution ---------------- */

/**
 * Resolve one attack from a player character.
 * Pure: returns a report. useGame applies it.
 */
export function resolveAttack({ pc, weaponId, weapon, enemy, combat, ctx }) {
  const { items, houseRules } = ctx;
  /* The table's own seeded stream when there is one. See ctxFor in
     useGame.js — every roll below has to come off it or a rewind is a
     lie. Defaults to Math.random so a bare call site still works. */
  const rng = ctx.rng || Math.random;
  const actor = combat.actors[pc.id] || {};
  const band = rangeBand(weapon, enemy.distance);
  if (!band.ok) {
    return { ok: false, why: band.band === "close" ? "too far to reach" : "out of range", band };
  }

  const skill = weapon.melee
    ? ["Close-Quarters Combat", "Weapon Specialization", "Military Training"]
    : ["Firearms", "Weapon Specialization", "Gunnery", "Military Training"];

  const situational = [];
  if (band.penalty) situational.push({ source: `${band.band} range`, bonus: band.penalty });
  if (band.mode === "disadvantage") situational.push({ source: "long range", dis: true });
  if (actor.aimReady) situational.push({ source: "aimed", adv: true });
  if (enemy.distracted > 0) situational.push({ source: "target distracted", adv: true });
  if (actor.prone) situational.push({ source: "prone", dis: true });
  // smart-link only works with the HUD in hand
  for (const g of weapon.grants || []) {
    if (g.needsItem && !pc.items.includes(g.needsItem)) continue;
    if (g.needsItem && g.bonus) situational.push({ source: `${weapon.n} smart-link`, bonus: g.bonus });
  }

  const m = collectModifiers({
    ...ctx, pc, kind: "stat", name: "combat", skill,
    tags: ["attack", weapon.melee ? "melee" : "ranged"],
    situational, assist: ctx.assist,
  });

  const target = clampTarget(pc.stats.combat + m.bonus);
  const att = check(target, m.mode, { advTieBreak: houseRules.advTieBreak, rng });

  /* --- defence --- */
  let defTarget = enemy.combat;
  let defMode = "none";
  const threat = ctx.mod.threats[enemy.threatId];
  const canSee = !threat.unseen || (threat.seenWith && pc.items.some((i) => items[i] && items[i][threat.seenWith]));
  if (!canSee) defMode = "advantage";
  if (enemy.distracted > 0) defMode = "disadvantage";
  if (weapon.vsArmor) defTarget += weapon.vsArmor;

  let def, outcome;
  if (houseRules.playerFacingRolls) {
    // The enemy never rolls: the player's own result decides.
    def = null;
    outcome = att.critFail ? "both-fail" : att.success ? "attacker" : "defender";
  } else {
    def = check(clampTarget(defTarget), defMode, { advTieBreak: houseRules.advTieBreak, rng });
    outcome = opposedResult(att, def);
    if (outcome === "reroll") {
      def = check(clampTarget(defTarget), defMode, { advTieBreak: houseRules.advTieBreak, rng });
      outcome = opposedResult(att, def);
      if (outcome === "reroll") outcome = "defender";
    }
  }

  const hit = outcome === "attacker";
  const report = {
    ok: true, hit, outcome, att, def, band, target, defTarget,
    breakdown: m.breakdown, mode: m.mode, canSee,
    shots: shotsForAttack(pc, weapon),
    weaponId, weapon, enemyUid: enemy.uid,
    effects: [],
  };

  if (!hit) return report;

  /* --- damage --- */
  const crit = att.critHit;
  const c = weapon.crit || { mult: 2 };
  let dmg = evalDice(weapon.dmg || "1d10", 0, rng);
  dmg = Math.round(dmg * damageScale(weapon, band.band));
  if (crit) {
    dmg = Math.round(dmg * (c.mult ?? 2));
    if (c.bonus) dmg += evalDice(c.bonus, 0, rng);
    if (c.limb) report.effects.push({ kind: "limb", text: "A limb comes away from it." });
    if (c.knockdown) report.effects.push({ kind: "knockdown", text: "It goes down hard." });
    if (c.impale) report.effects.push({ kind: "impale", extra: c.impale, text: "The grapnel is through it. Pulling it out will do more." });
    if (c.bleed) report.effects.push({ kind: "bleed", amount: c.bleed, text: "It is losing something, steadily." });
  }
  if (weapon.knockback) report.effects.push({ kind: "knockback", text: "The hit shoves it back a metre." });
  report.dmg = Math.max(0, dmg);
  report.crit = crit;

  if (weapon.onHit) report.effects.push({ kind: "onHit", ...weapon.onHit });
  return report;
}

/* ============================================================
   WHEN IT STOPS PRESSING

   A thing that fights to its last hit point regardless of what
   has been done to it is a damage sponge, not a creature. A
   threat may declare `morale` — the fraction of its health below
   which it breaks off. Absent a declaration this never fires and
   every existing module fights exactly as it did.

   BROKEN, NOT GONE. It disengages — gives ground and does not
   swing — rather than vanishing, because a wounded thing backing
   into the dark is the interesting outcome and an enemy deleting
   itself is not.

   Pure, and exported, so the enemy's turn can ask the question
   BEFORE it spends the top of its turn walking towards you.
   Asking via a trial `resolveEnemyAttack` would work and would
   also burn two draws off the seeded stream for one turn, which
   is exactly the determinism bug the rng threading just fixed.
   ============================================================ */
export function moraleBroken(threat, enemy) {
  const morale = Number(threat && threat.morale) || 0;
  if (morale <= 0 || !enemy || enemy.grabbed) return false;
  /* `hits` counts wounds TAKEN and death is `hits >= maxHits`, so
     health remaining is the complement. Backwards, this would break
     a creature the moment it was scratched. */
  const max = enemy.maxHits ?? 0;
  const left = max > 0 ? Math.max(0, (max - (enemy.hits ?? 0)) / max) : 1;
  return left <= morale;
}

/* ============================================================
   WHO IT GOES FOR

   This used to be one line — always the most wounded — and that
   is both the single most lethal policy available and the least
   characterful. A Warden varies it constantly, and the variation
   is most of what makes a threat read as a creature rather than
   an attack routine: the thing in the vents takes whoever is
   alone, the security drone shoots whoever shot it, the animal
   goes for whoever is nearest.

   Declared per threat as `tactics`, defaulting to `weakest` so
   every existing module behaves exactly as it did.

   Each policy is a comparator over living targets. None of them
   is random except `random`, because an enemy that picks
   uniformly is an enemy nobody can play around — the same
   argument director.js makes about a referee who is random.
   ============================================================ */
export const TACTICS = ["weakest", "nearest", "isolated", "loudest", "random"];

/** Fraction of health a character has left, 0..1. */
const healthLeft = (p) => (p.maxHealth > 0 ? (p.health || 0) / p.maxHealth : 1);

export function chooseVictim(threat, targets, combat, rng = Math.random) {
  const how = TACTICS.includes(threat && threat.tactics) ? threat.tactics : "weakest";
  const actor = (p) => (combat && combat.actors && combat.actors[p.id]) || {};
  const list = targets.slice();

  switch (how) {
    /* Nearest to hand. `distance` is tracked per enemy rather than
       per character, so proximity is read off who closed with it:
       anyone prone or grappling is within reach by definition. */
    case "nearest":
      return list.sort((a, b) => {
        const reach = (p) => (actor(p).prone ? 0 : actor(p).aimReady ? 2 : 1);
        return reach(a) - reach(b) || healthLeft(a) - healthLeft(b);
      })[0];

    /* Whoever has nobody with them. The Ypsilon 14 policy, and the
       one that makes splitting the party frightening rather than
       merely inconvenient. `pcsIn` is not importable here — combat
       must stay free of party state — so isolation is read from
       the room stamped on the character. */
    case "isolated": {
      const heads = {};
      for (const p of list) heads[p.room || "-"] = (heads[p.room || "-"] || 0) + 1;
      return list.sort((a, b) =>
        (heads[a.room || "-"] - heads[b.room || "-"]) || healthLeft(a) - healthLeft(b))[0];
    }

    /* Whoever just made themselves the loudest problem. Aiming and
       firing both qualify; standing still does not. Turns "shoot
       it" into a decision with a cost. */
    case "loudest":
      return list.sort((a, b) => {
        const noise = (p) => (actor(p).aimReady ? 2 : 0) + (actor(p).actions < ACTIONS_PER_ROUND ? 1 : 0);
        return noise(b) - noise(a) || healthLeft(a) - healthLeft(b);
      })[0];

    case "random":
      return list[Math.floor(rng() * list.length)] || list[0];

    case "weakest":
    default:
      return list.sort((a, b) => healthLeft(a) - healthLeft(b))[0];
  }
}

/**
 * An enemy's turn. Chooses a target and an attack, resolves against
 * that character's Armor Save.
 */
export function resolveEnemyAttack({ enemy, crew, combat, ctx }) {
  const { items, houseRules, mod } = ctx;
  const rng = ctx.rng || Math.random;
  const t = mod.threats[enemy.threatId];
  const targets = crew.filter((p) => p.alive !== false && !p.unconscious && !(combat.actors[p.id] || {}).fled);
  if (!targets.length) return { ok: false, why: "nobody left" };

  if (moraleBroken(t, enemy)) {
    return {
      ok: true, broken: true, disengage: MOVE_STEP,
      text: t.brokenText || `${enemy.name} gives ground, and keeps giving it.`,
    };
  }

  if (enemy.distracted > 0 && !enemy.grabbed)
    return { ok: true, distracted: true, text: t.searchingText || "It is casting around for the sound. It has lost you for a moment." };

  // Already holding someone: it does not swing at anybody else. It keeps
  // working on what it has. The victim saves or loses another piece.
  if (enemy.grabbed) {
    const held = crew.find((p) => p.id === enemy.grabbed);
    if (held && held.alive !== false) {
      const g = t.grapple || {};
      return {
        ok: true, holding: true, victimId: held.id, victimName: held.name,
        text: g.holdText || `${enemy.name} has not let go.`,
        save: g.save || "body", dmg: g.dmg || "2d10",
        onPassText: g.onPassText, onFailText: g.onFailText,
      };
    }
  }

  const victim = chooseVictim(t, targets, combat, rng);

  const attacks = t.attacks || [{ name: "Attack", dmg: "1d10" }];
  const total = attacks.reduce((a, x) => a + (x.weight ?? 1), 0);
  let pick = rng() * total, atk = attacks[0];
  for (const a of attacks) { pick -= a.weight ?? 1; if (pick <= 0) { atk = a; break; } }

  const armor = armorSave(victim, items) + (atk.vsArmor || 0);
  const att = check(clampTarget(enemy.combat), "none", { advTieBreak: houseRules.advTieBreak, rng });

  let def, outcome;
  if (houseRules.playerFacingRolls) {
    // Player-facing: the PLAYER rolls their Armor Save; failing it means hit.
    def = check(clampTarget(armor), "none", { advTieBreak: houseRules.advTieBreak, rng });
    outcome = def.success ? "defender" : "attacker";
  } else {
    def = check(clampTarget(armor), "none", { advTieBreak: houseRules.advTieBreak, rng });
    outcome = opposedResult(att, def);
    if (outcome === "reroll") outcome = "defender";
  }

  const hit = outcome === "attacker";
  const report = { ok: true, victimId: victim.id, victimName: victim.name, atk, att, def, armor, hit, outcome, effects: [] };
  if (!hit) return report;

  const crit = att.critHit && atk.crit;
  const use = crit ? { ...atk, ...atk.crit } : atk;
  report.use = use;
  report.dmg = evalDice(use.dmg || atk.dmg || "1d10", 0, rng);
  report.crit = !!crit;
  if (use.save) report.effects.push({ kind: "save", save: use.save, onFailDmg: use.onFailDmg, onPassText: use.onPassText, onFailText: use.onFailText });
  if (use.grapple) report.effects.push({ kind: "grapple", text: use.grappleText });
  return report;
}

/**
 * Tear free of something that has hold of you. Opposed Strength against
 * the thing's Combat; Close-Quarters Combat and Military Training help.
 */
export function resolveEscape({ pc, enemy, ctx }) {
  const m = collectModifiers({
    ...ctx, pc, kind: "stat", name: "strength",
    skill: ["Close-Quarters Combat", "Military Training", "Weapon Specialization"],
    tags: ["escape", "grapple", "melee"],
  });
  const target = clampTarget(baseValue(pc, "stat", "strength", ctx.items) + m.bonus);
  const att = check(target, m.mode, { advTieBreak: ctx.houseRules.advTieBreak, rng: ctx.rng || Math.random });
  const def = check(clampTarget(enemy.combat), "none", { advTieBreak: ctx.houseRules.advTieBreak, rng: ctx.rng || Math.random });
  let outcome = opposedResult(att, def);
  if (outcome === "reroll") outcome = "defender";
  return { free: outcome === "attacker", att, def, target, breakdown: m.breakdown, mode: m.mode };
}

/* ---------------- movement, aiming, fleeing ---------------- */

export const MOVE_STEP = 10;

export function moveToward(combat, uid, metres) {
  return {
    ...combat,
    enemies: combat.enemies.map((e) =>
      e.uid === uid ? { ...e, distance: Math.max(1, e.distance - metres) } : e),
  };
}
export function moveAway(combat, metres) {
  return { ...combat, enemies: combat.enemies.map((e) => ({ ...e, distance: e.distance + metres })) };
}

export function spendAction(combat, pcId, n = 1) {
  const a = combat.actors[pcId];
  if (!a) return combat;
  return { ...combat, actors: { ...combat.actors, [pcId]: { ...a, actions: Math.max(0, a.actions - n) } } };
}

export function setActor(combat, pcId, patch) {
  const a = combat.actors[pcId] || {};
  return { ...combat, actors: { ...combat.actors, [pcId]: { ...a, ...patch } } };
}

export function damageEnemy(combat, uid, dmg, maxHits, maxDmg) {
  let killed = false;
  const enemies = combat.enemies.map((e) => {
    if (e.uid !== uid) return e;
    const hits = e.hits + 1;
    const total = e.dmg + dmg;
    const dead = hits >= (maxHits ?? e.maxHits) || total >= (maxDmg ?? e.maxDmg);
    if (dead) killed = true;
    return { ...e, hits, dmg: total, dead };
  });
  return { combat: { ...combat, enemies }, killed };
}

export const combatOver = (combat) => liveEnemies(combat).length === 0;

/** Flee: Opposed Speed Check against the fastest thing chasing you. */
export function resolveFlee({ pc, combat, ctx }) {
  const fastest = liveEnemies(combat).reduce((a, e) => (a && a.speed > e.speed ? a : e), null);
  const m = collectModifiers({ ...ctx, pc, kind: "stat", name: "speed", tags: ["flee", "run"] });
  const target = clampTarget(pc.stats.speed + m.bonus);
  const att = check(target, m.mode, { advTieBreak: ctx.houseRules.advTieBreak, rng: ctx.rng || Math.random });
  const def = check(clampTarget(fastest ? fastest.speed : 40), "none", { advTieBreak: ctx.houseRules.advTieBreak, rng: ctx.rng || Math.random });
  let outcome = opposedResult(att, def);
  if (outcome === "reroll") outcome = "defender";
  return { escaped: outcome === "attacker", att, def, target, breakdown: m.breakdown, chaser: fastest };
}

export { pad };
