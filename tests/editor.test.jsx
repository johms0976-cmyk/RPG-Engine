// @vitest-environment jsdom
/* ============================================================
   THE EDITOR, WIRED.

   `tests/moduledraft.test.js` covers the model. This covers the
   two things a model test cannot see, and both of them are the
   class of bug this project keeps producing: a thing that is
   missing rather than wrong, failing as silence.

     1. THE DOOR. A capability whose only switch is somewhere the
        person who needs it never looks has not shipped (INV-9).
        Remote play sat behind an undocumented query string for
        three releases. So: the shelf offers this, the button
        reaches the screen, and the screen comes back.

     2. THE ROUND TRIP. What the editor writes has to be what the
        shelf reads. Not a similar shape — the same call, checked
        by starting a session with the result.
   ============================================================ */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import Editor from "../src/screens/Editor.jsx";
import Library from "../src/screens/Library.jsx";
import { loadInstalled, clearShelf } from "../src/engine/moduleStore.js";
import { clearDraft, blankDraft, toEnvelope } from "../src/engine/moduleDraft.js";
import mod from "../src/modules/deadweight/index.js";

beforeEach(() => { localStorage.clear(); clearShelf(); clearDraft(); });
afterEach(cleanup);

const open = (props = {}) => render(
  <Editor onBack={() => {}} onShelfChange={() => {}} {...props} />,
);

/* Scoped to the room list. The report panels above it are lists too,
   and an unscoped listitem query counts the coverage notes as rooms. */
const rooms = () => within(screen.getByRole("list", { name: "Rooms" })).getAllByRole("listitem");

/* ---------------- the door ---------------- */

describe("getting to it", () => {
  it("is offered on the shelf, beside loading somebody else's", () => {
    const onWrite = vi.fn();
    render(
      <Library modules={[mod]} onPick={() => {}} onResume={() => {}}
        onWardenTools={() => {}} onWrite={onWrite} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Write a module" }));
    expect(onWrite).toHaveBeenCalled();
  });

  it("does NOT offer to edit a bundled module", () => {
    /* Not a policy. Both shipped modules carry `hooks`, the portable
       format cannot, and the editor would refuse at the door — a
       button that always fails is worse than no button. */
    render(
      <Library modules={[mod]} onPick={() => {}} onResume={() => {}}
        onWardenTools={() => {}} onWrite={() => {}} />,
    );
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("comes back", () => {
    const onBack = vi.fn();
    open({ onBack });
    fireEvent.click(screen.getByRole("button", { name: "Back to the shelf" }));
    expect(onBack).toHaveBeenCalled();
  });
});

/* ---------------- the report ---------------- */

describe("what the engine says, while you type", () => {
  it("says a fresh draft loads", () => {
    open();
    expect(screen.getByText("This loads cleanly.")).toBeTruthy();
  });

  it("names a problem the moment it exists, and refuses the shelf", () => {
    open();
    fireEvent.click(screen.getByRole("tab", { name: "Rooms" }));
    /* Clearing the name is a `problem` in defineModule, not a
       warning: a room with no name cannot be rendered. */
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "" } });
    expect(screen.getByText(/1 problem — this will not load/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fix the problems first" })).toBeTruthy();
  });

  it("keeps the shape report OUT of the problems", () => {
    /* coverage.js is emphatic that none of it is an error, and an
       editor that renders "this room has no features" in red is
       telling an author their corridor is a bug. */
    open();
    expect(screen.getByText(/nothing here is wrong/)).toBeTruthy();
    expect(screen.queryByText(/problem — this will not load/)).toBeNull();
  });
});

/* ---------------- editing ---------------- */

describe("rooms", () => {
  it("adds one and selects it", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "+ Add a room" }));
    expect(rooms()).toHaveLength(2);
  });

  it("joins two rooms both ways by default", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "+ Add a room" }));
    fireEvent.change(screen.getByLabelText("A way to"), { target: { value: "start" } });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    /* Both rooms now report one exit each. */
    const list = rooms();
    expect(within(list[0]).getByText(/1 exit/)).toBeTruthy();
    expect(within(list[1]).getByText(/1 exit/)).toBeTruthy();
  });

  it("renames without breaking the exit that pointed at it", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "+ Add a room" }));
    fireEvent.change(screen.getByLabelText("A way to"), { target: { value: "start" } });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));

    fireEvent.click(rooms()[0]);
    fireEvent.change(screen.getByLabelText(/^Id/), { target: { value: "cargo hold" } });
    fireEvent.blur(screen.getByLabelText(/^Id/));

    expect(screen.getByText("This loads cleanly.")).toBeTruthy();
    /* The exit that pointed at it lives on the OTHER room, which is
       exactly why this is the failure worth testing: it is somewhere
       the author was not looking when they renamed. */
    fireEvent.click(rooms()[1]);
    expect(screen.getByText("\u2192 cargo-hold")).toBeTruthy();
  });

  it("will not delete the last room out from under itself", () => {
    open();
    expect(screen.getByRole("button", { name: "Delete this room" }).disabled).toBe(true);
  });

  it("undoes the last thing", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "+ Add a room" }));
    expect(rooms()).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(rooms()).toHaveLength(1);
  });
});

describe("the escape hatch", () => {
  it("takes a room the forms cannot express, and validates it", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "This room as JSON" }));
    fireEvent.change(screen.getByLabelText("Room"), {
      target: {
        value: JSON.stringify({
          name: "CARGO HOLD",
          look: "Crates lashed to the deck.",
          exits: [],
          features: {
            panel: { name: "Breaker panel", d: "A blown fuse.", effects: [{ stress: 1 }] },
          },
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByText("This loads cleanly.")).toBeTruthy();
  });

  it("says what is wrong rather than swallowing it", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "This room as JSON" }));
    fireEvent.change(screen.getByLabelText("Room"), { target: { value: "{ nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByText(/isn't valid JSON/)).toBeTruthy();
  });
});

/* ---------------- the round trip ---------------- */

describe("what it writes is what the shelf reads", () => {
  it("puts a module on the shelf that loads cleanly", () => {
    const onShelfChange = vi.fn();
    open({ onShelfChange });
    fireEvent.click(screen.getByRole("tab", { name: "About" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "THE HOLD" } });
    fireEvent.click(screen.getByRole("button", { name: "Put it on the shelf" }));

    expect(onShelfChange).toHaveBeenCalled();
    const { mods, broken } = loadInstalled();
    expect(broken).toEqual([]);
    expect(mods).toHaveLength(1);
    /* The guarantee. Not "a similar shape" — the shelf's own reader,
       reporting no problems, which is what the library card gates
       "New game" on. */
    expect(mods[0].problems).toEqual([]);
    expect(mods[0].portable).toBe(true);
  });

  it("opens what it wrote", () => {
    open({ open: toEnvelope({ ...blankDraft({ title: "THE HOLD" }), blurb: "Nine rooms." }) });
    fireEvent.click(screen.getByRole("tab", { name: "About" }));
    expect(screen.getByLabelText("Title").value).toBe("THE HOLD");
    expect(screen.getByLabelText("Blurb").value).toBe("Nine rooms.");
  });
});

/* ---------------- not losing an evening ---------------- */

describe("the draft", () => {
  it("survives the tab closing", () => {
    /* The commonest way an editor gets abandoned is losing an hour
       of writing to a closed tab. */
    const first = open();
    fireEvent.click(screen.getByRole("button", { name: "+ Add a room" }));
    first.unmount();

    open();
    expect(rooms()).toHaveLength(2);
  });

  it("is NOT on the shelf until somebody puts it there", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "+ Add a room" }));
    expect(loadInstalled().mods).toEqual([]);
  });

  it("gives way to a module handed in from the shelf", () => {
    const first = open();
    fireEvent.click(screen.getByRole("button", { name: "+ Add a room" }));
    first.unmount();

    open({ open: toEnvelope(blankDraft({ title: "SOMETHING ELSE" })) });
    expect(rooms()).toHaveLength(1);
  });
});
