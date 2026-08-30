// @vitest-environment jsdom
/* ============================================================
   THE TWO PREP SURFACES, WIRED.

   `tests/paper.test.js` and `tests/analytics.test.js` cover what
   the two engines compute. This covers the thing neither of them
   can see, and the thing this project keeps getting wrong: the
   door.

   INV-9. Remote play worked for three releases and was reachable
   only by knowing an undocumented query string. A capability
   whose only switch is somewhere the person who needs it never
   looks has not shipped, so every one of these tests starts from
   a screen a person actually lands on and clicks its way in.
   ============================================================ */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import Library from "../src/screens/Library.jsx";
import Paper from "../src/screens/Paper.jsx";
import WardenTools from "../src/screens/WardenTools.jsx";
import { createCampaign, recordSession, forgetCampaign, listCampaigns } from "../src/engine/campaign.js";
import mod from "../src/modules/deadweight/index.js";

beforeEach(() => { localStorage.clear(); });
afterEach(cleanup);

/* ---------------- paper mode ---------------- */

describe("getting to paper", () => {
  it("is offered on every module's card", () => {
    const onPaper = vi.fn();
    render(
      <Library modules={[mod]} onPick={() => {}} onResume={() => {}}
        onWardenTools={() => {}} onPaper={onPaper} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Print it" }));
    expect(onPaper).toHaveBeenCalledWith(mod);
  });
});

describe("the printed pack", () => {
  it("puts the author's own words on the page", () => {
    render(<Paper mod={mod} onBack={() => {}} />);
    const first = Object.values(mod.rooms)[0];
    expect(screen.getByRole("heading", { level: 1, name: mod.title })).toBeTruthy();
    expect(screen.getByText(first.look)).toBeTruthy();
  });

  it("prints the whole module by default rather than a third of it", () => {
    /* Somebody who presses Print without reading the bar should get
       the folder, not a fragment of it. */
    render(<Paper mod={mod} onBack={() => {}} />);
    for (const name of ["The module", "Cast and threats", "Handouts and tables", "Blank character sheets"]) {
      expect(screen.getByRole("checkbox", { name }).checked).toBe(true);
    }
  });

  it("drops a section when it is switched off", () => {
    render(<Paper mod={mod} onBack={() => {}} />);
    expect(screen.getByRole("heading", { name: "Rooms" })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "The module" }));
    expect(screen.queryByRole("heading", { name: "Rooms" })).toBeNull();
  });

  it("prints as many blank sheets as the table needs", () => {
    render(<Paper mod={mod} onBack={() => {}} />);
    const suggested = mod.crewSize.suggested;
    expect(screen.getAllByRole("heading", { name: "Character" })).toHaveLength(suggested);
    fireEvent.change(screen.getByLabelText("How many sheets"), { target: { value: "2" } });
    expect(screen.getAllByRole("heading", { name: "Character" })).toHaveLength(2);
  });

  it("leaves the sheets blank", () => {
    /* A sheet with numbers on it is a pregen, and a table who wanted
       pregens can print a finished crew instead. */
    render(<Paper mod={mod} onBack={() => {}} />);
    const sheet = screen.getAllByRole("heading", { name: "Character" })[0].closest("section");
    expect(within(sheet).queryByText(/\d\d/)).toBeNull();
  });

  it("comes back", () => {
    const onBack = vi.fn();
    render(<Paper mod={mod} onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalled();
  });
});

/* ---------------- analytics ---------------- */

describe("getting to what the module did", () => {
  it("says why there is nothing to read, rather than showing an empty report", () => {
    /* A table that never named a campaign has no record. Rendering
       zeroes would read as "nobody engaged with your module", which
       is a different and much worse claim than "you have not kept a
       record". */
    render(<WardenTools onBack={() => {}} modules={[mod]} />);
    expect(screen.getByText(/No campaigns yet/)).toBeTruthy();
  });

  it("reports on a campaign that has actually played something", () => {
    const c = createCampaign("THE LONG HAUL");
    recordSession(c.id, {
      sessionId: "s1",
      modId: mod.id,
      modTitle: mod.title,
      ending: Object.keys(mod.endings)[0],
      survivors: ["RILEY"],
      lost: [],
      minutes: 180,
      mod,
      feed: [],
      world: {
        visited: { [mod.start]: true },
        searched: {}, flags: {}, npcs: {}, handouts: {}, rollLog: [], clock: 180,
        ended: Object.keys(mod.endings)[0], rulings: [],
      },
    });

    render(<WardenTools onBack={() => {}} modules={[mod]} />);
    expect(screen.getByText(/1 session/)).toBeTruthy();
    /* One room was reached; the rest of a nine-room module was not,
       and naming them is the entire feature. */
    expect(screen.getByText("ROOMS NOBODY HAS REACHED")).toBeTruthy();
    forgetCampaign(c.id);
  });

  it("writes a digest that carries counts and no prose", () => {
    const c = createCampaign("THE LONG HAUL");
    recordSession(c.id, {
      sessionId: "s1", modId: mod.id, modTitle: mod.title, ending: "", minutes: 10,
      survivors: [], lost: [], mod, feed: [],
      world: {
        visited: { [mod.start]: true }, searched: {}, flags: {}, npcs: {},
        handouts: {}, rollLog: [], clock: 10, rulings: [],
      },
    });
    const stored = listCampaigns().find((x) => x.id === c.id);
    const digest = stored.sessions[0].digest;
    expect(digest).toBeTruthy();
    expect(digest.modId).toBe(mod.id);
    expect(typeof digest.misses).toBe("number");
    forgetCampaign(c.id);
  });

  it("is unaffected by a caller that passes no world", () => {
    /* Every pre-2.20 call site. `digest` is null and nothing throws —
       the same contract `facts` has had since 2.18. */
    const c = createCampaign("OLD");
    recordSession(c.id, {
      sessionId: "s1", modId: mod.id, modTitle: mod.title,
      ending: "", minutes: 5, survivors: [], lost: [],
    });
    const stored = listCampaigns().find((x) => x.id === c.id);
    expect(stored.sessions[0].digest).toBeNull();
    forgetCampaign(c.id);
  });
});
