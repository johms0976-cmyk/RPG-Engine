// @vitest-environment jsdom
/* ============================================================
   THE SHELF, END TO END.

   The unit tests in loadmodule.test.js prove the format and the
   store. This proves the thing the feature actually promises:
   a file dropped into the browser becomes a module you can
   start, with no build step and no terminal.

   Shallow and slow on purpose, in the manner of boot.test.jsx —
   it asserts that the whole path mounts and survives, because the
   failure mode for wiring a new source of modules into App is not
   a wrong pixel, it is a white screen at the shelf.
   ============================================================ */

import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { installModule, clearShelf } from "../src/engine/moduleStore.js";
import { PMOD_KIND, PMOD_VERSION } from "../src/engine/portableModule.js";

beforeEach(() => {
  window.matchMedia = window.matchMedia || ((q) => ({
    matches: false, media: q, onchange: null,
    addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
  }));
  Element.prototype.getBoundingClientRect = () => ({
    width: 760, height: 460, top: 0, left: 0, right: 760, bottom: 460, x: 0, y: 0,
  });
  Element.prototype.setPointerCapture = Element.prototype.setPointerCapture || (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  localStorage.clear();
  clearShelf();
});

const MODULE = {
  id: "loaded-drift",
  title: "SILENT DRIFT",
  blurb: "A hauler answering nobody.",
  start: "airlock",
  loadouts: { salvor: { name: "SALVOR", items: [], credits: 100 } },
  rooms: {
    airlock: {
      name: "AIRLOCK",
      look: "The inner door is open. That is the first wrong thing.",
      exits: [{ to: "galley", label: "Forward to the galley", mins: 3 }],
      features: { panel: { name: "Cycle panel", d: "Dead, and warm." } },
    },
    galley: {
      name: "GALLEY",
      look: "Six settings laid out. Nothing has been eaten.",
      exits: [{ to: "airlock", label: "Back to the airlock", mins: 3 }],
    },
  },
  endings: { away: { title: "AWAY", text: "You undock.", good: true } },
};

const file = (mod = MODULE) => JSON.stringify({ kind: PMOD_KIND, v: PMOD_VERSION, module: mod });

async function boot(search = "") {
  window.history.replaceState({}, "", `/${search}`);
  vi.resetModules();
  const App = (await import("../src/App.jsx")).default;
  return render(<App />);
}

describe("a module loaded at runtime", () => {
  it("appears on the shelf beside the bundled ones", async () => {
    expect(installModule(file()).ok).toBe(true);
    await boot();

    expect(screen.getByText("THE SHELF")).toBeTruthy();
    expect(screen.getByText("SILENT DRIFT")).toBeTruthy();
    /* Bundled modules are still there — a loaded module adds to the
       shelf, it does not replace it. */
    expect(screen.getAllByText("New game").length).toBeGreaterThan(1);
  });

  it("is marked as loaded rather than passing as built in", async () => {
    installModule(file());
    await boot();
    expect(screen.getAllByText(/LOADED/).length).toBeGreaterThan(0);
  });

  it("starts a playable session", async () => {
    installModule(file());
    await boot();

    /* The loaded module sorts after the bundled shelf, so find its own
       card rather than clicking the first New game on the page. */
    const heading = screen.getByText("SILENT DRIFT");
    const card = heading.closest("section") || heading.parentElement.parentElement;
    const start = [...card.querySelectorAll("button")].find((b) => /New game/.test(b.textContent));
    expect(start).toBeTruthy();

    await act(async () => { fireEvent.click(start); });
    await act(async () => { fireEvent.click(screen.getByText("PRESS ANY KEY TO SKIP")); });
    await act(async () => { fireEvent.click(screen.getByText("QUICK START")); });

    /* In the room, with the module's own prose on screen. */
    expect(screen.getAllByText(/AIRLOCK/i).length).toBeGreaterThan(0);
  });

  it("shows a broken stored module without taking the shelf down with it", async () => {
    installModule(file());
    const raw = JSON.parse(localStorage.getItem("rpg-engine:shelf:v1"));
    raw.mods["loaded-drift"].json = JSON.stringify({
      kind: PMOD_KIND, v: 99, module: MODULE,
    });
    localStorage.setItem("rpg-engine:shelf:v1", JSON.stringify(raw));

    await boot();
    /* The shelf still renders, and says what happened. */
    expect(screen.getByText("THE SHELF")).toBeTruthy();
    expect(screen.getAllByText(/no longer/i).length).toBeGreaterThan(0);
  });

  it("offers the load door from the shelf", async () => {
    await boot();
    await act(async () => { fireEvent.click(screen.getByText("Load a module")); });
    expect(screen.getAllByText(/Choose a file/).length).toBeGreaterThan(0);
  });
});
