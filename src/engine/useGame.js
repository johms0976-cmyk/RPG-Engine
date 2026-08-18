/* ============================================================
   useGame — the whole runtime. Reads a module, exposes actions.
   Nothing in this file knows what a "goo" or a "Giovanni" is.

   Everything here runs locally. There is no network call in the
   engine and no API key anywhere in the codebase.
   ============================================================ */
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { check, opposed, opposedResult, evalDice, d, dN, pad } from "./dice.js";
import {
  armorSave, bestArmorItem, baseValue, clampTarget, panicEffect, WAKE_TABLE,
  STAT_KEYS, SAVE_KEYS, STAT_LABEL, skillTier, resolveRest, RestQuality,
  xpForLevel, primeAmmo, SKILL_BONUS, applyAdvancement,
} from "./rules.js";
import { collectModifiers, describeModifiers } from "./modifiers.js";
import { createWorld, npcsIn, threatIn, visibleExits, dayOf } from "./world.js";
import { runEffects, test, tmpl } from "./effects.js";
import {
  createCombat, rollInitiative, nextTurn, currentTurn, enemyByUid, liveEnemies,
  resolveAttack, resolveEnemyAttack, resolveFlee, damageEnemy, spendAction,
  setActor, combatOver, canFire, doReload, reloadCost, shotsForAttack,
  moveToward, moveAway, MOVE_STEP, ACTIONS_PER_ROUND, isTrainedShooter,
  resolveEscape, setEnemy, grabberOf,
} from "./combat.js";
import {
  makeRng, parseCommand, consultOracle, guessOdds, atmosphere, npcReply, pickFresh,
} from "./oracle.js";
import {
  saveContagion, panicContagion, deathContagion, multiPanicContagion,
  othersNearby, isAble, findPc, replacePc, possibleAssists, possibleTherapists,
} from "./crew.js";
import { withDefaults } from "./houserules.js";
import { SECRET_CONDITIONS } from "./secrets.js";
import { makeClue, addClue, dropClue, resolveClue, isDuplicateClue, makeMark, addMark, dropMark, canRemoveMark } from "./board.js";
import { save as persist, clear as clearSave } from "./storage.js";

let FEED_ID = 0;

export function useGame(mod, settings = {}) {
  const [crew, setCrew] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [w, setW] = useState(() => createWorld(mod));
  const [feed, setFeed] = useState([]);
  const [pending, setPending] = useState(null);
  const [combat, setCombat] = useState(null);
  const [talking, setTalking] = useState(null);
  const [device, setDevice] = useState(null);
  const [resting, setResting] = useState(null);
  const [levelUp, setLevelUp] = useState(null);
  const [shopping, setShopping] = useState(null);
  const [lastRoll, setLastRoll] = useState(null);
  const [houseRules, setHouseRules] = useState(() => withDefaults(settings.houseRules));
  const [slotName] = useState(settings.slot || "auto");

  // Hosts can contribute extra state to the save file (the headless
  // core's ship/contractor/downtime slice does exactly this) without
  // this hook needing to know what any of it is.
  const extraRef = useRef(settings.getExtra);
  extraRef.current = settings.getExtra;

  const wRef = useRef(w), crewRef = useRef(crew), combatRef = useRef(combat), activeRef = useRef(activeId);
  const W = () => wRef.current;
  const C = () => crewRef.current;
  const P = () => findPc(crewRef.current, activeRef.current);
  useEffect(() => { combatRef.current = combat; }, [combat]);
  useEffect(() => { activeRef.current = activeId; }, [activeId]);

  const commitW = useCallback((patch) => { wRef.current = { ...wRef.current, ...patch }; setW(wRef.current); }, []);
  const commitCrew = useCallback((next) => { crewRef.current = next; setCrew(next); }, []);
  const patchPc = useCallback((id, patch) => {
    const target = id || activeRef.current;
    commitCrew(crewRef.current.map((c) => (c.id === target ? { ...c, ...(typeof patch === "function" ? patch(c) : patch) } : c)));
  }, [commitCrew]);

  const items = mod.items;

  /* ---------------- deterministic randomness ---------------- */
  const tickingRef = useRef(false);
  const rngRef = useRef(null);
  const rng = useCallback(() => {
    if (!rngRef.current) rngRef.current = makeRng(W().seed);
    wRef.current.rngCalls = (wRef.current.rngCalls || 0) + 1;
    return rngRef.current();
  }, []);

  /* ---------------- feed ---------------- */
  const say = useCallback((kind, text, extra) => {
    if (text == null || text === "") return;
    setFeed((f) => [...f, { id: ++FEED_ID, kind, text: String(text), extra, clock: wRef.current.clock }].slice(-400));
  }, []);

  /* ---------------- primitives ---------------- */
  const flag = useCallback((name, value = true) => {
    commitW({ flags: { ...W().flags, [name]: value } });
  }, [commitW]);

  const give = useCallback((ids, pcId) => {
    if (!ids || !ids.length) return;
    const pc = pcId ? findPc(C(), pcId) : P();
    if (!pc) return;
    const add = ids.filter((i) => items[i] && !pc.items.includes(i));
    if (!add.length) return;
    patchPc(pc.id, (c) => {
      const nc = { ...c, items: [...c.items, ...add] };
      return primeAmmo(nc, items);
    });
    add.forEach((i) => say("item", `${pc.name} takes: ${items[i].n}`));
  }, [items, say, patchPc]);

  const take = useCallback((ids, pcId) => {
    if (!ids || !ids.length) return;
    const pc = pcId ? findPc(C(), pcId) : P();
    if (!pc) return;
    patchPc(pc.id, (c) => ({ ...c, items: c.items.filter((i) => !ids.includes(i)) }));
  }, [patchPc]);

  const stress = useCallback((n, why, pcId) => {
    const pc = pcId ? findPc(C(), pcId) : P();
    if (!n || !pc) return;
    if (n > 0 && houseRules.optInStress) {
      say("stress", `${pc.name} may take ${n} Stress — ${why || "the situation"}. Your call.`);
      setPending({ kind: "optStress", amount: n, why, pcId: pc.id });
      return;
    }
    const floor = pc.conditions.includes("Descent into Madness") ? 5 : 0;
    patchPc(pc.id, (c) => ({ ...c, stress: Math.max(floor, c.stress + n) }));
    say(n > 0 ? "stress" : "good", `${pc.name}: ${n > 0 ? "+" : ""}${n} Stress${why ? ` — ${why}` : ""}.`);
  }, [say, patchPc, houseRules.optInStress]);

  const stressCrew = useCallback((n, why) => {
    const pc = P();
    const others = othersNearby(C(), pc || { id: null });
    if (!others.length) return;
    commitCrew(C().map((c) => (others.some((o) => o.id === c.id)
      ? { ...c, stress: Math.max(c.conditions.includes("Descent into Madness") ? 5 : 0, c.stress + n) } : c)));
    say("stress", `Everyone nearby: ${n > 0 ? "+" : ""}${n} Stress${why ? ` — ${why}` : ""}.`);
  }, [commitCrew, say]);

  const meter = useCallback((key, n) => {
    const def = mod.meters[key]; const pc = P();
    if (!def || !pc) return;
    const next = Math.max(0, (pc.meters[key] || 0) + n);
    patchPc(pc.id, (c) => ({ ...c, meters: { ...c.meters, [key]: next } }));
    say(n > 0 ? "stress" : "good", `${pc.name}: ${n > 0 ? "+" : ""}${n} ${def.name || key} — now ${next}.`);
  }, [mod.meters, say, patchPc]);

  const heal = useCallback((n, pcId) => {
    const pc = pcId ? findPc(C(), pcId) : P();
    if (!n || !pc) return;
    patchPc(pc.id, (c) => ({ ...c, health: Math.min(c.maxHealth, c.health + n) }));
    say("good", `${pc.name} recovers ${n} Health.`);
  }, [say, patchPc]);

  const addCondition = useCallback((cond, pcId) => {
    const pc = pcId ? findPc(C(), pcId) : P();
    if (!pc || pc.conditions.includes(cond)) return;
    patchPc(pc.id, (c) => ({ ...c, conditions: [...c.conditions, cond] }));
  }, [patchPc]);

  const addBuff = useCallback((buff, pcId) => {
    const pc = pcId ? findPc(C(), pcId) : P();
    if (!pc) return;
    const until = buff.hours ? W().clock + evalDice(buff.hours) * 60 : buff.minutes ? W().clock + evalDice(buff.minutes) : null;
    const entries = buff.grants ? buff.grants.map((g) => ({ ...g, until, source: buff.source })) : [];
    if (buff.stats) {
      for (const [k, v] of Object.entries(buff.stats))
        entries.push({ kind: "stat", name: k, bonus: evalDice(v), until, source: buff.source });
    }
    patchPc(pc.id, (c) => ({ ...c, buffs: [...c.buffs, ...entries] }));
    if (buff.source) say("good", `${pc.name}: ${buff.source} takes hold.`);
  }, [patchPc, say]);

  const awardXp = useCallback((n, pcId) => {
    if (!n) return;
    const ids = pcId ? [pcId] : C().filter((c) => c.alive !== false).map((c) => c.id);
    commitCrew(C().map((c) => (ids.includes(c.id) ? { ...c, xp: c.xp + n } : c)));
    say("good", `+${n} XP.`);
  }, [commitCrew, say]);

  const endGame = useCallback((endingId) => {
    if (W().ended) return;
    commitW({ ended: endingId });
    setCombat(null); setTalking(null); setPending(null); setDevice(null); setResting(null);
    // v2: the save is KEPT so the debrief and the transcript survive.
  }, [commitW]);

  /* ---------------- rolling ---------------- */
  const logRoll = useCallback((entry) => {
    const log = [...(W().rollLog || []), entry].slice(-500);
    wRef.current.rollLog = log;
  }, []);

  const ctxFor = useCallback((pc) => ({
    world: W(), pc: pc || P(), crew: C(), items, mod, houseRules,
  }), [items, mod, houseRules]);

  const rollNow = useCallback((req) => {
    const pc = req.pcId ? findPc(C(), req.pcId) : P();
    if (!pc) return { success: false };

    // Exhaustible Skills: burn the skill for an automatic success.
    if (houseRules.exhaustibleSkills && req.useSkillCharge && req.skill) {
      const s = Array.isArray(req.skill) ? req.skill.find((x) => pc.skills.includes(x)) : req.skill;
      if (s && !pc.spentSkills.includes(s)) {
        patchPc(pc.id, (c) => ({ ...c, spentSkills: [...c.spentSkills, s] }));
        say("rollgood", `${pc.name} — ${s} carries it. Automatic success. That skill is spent for the session.`);
        return { success: true, crit: false, critHit: false, critFail: false, value: 0, target: 99, margin: 99, auto: true };
      }
    }

    const m = collectModifiers({
      ...ctxFor(pc), pc, kind: req.kind, name: req.name, skill: req.skill,
      tags: req.tags, mode: req.mode, assist: req.assist, situational: req.situational,
    });
    const base = baseValue(pc, req.kind, req.name, items);
    const target = clampTarget(base + m.bonus);
    const r = check(target, m.mode, { advTieBreak: houseRules.advTieBreak });

    const skillName = Array.isArray(req.skill)
      ? req.skill.find((s) => pc.skills.includes(s))
      : (pc.skills.includes(req.skill) ? req.skill : null);
    const label = `${STAT_LABEL[req.name] || req.name}${skillName ? ` (${skillName})` : ""}`;
    setLastRoll({ ...r, label, who: pc.name, breakdown: m.breakdown });
    logRoll({ clock: W().clock, who: pc.name, label, value: r.value, target, mode: m.mode,
      success: r.success, critHit: r.critHit, critFail: r.critFail, margin: r.margin });

    const tag = r.critHit ? "CRITICAL SUCCESS" : r.critFail ? "CRITICAL FAILURE" : r.success ? "SUCCESS" : "FAILURE";
    const mods = describeModifiers(m.breakdown);
    say(r.success ? "rollgood" : "rollbad",
      `${req.kind === "save" ? "SAVE" : "CHECK"} · ${pc.name} — ${label} ${base}${m.bonus ? (m.bonus > 0 ? `+${m.bonus}` : m.bonus) : ""}=${target}%` +
      `  ·  rolled ${pad(r.value)}${m.mode !== "none" ? ` [${m.mode === "advantage" ? "+" : "−"}]` : ""}  ·  ${tag}` +
      `${req.why ? `  ·  ${req.why}` : ""}${mods ? `\n   ${mods}` : ""}`);

    if (req.assist) patchPc(req.assist, (c) => ({ ...c, lastAssistDay: dayOf(W()) }));

    // Critical Stress Relief house rule
    if (houseRules.criticalStressRelief && r.critHit && pc.stress > 0) {
      patchPc(pc.id, (c) => ({ ...c, stress: Math.max(0, c.stress - 1) }));
      say("good", `${pc.name} — a moment of grace. −1 Stress.`);
    }

    if (req.kind === "save" && !r.success && req.autoStress !== false) stress(1, "failed Save", pc.id);

    // Class contagion
    for (const c of saveContagion(pc, req, r, C())) {
      if (c.kind === "stressOthers") {
        say("stress", c.text);
        commitCrew(C().map((x) => (c.ids.includes(x.id) ? { ...x, stress: x.stress + c.amount } : x)));
      }
    }

    if (r.critFail && req.autoPanic !== false && houseRules.autoPanicOnCritFail)
      queuePanic(pc.id, "critFail");
    return r;
  }, [items, say, stress, ctxFor, houseRules, patchPc, commitCrew, logRoll]);

  /* ---------------- panic ---------------- */
  const panicQueue = useRef([]);
  const queuePanic = useCallback((pcId, reason) => {
    panicQueue.current.push({ pcId, reason });
    setTimeout(() => flushPanics(), 40);
  }, []);

  const doPanic = useCallback((pcId, depth = 0) => {
    const pc = findPc(C(), pcId);
    if (!pc || W().ended || pc.alive === false) return false;

    const roll = dN(2, 10);
    if (roll > pc.stress) {
      say("panic", `PANIC CHECK · ${pc.name} · 2d10 = ${roll} vs Stress ${pc.stress} — holds it together. −1 Stress.`);
      patchPc(pc.id, (c) => ({ ...c, stress: Math.max(0, c.stress - 1) }));
      return false;
    }

    let effRoll = dN(2, 10);
    // Teamster: one Panic Effect re-roll per session.
    if (pc.cls === "teamster" && !pc.usedPanicReroll && effRoll + pc.stress - pc.resolve >= 14) {
      const second = dN(2, 10);
      say("panic", `${pc.name} is a Teamster and has seen worse. Re-rolling ${effRoll} → ${second}.`);
      effRoll = Math.min(effRoll, second);
      patchPc(pc.id, (c) => ({ ...c, usedPanicReroll: true }));
    }

    // PSG 26.3: Resolve can take the total to 1 or less, in which
    // case there is NO effect and you did not Panic at all.
    const total = effRoll + pc.stress - pc.resolve;
    if (total <= 1) {
      say("good", `PANIC CHECK · ${pc.name} · effect total ${total} — Resolve holds. Nothing happens.`);
      return false;
    }

    const eff = panicEffect(total);
    say("panic", `PANIC CHECK · ${pc.name} · 2d10 = ${roll} vs Stress ${pc.stress} — PANICS.\nEffect ${total} → ${eff.name.toUpperCase()}\n${eff.t}`);

    const e = eff.e;
    const patch = { stress: pc.stress, conditions: [...pc.conditions] };
    if (e.stress) patch.stress += e.stress;
    if (e.stressDice) patch.stress += d(10);
    if (e.phobia) patch.conditions.push("Phobia");
    if (e.floor) { patch.conditions.push("Descent into Madness"); patch.stress = Math.max(5, patch.stress); }
    if (e.adv) patch.conditions.push(`Advantage (${e.adv})`);
    if (e.dis) patch.conditions.push("Rattled — Disadvantage");
    ["cowardice", "hallucinating", "catatonic", "broken", "paranoid", "deathdrive", "psychotic"].forEach((k) => {
      if (e[k]) patch.conditions.push(k[0].toUpperCase() + k.slice(1));
    });
    patchPc(pc.id, patch);

    // Nervous Twitch: the nearest crew member catches it.
    if (e.nearby) {
      const others = othersNearby(C(), pc);
      if (others.length) {
        const victim = others[0];
        commitCrew(C().map((c) => (c.id === victim.id ? { ...c, stress: c.stress + e.nearby } : c)));
        say("stress", `${victim.name} is standing too close. +${e.nearby} Stress.`);
      }
    }

    if (e.noise) noise("your own scream");
    if (e.end === "dead") { killPc(pc.id, "heart attack"); return true; }
    if (e.end === "insane") {
      patchPc(pc.id, (c) => ({ ...c, alive: false, conditions: [...c.conditions, "Psychological Collapse"] }));
      say("horror", `${pc.name} is not coming back. The Warden has that sheet now.`);
      afterCrewLoss(pc.id);
      return true;
    }
    if (e.again && depth < 2) { doPanic(pcId, depth + 1); doPanic(pcId, depth + 1); }

    // Marine contagion
    for (const c of panicContagion(pc, C())) {
      say("panic", c.text);
      c.ids.forEach((id) => rollNow({ kind: "save", name: "fear", pcId: id, why: "a Marine just broke", autoPanic: false }));
    }
    return true;
  }, [say, patchPc, commitCrew, rollNow]);

  const flushPanics = useCallback(() => {
    const q = panicQueue.current;
    panicQueue.current = [];
    if (!q.length) return;
    const panicked = [];
    for (const item of q) if (doPanic(item.pcId)) panicked.push(item.pcId);
    // More than one at once is itself a trigger (PSG 26.2).
    for (const c of multiPanicContagion(panicked, C())) {
      say("panic", c.text);
      c.ids.forEach((id) => doPanic(id));
    }
  }, [doPanic, say]);

  const panic = useCallback((pcId) => { queuePanic(pcId || activeRef.current, "manual"); }, [queuePanic]);

  /* ---------------- damage, unconsciousness, death ---------------- */
  const killPc = useCallback((pcId, why) => {
    const pc = findPc(C(), pcId);
    if (!pc) return;
    patchPc(pcId, { alive: false, unconscious: false, health: 0 });
    say("dmg", `${pc.name} is dead${why ? ` — ${why}` : ""}.`);
    afterCrewLoss(pcId);
  }, [patchPc, say]);

  const afterCrewLoss = useCallback((pcId) => {
    const dead = findPc(C(), pcId);
    for (const c of deathContagion(dead, C())) {
      say("panic", c.text);
      c.ids.forEach((id) => queuePanic(id, "crewDeath"));
    }
    const left = C().filter((c) => c.alive !== false);
    if (!left.length) {
      endGame(mod.endings.dead ? "dead" : Object.keys(mod.endings)[0]);
      return;
    }
    if (dead && dead.id === activeRef.current) {
      const next = left.find((c) => isAble(c)) || left[0];
      setActiveId(next.id);
      say("system", `You are ${next.name} now.`);
    }
  }, [say, queuePanic, endGame, mod.endings]);

  const hurt = useCallback((n, why, pcId) => {
    const pc = pcId ? findPc(C(), pcId) : P();
    if (!pc || n <= 0 || pc.alive === false) return;

    let dmg = n;
    let armorNote = "";
    // Armor Degradation house rule: excess damage chews the suit.
    if (houseRules.armorDegradation) {
      const worn = bestArmorItem(pc, items);
      if (worn) {
        const remaining = Math.max(0, worn.it.armor - (pc.armorDamage || 0));
        if (remaining > 0) {
          patchPc(pc.id, (c) => ({ ...c, armorDamage: (c.armorDamage || 0) + 1 }));
          armorNote = remaining - 1 <= 0 ? ` ${worn.it.n} is finished.` : ` ${worn.it.n} takes a point (${remaining - 1} left).`;
        }
      }
    }

    // Wounds house rule
    if (houseRules.wounds) {
      patchPc(pc.id, (c) => ({ ...c, wounds: (c.wounds || 0) + 1 }));
    }

    const nh = Math.max(0, pc.health - dmg);
    patchPc(pc.id, (c) => ({ ...c, health: nh }));
    say("dmg", `${pc.name} takes ${dmg} damage${why ? ` — ${why}` : ""}.  Health ${nh}/${pc.maxHealth}.${armorNote}`);

    if (dmg > pc.maxHealth / 2 && nh > 0) {
      say("panic", `That was more than half of ${pc.name}'s Health in one hit.`);
      queuePanic(pc.id, "bigHit");
    }
    if (houseRules.wounds && (pc.wounds || 0) + 1 > (pc.maxWounds || 2)) { killPc(pc.id, "too many wounds"); return; }
    if (nh > 0) return;

    /* --- 0 Health: Body Save or die (PSG 10.4) --- */
    const r = check(pc.saves.body, "none", { advTieBreak: houseRules.advTieBreak });
    say(r.success ? "rollgood" : "rollbad",
      `DEATH · ${pc.name} — Body Save ${pc.saves.body}%, rolled ${pad(r.value)} · ${r.success ? "falls unconscious" : "dies"}.`);
    if (!r.success) { killPc(pc.id, why); return; }

    const roll = d(10);
    const entry = WAKE_TABLE.find((x) => roll <= x.max);
    say("horror", `UNCONSCIOUS · ${pc.name} — ${entry.t}`);

    if (entry.coma) {
      patchPc(pc.id, { unconscious: true, health: 0, conditions: [...pc.conditions, "Comatose"] });
      say("horror", `${pc.name} is not coming back without extraordinary measures.`);
      afterCrewLoss(pc.id);
      return;
    }

    /* --- the wake table's permanent penalties are now REAL --- */
    const pen = entry.penalties || {};
    const wakeMins = entry.wake === "1d10 days" ? d(10) * 1440
      : entry.wake === "1d10 hours" ? d(10) * 60
      : entry.wake === "1d10 minutes" ? d(10) : 0;

    patchPc(pc.id, (c) => {
      const stats = { ...c.stats };
      const applied = [];
      for (const [k, v] of Object.entries(pen)) {
        stats[k] = Math.max(1, stats[k] + v);
        applied.push(`${v} ${STAT_LABEL[k]}`);
      }
      const maxHealth = pen.strength ? Math.max(1, stats.strength * 2) : c.maxHealth;
      return {
        ...c, stats, maxHealth,
        health: 1,
        stress: c.stress + evalDice(entry.stress ?? 1),
        unconscious: wakeMins > 0,
        wakeAt: wakeMins > 0 ? W().clock + wakeMins : null,
        conditions: entry.dazed ? [...c.conditions, "Dazed — Disadvantage"] : c.conditions,
        penaltyNote: applied.join(", ") || null,
      };
    });

    if (Object.keys(pen).length)
      say("system", `Permanent: ${Object.entries(pen).map(([k, v]) => `${v} ${STAT_LABEL[k]}`).join(", ")}. That does not come back.`);
    if (wakeMins > 0) say("system", `${pc.name} will wake in about ${wakeMins < 60 ? `${wakeMins} minutes` : wakeMins < 1440 ? `${Math.round(wakeMins / 60)} hours` : `${Math.round(wakeMins / 1440)} days`}.`);

    if (combatRef.current) {
      const anyUp = C().some((c) => c.id !== pc.id && isAble(c));
      if (!anyUp) { setCombat(null); say("system", "Nobody is left standing. Whatever it is, it has the room."); }
    }
    if (pc.id === activeRef.current && wakeMins > 0) {
      const next = C().find((c) => c.id !== pc.id && isAble(c));
      if (next) { setActiveId(next.id); say("system", `You are ${next.name} now.`); }
    }
    if (mod.hooks.onUnconscious) runEffects(mod.hooks.onUnconscious, apiRef.current, {});
  }, [items, say, patchPc, queuePanic, killPc, afterCrewLoss, houseRules, mod]);

  /** Bring somebody new aboard mid-session — an approved character from
      a player's phone, or a replacement after a death. Goes through the
      same priming as creation so weapons arrive loaded. */
  const addCrewMember = useCallback((pc) => {
    if (!pc || !pc.id) return null;
    const primed = primeAmmo({ ...pc }, items);
    commitCrew([...C(), primed]);
    if (!activeRef.current) { activeRef.current = primed.id; setActiveId(primed.id); }
    say("system", `${primed.name} joins the crew.`);
    return primed;
  }, [items, commitCrew, say]);

  /* ---------------- the board (clues and map marks) ----------------
     Both live on the world so they save, restore and travel with
     everything else, and both are written by players rather than by
     the module. Nothing here consumes a turn or an action. */
  const pinClue = useCallback((text, kind, opts = {}) => {
    if (!text || !String(text).trim()) return;
    const st = W();
    if (isDuplicateClue(st.clues, text)) {
      say("system", "That's already on the board.");
      return;
    }
    const pc = opts.by ? findPc(C(), opts.by) : P();
    const clue = makeClue({
      text, kind, room: st.room, clock: st.clock,
      by: pc ? pc.name : null, secret: !!opts.secret,
    });
    commitW({ clues: addClue(st.clues, clue) });
    if (!clue.secret) say("system", `Pinned: ${clue.text}`);
  }, [commitW, say]);

  const unpinClue = useCallback((id) => {
    commitW({ clues: dropClue(W().clues, id) });
  }, [commitW]);

  const setClueResolved = useCallback((id, resolved = true) => {
    commitW({ clues: resolveClue(W().clues, id, resolved) });
  }, [commitW]);

  const addMapMark = useCallback((roomId, kind, text, opts = {}) => {
    const st = W();
    const room = roomId || st.room;
    if (!mod.rooms[room]) return;
    const pc = opts.by ? findPc(C(), opts.by) : P();
    const mark = makeMark({
      room, kind, text, clock: st.clock,
      by: pc ? pc.id : null, byName: pc ? pc.name : "the Warden",
    });
    commitW({ marks: addMark(st.marks, mark) });
  }, [commitW, mod]);

  const removeMapMark = useCallback((id, opts = {}) => {
    const st = W();
    const mark = (st.marks || []).find((m) => m.id === id);
    if (!mark) return;
    const pcId = opts.by || activeRef.current;
    if (!canRemoveMark(mark, { pcId, isWarden: !!opts.isWarden })) {
      say("system", "That isn't yours to rub out.");
      return;
    }
    commitW({ marks: dropMark(st.marks, id) });
  }, [commitW, say]);

  /** A line only one player receives. The addressing is honoured by
      secrets.js when the snapshot is packed, so this is safe to call
      even in a single-player session — it just reads as a normal line. */
  const whisper = useCallback((pcId, text) => {
    if (!text) return;
    setFeed((f) => [...f, { id: ++FEED_ID, kind: "whisper", text: String(text), to: pcId, clock: wRef.current.clock }].slice(-400));
  }, []);

  /* ---------------- ask (player-pressed rolls) ---------------- */
  const ask = useCallback((req) => {
    if (!req || !req.name) return;
    const name = String(req.name).toLowerCase().trim();
    let kind = req.kind === "save" ? "save" : "stat";
    if (kind === "stat" && !STAT_KEYS.includes(name)) kind = SAVE_KEYS.includes(name) ? "save" : null;
    if (kind === "save" && !SAVE_KEYS.includes(name)) kind = STAT_KEYS.includes(name) ? "stat" : null;
    if (!kind) return;
    const skill = req.skill && skillTier(req.skill) ? req.skill : null;
    const mode = ["advantage", "disadvantage"].includes(req.mode) ? req.mode : "none";
    // pcId is always stamped, never left to default. Single-player never
    // noticed, but at a networked table it is how the prompt finds the
    // right phone instead of interrupting everyone.
    setPending({ kind: "roll", req: { kind, name, skill, mode, tags: req.tags, reason: req.reason, effects: req.effects, pcId: req.pcId || activeRef.current } });
  }, []);

  /* ---------------- threats, noise ---------------- */
  const setThreat = useCallback((id, patch) => {
    const st = W(); const cur = st.threats[id];
    if (!cur) return;
    const next = { ...cur };
    if (patch.loc !== undefined) next.loc = patch.loc;
    if (patch.retreat !== undefined) next.retreatUntil = st.clock + evalDice(patch.retreat);
    if (patch.distract !== undefined) next.distracted = evalDice(patch.distract);
    if (patch.dead !== undefined) { next.dead = patch.dead; next.loc = null; }
    // A threat can carry wounds between encounters, and can mend them.
    if (patch.dmg !== undefined) next.dmg = Math.max(0, evalDice(patch.dmg));
    if (patch.hits !== undefined) next.hits = Math.max(0, evalDice(patch.hits));
    if (patch.heal !== undefined) next.dmg = Math.max(0, (next.dmg || 0) - evalDice(patch.heal));
    if (patch.state !== undefined) next.state = patch.state;
    commitW({ threats: { ...st.threats, [id]: next } });
  }, [commitW]);

  /* ---------------- NPCs with somewhere to be ---------------- */
  const npcSay = useCallback((id, text, tone) => {
    const n = mod.npcs[id];
    if (!n || !text) return;
    say(tone || "npc", `${n.name}: ${text}`, { npc: id });
  }, [mod.npcs, say]);

  /**
   * Move or alter an NPC. This is what lets a module give its cast a
   * routine: `{ npc: { id: "sonya", loc: "mess", mood: 3 } }`.
   */
  const setNpc = useCallback((id, patch = {}) => {
    const st = W(); const cur = st.npcs[id];
    if (!cur) return;
    const next = { ...cur };
    if (patch.loc !== undefined) next.loc = patch.loc;
    if (patch.alive !== undefined) next.alive = patch.alive;
    if (patch.taken !== undefined) next.taken = patch.taken;
    if (patch.met !== undefined) next.met = patch.met;
    if (patch.mood !== undefined) next.mood = patch.mood;
    if (patch.state !== undefined) next.state = patch.state;
    if (patch.knows !== undefined) next.knows = patch.knows;
    if (patch.told !== undefined) next.told = patch.told;
    commitW({ npcs: { ...st.npcs, [id]: next } });
    if (patch.say) npcSay(id, patch.say, patch.tone);
  }, [commitW, npcSay]);

  const noise = useCallback((source) => {
    say("horror", `The noise carries — ${source}. Anything that hunts by sound now knows where you are.`);
    const st = W();
    Object.entries(mod.threats).forEach(([id, t]) => {
      if (!t.hearsNoise) return;
      const s = st.threats[id];
      if (s.dead || s.retreatUntil >= st.clock) return;
      if (rng() < (t.noiseDraw ?? 0.55)) {
        setThreat(id, { loc: st.room, distract: 2 });
        say("good", t.distractedText || "Something large blunders into a bulkhead nearby and stops. It heard the sound, not you.");
      } else setThreat(id, { loc: st.room });
    });
  }, [say, mod.threats, setThreat, rng]);

  const vanish = useCallback((opts = {}) => {
    const st = W();
    const eligible = (id) =>
      st.npcs[id] && st.npcs[id].alive && !st.npcs[id].taken && mod.npcs[id].vanishable !== false &&
      (!opts.in || st.npcs[id].loc === opts.in) &&
      (!opts.exclude || !opts.exclude.includes(id));

    let victim = null;
    if (opts.id && eligible(opts.id)) victim = opts.id;
    else {
      const pool = mod.npcOrder.filter(eligible);
      if (!pool.length) return null;
      victim = pool[Math.floor(rng() * pool.length)];
    }

    const where = st.npcs[victim].loc;
    const witnessed = where === st.room;
    commitW({ npcs: { ...st.npcs, [victim]: { ...st.npcs[victim], taken: true, alive: false, loc: null } } });

    const name = mod.npcs[victim].name;
    const line = witnessed && opts.witnessText ? opts.witnessText : opts.text;
    say(opts.tone || "horror", tmpl(line || "{name} is not where {name} should be.", { name }));
    const s = witnessed ? (opts.witnessStress ?? opts.stress) : opts.stress;
    if (s) stressCrew(evalDice(s), "another one gone");
    if (typeof mod.hooks.onVanish === "function") mod.hooks.onVanish(apiRef.current, { id: victim, name, where, witnessed });
    return victim;
  }, [mod, commitW, say, stressCrew, rng]);

  const rollTable = useCallback((id) => {
    const t = mod.tables[id];
    if (!t) return;
    const roll = evalDice(t.die || "1d10");
    const entry = t.entries.find((e) => roll <= (e.max ?? 99)) || t.entries[t.entries.length - 1];
    say(t.tone || "system", `${(t.name || id).toUpperCase()} · rolled ${roll} — ${entry.text}`);
    if (entry.effects) runEffects(entry.effects, apiRef.current, {});
  }, [mod.tables, say]);

  const run = useCallback((name, vars) => {
    const fn = mod.hooks[name];
    if (typeof fn === "function") fn(apiRef.current, vars);
    else say("system", `[module hook "${name}" is missing]`);
  }, [mod.hooks, say]);

  /* ---------------- countdowns & clock ---------------- */
  const countdown = useCallback((cfg) => {
    commitW({ countdowns: { ...W().countdowns, [cfg.id]: { left: evalDice(cfg.minutes), cfg } } });
  }, [commitW]);
  const stopCountdown = useCallback((id) => {
    const next = { ...W().countdowns }; delete next[id];
    commitW({ countdowns: next });
  }, [commitW]);

  const wakeSleepers = useCallback((clock) => {
    const waking = C().filter((c) => c.unconscious && c.wakeAt != null && clock >= c.wakeAt);
    if (!waking.length) return;
    commitCrew(C().map((c) => (waking.some((x) => x.id === c.id) ? { ...c, unconscious: false, wakeAt: null } : c)));
    waking.forEach((c) => say("good", `${c.name} comes round.`));
  }, [commitCrew, say]);

  const expireBuffs = useCallback((clock) => {
    let touched = false;
    const next = C().map((c) => {
      const keep = c.buffs.filter((b) => b.until == null || clock < b.until);
      if (keep.length !== c.buffs.length) touched = true;
      const conds = c.conditions.filter((x) => !x.startsWith("Advantage (") && !x.startsWith("Rattled") && !x.startsWith("Dazed"));
      return keep.length !== c.buffs.length ? { ...c, buffs: keep, conditions: conds } : c;
    });
    if (touched) commitCrew(next);
  }, [commitCrew]);

  const advance = useCallback((mins) => {
    const st = W();
    if (st.ended || !mins) return;
    const clock = st.clock + mins;
    const patch = { clock, day: Math.floor(clock / 1440) };

    const threats = { ...st.threats };
    let touched = false;
    Object.keys(threats).forEach((id) => {
      if (threats[id].distracted > 0) { threats[id] = { ...threats[id], distracted: Math.max(0, threats[id].distracted - 1) }; touched = true; }
    });
    if (touched) patch.threats = threats;

    const cds = { ...st.countdowns };
    let expired = null;
    Object.entries(cds).forEach(([id, c]) => {
      // A countdown the Warden is holding keeps its minutes and skips
      // its tick. Used constantly at real tables — "the reactor waits
      // while we sort out what just happened in the corridor."
      if (c.paused) return;
      const left = c.left - mins;
      if (left <= 0) { expired = c.cfg; delete cds[id]; }
      else { cds[id] = { ...c, left }; say("alarm", tmpl(c.cfg.tick || "{id} · {left} minutes remaining.", { id: id.toUpperCase(), left })); }
    });
    patch.countdowns = cds;
    commitW(patch);

    if (expired) { runEffects(expired.onZero, apiRef.current, {}); if (W().ended) return; }

    const clocks = { ...W().clocks };
    let fired = null;
    (mod.clocks || []).forEach((c) => {
      const s = clocks[c.id];
      if (!s || !s.on) return;
      if (clock >= s.next) {
        clocks[c.id] = { ...s, next: clock + evalDice(c.every ?? 60) };
        if (test(c.when, apiRef.current.ctx())) fired = fired || c;
      }
    });
    commitW({ clocks });
    if (fired) runEffects(fired.effects, apiRef.current, {});

    wakeSleepers(clock);
    expireBuffs(clock);
    tickTracks(clock);

    // The module's own simulation step. Anything it does that advances the
    // clock again would recurse, so it gets one pass per advance.
    if (typeof mod.hooks.onTick === "function" && !tickingRef.current) {
      tickingRef.current = true;
      try { mod.hooks.onTick(apiRef.current, { mins, clock, from: clock - mins }); }
      finally { tickingRef.current = false; }
    }
  }, [commitW, say, mod.clocks, mod.hooks, wakeSleepers, expireBuffs]);

  /* ---------------- timed condition tracks ---------------- */
  const startTrack = useCallback((id, pcId) => {
    const def = mod.tracks[id];
    const pc = pcId ? findPc(C(), pcId) : P();
    if (!def || !pc || pc.tracks[id]) return;
    const start = W().clock;
    const times = (def.stages || []).map((s) => start + evalDice(s.after ?? 0));
    patchPc(pc.id, (c) => ({
      ...c,
      tracks: { ...c.tracks, [id]: { start, times, done: [], repeatAt: null } },
      conditions: def.condition && !c.conditions.includes(def.condition) ? [...c.conditions, def.condition] : c.conditions,
    }));
  }, [mod.tracks, patchPc]);

  const tickTracks = useCallback((clock) => {
    for (const pc of C()) {
      if (!pc.tracks) continue;
      for (const [id, st] of Object.entries(pc.tracks)) {
        const def = mod.tracks[id];
        if (!def) continue;
        (def.stages || []).forEach((stage, i) => {
          if (st.done.includes(i) || clock < st.times[i]) return;
          patchPc(pc.id, (c) => ({
            ...c,
            tracks: { ...c.tracks, [id]: { ...c.tracks[id], done: [...c.tracks[id].done, i], repeatAt: stage.repeat ? clock : c.tracks[id].repeatAt } },
          }));
          runEffects(stage.effects, apiRef.current, {}, pc.id);
        });
        const fresh = findPc(C(), pc.id);
        const t = fresh && fresh.tracks[id];
        if (t && t.repeatAt != null) {
          const stage = def.stages.find((s) => s.repeat);
          if (stage && clock >= t.repeatAt + evalDice(stage.repeat.every)) {
            patchPc(pc.id, (c) => ({ ...c, tracks: { ...c.tracks, [id]: { ...c.tracks[id], repeatAt: clock } } }));
            runEffects(stage.repeat.effects, apiRef.current, {});
          }
        }
      }
    }
  }, [mod.tracks, patchPc]);

  /* ---------------- REST, HEALING & STRESS RELIEF ---------------- */
  const offerRest = useCallback((cfg = {}) => {
    setResting({ quality: cfg.quality || "SAFE", hours: cfg.hours || 6, therapistFor: {} });
  }, []);

  const doRest = useCallback(({ quality, hours, therapists = {} }) => {
    const q = RestQuality[quality] || RestQuality.SAFE;
    const day = dayOf(W());
    if (hours < 6) { say("system", "Six hours is the minimum. Anything less is just lying down."); return; }

    say("move", `REST — ${q.name}, ${hours} hours.`);
    say("system", q.blurb);
    advance(hours * 60);

    const reports = [];
    for (const pc of C()) {
      if (pc.alive === false) continue;
      if (pc.lastRestDay === day) { say("system", `${pc.name} has already had their rest today.`); continue; }

      const therapistId = therapists[pc.id];
      let assistAdv = false;
      if (therapistId) {
        const th = findPc(C(), therapistId);
        if (th) {
          const skill = ["Psychology", "Theology", "Sophontology"].find((s) => th.skills.includes(s));
          const r = rollNow({ kind: "stat", name: "intellect", skill, tags: ["therapy"], pcId: th.id, why: `talking ${pc.name} down`, autoPanic: false });
          assistAdv = r.success;
          patchPc(th.id, (c) => ({ ...c, lastAssistDay: day, lastRestDay: day }));
          if (!assistAdv) say("system", `${th.name} says the wrong thing. It doesn't help.`);
        }
      }

      const rep = resolveRest(pc, {
        quality: q, items, houseRules, assistAdv,
        rng: Math.random,
      });

      // healing
      if (rep.heal > 0) {
        patchPc(pc.id, (c) => ({ ...c, health: Math.min(c.maxHealth, c.health + rep.heal), armorDamage: 0 }));
        say("rollgood", `REST · ${pc.name} — Body Save ${pc.saves.body}%, rolled ${pad(rep.healRoll.value)}${rep.healRoll.mode !== "none" ? ` [${rep.healRoll.mode === "advantage" ? "+" : "−"}]` : ""} · heals ${rep.heal}${rep.healRoll.critHit ? " (critical, doubled)" : ""}.`);
      } else if (rep.heal < 0) {
        say("rollbad", `REST · ${pc.name} — Body Save rolled ${pad(rep.healRoll.value)} · CRITICAL FAILURE. The wound opens: ${-rep.heal} damage.`);
        hurt(-rep.heal, "a bad night", pc.id);
      } else {
        say("rollbad", `REST · ${pc.name} — Body Save rolled ${pad(rep.healRoll.value)} · no healing.`);
      }

      // stress relief
      if (rep.stressRoll) {
        if (rep.stressRelief > 0) {
          patchPc(pc.id, (c) => ({ ...c, stress: Math.max(0, c.stress - rep.stressRelief) }));
          say("good", `REST · ${pc.name} — Fear Save ${pc.saves.fear}%, rolled ${pad(rep.stressRoll.value)}${rep.stressRoll.mode !== "none" ? ` [${rep.stressRoll.mode === "advantage" ? "+" : "−"}]` : ""} · sheds ${rep.stressRelief} Stress${rep.stressRoll.critHit ? " (critical, doubled)" : ""}.`);
        } else {
          say("rollbad", `REST · ${pc.name} — Fear Save rolled ${pad(rep.stressRoll.value)} · the Stress stays where it is.`);
        }
      }
      rep.notes.forEach((n) => say("system", n));
      patchPc(pc.id, (c) => ({ ...c, lastRestDay: day, spentSkills: [] }));
      reports.push({ pc, rep });
    }
    setResting(null);
    checkLevelUps();
  }, [advance, say, items, houseRules, rollNow, patchPc, hurt]);

  /* ---------------- progression ---------------- */
  const checkLevelUps = useCallback(() => {
    const ready = C().filter((c) => c.alive !== false && c.xp >= xpForLevel(c.level));
    if (ready.length) setLevelUp({ queue: ready.map((c) => c.id) });
  }, []);

  const applyLevel = useCallback((pcId, choice) => {
    const pc = findPc(C(), pcId);
    if (!pc) return;
    const { pc: next, error } = applyAdvancement(pc, choice);
    if (error) { say("system", error); return; }
    commitCrew(C().map((c) => (c.id === pcId ? next : c)));
    say("good", `${pc.name} advances to level ${next.level}.`);
    setLevelUp((lu) => {
      const q = (lu ? lu.queue : []).filter((id) => id !== pcId);
      return q.length ? { queue: q } : null;
    });
  }, [commitCrew, say]);

  /* ---------------- COMBAT ---------------- */
  const startCombat = useCallback((threatId, opts = {}) => {
    const st = W(); const t = mod.threats[threatId];
    if (!t || st.ended || combatRef.current) return;
    const first = !st.flags[`met:${threatId}`];
    if (first) flag(`met:${threatId}`, true);
    if (t.onSighted) say("horror", t.onSighted);

    let c = createCombat(mod, [{ threatId, count: opts.count, distance: opts.distance }], C(), { surprise: opts.surprise });
    c = rollInitiative(c, C(), ctxFor());
    say("move", `COMBAT — round 1.`);
    for (const ir of c.initiativeRolls) {
      say(ir.r.success ? "rollgood" : "rollbad",
        `INITIATIVE · ${ir.pc.name} — Speed ${ir.target}%, rolled ${pad(ir.r.value)} · ${ir.r.success ? "acts first" : "acts after"}.`);
    }

    if (opts.surprise) {
      for (const pc of C().filter(isAble)) {
        const r = rollNow({ kind: "save", name: "fear", pcId: pc.id, why: "taken by surprise", autoPanic: false });
        if (!r.success) c = setActor(c, pc.id, { stunned: true, actions: 0 });
      }
    }
    setCombat(c);
    combatRef.current = c;
    if (first && t.onFirstContact) runEffects(t.onFirstContact, apiRef.current, {});
    setTimeout(() => runTurnsUntilPlayer(), 120);
  }, [mod, say, flag, ctxFor, rollNow]);

  const commitCombat = useCallback((c) => { combatRef.current = c; setCombat(c); }, []);

  const enemyTurn = useCallback((uid) => {
    const c = combatRef.current; if (!c) return;
    const enemy = enemyByUid(c, uid);
    if (!enemy || enemy.dead) return;
    const t = mod.threats[enemy.threatId];

    // close the distance if it wants to be in your face
    if (enemy.distance > 2 && (t.melee !== false)) {
      const closed = Math.min(enemy.distance - 2, t.pace ?? 10);
      if (closed > 0) {
        commitCombat(moveToward(combatRef.current, uid, closed));
        say("horror", t.approachText || `${enemy.name} closes to ${Math.max(2, enemy.distance - closed)}m.`);
      }
    }

    const rep = resolveEnemyAttack({ enemy: enemyByUid(combatRef.current, uid), crew: C(), combat: combatRef.current, ctx: ctxFor() });
    if (!rep.ok) return;
    if (rep.distracted) { say("good", rep.text); return; }

    // It already has hold of somebody. Nothing else happens this round.
    if (rep.holding) {
      say("horror", rep.text);
      const r = rollNow({ kind: "save", name: rep.save, pcId: rep.victimId, why: "it has not finished" });
      if (r.success) say("good", rep.onPassText || "You get an arm braced against it and it cannot close any further.");
      else {
        say("dmg", rep.onFailText || "It takes another piece.");
        hurt(evalDice(rep.dmg), "being eaten", rep.victimId);
        queuePanic(rep.victimId, "critHitTaken");
      }
      return;
    }

    say("roll", `${enemy.name} attacks ${rep.victimName} · Combat ${enemy.combat} rolled ${pad(rep.att.value)}  vs  Armor ${rep.armor} rolled ${pad(rep.def.value)}`);
    if (!rep.hit) {
      say("good", t.missText || "Whatever swung missed.");
      if (!rep.def.success) stress(1, "failed Armor Save", rep.victimId);
      return;
    }
    say("horror", (rep.use && rep.use.text) || `${rep.atk.name}.`);
    if (rep.crit) {
      say("panic", "It was a critical.");
      queuePanic(rep.victimId, "critHitTaken");
    }
    hurt(rep.dmg, rep.atk.name.toLowerCase(), rep.victimId);
    for (const eff of rep.effects) {
      if (eff.kind === "save") {
        const r = rollNow({ kind: "save", name: eff.save, pcId: rep.victimId, why: "it is not finished" });
        say(r.success ? "good" : "dmg", r.success ? (eff.onPassText || "tears free") : (eff.onFailText || "it takes another piece"));
        if (!r.success && eff.onFailDmg) hurt(evalDice(eff.onFailDmg), "still feeding", rep.victimId);
      }
      if (eff.kind === "grapple") {
        commitCombat(setEnemy(combatRef.current, uid, { grabbed: rep.victimId }));
        addCondition(t.grapple && t.grapple.condition ? t.grapple.condition : "Held", rep.victimId);
        say("horror", eff.text || `${enemy.name} has hold of ${rep.victimName} and does not intend to let go.`);
        queuePanic(rep.victimId, "critHitTaken");
      }
    }
  }, [mod.threats, ctxFor, say, stress, hurt, rollNow, queuePanic, commitCombat, addCondition]);

  /** Walk the initiative order, resolving enemies, until it is a player's turn. */
  const runTurnsUntilPlayer = useCallback(() => {
    let guard = 0;
    const step = () => {
      let c = combatRef.current;
      if (!c || W().ended) return;
      if (combatOver(c)) { finishCombat(); return; }
      const turn = currentTurn(c);
      if (!turn) { commitCombat(nextTurn(c, C())); return step(); }
      if (turn.side === "pc") {
        const pc = findPc(C(), turn.id);
        const actor = c.actors[turn.id];
        if (!pc || !isAble(pc) || !actor || actor.fled || actor.stunned || actor.actions <= 0) {
          commitCombat(nextTurn(c, C()));
          if (++guard < 60) return step();
          return;
        }
        if (turn.id !== activeRef.current) setActiveId(turn.id);
        say("system", `${pc.name}'s turn — ${actor.actions} action${actor.actions === 1 ? "" : "s"}.`);
        return; // hand control back to the player
      }
      // enemy
      enemyTurn(turn.id);
      commitCombat(nextTurn(combatRef.current, C()));
      if (++guard < 60) setTimeout(step, 220);
    };
    step();
  }, [enemyTurn, commitCombat, say]);

  /** Nothing holds on to anybody once the fighting stops. */
  const releaseAll = useCallback(() => {
    const c = combatRef.current;
    if (!c) return;
    const held = new Set();
    for (const e of c.enemies) {
      if (!e.grabbed) continue;
      const g = (mod.threats[e.threatId] || {}).grapple || {};
      held.add(`${e.grabbed}|${g.condition || "Held"}`);
    }
    if (!held.size) return;
    commitCrew(C().map((pcx) => {
      const mine = [...held].filter((h) => h.split("|")[0] === pcx.id).map((h) => h.split("|")[1]);
      if (!mine.length) return pcx;
      return { ...pcx, conditions: pcx.conditions.filter((n) => !mine.includes(n)) };
    }));
  }, [mod.threats, commitCrew]);

  const finishCombat = useCallback(() => {
    const c = combatRef.current;
    if (!c) return;
    const ids = [...new Set(c.enemies.map((e) => e.threatId))];
    releaseAll();
    setCombat(null); combatRef.current = null;
    for (const id of ids) {
      const t = mod.threats[id];
      setThreat(id, { dead: true });
      flag(`slain:${id}`, true);
      runEffects(t.onSlain || [{ say: `${t.name} stops.`, tone: "good" }], apiRef.current, { name: t.name });
    }
  }, [mod.threats, setThreat, flag, releaseAll]);

  const endPcTurn = useCallback(() => {
    let c = combatRef.current; if (!c) return;
    c = setActor(c, activeRef.current, { actions: 0, aiming: false });
    c = nextTurn(c, C());
    commitCombat(c);
    setTimeout(() => runTurnsUntilPlayer(), 160);
  }, [commitCombat, runTurnsUntilPlayer]);

  const afterAction = useCallback((cost = 1) => {
    let c = combatRef.current; if (!c) return;
    c = spendAction(c, activeRef.current, cost);
    commitCombat(c);
    if (combatOver(c)) { finishCombat(); return; }
    const actor = c.actors[activeRef.current];
    if (actor && actor.actions <= 0) {
      c = nextTurn(c, C());
      commitCombat(c);
      setTimeout(() => runTurnsUntilPlayer(), 160);
    }
  }, [commitCombat, finishCombat, runTurnsUntilPlayer]);

  const attackWith = useCallback((weaponId, targetUid, assistId) => {
    const c = combatRef.current; if (!c) return;
    const pc = P(); const weapon = items[weaponId];
    const enemy = enemyByUid(c, targetUid || c.targetUid);
    if (!pc || !weapon || !enemy) return;

    const fireable = canFire(pc, weaponId, weapon, houseRules);
    if (!fireable.ok) {
      say("system", `${weapon.n} is empty. Reload, or use something else.`);
      return;
    }

    const rep = resolveAttack({ pc, weaponId, weapon, enemy, combat: c, ctx: { ...ctxFor(pc), assist: assistId } });
    if (!rep.ok) { say("system", `${enemy.name} is ${rep.why}.`); return; }

    // spend ammunition
    if (weapon.shots && houseRules.trackAmmoStrictly && !houseRules.lightAmmo) {
      const left = (pc.ammo[weaponId] ?? weapon.shots) - rep.shots;
      patchPc(pc.id, (x) => ({ ...x, ammo: { ...x.ammo, [weaponId]: Math.max(0, left) } }));
      if (weapon.auto) say("system", `${weapon.n} — ${rep.shots} rounds gone. ${Math.max(0, left)} left in the magazine.`);
      else if (left <= 0) say("system", `${weapon.n} — that was the last one.`);
    }
    if (weapon.loud) noise(`${weapon.n} in an enclosed space`);

    const mods = describeModifiers(rep.breakdown);
    say("roll",
      `${pc.name} attacks ${enemy.name} with ${weapon.n} · ${rep.band.band} range · Combat ${rep.target}%` +
      ` rolled ${pad(rep.att.value)}${rep.mode !== "none" ? ` [${rep.mode === "advantage" ? "+" : "−"}]` : ""}` +
      (rep.def ? `  vs  ${enemy.name} ${rep.defTarget} rolled ${pad(rep.def.value)}` : "") +
      (!rep.canSee ? " [unseen — defends with Advantage]" : "") +
      (mods ? `\n   ${mods}` : ""));

    logRoll({ clock: W().clock, who: pc.name, label: `Attack (${weapon.n})`, value: rep.att.value,
      target: rep.target, mode: rep.mode, success: rep.hit, critHit: rep.att.critHit, critFail: rep.att.critFail, margin: rep.att.margin });

    if (assistId) patchPc(assistId, (x) => ({ ...x, lastAssistDay: dayOf(W()) }));

    if (!rep.hit) {
      const t = mod.threats[enemy.threatId];
      say("dmg", rep.att.critFail ? "The swing goes wide and takes your footing with it." : (t.dodgeText || "Nothing. You are aiming at a space where it already isn't."));
      if (rep.att.critFail) queuePanic(pc.id, "critFail");
      commitCombat(setActor(combatRef.current, pc.id, { aimReady: false }));
      afterAction(1);
      return;
    }

    say("good", `HIT — ${rep.dmg} damage${rep.crit ? " (CRITICAL)" : ""}.`);
    for (const eff of rep.effects) if (eff.text) say("horror", eff.text);

    const t = mod.threats[enemy.threatId];
    const { combat: c2, killed } = damageEnemy(combatRef.current, enemy.uid, rep.dmg, t.maxHits, t.maxDmg);
    commitCombat(setActor(c2, pc.id, { aimReady: false }));

    if (killed) {
      say("good", `${enemy.name} stops.`);
      awardXp(1);
      if (combatOver(combatRef.current)) { finishCombat(); return; }
    } else if (t.onHit) {
      runEffects(t.onHit, apiRef.current, { hits: enemyByUid(combatRef.current, enemy.uid).hits, max: t.maxHits ?? 3, name: enemy.name });
    }
    if (t.breaksOff && !killed) {
      say("horror", "It breaks off. You hear it going away, fast.");
      releaseAll();
      setCombat(null); combatRef.current = null;
      setThreat(enemy.threatId, { loc: t.retreatTo || null, retreat: 60 });
      return;
    }
    afterAction(1);
  }, [items, houseRules, ctxFor, say, noise, patchPc, mod.threats, queuePanic, commitCombat, afterAction, finishCombat, awardXp, setThreat, logRoll, releaseAll]);

  const reloadWeapon = useCallback((weaponId) => {
    const pc = P(); const weapon = items[weaponId];
    if (!pc || !weapon) return;
    const { ok, pc: next, why } = doReload(pc, weaponId, weapon);
    if (!ok) { say("system", `No reloads left for the ${weapon.n}.`); return; }
    commitCrew(C().map((c) => (c.id === pc.id ? next : c)));
    const cost = reloadCost(pc);
    say("system", `${pc.name} reloads the ${weapon.n}.${cost === 0 ? " Trained hands — free action." : ""}`);
    if (combatRef.current && cost > 0) afterAction(cost);
  }, [items, say, commitCrew, afterAction]);

  const aim = useCallback(() => {
    const c = combatRef.current; const pc = P(); if (!c || !pc) return;
    commitCombat(setActor(c, pc.id, { aiming: true, aimReady: true, actions: 0 }));
    say("system", `${pc.name} takes the full turn to aim. Advantage on the next shot, if nothing hits them first.`);
    endPcTurn();
  }, [commitCombat, say, endPcTurn]);

  const combatMove = useCallback((dir) => {
    const c = combatRef.current; if (!c) return;
    const next = dir === "close" ? moveToward(c, c.targetUid, MOVE_STEP) : moveAway(c, MOVE_STEP);
    commitCombat(next);
    say("system", dir === "close" ? `You close ${MOVE_STEP}m.` : `You give up ${MOVE_STEP}m of ground.`);
    afterAction(1);
  }, [commitCombat, say, afterAction]);

  const setTarget = useCallback((uid) => {
    const c = combatRef.current; if (!c) return;
    commitCombat({ ...c, targetUid: uid });
  }, [commitCombat]);

  /** Tear free of whatever has hold of you. Costs your whole turn. */
  const escapeGrab = useCallback(() => {
    const c = combatRef.current; const pc = P(); if (!c || !pc) return;
    const enemy = grabberOf(c, pc.id);
    if (!enemy) return;
    const t = mod.threats[enemy.threatId];
    const g = t.grapple || {};
    const rep = resolveEscape({ pc, enemy, ctx: ctxFor(pc) });
    say("roll", `TEAR FREE · ${pc.name} — Strength ${rep.target}% rolled ${pad(rep.att.value)}  vs  ${enemy.name} ${enemy.combat} rolled ${pad(rep.def.value)}` +
      (describeModifiers(rep.breakdown) ? `\n   ${describeModifiers(rep.breakdown)}` : ""));
    if (rep.free) {
      commitCombat(setEnemy(combatRef.current, enemy.uid, { grabbed: null }));
      patchPc(pc.id, (x) => ({ ...x, conditions: x.conditions.filter((n) => n !== (g.condition || "Held")) }));
      say("good", g.escapeText || "You get a boot against it and shove, and it lets go of you.");
      if (g.onEscape) runEffects(g.onEscape, apiRef.current, { name: pc.name });
    } else {
      say("dmg", g.failEscapeText || "You cannot get any leverage. It is not built for you to get leverage.");
      if (g.onFailEscape) runEffects(g.onFailEscape, apiRef.current, { name: pc.name });
    }
    endPcTurn();
  }, [mod.threats, ctxFor, say, commitCombat, patchPc, endPcTurn]);

  const useCounter = useCallback((counterId) => {
    const c = combatRef.current; if (!c) return;
    const enemy = enemyByUid(c, c.targetUid);
    const t = enemy && mod.threats[enemy.threatId];
    const k = t && (t.counters || []).find((x) => x.id === counterId);
    if (!k) return;
    if (k.when && !test(k.when, apiRef.current.ctx())) {
      say("system", k.whenText || "Not with what you are carrying.");
      return;
    }
    say("you", k.say || k.label);
    if (k.roll) {
      const r = check(t[k.roll] ?? 50, "none", { advTieBreak: houseRules.advTieBreak });
      say("roll", `${enemy.name} · ${k.roll} ${t[k.roll]} rolled ${pad(r.value)} — ${r.success ? (k.heldText || "it holds its ground") : (k.brokeText || "it will not be touched by that")}`);
      if (!r.success) {
        runEffects(k.onBreak, apiRef.current, {});
        if (k.endsCombat !== false) { setCombat(null); combatRef.current = null; return; }
      } else runEffects(k.onHold, apiRef.current, {});
    } else runEffects(k.effects, apiRef.current, {});
    if (!W().ended && combatRef.current) afterAction(1);
  }, [mod.threats, say, houseRules, afterAction]);

  const fleeCombat = useCallback(() => {
    const c = combatRef.current; const pc = P(); if (!c || !pc) return;
    const rep = resolveFlee({ pc, combat: c, ctx: ctxFor(pc) });
    say("roll", `FLEE · ${pc.name} — Speed ${rep.target}% rolled ${pad(rep.att.value)}  vs  ${rep.chaser ? rep.chaser.name : "it"} rolled ${pad(rep.def.value)}${describeModifiers(rep.breakdown) ? `\n   ${describeModifiers(rep.breakdown)}` : ""}`);
    if (rep.escaped) {
      say("good", "You get out. You do not look back.");
      commitCombat(setActor(c, pc.id, { fled: true, actions: 0 }));
      const stillIn = C().filter((x) => isAble(x) && !(combatRef.current.actors[x.id] || {}).fled);
      if (!stillIn.length) {
        setCombat(null); combatRef.current = null;
        const exits = visibleExits(mod, W()).filter((e) => mod.rooms[e.to] && !e.gate);
        if (exits[0]) doMove(exits[0], true);
        return;
      }
      endPcTurn();
    } else {
      say("dmg", "It is between you and the door. It was always going to be.");
      afterAction(1);
    }
  }, [ctxFor, say, commitCombat, endPcTurn, afterAction, mod]);

  /* ---------------- movement & rooms ---------------- */
  const describeRoom = useCallback((id, full) => {
    const r = mod.rooms[id]; const st = W();
    say("room", full ? r.look : r.look.split(". ").slice(0, 2).join(". ") + ".");
    const here = npcsIn(mod, st, id);
    if (here.length) say("system", "Present: " + here.map((n) => mod.npcs[n].name).join(", "));
    if (full && r.onFirstEnter) runEffects(r.onFirstEnter, apiRef.current, {});
    if (r.onEnter) runEffects(r.onEnter, apiRef.current, {});
  }, [mod, say]);

  const threatCheckOnEntry = useCallback((roomId) => {
    let st = W();
    if (st.ended || combatRef.current) return;

    // The module gets first refusal: a threat that is actually somewhere
    // should decide for itself, rather than leaving it to a flat percentage.
    if (typeof mod.hooks.onEnterRoom === "function") {
      mod.hooks.onEnterRoom(apiRef.current, { room: roomId, first: !st.visited[roomId] });
      st = W();
      if (st.ended || combatRef.current) return;
    }

    for (const [id, t] of Object.entries(mod.threats)) {
      const s = st.threats[id];
      if (s.dead || s.retreatUntil >= st.clock) continue;
      // Where it actually is beats where the dice might put it.
      if (s.loc === roomId && t.ambushes !== false) {
        say("horror", t.hunts && t.hunts.text ? t.hunts.text : "You are not alone in here.");
        startCombat(id, { surprise: true });
        return;
      }
      if (!t.hunts) continue;
      if (rng() < (t.hunts.chance ?? 0.1)) {
        setThreat(id, { loc: roomId });
        say("horror", t.hunts.text || "There is a smell in here that shouldn't be.");
        startCombat(id, { surprise: true });
        return;
      }
    }
  }, [mod.threats, mod.hooks, setThreat, say, startCombat, rng]);

  const runGate = useCallback((gate) => {
    const pc = P();
    for (const route of gate.routes || []) {
      if (!test(route.when, apiRef.current.ctx())) continue;
      if (route.time) advance(evalDice(route.time));
      if (route.noise) noise(route.noise);
      flag(gate.flag, true);
      say("good", route.text);
      if (route.effects) runEffects(route.effects, apiRef.current, {});
      return true;
    }
    if (gate.roll) {
      const r = rollNow({
        kind: "stat", name: gate.roll.stat || "intellect", skill: gate.roll.skills,
        tags: gate.roll.tags || ["door"], why: gate.roll.label || "the lock",
      });
      advance(evalDice(gate.roll.time || 15));
      say(r.success ? "good" : "system", r.success ? (gate.roll.passText || "It opens.") : (gate.roll.failText || "It does not open."));
      if (r.success) { flag(gate.flag, true); return true; }
    } else say("system", gate.lockedText || "It is locked.");
    return false;
  }, [advance, noise, flag, say, rollNow]);

  const doMove = useCallback((exit, silent) => {
    const st = W();
    if (st.ended) return;
    if (combatRef.current) { say("system", "Not while that is in the room with you. Fight it or run."); return; }

    if (String(exit.to).startsWith("@")) {
      const id = exit.to.slice(1);
      if (exit.confirm && !st.flags[`confirm:${id}`]) {
        flag(`confirm:${id}`, true);
        say("system", typeof exit.confirm === "string" ? exit.confirm : "Choose it again to confirm.");
        return;
      }
      if (exit.effects) { runEffects(exit.effects, apiRef.current, {}); if (W().ended) return; }
      endGame(id);
      return;
    }

    const dest = mod.rooms[exit.to];
    if (!dest) return;
    if (exit.needs && !test(exit.needs, apiRef.current.ctx())) {
      say("system", exit.needsText || "You can't go that way yet.");
      return;
    }
    if (exit.gate && !st.flags[exit.gate.flag] && !runGate(exit.gate)) return;
    if (exit.hidden && !st.flags[exit.hidden]) return;

    advance(exit.mins ?? 5);
    commitW({
      room: exit.to,
      visited: { ...W().visited, [exit.to]: true },
      flags: Object.fromEntries(Object.entries(W().flags).filter(([k]) => !k.startsWith("confirm:"))),
    });
    if (!silent) say("move", `→ ${dest.name}`);
    describeRoom(exit.to, !st.visited[exit.to]);
    threatCheckOnEntry(exit.to);
  }, [mod, advance, commitW, say, describeRoom, threatCheckOnEntry, endGame, flag, runGate]);

  /* ---------------- searching ---------------- */
  const doSearch = useCallback((key) => {
    const st = W(); const f = mod.rooms[st.room].features[key];
    if (!f) return;
    const seenKey = `${st.room}:${key}`;

    if (f.deep && !st.searched[seenKey]) {
      const tries = (st.searched[`${seenKey}#tries`] || 0) + 1;
      advance(15);
      const r = rollNow({ kind: "stat", name: "intellect", skill: f.skills || ["Scavenging"], tags: ["search"], why: f.name });
      const thorough = tries >= 2;
      if (!r.success && !thorough) {
        say("system", "Nothing yet. There is more here if you keep looking.");
        commitW({ searched: { ...W().searched, [`${seenKey}#tries`]: tries } });
        return;
      }
      if (!r.success) say("system", "Nothing, until you go over it a second time.");
    } else advance(f.mins ?? 10);

    commitW({ searched: { ...W().searched, [seenKey]: true } });
    say("search", `${f.name.toUpperCase()} — ${f.d}`);
    if (f.setsFlag) flag(f.setsFlag, true);
    if (f.gives) {
      const fresh = f.gives.filter((i) => !W().taken[i]);
      give(fresh);
      commitW({ taken: { ...W().taken, ...Object.fromEntries(f.gives.map((i) => [i, true])) } });
    }
    if (f.effects) runEffects(f.effects, apiRef.current, {});
  }, [mod, advance, commitW, say, flag, give, rollNow]);

  /* ---------------- items ---------------- */
  const useItem = useCallback((id) => {
    const pc = P(); const it = items[id];
    if (!it || !pc) return;

    const custom = (mod.itemUse || {})[id];
    if (custom) {
      const uses = pc.uses[id] || 0;
      if (it.uses && uses >= it.uses) { say("system", `${it.n} — nothing left.`); return; }
      if (it.uses) patchPc(pc.id, (c) => ({ ...c, uses: { ...c.uses, [id]: uses + 1 } }));
      runEffects(custom, apiRef.current, { name: it.n });
      return;
    }
    if (it.handout) {
      const h = mod.handouts[it.handout];
      if (!h) return;
      if (h.needs && !test(h.needs, apiRef.current.ctx())) { say("system", h.needsText || "You have nothing to play it on."); return; }
      advance(h.mins ?? 10);
      /* A handout used to exist for exactly as long as it took to
         scroll past. It is now filed against the character who opened
         it, so the phone can hand it back as an object and the Warden
         can see who has read what. */
      const held = W().handouts || {};
      const prior = held[it.handout];
      commitW({
        handouts: {
          ...held,
          [it.handout]: {
            id: it.handout,
            first: prior ? prior.first : W().clock,
            by: [...new Set([...(prior ? prior.by : []), pc.id])],
          },
        },
      });
      say("handout", `${h.label}\n\n${h.text}`, { handout: it.handout });
      if (h.effects) runEffects(h.effects, apiRef.current, {});
      return;
    }
    if (it.heal || it.buff || it.calm) {
      const uses = pc.uses[id] || 0;
      if (it.uses && uses >= it.uses) { say("system", `${it.n} — nothing left.`); return; }
      advance(it.mins ?? 5);
      if (it.heal) heal(evalDice(it.heal === true ? "1d10" : it.heal));
      if (it.calm) stress(-it.calm, "the edge comes off");
      if (it.buff) addBuff({ ...it.buff, source: it.buff.source || it.n });
      if (it.addictive && rng() < 0.15) {
        addCondition("Withdrawal risk");
        say("system", "You notice how much you wanted that.");
      }
      patchPc(pc.id, (c) => ({ ...c, uses: { ...c.uses, [id]: uses + 1 } }));
      return;
    }
    if (it.scanner) {
      advance(5);
      const st = W();
      const here = npcsIn(mod, st).length;
      const beast = threatIn(mod, st) ? 1 : 0;
      const crewHere = C().filter(isAble).length;
      say("search", `${it.n.toUpperCase()} · sweep — ${here + beast + crewHere} signs of life in range.${beast ? " One of them is not accounted for and is very close." : ""}`);
      if (beast) stress(1, "the scanner is very sure");
      return;
    }
    say("system", `${it.n} — ${it.d}`);
  }, [items, mod, say, advance, heal, stress, patchPc, addBuff, addCondition, rng]);

  /* ---------------- devices ---------------- */
  const deviceAction = useCallback((deviceId, actionId) => {
    const dev = (mod.devices || {})[deviceId];
    const act = dev && dev.actions.find((a) => a.id === actionId);
    if (!act) return;
    advance(act.mins ?? 5);
    if (act.needs && !test(act.needs, apiRef.current.ctx())) { say("system", act.needsText || "Access denied."); return; }
    runEffects(act.effects, apiRef.current, {});
  }, [mod.devices, advance, say]);

  /* ---------------- talking (offline) ---------------- */
  const askNpc = useCallback((npcId, line) => {
    const n = mod.npcs[npcId]; const st = W();
    if (!n) return;
    say("you", `"${line}"`);
    advance(5);
    const state = st.npcs[npcId];
    const reply = npcReply(n, line, state, rng, st.oracleMemory);
    say("npc", `${n.name}: ${reply.line}`, { npc: npcId });
    const told = reply.topic != null && !state.told.includes(reply.topic)
      ? [...state.told, reply.topic] : state.told;
    commitW({
      npcs: { ...st.npcs, [npcId]: { ...state, met: true, chat: [...state.chat, line], told } },
    });
    if (n.onTold && reply.topic != null && n.onTold[reply.topic])
      runEffects(n.onTold[reply.topic], apiRef.current, {});
  }, [mod.npcs, say, advance, commitW, rng]);

  /* ---------------- the offline Warden ---------------- */
  const doFreeAction = useCallback((text) => {
    const st = W(); const pc = P();
    if (!pc) return;
    say("you", text);

    const ctx = {
      mod, world: st, pc, items,
      npcsHere: npcsIn(mod, st),
      enemiesHere: combatRef.current ? liveEnemies(combatRef.current) : [],
    };
    const intent = parseCommand(text, ctx);

    switch (intent.kind) {
      case "look": {
        advance(2);
        describeRoom(st.room, true);
        const line = atmosphere(mod, mod.rooms[st.room], rng, st.oracleMemory);
        if (line) say("warden", line);
        return;
      }
      case "lookAt": {
        advance(1);
        if (intent.item) say("search", `${items[intent.item].n} — ${items[intent.item].d}`);
        else if (intent.npc) say("search", `${mod.npcs[intent.npc].name}. ${mod.npcs[intent.npc].brief || ""}`);
        else if (intent.enemy) {
          const e = enemyByUid(combatRef.current, intent.enemy);
          const t = e && mod.threats[e.threatId];
          say("search", t ? (t.note || `${e.name}. ${e.distance}m away.`) : "You cannot make it out.");
        }
        return;
      }
      case "search": return doSearch(intent.feature);
      case "searchRoom": {
        const keys = Object.keys(mod.rooms[st.room].features || {});
        if (!keys.length) { say("warden", "There is nothing here worth taking apart."); return; }
        say("system", `Worth a look: ${keys.map((k) => mod.rooms[st.room].features[k].name).join(", ")}.`);
        return;
      }
      case "move": return doMove(intent.exit);
      case "use": return useItem(intent.item);
      case "talk": return setTalking(intent.npc);
      case "attack": {
        if (combatRef.current) {
          const wep = pc.items.find((i) => items[i] && items[i].tag === "WPN");
          if (wep) return attackWith(wep, intent.target ? intent.target.key : null);
          say("system", "You have nothing to fight with.");
          return;
        }
        const tid = threatIn(mod, st);
        if (tid) return startCombat(tid, {});
        say("warden", "There is nothing here to hit that would deserve it.");
        return;
      }
      case "rest": return offerRest({});
      case "listen": {
        advance(30);
        say("search", atmosphere(mod, mod.rooms[st.room], rng, st.oracleMemory) || "Half an hour of nothing.");
        const t = threatIn(mod, st);
        if (t) say("horror", "And under it, close, something that is trying to be quiet.");
        return;
      }
      case "wait": { advance(10); say("warden", atmosphere(mod, mod.rooms[st.room], rng, st.oracleMemory)); return; }
      case "hide": {
        advance(5);
        const r = rollNow({ kind: "stat", name: "speed", tags: ["hide", "stealth"], why: "getting out of sight" });
        say(r.success ? "good" : "system", r.success ? "You find somewhere the light doesn't reach and stop moving." : "There is nowhere in here that is genuinely out of sight.");
        return;
      }
      case "inventory": {
        say("system", `${pc.name} is carrying: ${pc.items.map((i) => items[i].n).join(", ") || "nothing"}. ${pc.credits}cr.`);
        return;
      }
      case "help": {
        say("system",
          "The Warden is a parser, not a chatbot, and it runs entirely on this machine.\n" +
          "Try: LOOK · LOOK AT <thing> · SEARCH <thing> · GO <exit> · USE <item> · TALK TO <person> · " +
          "ATTACK · LISTEN · HIDE · REST · INVENTORY.\n" +
          "Anything it can't parse becomes a question for the oracle.");
        return;
      }
      case "ambiguous": {
        say("system", `Which one — ${intent.options.map((o) => o.name).join(", ")}?`);
        return;
      }
      default: {
        // The oracle. No model, no tokens: a weighted yes/no with teeth.
        const odds = guessOdds(text);
        const o = consultOracle(odds, rng, st.oracleMemory);
        advance(2);
        say("warden", `${o.line}${o.exceptional ? " And it is emphatic about it." : ""}`);
        if (o.complication) say("horror", o.complication);
        say("system", `[oracle · ${odds} · rolled ${o.roll} vs ${o.chance}]`);
        return;
      }
    }
  }, [mod, items, say, advance, describeRoom, doSearch, doMove, useItem, attackWith, startCombat, offerRest, rollNow, rng]);

  /* ---------------- the api handed to effects & hooks ---------------- */
  const apiRef = useRef(null);
  apiRef.current = useMemo(() => ({
    mod, items, houseRules,
    world: W, pc: P, crew: C, rng,
    ctx: () => ({ world: W(), pc: P(), crew: C(), items, mod, houseRules }),
    ended: () => !!W().ended,
    say, flag, give, take, stress, stressCrew, meter, heal, hurt, panic, addCondition, addBuff,
    advance, noise, vanish, rollTable, run, setThreat, setNpc, npcSay, startTrack, awardXp,
    countdown, stopCountdown, offerRest,
    rollNow, ask, startCombat, endGame,
    moveTo: (roomId) => {
      const ex = (mod.rooms[W().room].exits || []).find((e) => e.to === roomId);
      if (ex) doMove(ex);
      else {
        commitW({ room: roomId, visited: { ...W().visited, [roomId]: true } });
        describeRoom(roomId, !W().visited[roomId]);
      }
    },
    effects: (list, vars) => runEffects(list, apiRef.current, vars),
  }), [mod, items, houseRules, rng, say, flag, give, take, stress, stressCrew, meter, heal, hurt, panic,
    addCondition, addBuff, advance, noise, vanish, rollTable, run, setThreat, setNpc, npcSay, startTrack, awardXp,
    countdown, stopCountdown, offerRest, rollNow, ask, startCombat, endGame, doMove, describeRoom, commitW]);

  /* ============================================================
     THE WARDEN LAYER — the interrupt.

     Everything above this line is the module talking: rooms
     describe themselves, NPCs answer from tables, the clock runs
     the horror on rails. That automation is what lets one person
     Warden a table from a laptop, and none of it is being taken
     away.

     What was missing is the human. At a physical table running a
     boxed module the book talks until the person running it
     decides otherwise, and *that decision* is what makes them a
     Game Master rather than a page-turner. This section is the
     software version of picking the microphone back up.

     Two rules hold it together:

       1. Nothing here invents. Every function is a lever onto
          state the engine already owns — no generation, no
          language model, no "the Warden types a wish and the
          computer imagines the rest". The Warden supplies the
          words; the engine only carries them.

       2. Everything here is loud. A Warden edit lands in the feed
          like any other event, because a table where the referee
          can silently change the score is not a game. The one
          exception is `secretly`, for the things RAW says are
          determined secretly — and even those are visible on the
          Warden's own screen.
     ============================================================ */

  /** The Warden narrating in their own words. The one verb the whole
      engine was missing. */
  /* NOT kind "warden". Modules already use that tone for briefing
     text — Ypsilon's intro is written in it — and a Warden's live
     narration must be visually distinct from the module's own voice,
     which is the entire point of the feature. */
  const wardenSay = useCallback((text, tone = "interject") => {
    const t = String(text || "").trim();
    if (!t) return;
    say(tone, t);
  }, [say]);

  /** The Warden speaking *as* an NPC. The module handles what it
      anticipated; this handles everything else, in the Warden's voice
      rather than an invented one. Marked `live` so the feed can show
      that a person said it and not a table. */
  const wardenNpcSay = useCallback((npcId, text) => {
    const n = mod.npcs[npcId];
    const t = String(text || "").trim();
    if (!n || !t) return;
    say("npc", `${n.name}: ${t}`, { npc: npcId, live: true });
    const st = W(); const state = st.npcs[npcId];
    // Speaking to someone counts as having met them, the same as the
    // scripted path — otherwise the Warden's own dialogue leaves the
    // world thinking the crew has never spoken to this person.
    if (state && !state.met) {
      commitW({ npcs: { ...st.npcs, [npcId]: { ...state, met: true } } });
    }
  }, [mod.npcs, say, commitW]);

  /** A line only the Warden's screen carries. For the things RAW
      determines secretly and for the Warden's own notes mid-scene. */
  const wardenNote = useCallback((text) => {
    const t = String(text || "").trim();
    if (!t) return;
    setFeed((f) => [...f, {
      id: ++FEED_ID, kind: "wardennote", text: t, wardenOnly: true, clock: wRef.current.clock,
    }].slice(-400));
  }, []);

  /* ---------------- handing things over ----------------
     `useItem` and the rest resolve through the *active* character,
     and the host makes the sender active before dispatching, so the
     giver is always P(). The receiver is named. */
  const giveItem = useCallback((itemId, toPcId) => {
    const from = P();
    const to = findPc(C(), toPcId);
    const it = items[itemId];
    if (!from || !to || !it || from.id === to.id) return;
    if (!from.items.includes(itemId)) { say("system", `${from.name} isn't carrying that.`); return; }
    if (to.alive === false) { say("system", `${to.name} can't take anything.`); return; }

    /* Ammunition and charges travel with the object, which is the
       whole reason to pass it. A half-empty magazine handed over as a
       full one is the kind of quiet lie that costs a table an hour. */
    const ammo = from.ammo ? from.ammo[itemId] : undefined;
    const spare = from.spare ? from.spare[itemId] : undefined;
    const used = from.uses ? from.uses[itemId] : undefined;

    commitCrew(C().map((c) => {
      if (c.id === from.id) {
        const next = { ...c, items: c.items.filter((i) => i !== itemId) };
        if (next.ammo) { next.ammo = { ...next.ammo }; delete next.ammo[itemId]; }
        if (next.spare) { next.spare = { ...next.spare }; delete next.spare[itemId]; }
        if (next.uses) { next.uses = { ...next.uses }; delete next.uses[itemId]; }
        return next;
      }
      if (c.id === to.id) {
        const next = { ...c, items: [...new Set([...c.items, itemId])] };
        if (ammo !== undefined) next.ammo = { ...next.ammo, [itemId]: ammo };
        if (spare !== undefined) next.spare = { ...next.spare, [itemId]: spare };
        if (used !== undefined) next.uses = { ...next.uses, [itemId]: used };
        return primeAmmo(next, items);
      }
      return c;
    }));
    say("item", `${from.name} hands the ${it.n} to ${to.name}.`);
  }, [items, commitCrew, say]);

  /* ---------------- the override levers ---------------- */

  /** Health and Stress, moved by hand. Both go through the feed. */
  const wardenAdjust = useCallback((pcId, { health = 0, stress: st = 0, why }) => {
    const pc = findPc(C(), pcId);
    if (!pc) return;
    if (health) {
      patchPc(pc.id, (c) => ({
        ...c, health: Math.max(0, Math.min(c.maxHealth, c.health + health)),
      }));
      say(health > 0 ? "good" : "dmg",
        `${pc.name}: ${health > 0 ? "+" : ""}${health} Health${why ? ` — ${why}` : ""}.`);
    }
    if (st) {
      const floor = (pc.conditions || []).includes("Descent into Madness") ? 5 : 0;
      patchPc(pc.id, (c) => ({ ...c, stress: Math.max(floor, c.stress + st) }));
      say(st > 0 ? "stress" : "good",
        `${pc.name}: ${st > 0 ? "+" : ""}${st} Stress${why ? ` — ${why}` : ""}.`);
    }
  }, [patchPc, say]);

  /** Conditions on and off. Secret ones are never announced to the
      table, because secrets.js will refuse to send them anyway and a
      feed line would defeat the whole arrangement. */
  const wardenCondition = useCallback((pcId, cond, on) => {
    const pc = findPc(C(), pcId);
    if (!pc || !cond) return;
    const has = (pc.conditions || []).includes(cond);
    if (on === has) return;
    patchPc(pc.id, (c) => ({
      ...c,
      conditions: on
        ? [...c.conditions, cond]
        : c.conditions.filter((x) => x !== cond),
    }));
    if (SECRET_CONDITIONS.has(cond)) {
      wardenNote(`${pc.name}: ${cond} ${on ? "applied" : "lifted"}. They are not told.`);
      return;
    }
    say(on ? "stress" : "good", `${pc.name} — ${cond} ${on ? "sets in" : "passes"}.`);
  }, [patchPc, say, wardenNote]);

  /** Put something in a character's hands, or take it back out. */
  const wardenItem = useCallback((pcId, itemId, on) => {
    const pc = findPc(C(), pcId);
    const it = items[itemId];
    if (!pc || !it) return;
    if (on) {
      if (pc.items.includes(itemId)) return;
      patchPc(pc.id, (c) => primeAmmo({ ...c, items: [...c.items, itemId] }, items));
      say("item", `${pc.name} now has: ${it.n}.`);
    } else {
      if (!pc.items.includes(itemId)) return;
      patchPc(pc.id, (c) => ({ ...c, items: c.items.filter((i) => i !== itemId) }));
      say("item", `${pc.name} no longer has the ${it.n}.`);
    }
  }, [items, patchPc, say]);

  /** Countdowns: start one by hand, push it, hold it, or kill it. A
      held countdown keeps its remaining minutes and simply stops being
      ticked — see `advance`, which skips anything paused. */
  const wardenCountdown = useCallback((id, op, amount = 5) => {
    const st = W();
    const cds = { ...st.countdowns };
    const cur = cds[id];
    if (op === "start") {
      cds[id] = { left: amount, cfg: (cur && cur.cfg) || { id, minutes: amount } };
      say("system", `${id.toUpperCase()} — ${amount} minutes.`);
    } else if (!cur) return;
    else if (op === "stop") {
      delete cds[id];
      say("system", `${id.toUpperCase()} — stopped.`);
    } else if (op === "pause") {
      cds[id] = { ...cur, paused: !cur.paused };
      wardenNote(`${id.toUpperCase()} ${cds[id].paused ? "held" : "running again"}.`);
    } else if (op === "add") {
      cds[id] = { ...cur, left: Math.max(0, cur.left + amount) };
      wardenNote(`${id.toUpperCase()} now ${cds[id].left}m.`);
    }
    commitW({ countdowns: cds });
  }, [commitW, say, wardenNote]);

  /** Move an NPC, or kill one, without waiting for the routine. */
  const wardenMoveNpc = useCallback((npcId, roomId) => {
    const st = W(); const cur = st.npcs[npcId];
    if (!cur) return;
    commitW({ npcs: { ...st.npcs, [npcId]: { ...cur, loc: roomId } } });
    const where = (mod.rooms[roomId] && mod.rooms[roomId].name) || roomId || "nowhere";
    if (roomId === st.room) say("npc", `${mod.npcs[npcId].name} comes in.`);
    else wardenNote(`${mod.npcs[npcId].name} → ${where}.`);
  }, [commitW, mod.npcs, mod.rooms, say, wardenNote]);

  /** End a fight on the Warden's word. The engine ends combat when
      one side is finished; a table often ends it earlier, because
      the thing walked away or because everyone has had enough. */
  const wardenEndCombat = useCallback((text) => {
    if (!combatRef.current) return;
    setCombat(null); combatRef.current = null;
    say("system", text || "The fight breaks off.");
  }, [say]);

  /** Call for a roll from a named character, in the Warden's own
      words. This is `ask`, addressed — the prompt lands on that
      player's phone and stalls nobody else. */
  const wardenAsk = useCallback((pcId, { kind, name, reason, mode }) => {
    if (!findPc(C(), pcId)) return;
    ask({ kind, name, reason, mode, pcId });
  }, [ask]);

  /** Put a handout in the middle of the table — or take it away. */
  const wardenShowHandout = useCallback((handoutId) => {
    const h = handoutId ? mod.handouts[handoutId] : null;
    commitW({ tableHandout: h ? handoutId : null });
    if (h) say("handout", `${h.label}\n\n${h.text}`, { handout: handoutId, table: true });
  }, [commitW, mod.handouts, say]);

  const warden = useMemo(() => ({
    say: wardenSay,
    note: wardenNote,
    npcSay: wardenNpcSay,
    adjust: wardenAdjust,
    condition: wardenCondition,
    item: wardenItem,
    countdown: wardenCountdown,
    moveNpc: wardenMoveNpc,
    startCombat: (threatId, opts) => startCombat(threatId, opts || {}),
    endCombat: wardenEndCombat,
    ask: wardenAsk,
    showHandout: wardenShowHandout,
  }), [wardenSay, wardenNote, wardenNpcSay, wardenAdjust, wardenCondition, wardenItem,
    wardenCountdown, wardenMoveNpc, startCombat, wardenEndCombat, wardenAsk, wardenShowHandout]);

  /* ---------------- lifecycle ---------------- */
  const begin = useCallback((newCrew, restored) => {
    if (restored) {
      wRef.current = restored.world; setW(restored.world);
      crewRef.current = restored.crew; setCrew(restored.crew);
      activeRef.current = restored.activeId; setActiveId(restored.activeId);
      if (restored.houseRules) setHouseRules(withDefaults(restored.houseRules));
      rngRef.current = makeRng(restored.world.seed);
      for (let i = 0; i < (restored.world.rngCalls || 0); i++) rngRef.current();
      setFeed(restored.feed || []);
      say("system", "— session resumed —");
      return;
    }
    const world = createWorld(mod);
    wRef.current = world; setW(world);
    rngRef.current = makeRng(world.seed);
    const primed = newCrew.map((c) => primeAmmo(c, items));
    crewRef.current = primed; setCrew(primed);
    activeRef.current = primed[0].id; setActiveId(primed[0].id);
    setFeed([]); setCombat(null); setTalking(null); setPending(null);
    setTimeout(() => {
      (mod.intro || []).forEach((line) =>
        typeof line === "string" ? say("room", line) : say(line.tone || "room", line.text));
      describeRoom(mod.start, true);
    }, 60);
  }, [mod, items, say, describeRoom]);

  // autosave
  useEffect(() => {
    if (!crew.length) return;
    const t = setTimeout(() => persist(mod.id, slotName, {
      world: w, crew, activeId, houseRules, feed: feed.slice(-80),
      core: extraRef.current ? extraRef.current() : undefined,
      label: `${mod.title} · ${crew.filter((c) => c.alive !== false).length} alive`,
    }), 700);
    return () => clearTimeout(t);
  }, [w, crew, activeId, feed, mod.id, mod.title, slotName, houseRules]);

  const pc = findPc(crew, activeId);

  return {
    mod, w, crew, pc, activeId, feed, pending, combat, talking, device, resting, levelUp, shopping,
    lastRoll, items, houseRules,
    setTalking, setDevice, setPending, setActiveId, setResting, setLevelUp, setShopping, setHouseRules,
    begin, doMove, doSearch, useItem, deviceAction, askNpc, doFreeAction,
    attackWith, reloadWeapon, aim, combatMove, setTarget, useCounter, fleeCombat, escapeGrab, endPcTurn,
    doRest, offerRest, applyLevel, checkLevelUps,
    addCrewMember,
    pinClue, unpinClue, setClueResolved,
    addMark: addMapMark, removeMark: removeMapMark, whisper,
    /* Handing an object to the player next to you. A player right,
       not a Warden one — it is in PLAYER_ACTIONS. */
    giveItem,
    /* The interrupt layer. Present only on the authoritative game, so
       a phone holding a useRemoteGame simply has no `warden` key and
       the Warden's controls never render there. */
    warden,
    possibleAssists: (target) => possibleAssists(crew, target || pc, dayOf(w)),
    possibleTherapists: (target) => possibleTherapists(crew, target, dayOf(w)),
    buy: (itemId, price) => {
      const p = P(); if (!p || p.credits < price) { say("system", "You can't afford that."); return; }
      patchPc(p.id, (c) => primeAmmo({ ...c, credits: c.credits - price, items: [...new Set([...c.items, itemId])] }, items));
      say("item", `${p.name} buys ${items[itemId].n} for ${price}cr.`);
    },
    sell: (itemId, price) => {
      const p = P(); if (!p) return;
      patchPc(p.id, (c) => ({ ...c, credits: c.credits + price, items: c.items.filter((i) => i !== itemId) }));
      say("item", `${p.name} sells ${items[itemId].n} for ${price}cr.`);
    },
    resolvePending: (extra) => {
      if (!pending) return;
      if (pending.kind === "optStress") {
        const floor = 0;
        patchPc(pending.pcId, (c) => ({ ...c, stress: Math.max(floor, c.stress + (extra.accept ? pending.amount : 0)) }));
        say(extra.accept ? "stress" : "system", extra.accept ? `+${pending.amount} Stress taken.` : "You hold it off. For now.");
        setPending(null);
        return;
      }
      const req = { ...pending.req, ...(extra || {}) };
      const r = rollNow(req);
      setPending(null);
      if (req.effects) runEffects(req.effects, apiRef.current, {});
      return r;
    },
    act: (effects, vars) => runEffects(effects, apiRef.current, vars),
    /* Same thing, but addressed by id instead of by handing over a list
       of effects. Phones can only name an action that already exists in
       the module for the room they are standing in, and its `when` is
       re-tested here, so nothing arrives over the wire that the Warden's
       own screen would not also have offered. */
    runAction: (actionId) => {
      const here = mod.rooms[W().room] || {};
      const a = (mod.actions || []).concat(here.actions || []).find((x) => x && x.id === actionId);
      if (!a) return;
      if (a.when && !test(a.when, apiRef.current.ctx())) { say("system", "Not available."); return; }
      if (a.needs && !test(a.needs, apiRef.current.ctx())) { say("system", a.needsText || "Access denied."); return; }
      runEffects(a.effects, apiRef.current, {});
    },
    api: apiRef.current,
  };
}
