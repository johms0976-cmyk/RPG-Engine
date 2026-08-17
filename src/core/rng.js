/* ============================================================
   RNG — pure, replayable randomness for the headless core.

   The engine's existing makeRng() is a closure: calling it
   mutates hidden state. That is fine inside a React hook but it
   makes a reducer impure, which defeats the whole point of #30.

   So the core carries its randomness *in state* as {seed, n}
   and every draw returns BOTH the value and the next state:

       const [v, rng2] = nextFloat(rng);

   Because the generator is counter-based (a hash of seed and n
   rather than an iterated register), drawing the 4000th number
   costs the same as drawing the first, and a save file only has
   to store two integers to replay a session exactly.
   ============================================================ */

/** splitmix64-flavoured 32-bit hash of (seed, counter). */
function hash(seed, n) {
  let z = (seed ^ Math.imul(n + 1, 0x9e3779b9)) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
  return (z ^ (z >>> 15)) >>> 0;
}

export const makeRngState = (seed = 1) => ({ seed: seed >>> 0, n: 0 });

/** @returns {[number, object]} float in [0,1) and the advanced state. */
export function nextFloat(rng) {
  const v = hash(rng.seed, rng.n) / 4294967296;
  return [v, { seed: rng.seed, n: rng.n + 1 }];
}

/** @returns {[number, object]} integer 1..sides. */
export function rollDie(rng, sides) {
  const [f, r2] = nextFloat(rng);
  return [1 + Math.floor(f * sides), r2];
}

/** Sum of `count` dice. @returns {[number, object]} */
export function rollDice(rng, count, sides) {
  let total = 0, r = rng;
  for (let i = 0; i < count; i++) {
    const [v, r2] = rollDie(r, sides);
    total += v; r = r2;
  }
  return [total, r];
}

/**
 * d% read as two d10s: tens and ones. Doubles are criticals.
 * The separate tens/ones are what the animated reveal (#31) lands
 * one at a time, so the core has to expose them, not just the sum.
 * @returns {[{value:number,tens:number,ones:number,doubles:boolean}, object]}
 */
export function rollPercent(rng) {
  const [a, r1] = nextFloat(rng);
  const [b, r2] = nextFloat(r1);
  const tens = Math.floor(a * 10);
  const ones = Math.floor(b * 10);
  return [{ value: tens * 10 + ones, tens, ones, doubles: tens === ones }, r2];
}

/**
 * Roll under `target` on d%. 00 always succeeds, 99 always fails.
 * @returns {[object, object]} the scored roll and the advanced rng.
 */
export function checkPure(rng, target, mode = "none", tieBreak = "high") {
  const t = Math.max(1, Math.min(99, Math.round(target)));
  const score = (r) => {
    const success = r.value === 0 ? true : r.value === 99 ? false : r.value <= t;
    const crit = r.doubles || r.value === 0 || r.value === 99;
    return {
      ...r, success, crit,
      critHit: crit && success,
      critFail: crit && !success,
      band: crit ? (success ? 3 : 0) : (success ? 2 : 1),
    };
  };

  const [first, r1] = rollPercent(rng);
  if (mode !== "advantage" && mode !== "disadvantage") {
    const s = score(first);
    return [{ ...s, target: t, mode, margin: t - s.value, all: [s] }, r1];
  }

  const [second, r2] = rollPercent(r1);
  const a = score(first), b = score(second);
  const wantBest = mode === "advantage";
  let picked;
  if (a.band !== b.band) picked = (wantBest ? b.band > a.band : b.band < a.band) ? b : a;
  else {
    const preferHigh = wantBest ? tieBreak === "high" : tieBreak === "low";
    picked = (preferHigh ? b.value > a.value : b.value < a.value) ? b : a;
  }
  return [{ ...picked, target: t, mode, margin: t - picked.value, all: [a, b] }, r2];
}

/** Pick one element. @returns {[*, object]} */
export function pick(rng, list) {
  if (!list || !list.length) return [null, rng];
  const [f, r2] = nextFloat(rng);
  return [list[Math.floor(f * list.length)], r2];
}

/** Evaluate "2d10", "1d10+10", "3" etc. purely. @returns {[number, object]} */
export function evalDicePure(rng, expr) {
  if (expr == null) return [0, rng];
  if (typeof expr === "number") return [expr, rng];
  const s = String(expr).trim().toLowerCase();
  const m = s.match(/^(\d*)d(\d+)\s*([+-]\s*\d+)?$/);
  if (!m) {
    const n = parseInt(s, 10);
    return [Number.isFinite(n) ? n : 0, rng];
  }
  const count = m[1] ? parseInt(m[1], 10) : 1;
  const sides = parseInt(m[2], 10);
  const mod = m[3] ? parseInt(m[3].replace(/\s+/g, ""), 10) : 0;
  const [sum, r2] = rollDice(rng, count, sides);
  return [sum + mod, r2];
}

export const seedFrom = (str) => {
  let h = 2166136261;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
