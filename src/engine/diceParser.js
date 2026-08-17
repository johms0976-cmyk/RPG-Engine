/* ============================================================
   DICE PARSER — a real recursive-descent parser for dice
   expressions. Replaces the old `new Function()` evaluator, so
   module data can never execute arbitrary code. This is what
   makes JSON-authored and user-submitted modules safe.

   Grammar:
     expr    := term (("+"|"-") term)*
     term    := unary (("*"|"/") unary)*
     unary   := "-" unary | atom
     atom    := NUMBER | DICE | "(" expr ")"
     DICE    := [count] "d" ( NUMBER | "%" ) [ "x" NUMBER ]

   Mothership notation supported:
     2d10      roll two d10 and sum
     d%        percentile, 0-99 (00 reads as 100 for damage)
     2d10x10   the underlined d10 of the rulebook: roll, then x10
     1d10+2, 60+1d6*10, (2d10)*2, -1d10
   ============================================================ */

const isDigit = (c) => c >= "0" && c <= "9";

class Parser {
  constructor(src, rng) {
    this.s = String(src).toLowerCase().replace(/\s+/g, "");
    this.i = 0;
    this.rng = rng || Math.random;
    this.rolls = [];
  }
  peek() { return this.s[this.i]; }
  eat(c) { if (this.s[this.i] === c) { this.i++; return true; } return false; }

  d(sides) {
    const v = 1 + Math.floor(this.rng() * sides);
    this.rolls.push({ sides, value: v });
    return v;
  }
  percent() {
    const tens = Math.floor(this.rng() * 10);
    const ones = Math.floor(this.rng() * 10);
    const v = tens * 10 + ones;
    this.rolls.push({ sides: "%", value: v, tens, ones });
    return v === 0 ? 100 : v; // 00 is 100 when used as a damage value
  }

  number() {
    let start = this.i;
    while (isDigit(this.peek())) this.i++;
    if (start === this.i) throw new Error(`expected a number at ${this.i}`);
    return Number(this.s.slice(start, this.i));
  }

  atom() {
    if (this.eat("(")) {
      const v = this.expr();
      if (!this.eat(")")) throw new Error("unbalanced (");
      return v;
    }
    // bare "d10" / "d%" with implicit count of 1
    if (this.peek() === "d") return this.dice(1);
    const n = this.number();
    if (this.peek() === "d") return this.dice(n);
    return n;
  }

  dice(count) {
    if (!this.eat("d")) throw new Error("expected d");
    if (count > 100) throw new Error("too many dice");
    let total = 0;
    if (this.eat("%")) {
      for (let k = 0; k < count; k++) total += this.percent();
    } else {
      const sides = this.number();
      if (sides < 1 || sides > 1000) throw new Error("bad die size");
      for (let k = 0; k < count; k++) total += this.d(sides);
    }
    // underlined-d10 shorthand: 2d10x10
    if (this.peek() === "x") { this.i++; total *= this.number(); }
    return total;
  }

  unary() {
    if (this.eat("-")) return -this.unary();
    if (this.eat("+")) return this.unary();
    return this.atom();
  }

  term() {
    let v = this.unary();
    for (;;) {
      if (this.eat("*")) v *= this.unary();
      else if (this.eat("/")) { const d = this.unary(); v = d === 0 ? 0 : v / d; }
      else return v;
    }
  }

  expr() {
    let v = this.term();
    for (;;) {
      if (this.peek() === "+") { this.i++; v += this.term(); }
      else if (this.peek() === "-") { this.i++; v -= this.term(); }
      else return v;
    }
  }

  run() {
    const v = this.expr();
    if (this.i !== this.s.length) throw new Error(`unexpected "${this.s.slice(this.i)}"`);
    return v;
  }
}

/**
 * Evaluate a dice expression. Never throws — returns `fallback` on bad input.
 * @param {string|number|null} expr
 * @param {number} fallback
 * @param {() => number} [rng]
 * @returns {number}
 */
export function evalDice(expr, fallback = 0, rng) {
  if (expr == null) return fallback;
  if (typeof expr === "number") return Math.round(expr);
  try {
    const p = new Parser(expr, rng);
    const out = p.run();
    return Number.isFinite(out) ? Math.round(out) : fallback;
  } catch {
    return fallback;
  }
}

/** Same, but also returns the individual dice for display. */
export function evalDiceVerbose(expr, fallback = 0, rng) {
  if (expr == null) return { total: fallback, rolls: [], ok: false };
  if (typeof expr === "number") return { total: Math.round(expr), rolls: [], ok: true };
  try {
    const p = new Parser(expr, rng);
    const out = p.run();
    if (!Number.isFinite(out)) return { total: fallback, rolls: [], ok: false };
    return { total: Math.round(out), rolls: p.rolls, ok: true };
  } catch {
    return { total: fallback, rolls: [], ok: false };
  }
}

/** Static check — used by defineModule validation, rolls nothing. */
export function isValidDice(expr) {
  if (expr == null) return false;
  if (typeof expr === "number") return Number.isFinite(expr);
  try { new Parser(expr, () => 0.5).run(); return true; } catch { return false; }
}
