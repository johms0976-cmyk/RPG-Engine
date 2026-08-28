import { describe, it, expect } from "vitest";
import {
  parseDeclared, declaredCheck, declaredPairsNeeded, parsePanicDice,
  declaredShare, DECLARE_ERRORS,
} from "../src/engine/declared.js";
import { check, scoreRoll } from "../src/engine/dice.js";

describe("reading the table's dice", () => {
  it("takes a pair the way it is read out loud", () => {
    expect(parseDeclared([4, 7])).toMatchObject({ value: 47, tens: 4, ones: 7, doubles: false });
  });

  it("takes the percentile as a number or a string", () => {
    expect(parseDeclared(47).value).toBe(47);
    expect(parseDeclared("47").value).toBe(47);
    expect(parseDeclared("4 7").value).toBe(47);
    expect(parseDeclared("4,7").value).toBe(47);
  });

  it("reads a bare single digit as a low percentile, not as tens", () => {
    // "I rolled a 7" at a Mothership table means 07, and 07 is very
    // different from 70 to anybody making a Save.
    expect(parseDeclared("7").value).toBe(7);
    expect(parseDeclared("07").value).toBe(7);
  });

  it("handles 00, which is the most misread result in the game", () => {
    const r = parseDeclared([0, 0]);
    expect(r.value).toBe(0);
    expect(r.doubles).toBe(true);
    // 00 succeeds regardless of target — that judgement is dice.js's.
    expect(scoreRoll(r, 5).success).toBe(true);
    expect(scoreRoll(r, 5).critHit).toBe(true);
  });

  it("spots doubles, because doubles are the whole critical rule", () => {
    expect(parseDeclared([6, 6]).doubles).toBe(true);
    expect(parseDeclared([6, 5]).doubles).toBe(false);
  });

  it("refuses a die that does not exist", () => {
    expect(parseDeclared([10, 2]).error).toBe(DECLARE_ERRORS.RANGE);
    expect(parseDeclared([-1, 2]).error).toBe(DECLARE_ERRORS.RANGE);
    expect(parseDeclared(100).error).toBe(DECLARE_ERRORS.RANGE);
  });

  it("refuses nonsense rather than guessing at it", () => {
    expect(parseDeclared("").error).toBe(DECLARE_ERRORS.EMPTY);
    expect(parseDeclared("nope").error).toBe(DECLARE_ERRORS.PARSE);
    expect(parseDeclared("1234").error).toBe(DECLARE_ERRORS.PARSE);
    expect(parseDeclared(null).error).toBe(DECLARE_ERRORS.EMPTY);
  });
});

describe("adjudicating what the table rolled", () => {
  it("agrees with the internal roller about every possible result", () => {
    // The point of the feature is that the only thing replaced is the
    // source of the digits. Walk all 100 against a spread of targets.
    for (const target of [1, 15, 35, 50, 66, 85, 99]) {
      for (let v = 0; v < 100; v += 1) {
        const declared = declaredCheck(target, "none", [v]);
        const canonical = scoreRoll(
          { value: v, tens: Math.floor(v / 10), ones: v % 10, doubles: Math.floor(v / 10) === v % 10 },
          target,
        );
        expect(declared.success).toBe(canonical.success);
        expect(declared.critHit).toBe(canonical.critHit);
        expect(declared.critFail).toBe(canonical.critFail);
        expect(declared.margin).toBe(target - v);
      }
    }
  });

  it("returns the same shape check() does, so callers cannot tell", () => {
    const rolled = check(50, "none");
    const declared = declaredCheck(50, "none", [[2, 3]]);
    for (const k of ["value", "tens", "ones", "doubles", "success", "crit", "band",
                     "critHit", "critFail", "target", "mode", "all", "margin"]) {
      expect(declared).toHaveProperty(k);
      expect(rolled).toHaveProperty(k);
    }
  });

  it("stamps itself, so the roll log knows where the number came from", () => {
    expect(declaredCheck(50, "none", [23]).declared).toBe(true);
    expect(check(50, "none").declared).toBeUndefined();
  });
});

describe("advantage, which is where a naive version breaks", () => {
  it("needs two pairs and says so instead of silently dropping the mode", () => {
    const r = declaredCheck(50, "advantage", [[2, 3]]);
    expect(r.need).toBe(2);
    expect(r.have).toBe(1);
    expect(r.success).toBeUndefined();
    expect(r.error).toBe(DECLARE_ERRORS.NEED_TWO);
  });

  it("needs one pair without a mode", () => {
    expect(declaredPairsNeeded("none")).toBe(1);
    expect(declaredPairsNeeded("advantage")).toBe(2);
    expect(declaredPairsNeeded("disadvantage")).toBe(2);
  });

  it("ranks by outcome band, not by number — the Abel case", () => {
    // PSG: Abel, Strength 36, rolls 23 and 45 with Advantage, takes 23.
    expect(declaredCheck(36, "advantage", [23, 45]).value).toBe(23);
  });

  it("ranks by outcome band, not by number — the Lilith case", () => {
    // PSG: Lilith, Speed 42, rolls 55 and 62 with Disadvantage, takes 55,
    // because 55 is a Critical Failure and therefore worse.
    const r = declaredCheck(42, "disadvantage", [55, 62]);
    expect(r.value).toBe(55);
    expect(r.critFail).toBe(true);
  });

  it("honours the table's tie-break inside a band", () => {
    expect(declaredCheck(50, "advantage", [12, 34], { advTieBreak: "high" }).value).toBe(34);
    expect(declaredCheck(50, "advantage", [12, 34], { advTieBreak: "low" }).value).toBe(12);
  });

  it("rejects a bad die in the second pair as loudly as in the first", () => {
    expect(declaredCheck(50, "advantage", [23, "nope"]).error).toBe(DECLARE_ERRORS.PARSE);
  });
});

describe("panic dice, which are a different animal", () => {
  it("reads two d10 faces and totals them", () => {
    expect(parsePanicDice([4, 6])).toMatchObject({ total: 10 });
  });

  it("reads a 0 face as a ten, because that is how the die is printed", () => {
    expect(parsePanicDice([0, 0]).total).toBe(20);
    expect(parsePanicDice([0, 5]).total).toBe(15);
  });

  it("refuses a face that is not on a d10", () => {
    expect(parsePanicDice([11, 4]).error).toBeTruthy();
    expect(parsePanicDice([4]).error).toBeTruthy();
  });
});

describe("provenance", () => {
  it("reports what share of the evening came off the table", () => {
    expect(declaredShare([])).toBe(0);
    expect(declaredShare([{ declared: true }, { declared: true }])).toBe(1);
    expect(declaredShare([{ declared: true }, {}, {}, {}])).toBe(0.25);
  });
});
