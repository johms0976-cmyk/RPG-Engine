/* ============================================================
   EFFECTS — the little language modules are written in.

   An effect is a plain object. The engine applies the keys it
   knows, in a fixed order, and ignores the rest. A module can
   always drop to JS with { run: "hookName" } instead.

     { say: "text", tone: "horror" }
     { time: 15 }                       advance the clock
     { stress: 1, why: "..." }          negative numbers calm
     { stressCrew: 1 }                  everyone else nearby
     { damage: "2d10", why: "claws" }
     { heal: "1d10" }
     { give: ["keycard"] } / { take: [...] }
     { flag: "knows_water" }            or { flag: { db1_open: true } }
     { noise: "a deliberate racket" }
     { moveTo: "work" }
     { threat: { id: "it", loc: "ante", retreat: 60, distract: 2 } }
     { fight: "it", surprise: true, count: 3, distance: 20 }
     { track: "infection" }             start a timed condition
     { condition: "INFECTED" }
     { meter: { bends: 1 } }
     { npc: { id: "sonya", loc: "mess", mood: 3, say: "..." } }
     { npcSay: { id: "sonya", text: "..." } }
     { whisper: "text" }                only the acting character
     { whisperTo: { who: "alone", text: "..." } }
     { vanish: { id: "rie", text: "{name} is gone." } }
     { table: "artifacts" }             roll and narrate
     { countdown: { id, minutes, tick, onZero: [...] } }
     { end: "win" }
     { save: "sanity", tags: [...], onFail: [...], onPass: [...], onCritFail: [...] }
     { test: "intellect", skill: ["Scavenging"], tags: ["search"], onPass, onFail }
     { ask: { kind: "save", name: "body", reason: "..." } }
     { when: "has:keycard", then: [...], else: [...] }
     { pick: [[3, [...]], [1, [...]]] }  weighted random branch
     { run: "giovanniEncounter" }        module JS hook
     { once: "flagName", then: [...] }   fires a single time, ever
     { panic: true }                     force a Panic Check
     { rest: { quality: "SAFE" } }       offer the rest screen
     { xp: 2 }                           award experience
   ============================================================ */
import { check, evalDice, pad } from "./dice.js";
import { STAT_LABEL } from "./rules.js";

/** Every effect key the engine understands. Used by validation. */
export const EFFECT_KEYS = new Set([
  "say", "tone", "time", "stress", "stressCrew", "why", "damage", "heal", "give", "take",
  "flag", "noise", "moveTo", "threat", "fight", "surprise", "count", "distance",
  "track", "condition", "meter", "vanish", "table", "countdown", "stopCountdown",
  "end", "save", "test", "skill", "tags", "mode", "onPass", "onFail", "onCritFail",
  "onCritHit", "ask", "when", "then", "else", "pick", "run", "once", "panic",
  "rest", "xp", "buff", "target", "npc", "npcSay",
  /* THE PRIVATE CHANNEL.

     `whisper` has been on the game object since the beginning and
     was never on the module API, so there was no way to write "when
     they open the locker, tell *only* the person who opened it" in a
     module. Everything private was either a Warden pressing a button
     or a hardcoded hook. Two keys close that, and they are the
     foundation of the share loop — a secret nobody can be given is a
     secret nobody can choose to keep. */
  "whisper", "whisperTo",
  /* The outside view of something happening to one character —
     see `sayOthers` above and useGame's implementation. */
  "sayOthers",
  /* Optional refinements on `noise`, which is now a persistent
     per-room field rather than a one-shot event. */
  "noiseLevel", "noiseRoom",
]);

/* ---------- predicates ---------- */
/**
 * `cond` may be a function(ctx) or a string of clauses joined by " and ".
 * Clauses:  has:item  tag:water  flag:name  room:id  npc:sonya  threat:it
 *           dead:it   clock>90   meter:bends>=5   crew:marine  !anything
 */
export function test(cond, ctx) {
  if (cond == null || cond === true) return true;
  if (cond === false) return false;
  if (typeof cond === "function") return !!cond(ctx);
  return String(cond).split(" and ").every((clause) => {
    const c = clause.trim();
    if (!c) return true;
    if (c.startsWith("!")) return !test(c.slice(1), ctx);

    const cmp = /^([\w.:]+)\s*(>=|<=|>|<|==)\s*(-?\d+)$/.exec(c);
    if (cmp) {
      const [, path, op, nRaw] = cmp;
      const n = Number(nRaw);
      const v = Number(resolvePath(path, ctx)) || 0;
      return op === ">" ? v > n : op === "<" ? v < n : op === ">=" ? v >= n : op === "<=" ? v <= n : v === n;
    }

    const [key, arg] = c.split(":");
    const { world: w, pc, items, crew = [] } = ctx;
    switch (key) {
      case "has": return !!pc && pc.items.includes(arg);
      case "crewHas": return crew.some((p) => p.alive !== false && p.items.includes(arg));
      case "tag": return !!pc && pc.items.some((i) => items[i] && items[i][arg]);
      case "crewTag": return crew.some((p) => p.alive !== false && p.items.some((i) => items[i] && items[i][arg]));
      case "flag": return !!w.flags[arg];
      case "room": return w.room === arg;
      case "visited": return !!w.visited[arg];
      case "npc": return !!w.npcs[arg] && w.npcs[arg].alive && !w.npcs[arg].taken;
      case "here": return !!w.npcs[arg] && w.npcs[arg].loc === w.room && w.npcs[arg].alive && !w.npcs[arg].taken;
      case "taken": return !!(w.npcs[arg] && w.npcs[arg].taken);
      case "npcAt": {
        const [who, where] = arg.split("@");
        return !!w.npcs[who] && w.npcs[who].alive && !w.npcs[who].taken && w.npcs[who].loc === where;
      }
      case "threat": return !!w.threats[arg] && w.threats[arg].loc === w.room && !w.threats[arg].dead;
      case "threatAt": {
        const [tid, where] = arg.split("@");
        return !!w.threats[tid] && !w.threats[tid].dead && w.threats[tid].loc === where;
      }
      case "dead": return !!(w.threats[arg] && w.threats[arg].dead);
      case "skill": return !!pc && pc.skills.includes(arg);
      case "crewSkill": return crew.some((p) => p.alive !== false && p.skills.includes(arg));
      case "crew": return crew.some((p) => p.alive !== false && p.cls === arg);
      case "condition": return !!pc && pc.conditions.some((x) => x.startsWith(arg));
      default: return !!w.flags[c];
    }
  });
}

function resolvePath(path, ctx) {
  const { world: w, pc } = ctx;
  if (path === "clock") return w.clock;
  if (path === "day") return Math.floor(w.clock / 1440);
  if (path === "stress") return pc ? pc.stress : 0;
  if (path === "health") return pc ? pc.health : 0;
  if (path === "wounds") return pc ? pc.wounds || 0 : 0;
  if (path === "crewAlive") return (ctx.crew || []).filter((p) => p.alive !== false).length;
  if (path.startsWith("meter:")) return pc ? pc.meters[path.slice(6)] || 0 : 0;
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), { world: w, pc });
}

/* ---------- text ---------- */
export const tmpl = (text, vars = {}) =>
  String(text).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));

/* ---------- the interpreter ---------- */
export function runEffects(effects, api, vars = {}) {
  if (!effects) return;
  const list = Array.isArray(effects) ? effects : [effects];
  for (const raw of list) {
    if (!raw) continue;
    if (typeof raw === "string") { api.say("system", tmpl(raw, vars)); continue; }
    if (typeof raw === "function") { raw(api, vars); continue; }
    if (api.ended()) return;

    const e = raw;
    const ctx = api.ctx();

    if (e.when !== undefined) {
      runEffects(test(e.when, ctx) ? e.then : e.else, api, vars);
      continue;
    }
    if (e.once) {
      if (ctx.world.flags[`once:${e.once}`]) continue;
      api.flag(`once:${e.once}`, true);
      runEffects(e.then, api, vars);
      continue;
    }
    if (e.pick) {
      const total = e.pick.reduce((a, [wt]) => a + wt, 0);
      let n = Math.random() * total;
      for (const [wt, sub] of e.pick) { n -= wt; if (n <= 0) { runEffects(sub, api, vars); break; } }
      continue;
    }

    if (e.time) api.advance(evalDice(e.time));
    if (e.say) api.say(e.tone || "system", tmpl(e.say, vars));
    /* THE OUTSIDE VIEW.

       `say` addresses the character the effect is running on. Some
       things are only horror if *somebody else* sees them: the
       infection's first two stages are "you are not thirsty" and
       "your wounds have closed", both private and both pleasant,
       so the table's paranoia engine never started. `sayOthers`
       sends a line to everyone in the room except the subject —
       the same event, from the outside, where it is not pleasant
       at all. See secrets.js `addressedTo`, which already knew how
       to do this; nothing was using it. */
    if (e.sayOthers) api.sayOthers(tmpl(e.sayOthers, vars), e.tone || "horror", e.target);
    if (e.flag !== undefined) {
      if (typeof e.flag === "string") api.flag(e.flag, true);
      else Object.entries(e.flag).forEach(([k, v]) => api.flag(k, v));
    }
    if (e.give) api.give(e.give, e.target);
    if (e.take) api.take(e.take, e.target);
    if (e.stress) api.stress(evalDice(e.stress), tmpl(e.why || "", vars), e.target);
    if (e.stressCrew) api.stressCrew(evalDice(e.stressCrew), tmpl(e.why || "", vars));
    if (e.meter) Object.entries(e.meter).forEach(([k, v]) => api.meter(k, evalDice(v)));
    if (e.heal) api.heal(evalDice(e.heal), e.target);
    if (e.damage) api.hurt(evalDice(e.damage), tmpl(e.why || "", vars), e.target);
    if (e.buff) api.addBuff(e.buff, e.target);
    if (e.condition) api.addCondition(tmpl(e.condition, vars), e.target);
    if (e.track) api.startTrack(e.track, e.target);
    /* `noise` takes an optional level and room now — see useGame's
       noise(). A bare `{ noise: "..." }` behaves exactly as it always
       did, so no existing module content has to change; content that
       wants to be specific about how loud a thing is can say so. */
    if (e.noise) api.noise(tmpl(e.noise, vars), { level: e.noiseLevel, room: e.noiseRoom });
    if (e.threat) api.setThreat(e.threat.id, e.threat);
    if (e.npc) api.setNpc(e.npc.id, { ...e.npc, say: e.npc.say ? tmpl(e.npc.say, vars) : undefined });
    if (e.npcSay) api.npcSay(e.npcSay.id, tmpl(e.npcSay.text, vars), e.npcSay.tone);
    /* Addressed at the moment it is written, so the words never reach
       another phone at all — secrets.js filters on `to` when the
       snapshot is packed. The bare form goes to whoever is acting,
       which is the overwhelmingly common case: you opened it, you saw
       it. `whisperTo` is for the rest. */
    if (e.whisper) api.whisper(null, tmpl(e.whisper, vars));
    if (e.whisperTo) {
      const spec = typeof e.whisperTo === "string" ? { who: e.whisperTo } : e.whisperTo;
      api.whisperTo(spec.who, tmpl(spec.text || e.whisperText || "", vars), spec);
    }
    if (e.vanish) api.vanish(e.vanish);
    if (e.table) api.rollTable(e.table);
    if (e.run) api.run(e.run, vars);
    if (e.countdown) api.countdown(e.countdown);
    if (e.stopCountdown) api.stopCountdown(e.stopCountdown);
    if (e.panic) api.panic();
    if (e.xp) api.awardXp(evalDice(e.xp));
    if (e.rest) api.offerRest(e.rest);

    /* auto-rolled saves and checks */
    if (e.save || e.test) {
      const kind = e.save ? "save" : "stat";
      const name = String(e.save || e.test).toLowerCase();
      const r = api.rollNow({
        kind, name, skill: e.skill, tags: e.tags, mode: e.mode,
        why: tmpl(e.why || "", vars), pcId: e.target,
      });
      if (r.critFail && e.onCritFail) runEffects(e.onCritFail, api, vars);
      else if (r.critHit && e.onCritHit) runEffects(e.onCritHit, api, vars);
      else runEffects(r.success ? e.onPass : e.onFail, api, vars);
    }

    if (e.fight) {
      const id = typeof e.fight === "string" ? e.fight : e.fight.id;
      api.startCombat(id, { surprise: !!e.surprise, count: e.count, distance: e.distance });
    }
    if (e.moveTo) api.moveTo(e.moveTo);
    if (e.ask) api.ask(e.ask);
    if (e.end) api.endGame(e.end);
  }
}

export { pad, check, evalDice, STAT_LABEL };
