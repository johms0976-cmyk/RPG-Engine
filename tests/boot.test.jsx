// @vitest-environment jsdom
/* ============================================================
   BOOT — the path from the shelf to a playable session.

   This exists because of a specific bug. App.jsx pushed crew
   context into the core from an effect; the patch was rebuilt on
   every render, so `crewNames` was a fresh object each time; the
   reducer returned a new state for that identical patch; the store
   notified; React re-rendered; the effect ran again. Clicking
   "New game" died with React error #185, "Maximum update depth
   exceeded", and the screen went black.

   Nothing else in the suite covered App end to end, which is how a
   crash on the single most-used button in the app shipped green.
   These two tests are slow and shallow on purpose: they assert only
   that the whole thing mounts, starts and survives, in both the
   ordinary mode and ?mode=host.
   ============================================================ */
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

beforeEach(() => {
  window.matchMedia = window.matchMedia || ((q) => ({
    matches: false, media: q, onchange: null,
    addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
  }));
  // jsdom implements no SVG geometry and no scrolling.
  Element.prototype.getBoundingClientRect = () => ({
    width: 760, height: 460, top: 0, left: 0, right: 760, bottom: 460, x: 0, y: 0,
  });
  Element.prototype.setPointerCapture = Element.prototype.setPointerCapture || (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  localStorage.clear();
});

/* HOSTING is read from the URL at module load, so the search string has
   to be set before App is imported — hence resetModules and a dynamic
   import rather than a top-level one. */
async function boot(search = "") {
  window.history.replaceState({}, "", `/${search}`);
  vi.resetModules();
  const App = (await import("../src/App.jsx")).default;
  return render(<App />);
}

async function newGameToPlay() {
  await act(async () => { fireEvent.click(screen.getAllByText("New game")[0]); });
  await act(async () => { fireEvent.click(screen.getByText("PRESS ANY KEY TO SKIP")); });
  await act(async () => { fireEvent.click(screen.getByText("QUICK START")); });
}

describe("booting a module", () => {
  it("reaches a playable session without an update loop", async () => {
    await boot();
    expect(screen.getByText("THE SHELF")).toBeTruthy();
    await newGameToPlay();
    // A started session has a crew, and the pregen is aboard.
    expect(screen.getAllByText(/PREGEN/).length).toBeGreaterThan(0);
  });

  it("does the same in host mode", async () => {
    await boot("?mode=host");
    await newGameToPlay();
    expect(screen.getAllByText(/PREGEN/).length).toBeGreaterThan(0);
  });

  /* The deck is a lot of new UI mounted into the busiest screen in the
     app, and the failure mode for that is not a wrong pixel — it is a
     white screen, which is exactly what boot.test exists to catch. */
  it("gives the Warden somewhere to speak from, and it works", async () => {
    await boot("?mode=host");
    await newGameToPlay();

    const field = screen.getByPlaceholderText(/light in the corridor/i);
    expect(field).toBeTruthy();

    await act(async () => {
      fireEvent.change(field, { target: { value: "Something moves behind the crates." } });
    });
    await act(async () => { fireEvent.click(screen.getByText("Say it")); });

    // It reached the feed, which is the whole feature.
    expect(screen.getAllByText(/Something moves behind the crates/).length).toBeGreaterThan(0);
  });

  it("keeps the Warden's controls off a player's screen", async () => {
    await boot();
    await newGameToPlay();
    // Single-player desk still has the deck (it is the same seat), but a
    // phone must not: ClientShell builds its game from useRemoteGame,
    // which has no `warden` key at all. Asserted directly in
    // warden.test.jsx; here we only check the solo case still mounts.
    expect(screen.getAllByText(/PREGEN/).length).toBeGreaterThan(0);
  });
});

describe("core context pushes", () => {
  it("an unchanged patch does not produce a new state", async () => {
    const { createCore, coreActions } = await import("../src/core/index.js");
    const core = createCore({ seed: 1 });
    core.dispatch(coreActions.context({ aboardCount: 3, crewNames: { pc1: "Riley" } }));
    const settled = core.getState();
    // Same values, freshly built object — exactly what the effect sends.
    core.dispatch(coreActions.context({ aboardCount: 3, crewNames: { pc1: "Riley" } }));
    expect(core.getState()).toBe(settled);
    // A real change still lands.
    core.dispatch(coreActions.context({ crewNames: { pc1: "Riley", pc2: "Vance" } }));
    expect(core.getState()).not.toBe(settled);
    expect(core.getState().crewNames.pc2).toBe("Vance");
  });
});
