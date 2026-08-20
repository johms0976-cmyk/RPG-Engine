/** @vitest-environment jsdom */
/* ============================================================
   The five things the phone now answers, and the one it must
   deliberately refuse to answer.
   ============================================================ */
import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";

import { panicChance, pct, ways, atMost, panicBand } from "../src/engine/odds.js";
import { classAlert, classLine, CLASS_EFFECTS } from "../src/engine/classfx.js";
import { deathFrom } from "../src/ui/DeathTakeover.jsx";
import DeathTakeover from "../src/ui/DeathTakeover.jsx";
import FeedLog from "../src/ui/FeedLog.jsx";
import TurnActions from "../src/ui/TurnActions.jsx";
import PlayerStatus from "../src/net/PlayerStatus.jsx";
import MODULES from "../src/modules/index.js";

// jsdom has no layout, so FeedLog's autoscroll needs a stub to exist.
beforeAll(() => { Element.prototype.scrollIntoView = () => {}; });

describe("panic odds", () => {
  it("is the 2d10 triangle, not a flat roll", () => {
    expect(ways(2)).toBe(1);
    expect(ways(11)).toBe(10);
    expect(ways(20)).toBe(1);
    expect(atMost(20)).toBe(1);
  });

  it("matches useGame's rule: you panic on equal or under", () => {
    // doPanic: `roll > pc.stress` holds. So P(panic) = P(2d10 <= stress).
    expect(pct(panicChance(2))).toBe(1);
    expect(pct(panicChance(8))).toBe(28);
    expect(pct(panicChance(12))).toBe(64);
    expect(pct(panicChance(20))).toBe(100);
  });

  it("cannot fail below Stress 2, and says so with silence", () => {
    expect(panicChance(0)).toBe(0);
    expect(panicChance(1)).toBe(0);
    expect(panicBand(1)).toBe("none");
  });

  it("bands escalate where the decision changes", () => {
    expect(panicBand(5)).toBe("low");      // 10%
    expect(panicBand(9)).toBe("real");     // 36%
    expect(panicBand(13)).toBe("likely");  // 72%
    expect(panicBand(16)).toBe("certain"); // 91%
  });
});

describe("class effects", () => {
  const crew = [{ id: "sci", name: "VOSS" }, { id: "me", name: "RILEY" }];
  const line = (extra, id = 1) => ({ id, kind: "stress", text: "…", extra });

  it("fires on the phone it landed on, naming who caused it", () => {
    const card = classAlert(
      line({ classfx: "scientistContagion", by: "sci", ids: ["me"] }), "me", crew,
    );
    expect(card).toBeTruthy();
    expect(card.who).toBe("VOSS");
    expect(card.body).toContain("Scientist");
  });

  it("speaks differently to the person who caused it", () => {
    const card = classAlert(
      line({ classfx: "marineContagion", by: "me", ids: ["sci"] }), "me", crew,
    );
    expect(card.title).toBe("That was you");
    expect(card.who).toBeNull();
  });

  it("stays off the phones it did not land on", () => {
    const card = classAlert(
      line({ classfx: "scientistContagion", by: "sci", ids: ["someone-else"] }), "me", crew,
    );
    expect(card).toBeNull();
  });

  it("keeps the Teamster's spent re-roll private to the Teamster", () => {
    const own = { classfx: "teamsterReroll", by: "me", ids: ["me"] };
    expect(classAlert(line(own), "me", crew)).toBeTruthy();
    expect(classAlert(line(own), "sci", crew)).toBeNull();
  });

  it("gives every class a standing second-person line", () => {
    for (const key of Object.keys(CLASS_EFFECTS)) {
      expect(classLine(key)).toBeTruthy();
    }
  });
});

describe("0 Health", () => {
  const line = {
    id: 9,
    extra: { death: { pcId: "me", name: "RILEY", save: 30, roll: 44, survived: false } },
  };

  it("only takes over the phone of the character it happened to", () => {
    expect(deathFrom(line, "me")).toBeTruthy();
    expect(deathFrom(line, "someone-else")).toBeNull();
  });

  it("shows what was needed and what was rolled", () => {
    render(<DeathTakeover event={deathFrom(line, "me")} onDismiss={() => {}} />);
    expect(screen.getByText("DEAD")).toBeTruthy();
    expect(screen.getByText(/30 or under/)).toBeTruthy();
    expect(screen.getByText("44")).toBeTruthy();
  });

  it("does not lift on its own — there is something to press", () => {
    render(<DeathTakeover event={deathFrom(line, "me")} onDismiss={() => {}} />);
    expect(screen.getByRole("button", { name: /understood/i })).toBeTruthy();
  });
});

describe("who else can see this line", () => {
  const crew = [
    { id: "a", name: "A" }, { id: "b", name: "B" },
    { id: "c", name: "C" }, { id: "d", name: "D" },
  ];
  const feed = [
    { id: 1, kind: "say", text: "public line", clock: 60 },
    { id: 2, kind: "say", text: "just you", to: "a", clock: 60 },
    { id: 3, kind: "say", text: "two of you", to: ["a", "b"], clock: 60 },
    { id: 4, kind: "say", text: "everyone standing", to: ["a", "b", "c", "d"], clock: 60 },
  ];

  it("marks a line only you were sent", () => {
    render(<FeedLog feed={feed} crew={crew} myPcId="a" />);
    expect(screen.getByText("ONLY YOU")).toBeTruthy();
  });

  it("counts a small audience", () => {
    render(<FeedLog feed={feed} crew={crew} myPcId="a" />);
    expect(screen.getByText("2 OF YOU")).toBeTruthy();
  });

  it("stays quiet on public lines and on whole-crew routing", () => {
    const { container } = render(<FeedLog feed={feed} crew={crew} myPcId="a" />);
    // Four lines, two badges: the public one and the whole-crew one
    // are not private and must not be dressed as though they were.
    expect(container.querySelectorAll(".feedlog-only").length).toBe(2);
  });
});

describe("the status strip", () => {
  const g = {
    mod: MODULES[0],
    pc: { id: "me", name: "RILEY", cls: "marine", health: 6, maxHealth: 14, stress: 12, conditions: [] },
    crew: [{ id: "me", name: "RILEY", health: 6, maxHealth: 14, stress: 12, alive: true }],
    w: {
      clock: 120, room: "mess", flags: {}, npcs: {}, threats: {},
      countdowns: { air: { left: 18, cfg: { id: "air", label: "AIR", minutes: 240, full: 240 } } },
    },
    combat: null,
  };

  it("carries the panic odds and the clock, permanently", () => {
    render(<PlayerStatus g={g} waitingOn={null} duress={null} />);
    expect(screen.getByText("64%")).toBeTruthy();
    expect(screen.getByText(/2d10 >/)).toBeTruthy();
    // The countdown, out of the drawer it used to live in.
    expect(screen.getByRole("timer")).toBeTruthy();
  });

  it("says nothing about Panic when a check cannot fail", () => {
    render(<PlayerStatus g={{ ...g, pc: { ...g.pc, stress: 1 } }} waitingOn={null} duress={null} />);
    expect(screen.queryByText(/2d10 >/)).toBeNull();
  });
});

describe("what an action is", () => {
  const ctx = {
    actions: 2, held: false, target: true, armed: true,
    reloadable: false, carrying: true, hasDrug: false, others: true,
  };

  it("stays collapsed until asked", () => {
    render(<TurnActions ctx={ctx} actionsLeft={2} />);
    expect(screen.getByText(/2 actions left/i)).toBeTruthy();
    expect(screen.queryByText(/Open a door/)).toBeNull();
  });

  it("shows unavailable actions with the reason rather than hiding them", () => {
    render(<TurnActions ctx={{ ...ctx, held: true, armed: false }} actionsLeft={1} />);
    act(() => { screen.getByRole("button", { name: /what are my options/i }).click(); });

    // The whole menu is present — a row that vanishes teaches nothing.
    expect(screen.getByText(/Open a door/)).toBeTruthy();
    // Attacking is off, and says why, rather than being absent.
    expect(screen.getByText("nothing you can fire")).toBeTruthy();
    // Being held adds a row that only exists while it is true.
    expect(screen.getByText("Tear free")).toBeTruthy();
  });
});
