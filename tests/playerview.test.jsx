// @vitest-environment jsdom
/* ============================================================
   Tests for the six player-view additions.

   The arithmetic ones matter most. A roll preview that is wrong
   is worse than no roll preview: a player who is told 62% and
   experiences 41% will stop trusting the panel, and then the
   panel is dead weight on a screen with no room for dead weight.
   So the odds are checked against brute-force enumeration of the
   same rules dice.js implements, rather than against numbers I
   worked out and typed in.
   ============================================================ */
import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/* jsdom has no matchMedia; HoldToRoll and the dice reveal check it. */
beforeEach(() => {
  window.matchMedia = window.matchMedia || ((q) => ({
    matches: false, media: q, onchange: null,
    addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {},
  }));
});

import { bandOdds, modeOdds, successChance, critFailChance, previewRoll } from "../src/engine/rollpreview.js";
import { explainCondition, orderConditions, isBoon } from "../src/engine/conditions.js";
import { PANIC_TABLE } from "../src/engine/rules.js";
import Hint, { Disclosure } from "../src/ui/Hint.jsx";
import { Initiative, Conditions } from "../src/ui/PlayerInfo.jsx";

/* ---------------- odds ---------------- */

/** Brute force, using exactly the rules in dice.js scoreRoll(). */
function bruteSingle(target) {
  const out = { critSuccess: 0, success: 0, fail: 0, critFail: 0 };
  for (let t = 0; t < 10; t += 1) {
    for (let o = 0; o < 10; o += 1) {
      const v = t * 10 + o;
      const doubles = t === o;
      const ok = v === 0 ? true : v === 99 ? false : v <= target;
      const crit = doubles || v === 0 || v === 99;
      out[ok ? (crit ? "critSuccess" : "success") : (crit ? "critFail" : "fail")] += 1;
    }
  }
  for (const k of Object.keys(out)) out[k] /= 100;
  return out;
}

const BAND = { critFail: 0, fail: 1, success: 2, critSuccess: 3 };
const bandOf = (v, target) => {
  const doubles = Math.floor(v / 10) === v % 10;
  const ok = v === 0 ? true : v === 99 ? false : v <= target;
  const crit = doubles || v === 0 || v === 99;
  return ok ? (crit ? 3 : 2) : (crit ? 0 : 1);
};

/** Every one of the 10,000 pairs, resolved the way dice.js resolves them. */
function brutePair(target, best) {
  const out = [0, 0, 0, 0];
  for (let a = 0; a < 100; a += 1) {
    for (let b = 0; b < 100; b += 1) {
      const x = bandOf(a, target);
      const y = bandOf(b, target);
      out[best ? Math.max(x, y) : Math.min(x, y)] += 1;
    }
  }
  return {
    critFail: out[0] / 10000,
    fail: out[1] / 10000,
    success: out[2] / 10000,
    critSuccess: out[3] / 10000,
  };
}

describe("roll odds", () => {
  it("matches brute force for a single roll at every target", () => {
    for (let t = 1; t <= 99; t += 1) {
      const got = bandOdds(t);
      const want = bruteSingle(t);
      for (const k of Object.keys(want)) expect(got[k]).toBeCloseTo(want[k], 10);
    }
  });

  it("matches brute force under advantage and disadvantage", () => {
    for (const t of [5, 20, 35, 50, 65, 80, 99]) {
      for (const [mode, best] of [["advantage", true], ["disadvantage", false]]) {
        const got = modeOdds(t, mode);
        const want = brutePair(t, best);
        for (const k of Object.keys(want)) expect(got[k]).toBeCloseTo(want[k], 9);
      }
    }
  });

  it("bands always sum to one", () => {
    for (const mode of ["none", "advantage", "disadvantage"]) {
      for (const t of [1, 33, 50, 77, 99]) {
        const o = modeOdds(t, mode);
        const sum = o.critFail + o.fail + o.success + o.critSuccess;
        expect(sum).toBeCloseTo(1, 10);
      }
    }
  });

  it("advantage helps and disadvantage hurts, at every target", () => {
    for (let t = 1; t <= 99; t += 1) {
      const flat = successChance(t, "none");
      expect(successChance(t, "advantage")).toBeGreaterThanOrEqual(flat);
      expect(successChance(t, "disadvantage")).toBeLessThanOrEqual(flat);
      // The thing that actually kills characters should get rarer
      // with advantage, not just less likely to matter.
      expect(critFailChance(t, "advantage")).toBeLessThanOrEqual(critFailChance(t, "none"));
    }
  });

  it("00 succeeds and 99 fails whatever the target", () => {
    // Target 1: only 00 and 01 succeed, and 00 is a critical.
    const low = bandOdds(1);
    expect(low.success + low.critSuccess).toBeCloseTo(0.02, 10);
    // Target 99: everything but 99 succeeds.
    const high = bandOdds(99);
    expect(high.success + high.critSuccess).toBeCloseTo(0.99, 10);
    expect(high.critFail).toBeCloseTo(0.01, 10);
  });
});

/* ---------------- preview against the engine's own inputs ---------------- */

const PC = {
  id: "pc1", name: "Riley", cls: "teamster", alive: true,
  stats: { strength: 30, speed: 40, intellect: 55, combat: 25 },
  saves: { sanity: 30, fear: 35, body: 40, armor: 0 },
  skills: ["Hacking"], items: [], conditions: [], buffs: [], ammo: {}, uses: {}, spare: {},
  stress: 4, resolve: 0, health: 10, maxHealth: 10, credits: 0, xp: 0, level: 0,
};

describe("previewRoll", () => {
  const ctx = { pc: PC, crew: [PC], items: {}, mod: { items: {} }, world: { clock: 0, flags: {} }, houseRules: {} };

  it("reports the bare stat when nothing applies", () => {
    const p = previewRoll({ kind: "stat", name: "intellect" }, ctx, null);
    expect(p.base).toBe(55);
    expect(p.bonus).toBe(0);
    expect(p.target).toBe(55);
    expect(p.mode).toBe("none");
  });

  it("adds the skill bonus and names it in the breakdown", () => {
    // Hacking is an Expert skill: +15, not +10. The point of reading
    // the bonus off skillTier rather than assuming a tier.
    const p = previewRoll({ kind: "stat", name: "intellect", skill: "Hacking" }, ctx, null);
    expect(p.target).toBe(70);
    expect(p.breakdown.map((m) => m.source)).toContain("Hacking");
  });

  it("flags a Save's critical failure as a Panic Check", () => {
    const save = previewRoll({ kind: "save", name: "fear" }, ctx, null);
    const check = previewRoll({ kind: "stat", name: "speed" }, ctx, null);
    expect(save.critFailPanics).toBe(true);
    expect(check.critFailPanics).toBe(false);
  });

  it("picks up a modifier coming from another character's class", () => {
    // A friendly Marine nearby is +5 Fear — invisible on your own
    // sheet, and exactly the sort of thing the panel exists for.
    const marine = { ...PC, id: "pc2", name: "Vex", cls: "marine" };
    const withMarine = previewRoll(
      { kind: "save", name: "fear" },
      { ...ctx, crew: [PC, marine] },
      null,
    );
    expect(withMarine.target).toBe(40);
    expect(withMarine.breakdown.some((m) => /Marine/.test(m.source))).toBe(true);
  });

  it("an assist turns the roll to advantage and improves the odds", () => {
    const helper = { ...PC, id: "pc2", name: "Vex" };
    const crew = [PC, helper];
    const flat = previewRoll({ kind: "stat", name: "speed" }, { ...ctx, crew }, null);
    const helped = previewRoll({ kind: "stat", name: "speed" }, { ...ctx, crew }, "pc2");
    expect(helped.mode).toBe("advantage");
    expect(helped.success).toBeGreaterThan(flat.success);
  });

  it("returns null rather than throwing without a character", () => {
    expect(previewRoll({ kind: "stat", name: "speed" }, { pc: null }, null)).toBe(null);
    expect(previewRoll(null, ctx, null)).toBe(null);
  });
});

/* ---------------- conditions ---------------- */

describe("conditions", () => {
  it("takes panic-effect text from PANIC_TABLE rather than a copy", () => {
    const row = PANIC_TABLE.find((r) => r.name === "Cowardice");
    expect(explainCondition("Cowardice").text).toBe(row.t);
  });

  it("every panic effect that stamps a condition can be explained", () => {
    // The exact strings useGame.js pushes onto pc.conditions.
    const stamped = [
      "Phobia", "Descent into Madness", "Advantage (3d10 minutes)",
      "Rattled — Disadvantage", "Cowardice", "Hallucinating", "Catatonic",
      "Broken", "Paranoid", "Deathdrive", "Psychotic", "Psychological Collapse",
      "Comatose", "Dazed — Disadvantage", "Held", "Withdrawal risk",
    ];
    for (const c of stamped) {
      const e = explainCondition(c);
      expect(e, c).toBeTruthy();
      expect(e.text.length, c).toBeGreaterThan(20);
    }
  });

  it("keeps the duration off a timed Advantage", () => {
    const e = explainCondition("Advantage (3d10 minutes)");
    expect(e.good).toBe(true);
    expect(e.detail).toMatch(/3d10 minutes/);
  });

  it("describes the hidden four in the third person", () => {
    // These only reach a phone when it is reading somebody else's
    // sheet — secrets.js strips them from their owner.
    for (const c of ["Paranoid", "Broken", "Deathdrive", "Hallucinating"]) {
      expect(explainCondition(c).observed).toBe(true);
      expect(explainCondition(c).text).toMatch(/They/);
    }
  });

  it("says something true about a module's own condition", () => {
    const e = explainCondition("INFECTED — yellow goo");
    expect(e.from).toBe("module");
    expect(e.name).toBe("INFECTED — yellow goo");
  });

  it("sorts problems above boons", () => {
    const sorted = orderConditions(["Advantage (1d10 hours)", "Cowardice"]);
    expect(sorted[0]).toBe("Cowardice");
    expect(isBoon("Advantage (1d10 hours)")).toBe(true);
    expect(isBoon("Cowardice")).toBe(false);
  });
});

/* ---------------- the touch-reachable hint ---------------- */

describe("Hint", () => {
  it("hides its text until tapped, then shows it", () => {
    render(<Hint text="Doubles above your target." label="explain" />);
    expect(screen.queryByText(/Doubles above/)).toBeNull();
    fireEvent.click(screen.getByLabelText("explain"));
    expect(screen.getByText(/Doubles above/)).toBeTruthy();
  });

  it("reports its state to assistive tech", () => {
    render(<Hint text="hello" label="explain" />);
    const btn = screen.getByLabelText("explain");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });

  it("renders nothing at all with no text", () => {
    const { container } = render(<Hint text="" />);
    expect(container.querySelector(".hint-btn")).toBeNull();
  });

  it("Disclosure opens and closes", () => {
    render(<Disclosure summary="Cowardice">You must pass a Fear Save.</Disclosure>);
    expect(screen.queryByText(/Fear Save/)).toBeNull();
    fireEvent.click(screen.getByText("Cowardice"));
    expect(screen.getByText(/Fear Save/)).toBeTruthy();
  });
});

/* ---------------- initiative ---------------- */

describe("Initiative", () => {
  const combat = {
    round: 2,
    turnIndex: 1,
    order: [
      { side: "pc", id: "pc1" },
      { side: "enemy", id: "e1" },
      { side: "pc", id: "pc2" },
    ],
    actors: { pc1: { actions: 2 }, pc2: { actions: 2 } },
    enemies: [{ uid: "e1", name: "The thing" }],
  };
  const crew = [{ id: "pc1", name: "Riley" }, { id: "pc2", name: "Vex" }];

  it("counts how many act before you", () => {
    render(<Initiative combat={combat} crew={crew} pcId="pc2" />);
    expect(screen.getByText("1 before you")).toBeTruthy();
  });

  it("wraps round to next round when you have already been", () => {
    render(<Initiative combat={combat} crew={crew} pcId="pc1" />);
    // pc1 is at index 0, the pointer is at 1, so it comes round again
    // after the other two.
    expect(screen.getByText("2 before you")).toBeTruthy();
  });

  it("says it plainly when it is your go", () => {
    render(<Initiative combat={{ ...combat, turnIndex: 0 }} crew={crew} pcId="pc1" />);
    expect(screen.getByText("your go")).toBeTruthy();
  });

  it("names you as You and names the enemy as it arrived", () => {
    render(<Initiative combat={combat} crew={crew} pcId="pc1" />);
    expect(screen.getByText("You")).toBeTruthy();
    expect(screen.getByText("The thing")).toBeTruthy();
  });

  it("renders nothing without an order", () => {
    const { container } = render(<Initiative combat={null} crew={crew} pcId="pc1" />);
    expect(container.firstChild).toBeNull();
  });
});

/* ---------------- conditions panel ---------------- */

describe("Conditions panel", () => {
  it("shows the name closed and the rule open", () => {
    render(<Conditions conditions={["Cowardice"]} />);
    expect(screen.getByText("Cowardice")).toBeTruthy();
    expect(screen.queryByText(/Fear Save to enter combat/)).toBeNull();
    fireEvent.click(screen.getByText("Cowardice"));
    expect(screen.getByText(/Fear Save to enter combat/)).toBeTruthy();
  });

  it("renders nothing when clean", () => {
    const { container } = render(<Conditions conditions={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

/* ============================================================
   END TO END, ON A PHONE.

   The unit tests above check arithmetic and components in
   isolation. These render the actual play screen out of an actual
   remote snapshot, because three of the six additions are wired
   in through Play.jsx and a component that works alone and
   crashes in place is not much use.

   The roll-history case earned its place: the first
   implementation kept the log in a ref, which does not schedule a
   render, so the panel stayed empty on a quiet phone and filled
   in on the Warden's busy screen. Nothing but a real render would
   have caught it.
   ============================================================ */
import { renderHook } from "@testing-library/react";
import Play from "../src/screens/Play.jsx";
import { useRemoteGame } from "../src/net/useRemoteGame.js";
import MODULES from "../src/modules/index.js";
import { makeCharacter } from "../src/engine/rules.js";

const smod = MODULES[0];

function mkPc() {
  const pc = makeCharacter({
    name: "Riley", cls: "teamster",
    stats: { strength: 30, speed: 40, intellect: 55, combat: 25 },
    skills: ["Hacking"], loadout: Object.keys(smod.loadouts || {})[0],
    trinket: "a", patch: "b",
  }, { items: smod.items, loadouts: smod.loadouts, meters: {} });
  pc.id = "pc1";
  pc.conditions = ["Cowardice", "Advantage (3d10 minutes)", "INFECTED — yellow goo"];
  pc.stress = 9;
  return pc;
}

function snap(extra = {}) {
  const pc = mkPc();
  return {
    t: "snapshot", seq: 1, modId: smod.id, phase: "play",
    state: {
      w: {
        clock: 0, room: Object.keys(smod.rooms)[0], flags: {}, visited: {}, npcs: {},
        threats: {}, meters: {}, countdowns: {}, clocks: {}, searched: {},
        handouts: {}, clues: [], marks: [], trades: [],
      },
      crew: [pc], activeId: "pc1", feed: [], pending: null, combat: null, houseRules: {},
      lastRoll: {
        who: "Riley", label: "Intellect (Hacking)", value: 23, target: 70,
        success: true, margin: 47, mode: "none", breakdown: [],
      },
      ...extra,
    },
  };
}

const useG = (s) => renderHook(() => useRemoteGame(s, "pc1", () => {})).result.current;

describe("phone smoke", () => {
  it("renders the play screen with conditions, kit and roll history", () => {
    const g = useG(snap());
    render(<Play g={g} onQuit={() => {}} onWhisper={() => {}} onWhisperPeer={() => {}} />);
    expect(screen.getAllByText(/Between us/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Your rolls/).length).toBeGreaterThan(0);
  });

  it("shows a target number and odds on a pending roll", () => {
    const g = useG(snap({ pending: { kind:"roll", req:{ kind:"save", name:"fear", pcId:"pc1", reason:"It is looking at you." } } }));
    render(<Play g={g} onQuit={() => {}} />);
    expect(screen.getByText("roll under")).toBeTruthy();
    expect(screen.getAllByText(/critical failure/).length).toBeGreaterThan(0);
    expect(screen.getByText("It is looking at you.")).toBeTruthy();
  });

  it("explains a condition on the sheet", () => {
    const g = useG(snap());
    render(<Play g={g} onQuit={() => {}} />);
    fireEvent.click(screen.getAllByText("Sheet")[0]);
    fireEvent.click(screen.getAllByText("Cowardice")[0]);
    expect(screen.getByText(/Fear Save to enter combat/)).toBeTruthy();
  });

  it("shows the panic odds on the opt-in stress prompt", () => {
    const g = useG(snap({ pending: { kind:"optStress", pcId:"pc1", amount:2, why:"That was a lot." } }));
    render(<Play g={g} onQuit={() => {}} />);
    expect(screen.getByText(/if you take it/)).toBeTruthy();
  });
});
