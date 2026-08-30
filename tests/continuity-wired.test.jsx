// @vitest-environment jsdom
/* ============================================================
   CONTINUITY, WITH HANDS.

   `tests/continuity.test.js` proves the harvest, the offer and
   the fragment. None of that matters if a table never sees any
   of it, and this repository has now shipped five features that
   worked and could not be reached:

     · `sessionEndsAt`, `floor.on`, `C_DISPUTE`, `ruling.js`
       (see tests/tableruling-wired.test.jsx for the full list)
     · and `commitW`, which is NOT on the game object — an early
       draft of the carry-forward wiring called it anyway, and it
       would have thrown on the first session that carried a fact.

   So these assertions walk the route: harvested at the end,
   stored on the campaign, offered at the lobby, and applied
   through the one door that appends a ruling.
   ============================================================ */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p) => readFileSync(resolve(__dirname, "..", p), "utf8");

describe("the route from a session's end to the next session", () => {
  it("the ending screen hands the world over to be harvested", () => {
    const ending = read("src/screens/Ending.jsx");
    /* `recordSession` cannot harvest what it is not given, and
       `world` is optional there so this would fail silently. */
    expect(ending).toContain("world: w");
  });

  it("the campaign record keeps them", () => {
    const campaign = read("src/engine/campaign.js");
    expect(campaign).toContain("continuity.js");
    expect(campaign).toMatch(/facts,\s*at: Date\.now\(\)/);
  });

  it("A SCREEN OFFERS THEM BACK — the hop that gets forgotten", () => {
    const lobby = read("src/screens/Lobby.jsx");
    expect(lobby).toContain("CarryForward");
    expect(lobby).toMatch(/import CarryForward from "\.\/CarryForward\.jsx"/);

    const screen = read("src/screens/CarryForward.jsx");
    expect(screen).toContain("offerable");
    expect(screen).toContain("onDone");
  });

  it("App passes the handler and applies what was ticked", () => {
    const app = read("src/App.jsx");
    expect(app).toContain("onCarry={setCarried}");
    expect(app).toMatch(/carried\.length/);
  });

  it("APPLIES THROUGH warden.rule, NOT a second commit path", () => {
    const app = read("src/App.jsx");
    /* `commitW` is not exposed on the game object. Calling it
       would throw on the first session that carried anything, and
       no unit test would have seen it. One place appends a
       ruling. */
    expect(app).toContain("g.warden.rule");
    expect(app).not.toMatch(/g\.commitW/);
  });

  it("the export is reachable from the screen somebody is already on", () => {
    const ending = read("src/screens/Ending.jsx");
    expect(ending).toContain("toFragment");
    expect(ending).toContain("Export as a module fragment");
  });
});

describe("the safe direction is forgetting", () => {
  it("nothing is pre-ticked", () => {
    const screen = read("src/screens/CarryForward.jsx");
    /* Pre-ticking produces forty auto-applied facts and a table
       who taps continue without reading, which is clutter with a
       ceremony attached rather than continuity. */
    expect(screen).toContain("new Set()");
    expect(screen).not.toMatch(/new Set\(offered/);
  });

  it("carrying nothing is one tap and says so", () => {
    expect(read("src/screens/CarryForward.jsx")).toContain("Start fresh");
  });

  it("nothing composes a sentence anywhere in the path — INV-1", () => {
    const code = read("src/engine/continuity.js")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\brng\b/);
    expect(code).not.toMatch(/Math\.random/);
  });
});
