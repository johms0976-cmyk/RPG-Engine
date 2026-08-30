// @vitest-environment jsdom
/* ============================================================
   WHILE YOU WERE AWAY.

   `buildRecap` has existed since 2.11 and has only ever been
   called with the Warden's mark, for the whole table at once. A
   player back from the kitchen had no way to ask for their own,
   and the machinery to give them one was already there.

   The thresholds are the design. Both fail toward silence,
   because an offer that never appears costs nothing and one that
   appears when the table was idle costs the trust that makes
   somebody tap it the time it matters.
   ============================================================ */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useAwayMark, AWAY_MIN_MS, AWAY_MIN_LINES,
} from "../src/net/useAwayMark.js";

const feedOf = (n, from = 0) =>
  Array.from({ length: n }, (_, i) => ({ id: from + i + 1, kind: "warden", text: `line ${i}` }));

function hide() {
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
}
function show() {
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
}

afterEach(() => { vi.useRealTimers(); });

describe("marking where somebody stopped watching", () => {
  it("offers a catch-up after a real absence with real content", () => {
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(1000);

    const { result, rerender } = renderHook(
      ({ feed }) => useAwayMark(feed, true),
      { initialProps: { feed: feedOf(3) } },
    );
    hide();

    /* Away long enough, and the table kept playing. */
    now.mockReturnValue(1000 + AWAY_MIN_MS + 1);
    rerender({ feed: feedOf(3 + AWAY_MIN_LINES) });
    show();

    expect(result.current.sinceId).toBe(3);
    expect(result.current.missed).toBe(AWAY_MIN_LINES);
    now.mockRestore();
  });

  it("STAYS QUIET FOR A GLANCE AT A NOTIFICATION", () => {
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(1000);
    const { result, rerender } = renderHook(
      ({ feed }) => useAwayMark(feed, true),
      { initialProps: { feed: feedOf(3) } },
    );
    hide();
    now.mockReturnValue(1000 + 5000); // five seconds
    rerender({ feed: feedOf(30) });
    show();
    expect(result.current.sinceId).toBeNull();
    now.mockRestore();
  });

  it("STAYS QUIET WHEN NOTHING HAPPENED WHILE THEY WERE OUT", () => {
    /* Ten minutes away during a quiet scene is not missing
       anything. A card saying "you missed: the lights flicker"
       teaches people the feature is noise. */
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(1000);
    const { result, rerender } = renderHook(
      ({ feed }) => useAwayMark(feed, true),
      { initialProps: { feed: feedOf(3) } },
    );
    hide();
    now.mockReturnValue(1000 + AWAY_MIN_MS * 20);
    rerender({ feed: feedOf(4) }); // one line
    show();
    expect(result.current.sinceId).toBeNull();
    now.mockRestore();
  });

  it("does nothing when play is not running", () => {
    const { result } = renderHook(() => useAwayMark(feedOf(3), false));
    hide();
    show();
    expect(result.current.sinceId).toBeNull();
  });

  it("can be dismissed", () => {
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(1000);
    const { result, rerender } = renderHook(
      ({ feed }) => useAwayMark(feed, true),
      { initialProps: { feed: feedOf(3) } },
    );
    hide();
    now.mockReturnValue(1000 + AWAY_MIN_MS + 1);
    rerender({ feed: feedOf(20) });
    show();
    expect(result.current.sinceId).toBe(3);
    act(() => result.current.clear());
    expect(result.current.sinceId).toBeNull();
    now.mockRestore();
  });
});

describe("it is wired to the phone", () => {
  it("ClientShell builds a card from the client's OWN feed", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(resolve(__dirname, "../src/net/ClientShell.jsx"), "utf8");
    expect(src).toContain("useAwayMark");
    /* The client's feed is already redacted, so a catch-up can
       never show somebody something they were not told in the
       first place — INV-3 holds without a second thought. */
    expect(src).toContain("buildRecap");
    expect(src).toContain("awayRecap");
  });
});
