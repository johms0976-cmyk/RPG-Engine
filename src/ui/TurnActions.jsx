/* ============================================================
   TURN ACTIONS — "it's my go, what are my two actions?"

   The Actions panel is a good control surface and answers a
   different question: what can I press. This answers the one a
   new player actually asks, which is what an *action* is. The
   Player's Cheat Sheet answers it in fourteen bullets — attack,
   bandage, check vitals, draw a holstered weapon, find something
   in your pack, move half your Speed, open a door, operate a
   machine, throw something, take a drug, use a computer, use an
   item — and a table with one experienced Warden spends the first
   fight relaying that list out loud, one player at a time.

   Three rules kept this from being a second Actions panel:

     · IT IS A REFERENCE, NOT A CONTROL. Nothing here is a button
       that does anything. The buttons are eight inches below and
       already work; duplicating them would mean two places to
       press for the same thing and one of them subtly wrong.

     · IT SHOWS WHAT IS OFF AS WELL AS WHAT IS ON. A greyed row
       with a reason attached — "no free hand", "nothing loaded" —
       teaches the rule. A row that vanishes teaches nothing, and
       the player concludes the app is broken. This is the one
       place in the client where the argument for hiding
       unavailable options is the wrong way round: the Actions
       panel hides them because the player is *choosing*, and this
       shows them because the player is *learning*.

     · IT COLLAPSES. An experienced player reads it once in the
       first fight and never again, so it remembers being shut,
       and it only ever appears on your own turn.

   Everything it says about availability is derived from state
   that is already on the phone. It asks the engine nothing.
   ============================================================ */
import React, { useState } from "react";

/**
 * The standard action menu, in cheat-sheet order. `test` decides
 * whether this character can do it right now and, when they
 * cannot, says why in four words or fewer.
 */
const ACTIONS = [
  {
    id: "attack",
    label: "Attack",
    cost: "1 action",
    test: ({ armed, target }) =>
      !armed ? "nothing you can fire"
        : !target ? "nothing selected" : true,
  },
  {
    id: "move",
    label: "Move — half your Speed in metres",
    cost: "1 action",
    test: ({ held }) => (held ? "something has hold of you" : true),
  },
  {
    id: "tear",
    label: "Tear free",
    cost: "whole turn",
    test: ({ held }) => (held ? true : "nothing is holding you"),
    onlyWhen: ({ held }) => held,
  },
  {
    id: "aim",
    label: "Aim — Advantage on your next shot",
    cost: "whole turn",
    test: ({ actions, held }) =>
      held ? "something has hold of you"
        : actions >= 2 ? true : "needs both actions",
  },
  {
    id: "reload",
    label: "Reload",
    cost: "1 action",
    test: ({ reloadable }) => (reloadable ? true : "nothing to reload"),
  },
  {
    id: "draw",
    label: "Draw a holstered weapon",
    cost: "1 action",
    test: ({ carrying }) => (carrying ? true : "your hands are empty"),
  },
  {
    id: "item",
    label: "Use an item, or find one in your pack",
    cost: "1 action",
    test: ({ carrying }) => (carrying ? true : "you are carrying nothing"),
  },
  {
    id: "drug",
    label: "Take a drug",
    cost: "1 action",
    test: ({ hasDrug }) => (hasDrug ? true : "nothing on you"),
  },
  {
    id: "vitals",
    label: "Bandage a wound, or check a crewmate's vitals",
    cost: "1 action",
    test: ({ others }) => (others ? true : "nobody within reach"),
  },
  {
    id: "door",
    label: "Open a door or an airlock",
    cost: "1 action",
    test: () => true,
  },
  {
    id: "machine",
    label: "Operate a machine, or use a computer",
    cost: "1 action",
    test: () => true,
  },
  {
    id: "throw",
    label: "Throw something",
    cost: "1 action",
    test: ({ carrying }) => (carrying ? true : "you are carrying nothing"),
  },
  {
    id: "flee",
    label: "Run for it",
    cost: "whole turn",
    test: ({ held }) => (held ? "tear free first" : true),
  },
];

export default function TurnActions({ ctx, actionsLeft }) {
  const [open, setOpen] = useState(false);

  const rows = ACTIONS
    .filter((a) => !a.onlyWhen || a.onlyWhen(ctx))
    .map((a) => {
      const r = a.test(ctx);
      return { ...a, ok: r === true, why: r === true ? null : r };
    });

  const ready = rows.filter((r) => r.ok).length;

  return (
    <section className={`turnref${open ? " is-open" : ""}`}>
      <button type="button" className="turnref-head" onClick={() => setOpen(!open)}
        aria-expanded={open}>
        <span className="turnref-count">
          {actionsLeft} action{actionsLeft === 1 ? "" : "s"} left
        </span>
        <span className="turnref-hint">
          {open ? "hide what an action is" : `what are my ${actionsLeft === 1 ? "options" : "two actions"}?`}
        </span>
        <span className="turnref-chev" aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <>
          <p className="turnref-lede">
            Two actions a turn. Attacking is one of them, and so is walking
            across the room — the fourteen below are the whole menu.
            {ready < rows.length ? " The greyed ones say why not." : ""}
          </p>
          <ul className="turnref-list">
            {rows.map((r) => (
              <li key={r.id} className={r.ok ? "" : "is-off"}>
                <span className="turnref-label">{r.label}</span>
                <span className="turnref-cost">{r.ok ? r.cost : r.why}</span>
              </li>
            ))}
          </ul>
          <p className="turnref-foot">
            Nothing here is a button — the ones you can take are in Actions
            below. Movement is half your Speed in metres, per action.
          </p>
        </>
      )}
    </section>
  );
}
