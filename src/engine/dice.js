/* ============================================================
   DICE — pure Mothership 0e resolution. No module knowledge.
   ============================================================ */

export const d = (n) => 1 + Math.floor(Math.random() * n);
export const dN = (count, sides) =>
  Array.from({ length: count }, () => d(sides)).reduce((a, b) => a + b, 0);

/** d% : two d10s read as tens + ones, 0-99. Doubles are criticals. */
export function rollPercent() {
  const tens = Math.floor(Math.random() * 10);
  const ones = Math.floor(Math.random() * 10);
  return { value: tens * 10 + ones, tens, ones, doubles: tens === ones };
}

/** Roll under `target`. 00 always crit hit, 99 always crit fail. */
export function check(target, mode = "none") {
  const rolls = mode === "none" ? [rollPercent()] : [rollPercent(), rollPercent()];
  const score = (r) => ({
    ...r,
    success: r.value === 0 ? true : r.value === 99 ? false : r.value <= target,
  });
  const scored = rolls.map(score);

  let picked;
  if (mode === "advantage") {
    const succ = scored.filter((r) => r.success);
    picked = succ.length
      ? succ.reduce((a, b) => (b.value > a.value ? b : a))
      : scored.reduce((a, b) => (b.value < a.value ? b : a));
  } else if (mode === "disadvantage") {
    const fails = scored.filter((r) => !r.success);
    picked = fails.length
      ? fails.reduce((a, b) => (b.value > a.value ? b : a))
      : scored.reduce((a, b) => (b.value < a.value ? b : a));
  } else picked = scored[0];

  const crit = picked.doubles || picked.value === 0 || picked.value === 99;
  return {
    ...picked, target, mode, all: scored, crit,
    critHit: crit && picked.success,
    critFail: crit && !picked.success,
    margin: target - picked.value,
  };
}

/** Opposed roll-under: who wins the contest. */
export function opposed(att, def) {
  if (att.critFail) return false;
  if (def.critFail) return true;
  if (att.critHit && !def.critHit) return true;
  if (def.critHit && !att.critHit) return false;
  if (att.success && !def.success) return true;
  if (!att.success && def.success) return false;
  if (!att.success && !def.success) return false;
  return att.value > def.value;
}

/**
 * Evaluate a dice expression from module data.
 * Accepts: 12 | "2d10" | "d%" | "1d10+2" | "60+1d6*10"
 */
export function evalDice(expr, fallback = 0) {
  if (expr == null) return fallback;
  if (typeof expr === "number") return expr;
  const src = String(expr).trim().toLowerCase();
  if (src === "d%") return rollPercent().value || 100;

  const rolled = src.replace(/(\d*)d(\d+|%)/g, (_, count, sides) =>
    sides === "%" ? String(rollPercent().value || 100) : String(dN(Number(count || 1), Number(sides)))
  );
  if (!/^[\d+\-*/(). ]+$/.test(rolled)) return fallback;
  try {
    // eslint-disable-next-line no-new-func
    const out = Function(`"use strict";return (${rolled})`)();
    return Number.isFinite(out) ? Math.round(out) : fallback;
  } catch {
    return fallback;
  }
}

export const pad = (n) => String(n).padStart(2, "0");
