/* ============================================================
   useGame — the whole runtime. Reads a module, exposes actions.
   Nothing in this file knows what a "goo" or a "Giovanni" is.
   ============================================================ */
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { check, opposed, evalDice, d, dN, pad } from "./dice.js";
import {
  armorSave, skillBonus, bestSkillBonus, statValue, panicEffect, WAKE_TABLE,
  STAT_KEYS, SAVE_KEYS, STAT_LABEL, skillTier,
} from "./rules.js";
import { createWorld, npcsIn, threatIn, visibleExits } from "./world.js";
import { runEffects, test, tmpl } from "./effects.js";
import { wardenSystem, npcSystem, callWarden } from "./warden.js";
import { save as persist, clear as clearSave } from "./storage.js";

let FEED_ID = 0;

export function useGame(mod, settings = {}) {
  const [pc, setPc] = useState(null);
  const [w, setW] = useState(() => createWorld(mod));
  const [feed, setFeed] = useState([]);
  const [pending, setPending] = useState(null);
  const [combat, setCombat] = useState(null);
  const [talking, setTalking] = useState(null);
  const [device, setDevice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [aiOn, setAiOn] = useState(settings.aiOn !== false);
  const [aiFailed, setAiFailed] = useState(false);
  const [lastRoll, setLastRoll] = useState(null);

  const wRef = useRef(w);
  const pcRef = useRef(pc);
  const combatRef = useRef(combat);
  const W = () => wRef.current;
  const P = () => pcRef.current;
  useEffect(() => { combatRef.current = combat; }, [combat]);

  const commitW = useCallback((patch) => { wRef.current = { ...wRef.current, ...patch }; setW(wRef.current); }, []);
  const commitPc = useCallback((patch) => { pcRef.current = { ...pcRef.current, ...patch }; setPc(pcRef.current); }, []);

  const items = mod.items;

  /* ---------------- feed ---------------- */
  const say = useCallback((kind, text, extra) => {
    if (text == null || text === "") return;
    setFeed((f) => [...f, { id: ++FEED_ID, kind, text: String(text), extra }].slice(-300));
  }, []);

  /* ---------------- primitive mutators ---------------- */
  const flag = useCallback((name, value = true) => {
    commitW({ flags: { ...W().flags, [name]: value } });
  }, [commitW]);

  const give = useCallback((ids) => {
    if (!ids || !ids.length) return;
    const add = ids.filter((i) => items[i] && !P().items.includes(i));
    if (add.length) commitPc({ items: [...P().items, ...add] });
    add.forEach((i) => say("item", `Taken: ${items[i].n}`));
  }, [items, say, commitPc]);

  const take = useCallback((ids) => {
    if (!ids || !ids.length) return;
    commitPc({ items: P().items.filter((i) => !ids.includes(i)) });
  }, [commitPc]);

  const stress = useCallback((n, why) => {
    if (!n || !P()) return;
    commitPc({ stress: Math.max(0, P().stress + n) });
    say(n > 0 ? "stress" : "good", `${n > 0 ? "+" : ""}${n} Stress${why ? ` — ${why}` : ""}.`);
  }, [say, commitPc]);

  const meter = useCallback((key, n) => {
    const def = mod.meters[key];
    if (!def || !P()) return;
    const next = Math.max(0, (P().meters[key] || 0) + n);
    commitPc({ meters: { ...P().meters, [key]: next } });
    say(n > 0 ? "stress" : "good", `${n > 0 ? "+" : ""}${n} ${def.name || key} — now ${next}.`);
  }, [mod.meters, say, commitPc]);

  const heal = useCallback((n) => {
    if (!n || !P()) return;
    commitPc({ health: Math.min(P().maxHealth, P().health + n) });
    say("good", `You recover ${n} Health.`);
  }, [say, commitPc]);

  const addCondition = useCallback((c) => {
    if (!P() || P().conditions.includes(c)) return;
    commitPc({ conditions: [...P().conditions, c] });
  }, [commitPc]);

  const endGame = useCallback((endingId) => {
    if (W().ended) return;
    commitW({ ended: endingId });
    setCombat(null); setTalking(null); setPending(null); setDevice(null);
    clearSave(mod.id);
  }, [commitW, mod.id]);

  /* ---------------- panic ---------------- */
  const panic = useCallback((depth = 0) => {
    const p = P();
    if (!p || W().ended) return;
    const roll = dN(2, 10);
    if (roll > p.stress) {
      say("panic", `PANIC CHECK · 2d10 = ${roll} vs Stress ${p.stress} — you hold it together. −1 Stress.`);
      commitPc({ stress: Math.max(0, p.stress - 1) });
      return;
    }
    const total = Math.max(2, dN(2, 10) + p.stress - p.resolve);
    const eff = panicEffect(total);
    say("panic", `PANIC CHECK · 2d10 = ${roll} vs Stress ${p.stress} — YOU PANIC.\nEffect ${total} → ${eff.name.toUpperCase()}\n${eff.t}`);
    const e = eff.e;
    const patch = { stress: p.stress, conditions: [...p.conditions] };
    if (e.stress) patch.stress += e.stress;
    if (e.stressDice) patch.stress += d(10);
    if (e.phobia) patch.conditions.push("Phobia");
    if (e.floor) { patch.conditions.push("Descent into Madness"); patch.stress = Math.max(5, patch.stress); }
    if (e.adv) patch.conditions.push(`Advantage (${e.adv})`);
    if (e.dis) patch.conditions.push("Rattled — Disadvantage");
    ["cowardice", "hallucinating", "catatonic", "broken", "paranoid", "deathdrive", "psychotic"].forEach((k) => {
      if (e[k]) patch.conditions.push(k[0].toUpperCase() + k.slice(1));
    });
    commitPc(patch);
    if (e.noise) noise("your own scream");
    if (e.end === "dead") endGame(mod.endings.dead ? "dead" : Object.keys(mod.endings)[0]);
    if (e.end === "insane") endGame(mod.endings.insane ? "insane" : "dead");
    if (e.again && depth < 2) { panic(depth + 1); panic(depth + 1); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [say, commitPc, endGame]);

  /* ---------------- damage & death ---------------- */
  const hurt = useCallback((n, why) => {
    const p = P();
    if (!p || n <= 0) return;
    const nh = Math.max(0, p.health - n);
    commitPc({ health: nh });
    say("dmg", `You take ${n} damage${why ? ` — ${why}` : ""}.  Health ${nh}/${p.maxHealth}`);
    if (n > p.maxHealth / 2 && nh > 0) { say("panic", "That was more than half your Health in one hit."); panic(); }
    if (nh > 0) return;

    const r = check(p.saves.body);
    say(r.success ? "rollgood" : "rollbad",
      `DEATH — Body save ${p.saves.body}%, rolled ${pad(r.value)} · ${r.success ? "you fall unconscious" : "you die"}.`);
    if (!r.success) { endGame(mod.endings.dead ? "dead" : Object.keys(mod.endings)[0]); return; }
    const roll = d(10);
    const entry = WAKE_TABLE.find((x) => roll <= x.max);
    say("horror", `UNCONSCIOUS — ${entry.t}`);
    if (roll <= 1) { endGame(mod.endings.coma ? "coma" : "dead"); return; }
    commitPc({ health: 1, stress: P().stress + (roll <= 3 ? d(10) : roll <= 6 ? 3 : roll <= 9 ? 2 : 1) });
    setCombat(null);
    if (mod.hooks.onUnconscious) runEffects(mod.hooks.onUnconscious, apiRef.current, {});
  }, [say, commitPc, panic, endGame, mod]);

  /* ---------------- rolls ---------------- */
  const rollNow = useCallback((req) => {
    const p = P();
    const target = statValue(p, req.kind, req.name, req.skill, items);
    const r = check(target, req.mode || "none");
    const label = `${STAT_LABEL[req.name] || req.name}${req.skill ? ` (${Array.isArray(req.skill) ? req.skill[0] : req.skill})` : ""}`;
    setLastRoll({ ...r, label });
    const tag = r.critHit ? "CRITICAL SUCCESS" : r.critFail ? "CRITICAL FAILURE" : r.success ? "SUCCESS" : "FAILURE";
    say(r.success ? "rollgood" : "rollbad",
      `${req.kind === "save" ? "SAVE" : "CHECK"} — ${label} ${target}%  ·  rolled ${pad(r.value)}${r.mode && r.mode !== "none" ? ` [${r.mode === "advantage" ? "+" : "−"}]` : ""}  ·  ${tag}${req.why ? `  ·  ${req.why}` : ""}`);
    if (req.kind === "save" && !r.success && req.autoStress !== false) stress(1, "failed save");
    if (r.critFail && req.autoPanic !== false) setTimeout(() => panic(), 120);
    return r;
  }, [items, say, stress, panic]);

  const ask = useCallback((req) => {
    if (!req || !req.name) return;
    const name = String(req.name).toLowerCase().trim();
    let kind = req.kind === "save" ? "save" : "stat";
    if (kind === "stat" && !STAT_KEYS.includes(name)) kind = SAVE_KEYS.includes(name) ? "save" : null;
    if (kind === "save" && !SAVE_KEYS.includes(name)) kind = STAT_KEYS.includes(name) ? "stat" : null;
    if (!kind) return;
    const skill = req.skill && skillTier(req.skill) ? req.skill : null;
    const mode = ["advantage", "disadvantage"].includes(req.mode) ? req.mode : "none";
    setPending({ kind, name, skill, mode, reason: req.reason, fromWarden: req.fromWarden, effects: req.effects });
  }, []);

  /* ---------------- noise & threats ---------------- */
  const setThreat = useCallback((id, patch) => {
    const st = W();
    const cur = st.threats[id];
    if (!cur) return;
    const next = { ...cur };
    if (patch.loc !== undefined) next.loc = patch.loc;
    if (patch.retreat !== undefined) next.retreatUntil = st.clock + evalDice(patch.retreat);
    if (patch.distract !== undefined) next.distracted = evalDice(patch.distract);
    if (patch.dead !== undefined) { next.dead = patch.dead; next.loc = null; }
    commitW({ threats: { ...st.threats, [id]: next } });
  }, [commitW]);

  const noise = useCallback((source) => {
    say("horror", `The noise carries — ${source}. Anything that hunts by sound now knows where you are.`);
    const st = W();
    Object.entries(mod.threats).forEach(([id, t]) => {
      if (!t.hearsNoise) return;
      const s = st.threats[id];
      if (s.dead || s.retreatUntil >= st.clock) return;
      if (Math.random() < (t.noiseDraw ?? 0.55)) {
        setThreat(id, { loc: st.room, distract: 2 });
        say("good", t.distractedText || "Something large blunders into a bulkhead nearby and stops. It heard the sound, not you.");
      } else {
        setThreat(id, { loc: st.room });
      }
    });
  }, [say, mod.threats, setThreat]);

  const vanish = useCallback((opts = {}) => {
    const st = W();
    const pool = mod.npcOrder.filter(
      (id) => st.npcs[id] && st.npcs[id].alive && !st.npcs[id].taken && mod.npcs[id].vanishable !== false
    );
    if (!pool.length) return;
    const victim = pool[Math.floor(Math.random() * pool.length)];
    commitW({ npcs: { ...st.npcs, [victim]: { ...st.npcs[victim], taken: true, alive: false } } });
    const name = mod.npcs[victim].name;
    say(opts.tone || "horror", tmpl(opts.text || "{name} is not where {name} should be.", { name }));
    if (opts.stress) stress(evalDice(opts.stress), "another one gone");
  }, [mod, commitW, say, stress]);

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

  /* ---------------- countdowns ---------------- */
  const countdown = useCallback((cfg) => {
    const st = W();
    commitW({ countdowns: { ...st.countdowns, [cfg.id]: { left: evalDice(cfg.minutes), cfg } } });
  }, [commitW]);
  const stopCountdown = useCallback((id) => {
    const st = W();
    const next = { ...st.countdowns }; delete next[id];
    commitW({ countdowns: next });
  }, [commitW]);

  /* ---------------- clock ---------------- */
  const advance = useCallback((mins) => {
    const st = W();
    if (st.ended || !mins) return;
    const clock = st.clock + mins;
    const patch = { clock };

    // threats calm down
    const threats = { ...st.threats };
    let touched = false;
    Object.keys(threats).forEach((id) => {
      if (threats[id].distracted > 0) { threats[id] = { ...threats[id], distracted: Math.max(0, threats[id].distracted - 1) }; touched = true; }
    });
    if (touched) patch.threats = threats;

    // countdowns
    const cds = { ...st.countdowns };
    let expired = null;
    Object.entries(cds).forEach(([id, c]) => {
      const left = c.left - mins;
      if (left <= 0) { expired = c.cfg; delete cds[id]; }
      else { cds[id] = { ...c, left }; say("alarm", tmpl(c.cfg.tick || "{id} · {left} minutes remaining.", { id: id.toUpperCase(), left })); }
    });
    patch.countdowns = cds;

    commitW(patch);
    if (expired) { runEffects(expired.onZero, apiRef.current, {}); if (W().ended) return; }

    // module clocks
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

    tickTracks(clock);
  }, [commitW, say, mod.clocks]);

  /* ---------------- timed condition tracks ---------------- */
  const startTrack = useCallback((id) => {
    const def = mod.tracks[id];
    const p = P();
    if (!def || !p || p.tracks[id]) return;
    const start = W().clock;
    const times = (def.stages || []).map((s) => start + evalDice(s.after ?? 0));
    commitPc({
      tracks: { ...p.tracks, [id]: { start, times, done: [], repeatAt: null } },
      conditions: def.condition && !p.conditions.includes(def.condition) ? [...p.conditions, def.condition] : p.conditions,
    });
  }, [mod.tracks, commitPc]);

  const tickTracks = useCallback((clock) => {
    const p = P();
    if (!p || !p.tracks) return;
    Object.entries(p.tracks).forEach(([id, st]) => {
      const def = mod.tracks[id];
      if (!def) return;
      (def.stages || []).forEach((stage, i) => {
        if (st.done.includes(i) || clock < st.times[i]) return;
        const cur = P();
        cur.tracks[id] = { ...cur.tracks[id], done: [...cur.tracks[id].done, i] };
        if (stage.repeat) cur.tracks[id].repeatAt = clock;
        commitPc({ tracks: { ...cur.tracks } });
        runEffects(stage.effects, apiRef.current, {});
      });
      const cur = P();
      const t = cur.tracks[id];
      if (t && t.repeatAt != null) {
        const stage = def.stages.find((s) => s.repeat);
        if (stage && clock >= t.repeatAt + evalDice(stage.repeat.every)) {
          cur.tracks[id] = { ...t, repeatAt: clock };
          commitPc({ tracks: { ...cur.tracks } });
          runEffects(stage.repeat.effects, apiRef.current, {});
        }
      }
    });
  }, [mod.tracks, commitPc]);

  /* ---------------- combat ---------------- */
  const startCombat = useCallback((threatId, surprise) => {
    const st = W(); const p = P();
    const t = mod.threats[threatId];
    if (!t || !p || st.ended) return;
    const first = !st.flags[`met:${threatId}`];
    if (first) flag(`met:${threatId}`, true);
    if (t.onSighted) say("horror", t.onSighted);
    setCombat({ threatId, round: 1, stunned: false });

    if (surprise) {
      const r = check(p.saves.fear);
      say(r.success ? "rollgood" : "rollbad",
        `SURPRISE — Fear save ${p.saves.fear}%, rolled ${pad(r.value)} · ${r.success ? "you react in time" : "you freeze for a round"}.`);
      if (!r.success) { stress(1, "surprised"); setCombat((c) => c && { ...c, stunned: true }); }
      if (r.critFail) panic();
    }
    if (first && t.onFirstContact) runEffects(t.onFirstContact, apiRef.current, {});
  }, [mod.threats, say, flag, stress, panic]);

  const threatTurn = useCallback(() => {
    const c = combatRef.current; const st = W(); const p = P();
    if (!c || !p || st.ended) return;
    const t = mod.threats[c.threatId];
    const state = st.threats[c.threatId];
    if (state.distracted > 0) {
      say("good", t.searchingText || "It is casting around for the sound. It has lost you for a moment.");
      setThreat(c.threatId, { distract: state.distracted - 1 });
      return;
    }
    const attacks = t.attacks || [{ name: "Attack", dmg: "1d10" }];
    const total = attacks.reduce((a, x) => a + (x.weight ?? 1), 0);
    let pick = Math.random() * total, atk = attacks[0];
    for (const a of attacks) { pick -= (a.weight ?? 1); if (pick <= 0) { atk = a; break; } }

    const armor = armorSave(p, items);
    const att = check(t.combat);
    const def = check(armor);
    say("roll", `${t.name} attacks · Combat ${t.combat} rolled ${pad(att.value)}  vs  your Armor ${armor} rolled ${pad(def.value)}`);

    if (!opposed(att, def)) {
      say("good", t.missText || "Whatever swung at you missed.");
      if (!def.success) stress(1, "failed Armor save");
      return;
    }
    const crit = att.critHit && atk.crit;
    const use = crit ? atk.crit : atk;
    say("horror", use.text || `${atk.name}.`);
    hurt(evalDice(use.dmg || atk.dmg), atk.name.toLowerCase());
    if (use.save) {
      const r = check(p.saves[use.save]);
      say(r.success ? "rollgood" : "rollbad",
        `${use.save.toUpperCase()} save ${p.saves[use.save]}%, rolled ${pad(r.value)} · ${r.success ? (use.onPassText || "you tear free") : (use.onFailText || "it takes another piece")}`);
      if (!r.success && use.onFailDmg) hurt(evalDice(use.onFailDmg), "still feeding");
    }
  }, [mod.threats, items, say, stress, hurt, setThreat]);

  const endTurn = useCallback(() => {
    setTimeout(() => {
      threatTurn();
      setCombat((c) => c && { ...c, round: c.round + 1, stunned: false });
    }, 260);
  }, [threatTurn]);

  const attackWith = useCallback((wid) => {
    const c = combatRef.current; if (!c) return;
    const p = P(); const it = items[wid];
    const t = mod.threats[c.threatId];
    const st = W();
    const sk = it.melee ? "Close-Quarters Combat" : "Firearms";
    const bonus = bestSkillBonus(p, [sk, "Weapon Specialization"]);
    const target = Math.min(99, p.stats.combat + bonus);
    const att = check(target);

    const canSee = !t.unseen || (t.seenWith && p.items.some((i) => items[i] && items[i][t.seenWith]));
    const defMode = st.threats[c.threatId].distracted > 0 ? "disadvantage" : (canSee ? "none" : "advantage");
    const def = check(t.combat, defMode);

    say("roll", `You attack with ${it.n} · Combat ${target}${bonus ? ` (+${bonus} ${sk})` : ""} rolled ${pad(att.value)}  vs  ${t.name} ${t.combat} rolled ${pad(def.value)}${defMode === "advantage" ? " [unseen — defends with Advantage]" : ""}`);

    if (it.shots) {
      const used = (p.uses[wid] || 0) + 1;
      commitPc({ uses: { ...p.uses, [wid]: used } });
      if (used >= it.shots) say("system", `${it.n} — last shot fired. Empty.`);
    }
    if (it.loud) noise(`${it.n} in an enclosed space`);

    if (!opposed(att, def)) {
      say("dmg", att.critFail ? "You swing hard at nothing at all and lose your footing." : (t.dodgeText || "Nothing. You are aiming at a space where it already isn't."));
      if (att.critFail) panic();
      endTurn();
      return;
    }

    const dmg = evalDice(it.dmg || "1d10") * (att.critHit ? 2 : 1);
    say("good", `HIT — ${dmg} damage${att.critHit ? " (critical)" : ""}.`);
    const cur = W().threats[c.threatId];
    const hits = cur.hits + 1;
    const totalDmg = cur.dmg + dmg;
    commitW({ threats: { ...W().threats, [c.threatId]: { ...cur, hits, dmg: totalDmg } } });

    if (hits >= (t.maxHits ?? 3) || totalDmg >= (t.maxDmg ?? 999)) {
      setThreat(c.threatId, { dead: true });
      flag(`slain:${c.threatId}`, true);
      setCombat(null);
      runEffects(t.onSlain || [{ say: `${t.name} stops.`, tone: "good" }], apiRef.current, { name: t.name });
      return;
    }
    if (t.onHit) runEffects(t.onHit, apiRef.current, { hits, max: t.maxHits ?? 3 });
    if (t.breaksOff) { setCombat(null); return; }
    endTurn();
  }, [items, mod.threats, say, commitPc, commitW, noise, panic, endTurn, setThreat, flag]);

  const useCounter = useCallback((counterId) => {
    const c = combatRef.current; if (!c) return;
    const t = mod.threats[c.threatId];
    const k = (t.counters || []).find((x) => x.id === counterId);
    if (!k) return;
    say("you", k.say || k.label);
    if (k.roll) {
      const r = check(t[k.roll] ?? 50);
      say("roll", `${t.name} · ${k.roll} ${t[k.roll]} rolled ${pad(r.value)} — ${r.success ? (k.heldText || "it holds its ground") : (k.brokeText || "it will not be touched by that")}`);
      if (!r.success) { runEffects(k.onBreak, apiRef.current, {}); if (k.endsCombat !== false) setCombat(null); return; }
      runEffects(k.onHold, apiRef.current, {});
    } else {
      runEffects(k.effects, apiRef.current, {});
    }
    if (!W().ended) endTurn();
  }, [mod.threats, say, endTurn]);

  const fleeCombat = useCallback(() => {
    const c = combatRef.current; if (!c) return;
    const p = P(); const t = mod.threats[c.threatId];
    const enc = p.items.some((i) => items[i] && items[i].vacc) ? "disadvantage" : "none";
    const att = check(p.stats.speed, enc);
    const def = check(t.speed ?? 40);
    say("roll", `FLEE · your Speed ${p.stats.speed} rolled ${pad(att.value)}  vs  ${t.name} rolled ${pad(def.value)}`);
    if (opposed(att, def)) {
      say("good", t.fleeText || "You get out. You do not look back.");
      setCombat(null);
      const exits = visibleExits(mod, W()).filter((e) => mod.rooms[e.to] && !e.locked);
      if (exits[0]) doMove(exits[0], true);
    } else {
      say("dmg", t.blockText || "It is between you and the door. It was always going to be.");
      endTurn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mod, items, say, endTurn]);

  /* ---------------- movement ---------------- */
  const describeRoom = useCallback((id, full) => {
    const r = mod.rooms[id]; const st = W();
    say("room", full ? r.look : r.look.split(". ").slice(0, 2).join(". ") + ".");
    const here = npcsIn(mod, st, id);
    if (here.length) say("system", "Present: " + here.map((n) => mod.npcs[n].name).join(", "));
    if (full && r.onFirstEnter) runEffects(r.onFirstEnter, apiRef.current, {});
    if (r.onEnter) runEffects(r.onEnter, apiRef.current, {});
  }, [mod, say]);

  const threatCheckOnEntry = useCallback((roomId) => {
    const st = W();
    if (st.ended) return;
    for (const [id, t] of Object.entries(mod.threats)) {
      const s = st.threats[id];
      if (!t.hunts || s.dead || s.retreatUntil >= st.clock) continue;
      if (Math.random() < (t.hunts.chance ?? 0.1)) {
        setThreat(id, { loc: roomId });
        say("horror", t.hunts.text || "There is a smell in here that shouldn't be.");
        startCombat(id, true);
        return;
      }
    }
  }, [mod.threats, setThreat, say, startCombat]);

  const doMove = useCallback((exit, silent) => {
    const st = W(); const p = P();
    if (st.ended) return;

    if (String(exit.to).startsWith("@")) {          // an exit straight to an ending
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
    if (exit.gate && !st.flags[exit.gate.flag]) {
      const opened = runGate(exit.gate);
      if (!opened) return;
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mod, advance, commitW, say, describeRoom, threatCheckOnEntry, endGame, flag]);

  /** A locked door with several ways through it, all described in module data. */
  const runGate = useCallback((gate) => {
    const st = W(); const p = P();
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
      const bonus = (gate.roll.bonusIf || []).reduce(
        (a, b) => a + (test(b.when, apiRef.current.ctx()) ? b.bonus : 0), 0);
      const r = check(Math.min(99, p.stats[gate.roll.stat || "intellect"] + bonus + bestSkillBonus(p, gate.roll.skills || [])));
      say(r.success ? "rollgood" : "rollbad",
        `${(gate.roll.label || "LOCK").toUpperCase()} · ${gate.roll.stat || "intellect"}${bonus ? ` +${bonus}` : ""} rolled ${pad(r.value)} — ${r.success ? (gate.roll.passText || "it opens") : (gate.roll.failText || "it does not open")}`);
      advance(evalDice(gate.roll.time || 15));
      if (r.success) { flag(gate.flag, true); return true; }
      if (r.critFail) panic();
    } else {
      say("system", gate.lockedText || "It is locked.");
    }
    return false;
  }, [advance, noise, flag, say, panic]);

  /* ---------------- searching ---------------- */
  const doSearch = useCallback((key) => {
    const st = W(); const p = P();
    const f = mod.rooms[st.room].features[key];
    if (!f) return;
    const seenKey = `${st.room}:${key}`;

    if (f.deep && !st.searched[seenKey]) {
      const tries = (st.searched[`${seenKey}#tries`] || 0) + 1;
      advance(15);
      const r = check(Math.min(99, p.stats.intellect + bestSkillBonus(p, f.skills || ["Scavenging"])));
      const thorough = tries >= 2;
      say(r.success || thorough ? "rollgood" : "rollbad",
        `SEARCH · Intellect rolled ${pad(r.value)} — ${r.success ? "you find it" : thorough ? "nothing, until you go over it a second time" : "nothing yet. There is more here if you keep looking."}`);
      if (!r.success && !thorough) {
        commitW({ searched: { ...W().searched, [`${seenKey}#tries`]: tries } });
        if (r.critFail) panic();
        return;
      }
    } else {
      advance(f.mins ?? 10);
    }

    commitW({ searched: { ...W().searched, [seenKey]: true } });
    say("search", `${f.name.toUpperCase()} — ${f.d}`);
    if (f.setsFlag) flag(f.setsFlag, true);
    if (f.gives) {
      const fresh = f.gives.filter((i) => !W().taken[i]);
      give(fresh);
      commitW({ taken: { ...W().taken, ...Object.fromEntries(f.gives.map((i) => [i, true])) } });
    }
    if (f.effects) runEffects(f.effects, apiRef.current, {});
  }, [mod, advance, commitW, say, flag, give, panic]);

  /* ---------------- items ---------------- */
  const useItem = useCallback((id) => {
    const p = P(); const it = items[id];
    if (!it) return;

    const custom = (mod.itemUse || {})[id];
    if (custom) {
      const uses = p.uses[id] || 0;
      if (it.uses && uses >= it.uses) { say("system", `${it.n} — nothing left.`); return; }
      if (it.uses) commitPc({ uses: { ...p.uses, [id]: uses + 1 } });
      runEffects(custom, apiRef.current, { name: it.n });
      return;
    }
    if (it.handout) {
      const h = mod.handouts[it.handout];
      if (!h) return;
      if (h.needs && !test(h.needs, apiRef.current.ctx())) { say("system", h.needsText || "You have nothing to play it on."); return; }
      advance(h.mins ?? 10);
      say("handout", `${h.label}\n\n${h.text}`);
      if (h.effects) runEffects(h.effects, apiRef.current, {});
      return;
    }
    if (it.heal) {
      const uses = p.uses[id] || 0;
      if (it.uses && uses >= it.uses) { say("system", `${it.n} — nothing left.`); return; }
      advance(10);
      heal(evalDice(it.heal === true ? "1d10" : it.heal));
      if (it.calm) stress(-it.calm, "the edge comes off");
      commitPc({ uses: { ...P().uses, [id]: uses + 1 } });
      return;
    }
    if (it.scanner) {
      advance(5);
      const st = W();
      const here = npcsIn(mod, st).length;
      const beast = threatIn(mod, st) ? 1 : 0;
      say("search", `${it.n.toUpperCase()} · sweep — ${here + beast + 1} signs of life in range.${beast ? " One of them is not accounted for and is very close." : ""}`);
      if (beast) stress(1, "the scanner is very sure");
      return;
    }
    say("system", `${it.n} — ${it.d}`);
  }, [items, mod, say, advance, heal, stress, commitPc]);

  /* ---------------- devices (terminals, consoles) ---------------- */
  const deviceAction = useCallback((deviceId, actionId) => {
    const dev = (mod.devices || {})[deviceId];
    const act = dev && dev.actions.find((a) => a.id === actionId);
    if (!act) return;
    advance(act.mins ?? 5);
    if (act.needs && !test(act.needs, apiRef.current.ctx())) {
      say("system", act.needsText || "Access denied.");
      return;
    }
    runEffects(act.effects, apiRef.current, {});
  }, [mod.devices, advance, say]);

  /* ---------------- talking ---------------- */
  const askScripted = useCallback((npcId, line) => {
    const n = mod.npcs[npcId]; const st = W();
    say("you", `"${line}"`);
    advance(5);
    const idx = Math.min(n.knows.length - 1, st.npcs[npcId].chat.length || 0);
    const reply = n.knows[idx] || "They don't have anything else for you.";
    say("npc", `${n.name}: ${reply}`, { npc: npcId });
    commitW({ npcs: { ...st.npcs, [npcId]: { ...st.npcs[npcId], met: true, chat: [...st.npcs[npcId].chat, line] } } });
  }, [mod.npcs, say, advance, commitW]);

  const askFree = useCallback(async (npcId, line) => {
    const n = mod.npcs[npcId]; const st = W(); const p = P();
    if (!aiOn) { askScripted(npcId, line); return; }
    say("you", `"${line}"`);
    advance(5);
    commitW({ npcs: { ...st.npcs, [npcId]: { ...st.npcs[npcId], met: true, chat: [...st.npcs[npcId].chat, line] } } });
    setBusy(true);
    try {
      const missing = mod.npcOrder.filter((x) => W().npcs[x].taken).map((x) => mod.npcs[x].name);
      const ctx = `CHARACTER: ${n.name}, ${n.role}.
PERSONALITY: ${n.persona}
THEY KNOW (use only this):
${n.knows.map((k) => "- " + k).join("\n")}
CURRENT SITUATION: You are in ${mod.rooms[st.room].name}. Elapsed: ${Math.floor(st.clock / 60)}h${st.clock % 60}m. Unaccounted for: ${missing.join(", ") || "nobody"}.
${n.note ? `IMPORTANT: ${n.note}` : ""}
${p ? `The person speaking to you is ${p.name}, a ${p.cls}.` : ""}

They say to you: ${line}`;
      const out = await callWarden(npcSystem(mod), ctx, { maxTokens: 400, ...settings.api });
      say("npc", `${n.name}: ${out.line}`, { npc: npcId, mood: out.mood });
      if (out.reveals) say("system", `Noted: ${out.reveals}`);
    } catch {
      setAiFailed(true);
      askScripted(npcId, line);
    }
    setBusy(false);
  }, [mod, aiOn, say, advance, commitW, askScripted, settings.api]);

  /* ---------------- freeform action ---------------- */
  const doFreeAction = useCallback(async (text) => {
    const st = W(); const p = P();
    say("you", text);
    if (!aiOn) {
      say("system", "The Warden is offline. Use the listed actions — move, look, talk, and your equipment cover everything the module needs.");
      return;
    }
    setBusy(true);
    try {
      const r = mod.rooms[st.room];
      const here = npcsIn(mod, st).map((n) => mod.npcs[n].name);
      const tId = threatIn(mod, st);
      const ctx = `LOCATION: ${r.name}
WHAT IS IN THE ROOM: ${r.look}
NOTABLE OBJECTS: ${Object.values(r.features || {}).map((f) => f.name).join(", ")}
PEOPLE PRESENT: ${here.length ? here.join(", ") : "nobody"}
THREATS: ${tId ? `${mod.threats[tId].name} IS IN THIS ROOM RIGHT NOW` : "none in this room"}
PLAYER: ${p.name}, ${p.cls}. Health ${p.health}/${p.maxHealth}, Stress ${p.stress}. Skills: ${p.skills.join(", ") || "none"}. Carrying: ${p.items.map((i) => items[i].n).join(", ")}.
KNOWN TO THE PLAYER: ${Object.keys(st.flags).filter((f) => st.flags[f] && !f.includes(":")).join(", ") || "nothing yet"}
ELAPSED: ${Math.floor(st.clock / 60)}h${st.clock % 60}m

PLAYER ACTION: ${text}`;
      const out = await callWarden(wardenSystem(mod), ctx, { maxTokens: 600, ...settings.api });
      say("warden", out.narration);
      advance(5);
      const eff = out.effects || {};
      if (eff.stress) stress(eff.stress, "the Warden says so");
      if (eff.health < 0) hurt(Math.abs(eff.health));
      else if (eff.health > 0) heal(eff.health);
      if (eff.noise) noise("what you just did");
      (eff.flags || []).forEach((f) => flag(String(f), true));
      if (eff.moveTo && mod.rooms[eff.moveTo]) {
        const ex = (mod.rooms[st.room].exits || []).find((e) => e.to === eff.moveTo);
        if (ex) doMove(ex);
      }
      if (out.check) ask({ ...out.check, fromWarden: true });
    } catch {
      setAiFailed(true);
      say("system", "The Warden isn't answering. Everything the module needs is on the buttons: move, look, talk, and your equipment.");
    }
    setBusy(false);
  }, [mod, items, aiOn, say, advance, stress, hurt, heal, noise, flag, doMove, ask, settings.api]);

  /* ---------------- the api handed to effects & hooks ---------------- */
  const apiRef = useRef(null);
  apiRef.current = useMemo(() => ({
    mod, items,
    world: W, pc: P,
    ctx: () => ({ world: W(), pc: P(), items, mod }),
    ended: () => !!W().ended,
    say, flag, give, take, stress, meter, heal, hurt, panic, addCondition,
    advance, noise, vanish, rollTable, run, setThreat, startTrack,
    countdown, stopCountdown,
    rollNow, ask, startCombat, endGame,
    moveTo: (roomId) => {
      const ex = (mod.rooms[W().room].exits || []).find((e) => e.to === roomId);
      if (ex) doMove(ex); else {
        commitW({ room: roomId, visited: { ...W().visited, [roomId]: true } });
        describeRoom(roomId, !W().visited[roomId]);
      }
    },
    effects: (list, vars) => runEffects(list, apiRef.current, vars),
  }), [mod, items, say, flag, give, take, stress, meter, heal, hurt, panic, addCondition,
    advance, noise, vanish, rollTable, run, setThreat, startTrack, countdown, stopCountdown,
    rollNow, ask, startCombat, endGame, doMove, describeRoom, commitW]);

  /* ---------------- lifecycle ---------------- */
  const begin = useCallback((character, restored) => {
    if (restored) {
      wRef.current = restored.world; setW(restored.world);
      pcRef.current = restored.pc; setPc(restored.pc);
      setFeed(restored.feed || []);
      say("system", "— session resumed —");
      return;
    }
    const world = createWorld(mod);
    wRef.current = world; setW(world);
    pcRef.current = character; setPc(character);
    setFeed([]); setCombat(null); setTalking(null); setPending(null);
    setTimeout(() => {
      (mod.intro || []).forEach((line) =>
        typeof line === "string" ? say("room", line) : say(line.tone || "room", line.text));
      describeRoom(mod.start, true);
    }, 60);
  }, [mod, say, describeRoom]);

  // autosave
  useEffect(() => {
    if (!pc || w.ended) return;
    const t = setTimeout(() => persist(mod.id, { world: w, pc, feed: feed.slice(-60) }), 800);
    return () => clearTimeout(t);
  }, [w, pc, feed, mod.id]);

  return {
    // state
    mod, w, pc, feed, pending, combat, talking, device, busy, aiOn, aiFailed, lastRoll, items,
    // setters the UI needs
    setTalking, setDevice, setAiOn, setPending,
    // actions
    begin, doMove, doSearch, useItem, deviceAction, askScripted, askFree, doFreeAction,
    attackWith, useCounter, fleeCombat, endTurn,
    resolvePending: (req) => {
      const r = rollNow(req);
      setPending(null);
      if (req.effects) runEffects(req.effects, apiRef.current, {});
      if (req.fromWarden && aiOn) {
        const outcome = r.critHit ? "CRITICAL SUCCESS" : r.critFail ? "CRITICAL FAILURE" : r.success ? "success" : "failure";
        setBusy(true);
        callWarden(wardenSystem(mod),
          `LOCATION: ${mod.rooms[W().room].name}\nThe player rolled a ${outcome} on the ${STAT_LABEL[req.name]} ${req.kind}. Narrate only what happens as a result, in two or three sentences. Set "check" to null.`,
          { maxTokens: 400, ...settings.api })
          .then((o) => say("warden", o.narration))
          .catch(() => setAiFailed(true))
          .finally(() => setBusy(false));
      }
      return r;
    },
    act: (effects, vars) => runEffects(effects, apiRef.current, vars),
    api: apiRef.current,
  };
}
