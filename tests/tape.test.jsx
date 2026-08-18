// @vitest-environment jsdom
/* ============================================================
   The cassettes: geometry, wiring, and the two places a tape is
   allowed to appear.

   jsdom will not decode audio, so nothing here asserts that a
   sound came out. What it can assert is everything that was
   actually broken before: that the files are reachable at all,
   that the transport exists where it should and nowhere else,
   and that the transcript never goes away.
   ============================================================ */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Artefact } from "../src/ui/Artefact.jsx";
import { spoolRadius, clockOf } from "../src/ui/TapeDeck.jsx";
import ypsilon from "../src/modules/ypsilon14/index.js";

describe("spool geometry", () => {
  it("is the hub when empty and full at the end", () => {
    expect(spoolRadius(0)).toBeCloseTo(7, 5);
    expect(spoolRadius(1)).toBeCloseTo(25, 5);
  });

  it("grows by area, not by length — half the tape is past halfway", () => {
    // sqrt(49 + 576*0.5) = 18.36, comfortably above the linear 16.
    expect(spoolRadius(0.5)).toBeGreaterThan(17.5);
  });

  it("survives nonsense rather than drawing a negative radius", () => {
    expect(spoolRadius(NaN)).toBeCloseTo(7, 5);
    expect(spoolRadius(-3)).toBeCloseTo(7, 5);
    expect(spoolRadius(9)).toBeCloseTo(25, 5);
  });
});

describe("the counter", () => {
  it("reads as minutes and seconds", () => {
    expect(clockOf(0)).toBe("0:00");
    expect(clockOf(9)).toBe("0:09");
    expect(clockOf(180)).toBe("3:00");
  });
  it("never shows a negative or a NaN", () => {
    expect(clockOf(-5)).toBe("0:00");
    expect(clockOf(undefined)).toBe("0:00");
  });
});

describe("the module's tapes", () => {
  it("carries a real recording on each of the three found tapes", () => {
    for (const id of ["tape1", "tape2", "tape3"]) {
      const h = ypsilon.handouts[id];
      expect(h, id).toBeTruthy();
      expect(typeof h.audio, id).toBe("string");
      expect(h.audio.length, id).toBeGreaterThan(0);
      expect(h.audioSecs, id).toBeGreaterThan(0);
    }
  });

  it("keeps the transcript on every tape that has audio", () => {
    for (const id of ["tape1", "tape2", "tape3"]) {
      expect(ypsilon.handouts[id].text.length).toBeGreaterThan(40);
    }
  });

  it("leaves the decoy tape silent — the crew records that one", () => {
    expect(ypsilon.handouts.tape4.audio).toBeUndefined();
  });

  it("still requires something to play it on", () => {
    for (const id of ["tape1", "tape2", "tape3"]) {
      expect(ypsilon.handouts[id].needs).toBe("tag:player");
    }
  });
});

describe("where a tape may be played", () => {
  const tape = ypsilon.handouts.tape2;

  it("gives the held-up view a transport", () => {
    render(<Artefact id="tape2" handout={tape} flat />);
    expect(screen.getByLabelText(/Play/i)).toBeTruthy();
  });

  it("keeps the transcript alongside it", () => {
    render(<Artefact id="tape2" handout={tape} flat />);
    expect(screen.getByText(/Mike Voss/)).toBeTruthy();
  });

  it("puts no controls inside the rack button", () => {
    const { container } = render(
      <Artefact id="tape2" handout={tape} onOpen={() => {}} />
    );
    const shell = container.querySelector(".artefact-shell");
    expect(shell).toBeTruthy();
    expect(shell.querySelectorAll("button, input, audio").length).toBe(0);
  });

  it("marks a playable tape in the rack so you know to pick it up", () => {
    render(<Artefact id="tape2" handout={tape} onOpen={() => {}} />);
    expect(screen.getByText(/Playable/)).toBeTruthy();
  });

  it("does not grow a transport on a handout with no recording", () => {
    const { container } = render(
      <Artefact id="tape4" handout={ypsilon.handouts.tape4} flat />
    );
    expect(container.querySelector("audio")).toBeNull();
  });
});
