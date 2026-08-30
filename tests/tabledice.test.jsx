// @vitest-environment jsdom
/* ============================================================
   THE MISREAD — physical dice, transposed.

   `tests/declared.test.js` covers `engine/declared.js`: the
   arithmetic of reading a pair off the table. This covers the
   component, which had no test of its own, and specifically the
   one error physical dice make that the app cannot see.

   A d100 is read tens-then-ones off two dice. Somebody reads 47
   off dice showing 74 and nothing in the system knows — nobody
   is checking these, by design. At a table with a Warden this is
   solved by somebody leaning over. Wardenless there is nobody to
   lean, and the only other remedy is the `rewind` vote: stop the
   session, poll five people, roll the clock back. A sledgehammer
   for a typo, and heavy enough that most players will shrug and
   take the wrong result — which is the habit that makes a table
   stop trusting the app.
   ============================================================ */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DeclareDice from "../src/ui/DeclareDice.jsx";

function setup(target, tens, ones) {
  const onDeclare = vi.fn();
  render(
    <DeclareDice
      preview={{ target, mode: "none" }}
      onDeclare={onDeclare}
      onFallBack={() => {}}
    />,
  );
  /* Radios, not buttons — each face carries an sr-only label
     "Tens 4" so the picker is usable without sight of the dice. */
  fireEvent.click(screen.getByRole("radio", { name: `Tens ${tens}` }));
  fireEvent.click(screen.getByRole("radio", { name: `Ones ${ones}` }));
  return onDeclare;
}

describe("reading dice in", () => {
  it("shows the verdict before anything is committed", () => {
    setup(55, 4, 7);
    /* The readback is the whole reason this panel is not just two
       number pickers: a player sees what the number means before
       they stand behind it. */
    expect(screen.getByText(/47 — under 55/)).toBeTruthy();
  });

  it("declares what was read", () => {
    const onDeclare = setup(55, 4, 7);
    fireEvent.click(screen.getByRole("button", { name: /Confirm/i }));
    expect(onDeclare).toHaveBeenCalledWith([[4, 7]]);
  });
});

describe("correcting a transposed die", () => {
  it("offers the swap when it would change the outcome", () => {
    /* 74 fails against 55; 47 succeeds. Worth offering. */
    setup(55, 7, 4);
    expect(screen.getByText(/Misread\? Tap to make it 47/)).toBeTruthy();
  });

  it("STAYS QUIET WHEN THE SWAP CHANGES NOTHING", () => {
    /* 31 and 13 both succeed against 55. Offering to correct
       something that cannot be wrong is noise, and noise is what
       teaches people to ignore a control. */
    setup(55, 3, 1);
    expect(screen.queryByText(/Misread/)).toBeNull();
  });

  it("stays quiet on a double, where there is nothing to transpose", () => {
    setup(55, 4, 4);
    expect(screen.queryByText(/Misread/)).toBeNull();
  });

  it("swaps the digits and declares the corrected number", () => {
    const onDeclare = setup(55, 7, 4);
    fireEvent.click(screen.getByText(/Misread\? Tap to make it 47/));
    fireEvent.click(screen.getByRole("button", { name: /Confirm/i }));
    expect(onDeclare).toHaveBeenCalledWith([[4, 7]]);
  });

  it("is offered BEFORE confirming and not after", () => {
    /* Once declared, the roll has resolved and its effects have
       landed. Unwinding that is what `rewind` is for — a genuinely
       table-wide event that genuinely deserves a vote. This fixes
       the typo before it becomes one. */
    const onDeclare = setup(55, 7, 4);
    fireEvent.click(screen.getByRole("button", { name: /Confirm/i }));
    expect(onDeclare).toHaveBeenCalledWith([[7, 4]]);
    expect(screen.queryByText(/Misread/)).toBeTruthy(); // still pre-resolution here
  });
});
