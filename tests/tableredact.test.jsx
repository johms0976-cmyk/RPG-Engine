// @vitest-environment jsdom
/* ============================================================
   WHAT THE SHARED SCREEN IS ALLOWED TO SAY

   Every one of these failed before the change that added them,
   and the whole suite passed anyway — 1107 tests, none of which
   ever asked the table screen what it was showing. That is the
   more interesting fact about this file than any single case in
   it: TableView opened by *claiming* it held no secrets, and a
   claim in a comment is not a test.

   Four groups:

     the enemy list   an unseen thing, and its hit tally
     the feed         lines addressed to somebody else
     the party        where people are, once they are not
                      all in the same place
     the moments      Panic and Death, at size, without
                      the arithmetic that belongs on a phone

   The couch layout is checked alongside the desk one in the
   first two groups, because it is the same shared screen at a
   different distance and a leak fixed on one is not fixed.
   ============================================================ */
import React from "react";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import TableView from "../src/screens/TableView.jsx";
import TableFar from "../src/screens/TableFar.jsx";
import { momentFrom } from "../src/ui/TableMoment.jsx";

beforeAll(() => { Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {}); });
afterEach(() => cleanup());

/* ---------------- a table with something invisible in it ----------------

   `unseen: true` with no `seenWith` is the Ypsilon 14 shape: a
   threat that cannot be perceived at all without the right item.
   `redactCombat` should swap the name for `combatLabel` and zero
   the tally. */
const MOD = {
  id: "t", title: "THE THING IN THE HOLD",
  rooms: {
    hold: { name: "CARGO HOLD", look: "cold", exits: [], features: {} },
    duct: { name: "DUCTING", look: "tight", exits: [], features: {} },
  },
  handouts: {},
  items: {},
  threats: {
    unseen: { name: "IT", combatLabel: "SOMETHING YOU CANNOT SEE", unseen: true, seenWith: "ir" },
    dog: { name: "GUARD DOG" },
  },
};

const CREW = [
  { id: "a", name: "RILEY", health: 10, maxHealth: 10, stress: 2, alive: true },
  { id: "b", name: "VOSS", health: 4, maxHealth: 10, stress: 9, alive: true },
  { id: "c", name: "DANA", health: 8, maxHealth: 10, stress: 5, alive: true },
];

const COMBAT = {
  round: 2,
  turnIndex: 0,
  order: [{ side: "enemy", id: "unseen#0" }],
  enemies: [
    { uid: "unseen#0", threatId: "unseen", name: "IT", wounds: 2, maxWounds: 3, dead: false },
    { uid: "dog#0", threatId: "dog", name: "GUARD DOG", wounds: 0, maxWounds: 2, dead: false },
  ],
};

const game = (over = {}) => ({
  mod: MOD,
  w: { room: "hold", clock: 90, flags: {}, ...(over.w || {}) },
  crew: over.crew || CREW,
  feed: over.feed || [],
  combat: over.combat || null,
});

/* ============================================================
   THE THING THAT IS NOT IN THE LIST
   ============================================================ */
describe("an unseen threat, on the screen everybody is reading", () => {
  it("does not name it", () => {
    render(<TableView g={game({ combat: COMBAT })} peers={[]} />);
    expect(screen.queryByText("IT")).toBeNull();
    expect(screen.getByText("SOMETHING YOU CANNOT SEE")).toBeTruthy();
  });

  /* The tally is the worse half of the leak and the easier one to
     leave in by accident, because the name looks like the secret. */
  it("does not count its wounds", () => {
    const { container } = render(<TableView g={game({ combat: COMBAT })} peers={[]} />);
    expect(container.textContent).not.toMatch(/2\/3/);
  });

  it("still names a threat the crew can plainly see", () => {
    render(<TableView g={game({ combat: COMBAT })} peers={[]} />);
    expect(screen.getByText("GUARD DOG")).toBeTruthy();
    expect(screen.getByText("0/2 wounds")).toBeTruthy();
  });

  /* `combat.order` entries are {side, id} and carry no name, so the
     old label fell through to the uid — which is the threat's key. */
  it("does not print a raw uid when it is the thing's go", () => {
    const { container } = render(<TableView g={game({ combat: COMBAT })} peers={[]} />);
    expect(container.textContent).not.toMatch(/unseen#0/);
    expect(container.textContent).toMatch(/Acting: SOMETHING YOU CANNOT SEE/);
  });

  it("keeps all of that true at couch distance too", () => {
    const { container } = render(<TableFar g={game({ combat: COMBAT })} peers={[]} />);
    expect(screen.queryByText("IT")).toBeNull();
    expect(container.textContent).not.toMatch(/unseen#0/);
    expect(container.textContent).not.toMatch(/2\/3/);
  });
});

/* ============================================================
   ADDRESSED LINES
   ============================================================ */
describe("the feed, on a screen the whole room can read", () => {
  const FEED = [
    { id: 1, kind: "room", text: "The hold is cold and badly lit." },
    { id: 2, kind: "room", text: "THE DUCT IS WARM ON ONE SIDE", to: ["b"] },
    { id: 3, kind: "warden", text: "A private note", wardenOnly: true },
    { id: 4, kind: "say", text: "Riley says they can hear something." },
  ];

  it("shows the lines nobody was singled out for", () => {
    render(<TableView g={game({ feed: FEED })} peers={[]} />);
    expect(screen.getByText(/The hold is cold/)).toBeTruthy();
    expect(screen.getByText(/Riley says they can hear/)).toBeTruthy();
  });

  it("does not show a line addressed to one person", () => {
    const { container } = render(<TableView g={game({ feed: FEED })} peers={[]} />);
    expect(container.textContent).not.toMatch(/THE DUCT IS WARM/);
  });

  it("does not show a Warden's private note", () => {
    const { container } = render(<TableView g={game({ feed: FEED })} peers={[]} />);
    expect(container.textContent).not.toMatch(/A private note/);
  });

  it("strips secretText rather than rendering it", () => {
    const feed = [{ id: 1, kind: "room", text: "A locker.", secretText: "THE CODE IS 4417" }];
    const { container } = render(<TableView g={game({ feed })} peers={[]} />);
    expect(container.textContent).not.toMatch(/4417/);
  });

  it("keeps an addressed line off the couch layout as well", () => {
    const { container } = render(<TableFar g={game({ feed: FEED })} peers={[]} />);
    expect(container.textContent).not.toMatch(/THE DUCT IS WARM/);
  });
});

/* ============================================================
   THE PARTY, ONCE IT COMES APART
   ============================================================ */
describe("a split party, on the shared screen", () => {
  const SPLIT = [
    { ...CREW[0], room: "hold" },
    { ...CREW[1], room: "duct" },
    { ...CREW[2], room: "hold" },
  ];

  it("says nothing about groups while everybody is together", () => {
    const { container } = render(<TableView g={game()} peers={[]} />);
    expect(container.querySelector(".table-groups")).toBeNull();
    /* And the room name is exactly where it always was. */
    expect(screen.getByText("CARGO HOLD")).toBeTruthy();
  });

  it("names every occupied room once they are apart", () => {
    render(<TableView g={game({ crew: SPLIT })} peers={[]} />);
    expect(screen.getByText("CARGO HOLD")).toBeTruthy();
    expect(screen.getByText("DUCTING")).toBeTruthy();
  });

  it("says who is in each", () => {
    const { container } = render(<TableView g={game({ crew: SPLIT })} peers={[]} />);
    expect(container.textContent).toMatch(/RILEY, DANA/);
    expect(container.textContent).toMatch(/VOSS/);
  });

  /* Being on your own is the condition the whole module is usually
     built around, so it gets its own marker rather than being
     something you work out by counting names. */
  it("marks the person who is on their own", () => {
    const { container } = render(<TableView g={game({ crew: SPLIT })} peers={[]} />);
    const alone = container.querySelectorAll(".table-group.is-alone");
    expect(alone.length).toBe(1);
    expect(alone[0].textContent).toMatch(/VOSS/);
  });

  /* The reversal recorded in TableView's comment: where people are
     standing is public, what they are being told is not. Nothing on
     this strip may reveal that a group received a line. */
  it("does not reveal which group the chair last spoke to", () => {
    const feed = [{ id: 1, kind: "room", text: "SOMETHING IS BREATHING IN HERE", to: ["b"] }];
    const { container } = render(<TableView g={game({ crew: SPLIT, feed })} peers={[]} />);
    expect(container.textContent).not.toMatch(/SOMETHING IS BREATHING/);
    expect(container.querySelectorAll(".table-group.is-focus").length).toBe(0);
  });
});

/* ============================================================
   PANIC AND DEATH
   ============================================================ */
describe("picking the moment out of a feed", () => {
  const panicLine = (id, effect) => ({
    id, kind: "panic", text: "PANIC CHECK · RILEY · PANICS.",
    extra: { panic: { pcId: "a", who: "RILEY", effect, detail: "Something about it." } },
  });
  const deathLine = (id, survived) => ({
    id, kind: survived ? "rollgood" : "rollbad", text: "DEATH · VOSS",
    extra: { death: { pcId: "b", name: "VOSS", save: 25, roll: 88, survived, why: null } },
  });

  it("finds a panic by its stamp, not by parsing the sentence", () => {
    const m = momentFrom([panicLine(4, "Spiral")]);
    expect(m.kind).toBe("panic");
    expect(m.name).toBe("SPIRAL");
    expect(m.who).toBe("RILEY");
  });

  it("ignores a panic-kind line with no stamp", () => {
    /* Holding it together is not a panic and must not take the
       shared screen. It carries no stamp, which is how we know. */
    const m = momentFrom([{ id: 1, kind: "panic", text: "PANIC CHECK · RILEY · holds it together." }]);
    expect(m).toBeNull();
  });

  it("prefers the later line when a death lands on top of a panic", () => {
    const m = momentFrom([panicLine(1, "Spiral"), deathLine(2, false)]);
    expect(m.kind).toBe("death");
    expect(m.survived).toBe(false);
  });

  it("ignores anything at or below the id already shown", () => {
    expect(momentFrom([panicLine(3, "Spiral")], 3)).toBeNull();
    expect(momentFrom([panicLine(3, "Spiral")], 2)).not.toBeNull();
  });
});

describe("the moment, on the shared screen", () => {
  const withPanic = (id) => ([
    { id: 1, kind: "room", text: "The hold." },
    {
      id, kind: "panic", text: "PANIC CHECK · RILEY · PANICS.",
      extra: { panic: { pcId: "a", who: "RILEY", effect: "Spiral", detail: "d" } },
    },
  ]);

  it("does not replay history when it mounts", () => {
    /* A table screen reloading an hour in must not announce a death
       from forty minutes ago. */
    const { container } = render(<TableView g={game({ feed: withPanic(2) })} peers={[]} />);
    expect(container.querySelector(".tablemoment")).toBeNull();
  });

  it("takes the screen when one arrives", () => {
    const g0 = game({ feed: withPanic(2) });
    const { container, rerender } = render(<TableView g={g0} peers={[]} />);
    act(() => {
      rerender(<TableView g={{ ...g0, feed: [...g0.feed, {
        id: 3, kind: "panic", text: "PANIC CHECK · VOSS · PANICS.",
        extra: { panic: { pcId: "b", who: "VOSS", effect: "Screaming", detail: null } },
      }] }} peers={[]} />);
    });
    const el = container.querySelector(".tablemoment");
    expect(el).toBeTruthy();
    expect(el.textContent).toMatch(/SCREAMING/);
    expect(el.textContent).toMatch(/VOSS/);
  });

  /* The split with the handset: the room gets the name, the player
     gets the arithmetic. A save value on the wall turns a death
     into a scoreboard. */
  it("carries no numbers", () => {
    const g0 = game();
    const { container, rerender } = render(<TableView g={g0} peers={[]} />);
    act(() => {
      rerender(<TableView g={{ ...g0, feed: [{
        id: 9, kind: "rollbad", text: "DEATH · VOSS — Body Save 25%, rolled 88 · dies.",
        extra: { death: { pcId: "b", name: "VOSS", save: 25, roll: 88, survived: false, why: null } },
      }] }} peers={[]} />);
    });
    const el = container.querySelector(".tablemoment");
    expect(el).toBeTruthy();
    expect(el.textContent).toMatch(/DEAD/);
    expect(el.textContent).toMatch(/VOSS/);
    expect(el.textContent).not.toMatch(/25/);
    expect(el.textContent).not.toMatch(/88/);
  });
});
