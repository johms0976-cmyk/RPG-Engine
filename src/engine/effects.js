/* ============================================================
   EFFECTS — the little language modules are written in.

   An effect is a plain object. The engine applies the keys it
   knows, in a fixed order, and ignores the rest. A module can
   always drop to JS with { run: "hookName" } instead.

     { say: "text", tone: "horror" }
     { time: 15 }                       advance the clock
     { stress: 1, why: "…" }            negative numbers calm
     { damage: "2d10", why: "claws" }
     { heal: "1d10" }
     { give: ["keycard"] } / { take: [...] }
     { flag: "knows_water" }            or { flag: { db1_open: true } }
     { noise: "a deliberate racket" }
     { moveTo: "work" }
     { threat: { id: "it", loc: "ante", retreat: 60, distract: 2 } }
     { fight: "it", surprise: true }
     { track: "infection" }             start a timed condition
     { condition: "INFECTED" }
     { meter: { bends: 1 } }
     { vanish: { pool: "crew", text: "{name} is not where {name} should be." } }
     { table: "artifacts" }             roll and narrate
     { countdown: { id, minutes, tick, onZero: [...] } }
 *     { end: "win" }
     { save: "sanity", why: "…", onFail: [...], onPass: [...], onCritFail: [...] }
     { test: "intellect", skill: ["Scavenging"], onPass: [...], onFail: [...] }
     { ask: { kind: "save", name: "body", reason: "…" } }   player presses the button
     { when: "has:keycard", then: [...], else: [...] }
     { pick: [[3, [...]], [1, [...]]] }  weighted random branch
     { run: "giovanniEncounter" }        module JS hook
     { once: "flagName", then: [...] }   fires a single time, ever
   ============================================================ */
import { check, evalDice, pad } from "./dice.js";
import { STAT_LABEL, statValue } from "./rules.js";

/* ---------- predicates ---------- */
/**
 * `cond` may be a function(ctx) or a string of clauses joined by " and ".
 * Clauses:  has:item  tag:water  flag:name  room:id  npc:sonya  threat:it
 *           dead:it   clock>90   meter:bends>=5   !anything
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
    const { world: w, pc, items } = ctx;
    switch (key) {
      case "has": return !!pc && pc.items.includes(arg);
      case "tag": return !!pc && pc.items.some((i) => items[i] && items[i][arg]);
      case "flag": return !!w.flags[arg];
      case "room": return w.room === arg;
      case "visited": return !!w.visited[arg];
      case "npc": return !!w.npcs[arg] && w.npcs[arg].alive && !w.npcs[arg].taken;
      case "here": return !!w.npcs[arg] && w.npcs[arg].loc === w.room && w.npcs[arg].alive && !w.npcs[arg].taken;
      case "threat": return !!w.threats[arg] && w.threats[arg].loc === w.room && !w.threats[arg].dead;
      case "dead": return !!(w.threats[arg] && w.threats[arg].dead);
      case "skill": return !!pc && pc.skills.includes(arg);
      case "condition": return !!pc && pc.conditions.some((x) => x.startsWith(arg));
      default: return !!w.flags[c];
    }
  });
}

function resolvePath(path, ctx) {
  const { world: w, pc } = ctx;
  if (path === "clock") return w.clock;
  if (path === "stress") return pc ? pc.stress : 0;
  if (path === "health") return pc ? pc.health : 0;
  if (path.startsWith("meter:")) return pc ? pc.meters[path.slice(6)] || 0 : 0;
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), { world: w, pc });
}

/* ---------- text ---------- */
export const tmpl = (text, vars = {}) =>
  String(text).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));

/* ---------- the interpreter ---------- */
/**
 * @param {Array|Object} effects
 * @param {Object} api  mutators supplied by useGame
 * @param {Object} vars template variables for {placeholders}
 */
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
    if (e.flag !== undefined) {
      if (typeof e.flag === "string") api.flag(e.flag, true);
      else Object.entries(e.flag).forEach(([k, v]) => api.flag(k, v));
    }
    if (e.give) api.give(e.give);
    if (e.take) api.take(e.take);
    if (e.stress) api.stress(evalDice(e.stress), tmpl(e.why || "", vars));
    if (e.meter) Object.entries(e.meter).forEach(([k, v]) => api.meter(k, evalDice(v)));
    if (e.heal) api.heal(evalDice(e.heal));
    if (e.damage) api.hurt(evalDice(e.damage), tmpl(e.why || "", vars));
    if (e.condition) api.addCondition(tmpl(e.condition, vars));
    if (e.track) api.startTrack(e.track);
    if (e.noise) api.noise(tmpl(e.noise, vars));
    if (e.threat) api.setThreat(e.threat.id, e.threat);
    if (e.vanish) api.vanish(e.vanish);
    if (e.table) api.rollTable(e.table);
    if (e.run) api.run(e.run, vars);
    if (e.countdown) api.countdown(e.countdown);
    if (e.stopCountdown) api.stopCountdown(e.stopCountdown);
    if (e.panic) api.panic();

    /* auto-rolled saves and checks */
    if (e.save || e.test) {
      const kind = e.save ? "save" : "stat";
      const name = String(e.save || e.test).toLowerCase();
      const r = api.rollNow({ kind, name, skill: e.skill, mode: e.mode, why: tmpl(e.why || "", vars) });
      if (r.critFail && e.onCritFail) runEffects(e.onCritFail, api, vars);
      else if (r.critHit && e.onCritHit) runEffects(e.onCritHit, api, vars);
      else runEffects(r.success ? e.onPass : e.onFail, api, vars);
    }

    if (e.fight) api.startCombat(typeof e.fight === "string" ? e.fight : e.fight.id, !!e.surprise);
    if (e.moveTo) api.moveTo(e.moveTo);
    if (e.ask) api.ask(e.ask);
    if (e.end) api.endGame(e.end);
  }
}

export { pad, check, evalDice, STAT_LABEL, statValue };
