// @vitest-environment jsdom
/* ============================================================
   THE TABLE'S RULING, WITH HANDS.

   `tests/tableruling.test.js` tests the threshold arithmetic.
   This is the half that arithmetic cannot see, and it is written
   against the failure this repository has now shipped FOUR
   times — see the same list in `correction-wired.test.jsx`:

     · `sessionEndsAt`   rung, plan and hook parameters, four
                         green assertions, no producer.
     · `floor.on`        a complete scoring file whose only
                         switch was on a screen wardenless mode
                         locks away.
     · `C_DISPUTE`       protocol message, relay case, host
                         handler, ledger — and no sender anywhere
                         in the application for three versions.
     · `ruling.js`       durable, parseable, save-surviving
                         improvised facts, reachable only from
                         `screens/warden/RulingBox.jsx`, which
                         INV-9 forbids a wardenless table from
                         opening. Shipped in 2.14, unreachable by
                         the configuration that most needs it
                         until this change.

   The fourth is why `tableRuling.js` exists, so a test that only
   proved the quorum works would be repeating the exact mistake
   it was written to correct.

   So these assertions go through the SOURCE as well as the
   logic. A message nothing sends, a relay case nothing routes, a
   snapshot field nothing packs, and a button nobody draws are
   all invisible to a unit test and all fatal at a table.
   ============================================================ */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  propose, second, emptyProposals, PROPOSAL_QUORUM,
} from "../src/engine/tableRuling.js";
import { C_PROPOSE, C_SECOND } from "../src/net/protocol.js";
import { SCOPE, roomAddendum } from "../src/engine/ruling.js";

const read = (p) => readFileSync(resolve(__dirname, "..", p), "utf8");

describe("the route from a phone to a fact exists at every hop", () => {
  it("the phone sends it", () => {
    const shell = read("src/net/ClientShell.jsx");
    expect(shell).toContain('t: "propose"');
    expect(shell).toContain('t: "second"');
  });

  it("A BUTTON DRAWS IT — the hop no other test can see", () => {
    const shell = read("src/net/ClientShell.jsx");
    /* C_DISPUTE had a handler, a relay case and a ledger, and no
       sender, for three versions. The sender is the hop that gets
       forgotten, and a control that is never rendered is a sender
       that never fires. */
    expect(shell).toContain("MakeItTrue");
    expect(shell).toMatch(/import MakeItTrue from "\.\/MakeItTrue\.jsx"/);

    const box = read("src/net/MakeItTrue.jsx");
    expect(box).toContain("onPropose");
    expect(box).toContain("onSecond");
  });

  it("it is drawn on the WARDENLESS bar, which is the whole point", () => {
    const shell = read("src/net/ClientShell.jsx");
    /* INV-9: anything a wardenless table needs must be reachable
       from TableControls or ClientShell, because a capability
       whose only switch is on the Warden deck does not exist for
       the configuration that most needs it. If this control ever
       drifts out of the `wardenless` block, the feature has
       silently un-shipped. */
    const bar = shell.slice(shell.indexOf("inPlay && wardenless"));
    const end = bar.indexOf("tap-ack");
    expect(bar.slice(0, end)).toContain("MakeItTrue");
  });

  it("both relays route it, and they agree with each other", () => {
    const lan = read("server/host.mjs");
    const rtc = read("src/net/rtcRelay.js");
    for (const src of [lan, rtc]) {
      expect(src).toContain("propose");
      expect(src).toContain("second");
    }
    /* `rtcRelay.js` is a port of `server/host.mjs` and the two must
       agree — the same requirement tests/rtcrelay.test.js already
       enforces for every other message. Both must take the
       character from their own record rather than the message,
       because the entire mechanism is that a proposer cannot
       second themselves. */
    expect(lan).toMatch(/t: "second", clientId: me\.clientId, asPc: me\.pcId/);
    expect(rtc).toMatch(/t: "second", clientId, asPc: c\.pcId/);
  });

  it("the host handles both", () => {
    const host = read("src/net/useHost.js");
    expect(host).toMatch(/msg\.t === "propose"/);
    expect(host).toMatch(/msg\.t === "second"/);
  });

  it("THE OPEN PROPOSAL REACHES THE OTHER PHONES", () => {
    /* The mechanism needs two voices. If the open proposal never
       leaves the host, exactly one person can see the thing they
       are meant to be agreeing with, and the second voice can
       never arrive. A ref alone would have failed here — the
       snapshot effect does not re-run on a ref. */
    expect(read("src/net/protocol.js")).toContain("proposal:");
    expect(read("src/net/useHost.js")).toContain("proposal: openProposal");
  });

  it("the protocol declares both messages", () => {
    expect(C_PROPOSE).toBe("propose");
    expect(C_SECOND).toBe("second");
  });
});

describe("what the table gets at the end of it", () => {
  const T0 = 2_000_000;

  it("a carried proposal changes what the room says", () => {
    const p = propose(
      emptyProposals(),
      {
        text: "The ceiling panel comes down on four wing-nuts. One is missing.",
        scope: SCOPE.ROOM, room: "work", by: "pc1",
      },
      T0,
    );
    const s = second(p.next, "pc2", T0 + 1000);
    expect(s.carried).toBe(true);

    const w = { rulings: [s.ruling] };
    /* The whole value of ruling.js: ten minutes later the room does
       not contradict the table. */
    expect(roomAddendum(w, "work").join(" ")).toContain("wing-nuts");
  });

  it("one player cannot do it alone, at any hop", () => {
    const p = propose(emptyProposals(), { text: "The door is open.", room: "work", by: "pc1" }, T0);
    expect(second(p.next, "pc1", T0 + 500).carried).toBe(false);
    expect(PROPOSAL_QUORUM).toBe(2);
  });

  it("nothing anywhere in the path composes a sentence — INV-1", () => {
    const text = "The grille is painted over, and the paint is fresh.";
    const p = propose(emptyProposals(), { text, room: "work", by: "pc1" }, T0);
    const s = second(p.next, "pc2", T0 + 1000);
    /* Byte-for-byte what a human typed, all the way through. */
    expect(s.ruling.text).toBe(text);

    const engine = read("src/engine/tableRuling.js");
    /* No pools, no tables, no randomness. If any of those ever
       appear here this file has become the thing the repository
       refused to build — the same guard ruling.js states about
       itself.

       Comments are stripped before the check, because this file
       and ruling.js both DISCUSS the absence of an rng at length
       and a grep that cannot tell prose from code would fail on
       the sentence explaining why it passes. */
    const code = engine
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\brng\b/);
    expect(code).not.toMatch(/Math\.random/);
    expect(code).not.toMatch(/\bpick\w*\s*\(/);
  });
});
