// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import MapV2 from "../src/ui/Map2.jsx";
import { DiceReveal } from "../src/ui/Dice.jsx";
import { ShipSheet, ShipCombat } from "../src/screens/Ship.jsx";
import { createCore, coreActions, initialCoreState, FALSTAFF, makeEnemyShip } from "../src/core/index.js";

/* jsdom has no matchMedia; the reduced-motion checks need one. */
beforeEach(() => {
  window.matchMedia = window.matchMedia || ((q) => ({
    matches: false, media: q, onchange: null,
    addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
  }));
  // SVG geometry isn't implemented in jsdom.
  if (!Element.prototype.getBoundingClientRect.mocked) {
    Element.prototype.getBoundingClientRect = () => ({ width: 760, height: 460, top: 0, left: 0, right: 760, bottom: 460, x: 0, y: 0 });
  }
  Element.prototype.setPointerCapture = Element.prototype.setPointerCapture || (() => {});
});

const mod = {
  title: "TEST STATION",
  start: "hab",
  rooms: {
    hab: { name: "HABITAT", n: 1, tags: ["quarters"], exits: [{ to: "corr" }] },
    corr: { name: "CORRIDOR", n: 2, exits: [{ to: "hab" }, { to: "eng" }, { to: "vault", hidden: "gotCode" }] },
    eng: { name: "ENGINE ROOM", n: 3, tags: ["industrial"], z: 1, exits: [{ to: "corr" }] },
    vault: { name: "VAULT", n: 4, exits: [{ to: "corr" }] },
  },
  threats: { thing: { name: "THE THING" } },
  npcs: {},
  map: null,
};

const world = {
  room: "hab",
  visited: { hab: true },
  flags: {},
  clock: 0,
  threats: { thing: { loc: "corr", dead: false, retreatUntil: -1 } },
  npcs: {},
};

describe("MapV2", () => {
  it("renders known rooms and hides rooms nobody has heard of", () => {
    render(<MapV2 mod={mod} w={world} onGo={() => {}} />);
    expect(screen.getByLabelText(/HABITAT, you are here/)).toBeTruthy();
    expect(screen.getByLabelText(/CORRIDOR/)).toBeTruthy();
    // The vault is behind a hidden exit from a room never visited.
    expect(screen.queryByLabelText(/^VAULT/)).toBeNull();
  });

  it("reveals a rumoured room once its door has been seen", () => {
    const seen = { ...world, visited: { hab: true, corr: true }, flags: { gotCode: true } };
    render(<MapV2 mod={mod} w={seen} onGo={() => {}} />);
    expect(screen.getByLabelText(/VAULT.*unexplored/)).toBeTruthy();
  });

  it("only makes reachable rooms clickable, and travels when clicked", () => {
    const onGo = vi.fn();
    render(<MapV2 mod={mod} w={world} onGo={onGo} />);
    const corr = screen.getByLabelText(/CORRIDOR.*reachable/);
    fireEvent.click(corr);
    expect(onGo).toHaveBeenCalledWith("corr");
  });

  it("shows floor tabs when the module has z-levels", () => {
    render(<MapV2 mod={mod} w={world} onGo={() => {}} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBe(2);
  });

  it("marks threats the crew knows about", () => {
    const seen = { ...world, visited: { hab: true, corr: true } };
    render(<MapV2 mod={mod} w={seen} onGo={() => {}} />);
    expect(screen.getByLabelText(/CORRIDOR.*danger/)).toBeTruthy();
  });

  it("exposes zoom controls and an application role for keyboard use", () => {
    render(<MapV2 mod={mod} w={world} onGo={() => {}} />);
    expect(screen.getByRole("application")).toBeTruthy();
    expect(screen.getByLabelText("Zoom in")).toBeTruthy();
    expect(screen.getByLabelText("Zoom out")).toBeTruthy();
  });
});

describe("DiceReveal", () => {
  const roll = { value: 37, tens: 3, ones: 7, doubles: false, target: 45, success: true, critHit: false, critFail: false, margin: 8, label: "Speed", who: "MARLOWE" };

  afterEach(() => vi.useRealTimers());

  it("announces the whole result to assistive tech immediately", () => {
    render(<DiceReveal roll={roll} />);
    const live = screen.getByRole("status");
    expect(live.getAttribute("aria-label")).toContain("rolled 37");
    expect(live.getAttribute("aria-label")).toContain("SUCCESS");
  });

  it("lands the tens die before the ones die", () => {
    vi.useFakeTimers();
    const { container } = render(<DiceReveal roll={roll} />);
    act(() => { vi.advanceTimersByTime(360); });
    const dice = container.querySelectorAll(".die");
    expect(dice[0].className).toContain("landed");
    expect(dice[1].className).toContain("rolling");

    act(() => { vi.advanceTimersByTime(440); });
    expect(container.querySelectorAll(".die")[1].className).toContain("landed");
  });

  it("calls the tens die when it has already decided the roll", () => {
    vi.useFakeTimers();
    const doomed = { ...roll, value: 71, tens: 7, ones: 1, target: 35, success: false };
    const { container } = render(<DiceReveal roll={doomed} />);
    act(() => { vi.advanceTimersByTime(360); });
    expect(container.querySelector(".dice-tens-call").textContent).toMatch(/over the number/);
  });

  it("holds a beat before the verdict when Panic is pending", () => {
    vi.useFakeTimers();
    const { container } = render(<DiceReveal roll={roll} panic />);
    act(() => { vi.advanceTimersByTime(360 + 440 + 280); });
    expect(container.querySelector(".dice-hold")).toBeTruthy();
    expect(container.querySelector(".dice-verdict")).toBeNull();

    act(() => { vi.advanceTimersByTime(950); });
    expect(container.querySelector(".dice-verdict")).toBeTruthy();
  });

  it("skips straight to the verdict on click", () => {
    vi.useFakeTimers();
    const { container } = render(<DiceReveal roll={roll} panic />);
    fireEvent.click(screen.getByRole("status"));
    expect(container.querySelector(".dice-verdict")).toBeTruthy();
  });
});

describe("ship screens", () => {
  const makeCore = () => {
    const store = createCore({ state: initialCoreState({ seed: 5, credits: 1000 }) });
    return {
      state: store.getState(),
      dispatch: store.dispatch,
      do: Object.fromEntries(Object.entries(coreActions).map(([k, fn]) => [k, (...a) => store.dispatch(fn(...a))])),
      store,
    };
  };

  it("says so plainly when there is no ship", () => {
    render(<ShipSheet core={makeCore()} />);
    expect(screen.getByText(/No ship/)).toBeTruthy();
  });

  it("renders the sheet with hull, thresholds and modules", () => {
    const c = makeCore();
    c.store.dispatch(coreActions.install(FALSTAFF()));
    c.state = c.store.getState();
    render(<ShipSheet core={c} crewCount={4} />);
    expect(screen.getByText("THE FALSTAFF")).toBeTruthy();
    expect(screen.getByText("25%")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("75%")).toBeTruthy();
    expect(screen.getByText("Life Support")).toBeTruthy();
  });

  it("surfaces damage conditions on the sheet", () => {
    const c = makeCore();
    c.store.dispatch(coreActions.install({ ...FALSTAFF(), armorBreached: true }));
    c.state = c.store.getState();
    render(<ShipSheet core={c} crewCount={2} />);
    expect(screen.getByText(/Armor breached/)).toBeTruthy();
  });

  it("renders ship combat with both hull bars and an action budget", () => {
    const c = makeCore();
    c.store.dispatch(coreActions.install(FALSTAFF()));
    c.store.dispatch(coreActions.fight(makeEnemyShip({
      name: "PATROL", hull: 40, weapons: [{ name: "Autocannon", dmg: "2d10" }],
    })));
    c.state = c.store.getState();
    render(<ShipCombat core={c} gunnerCombat={35} />);
    expect(screen.getByText("PATROL")).toBeTruthy();
    expect(screen.getByText(/actions left/)).toBeTruthy();
    expect(screen.getByText(/END ROUND/)).toBeTruthy();
  });
});
