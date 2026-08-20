/* ============================================================
   THE RELAY, MOVED INTO THE HOST TAB.

   These tests exist to keep rtcRelay.js honest against
   server/host.mjs, because the two implement one protocol in two
   places and nothing else would notice them drifting apart.

   No WebRTC here. The router takes ports — anything with send() —
   which is exactly what makes it testable, and is why it was
   written that way.
   ============================================================ */

import { describe, it, expect, beforeEach } from "vitest";
import { createRelay, MAX_CLIENTS, RTC_CAPABILITIES } from "../src/net/rtcRelay.js";

/** A fake phone. Records everything sent to it. */
const fakePort = () => {
  const sent = [];
  return {
    sent,
    send: (m) => sent.push(m),
    close: () => {},
    /** Last message of a given type. */
    last: (t) => [...sent].reverse().find((m) => m.t === t),
    types: () => sent.map((m) => m.t),
  };
};

let toHost;
let hostInbox;
let relay;

beforeEach(() => {
  hostInbox = [];
  toHost = (m) => hostInbox.push(m);
  relay = createRelay({ toHost });
});

const hostGot = (t) => hostInbox.filter((m) => m.t === t);

/** Attach a phone that has said hello and claimed a character. */
function seat(name, pcId) {
  const port = fakePort();
  const { clientId } = relay.attach(port);
  relay.fromClient(clientId, { t: "hello", name });
  if (pcId) relay.fromClient(clientId, { t: "claim", pcId });
  return { port, clientId };
}

/* ---------------- membership ---------------- */

describe("membership", () => {
  it("assigns the client id rather than letting the client pick", () => {
    const port = fakePort();
    const r = relay.attach(port);
    expect(r.ok).toBe(true);
    /* A client that named itself could name itself somebody else. */
    expect(port.last("welcome").clientId).toBe(r.clientId);
    expect(port.last("welcome").isHost).toBe(false);
  });

  it("tells the host and the other phones when someone arrives", () => {
    seat("Rook", null);
    const a = seat("Vale", null);
    expect(hostGot("peers").length).toBeGreaterThan(0);
    expect(a.port.last("peers").peers.length).toBe(2);
  });

  it("refuses past the cap", () => {
    for (let i = 0; i < MAX_CLIENTS; i++) expect(relay.attach(fakePort()).ok).toBe(true);
    const over = fakePort();
    const r = relay.attach(over);
    expect(r.ok).toBe(false);
    expect(over.last("denied").reason).toBe("full");
    expect(relay.size).toBe(MAX_CLIENTS);
  });

  it("frees a character when its phone drops", () => {
    const a = seat("Rook", "pc1");
    hostInbox.length = 0;
    relay.detach(a.clientId);
    /* A player whose phone died must not lock their own character out
       of the table for the rest of the session. */
    expect(hostGot("claim")).toEqual([{ t: "claim", clientId: a.clientId, pcId: "" }]);
    expect(relay.size).toBe(0);
  });

  it("tells everyone when the table goes away", () => {
    const a = seat("Rook", null);
    relay.shutdown();
    expect(a.port.last("hostgone")).toBeTruthy();
    expect(relay.size).toBe(0);
  });
});

/* ---------------- claims ---------------- */

describe("claims", () => {
  it("gives a free character to whoever asks", () => {
    const a = seat("Rook", "pc1");
    expect(a.port.last("claimed").pcId).toBe("pc1");
    expect(hostGot("claim").pop()).toMatchObject({ pcId: "pc1" });
  });

  it("refuses a character two phones want", () => {
    seat("Rook", "pc1");
    const b = seat("Vale", "pc1");
    expect(b.port.last("denied").reason).toBe("taken");
    expect(b.port.last("claimed")).toBeUndefined();
  });

  it("releases on an empty claim", () => {
    const a = seat("Rook", "pc1");
    relay.fromClient(a.clientId, { t: "claim", pcId: "" });
    /* Released, so the next phone can have it. */
    const b = seat("Vale", "pc1");
    expect(b.port.last("claimed").pcId).toBe("pc1");
  });
});

/* ---------------- intents ---------------- */

describe("intents", () => {
  it("forwards an intent from the character's own phone", () => {
    const a = seat("Rook", "pc1");
    relay.fromClient(a.clientId, { t: "intent", action: "move", args: { to: "vents" }, asPc: "pc1" });
    expect(hostGot("intent").pop()).toMatchObject({ action: "move", asPc: "pc1" });
  });

  it("refuses an intent claiming to be somebody else", () => {
    const a = seat("Rook", "pc1");
    hostInbox.length = 0;
    relay.fromClient(a.clientId, { t: "intent", action: "move", asPc: "pc2" });
    expect(a.port.last("denied").reason).toBe("not-yours");
    /* The spoofed intent must not reach the authority at all. */
    expect(hostGot("intent")).toHaveLength(0);
  });

  it("refuses an intent from a phone holding nobody", () => {
    const a = seat("Rook", null);
    relay.fromClient(a.clientId, { t: "intent", action: "move", asPc: "pc1" });
    expect(hostGot("intent")).toHaveLength(0);
  });
});

/* ---------------- the safety card ---------------- */

describe("the safety card", () => {
  it("reaches the host with no identity attached", () => {
    const a = seat("Rook", "pc1");
    relay.fromClient(a.clientId, { t: "safety", level: "stop" });

    const call = hostGot("safety").pop();
    expect(call.level).toBe("stop");
    /* Anonymous by construction: there is nothing here to leak. */
    expect(call.clientId).toBeUndefined();
    expect(call.name).toBeUndefined();
    expect(call.pcId).toBeUndefined();
    expect(Object.keys(call).sort()).toEqual(["level", "t"]);
  });

  it("acknowledges to the presser so the card does not feel ignored", () => {
    const a = seat("Rook", "pc1");
    relay.fromClient(a.clientId, { t: "safety", level: "veil" });
    expect(a.port.last("safetyack").level).toBe("veil");
  });
});

/* ---------------- peer whispers ---------------- */

describe("peer whispers", () => {
  it("routes by character, not by phone", () => {
    const a = seat("Rook", "pc1");
    const b = seat("Vale", "pc2");
    relay.fromClient(a.clientId, { t: "peerwhisper", toPcId: "pc2", text: "I took the keycard" });

    const got = b.port.last("peerwhisper");
    expect(got.text).toBe("I took the keycard");
    expect(got.fromPcId).toBe("pc1");
    expect(a.port.last("ack").state).toBe("whispered");
  });

  it("says so when nobody is holding the other end", () => {
    const a = seat("Rook", "pc1");
    relay.fromClient(a.clientId, { t: "peerwhisper", toPcId: "pc9", text: "hello?" });
    expect(a.port.last("ack").state).toBe("nobody-there");
  });

  it("gives the Warden the text on open", () => {
    relay.requestPeerMode("open");
    const a = seat("Rook", "pc1");
    seat("Vale", "pc2");
    relay.fromClient(a.clientId, { t: "peerwhisper", toPcId: "pc2", text: "the keycard" });
    expect(hostGot("peernote").pop().text).toBe("the keycard");
  });

  it("gives the Warden only the fact of it on seen", () => {
    relay.requestPeerMode("seen");
    const a = seat("Rook", "pc1");
    seat("Vale", "pc2");
    relay.fromClient(a.clientId, { t: "peerwhisper", toPcId: "pc2", text: "the keycard" });

    const note = hostGot("peernote").pop();
    expect(note.fromPcId).toBe("pc1");
    expect(note.toPcId).toBe("pc2");
    expect(note.text).toBeUndefined();
  });

  /* ---- the honest bit ---- */

  it("REFUSES dark rather than pretending to honour it", () => {
    /* On the LAN relay, dark means the words never reach the Warden's
       machine. Here the Warden's machine IS the router, so the
       guarantee is structurally unavailable. Silently accepting the
       setting would turn a structural guarantee into a promise, and a
       table might agree to something on the strength of it. */
    const r = relay.requestPeerMode("dark");
    expect(r.mode).toBe("seen");
    expect(r.downgraded).toBe(true);
    expect(r.reason).toMatch(/router/i);
    expect(relay.mode).toBe("seen");
  });

  it("advertises the limitation rather than burying it", () => {
    expect(RTC_CAPABILITIES.darkWhispers).toBe(false);
    expect(RTC_CAPABILITIES.peerModes).not.toContain("dark");
  });

  it("does not downgrade the modes it can actually keep", () => {
    expect(relay.requestPeerMode("open").downgraded).toBe(false);
    expect(relay.requestPeerMode("seen").downgraded).toBe(false);
  });

  it("falls back to seen on a mode it has never heard of", () => {
    expect(relay.requestPeerMode("nonsense").mode).toBe("seen");
  });
});

/* ---------------- host to client ---------------- */

describe("routing from the host", () => {
  it("broadcasts an unaddressed message", () => {
    const a = seat("Rook", "pc1");
    const b = seat("Vale", "pc2");
    relay.fromHost({ t: "snapshot", seq: 1 });
    expect(a.port.last("snapshot").seq).toBe(1);
    expect(b.port.last("snapshot").seq).toBe(1);
  });

  it("delivers an addressed message to one phone only", () => {
    const a = seat("Rook", "pc1");
    const b = seat("Vale", "pc2");
    relay.fromHost({ t: "whisper", to: a.clientId, text: "you feel watched" });
    expect(a.port.last("whisper").text).toBe("you feel watched");
    expect(b.port.last("whisper")).toBeUndefined();
  });

  it("addresses by character id as well as by client id", () => {
    const a = seat("Rook", "pc1");
    relay.fromHost({ t: "spotlight", to: "pc1", text: "everyone looks at you" });
    expect(a.port.last("spotlight")).toBeTruthy();
  });

  it("strips the routing field before it goes out", () => {
    const a = seat("Rook", "pc1");
    relay.fromHost({ t: "whisper", to: a.clientId, text: "x" });
    expect(a.port.last("whisper").to).toBeUndefined();
  });

  it("drops an addressed message that was never declared", () => {
    /* The same rule server/host.mjs enforces. An undeclared message is
       one that silently does not arrive, and finding that out
       mid-session is expensive. */
    const a = seat("Rook", "pc1");
    expect(relay.fromHost({ t: "smuggled", to: a.clientId, secret: 1 })).toBe(false);
    expect(a.port.last("smuggled")).toBeUndefined();
  });

  it("drops an addressed message to somebody who is not here", () => {
    seat("Rook", "pc1");
    expect(relay.fromHost({ t: "whisper", to: "c99", text: "x" })).toBe(false);
  });

  it("consumes config rather than putting it on the wire", () => {
    const a = seat("Rook", "pc1");
    relay.fromHost({ t: "config", peerWhispers: "open" });
    expect(relay.mode).toBe("open");
    expect(a.port.last("config")).toBeUndefined();
  });
});

/* ---------------- robustness ---------------- */

describe("bad input", () => {
  it("ignores messages from a client that is not attached", () => {
    expect(() => relay.fromClient("c99", { t: "hello", name: "ghost" })).not.toThrow();
  });

  it("ignores malformed frames", () => {
    const a = seat("Rook", "pc1");
    for (const junk of [null, undefined, {}, { t: 42 }, "string", []]) {
      expect(() => relay.fromClient(a.clientId, junk)).not.toThrow();
    }
  });

  it("drops verbs outside the vocabulary", () => {
    const a = seat("Rook", "pc1");
    hostInbox.length = 0;
    relay.fromClient(a.clientId, { t: "eval", code: "whatever" });
    expect(hostInbox).toHaveLength(0);
  });

  it("truncates a whisper rather than carrying an arbitrary payload", () => {
    const a = seat("Rook", "pc1");
    relay.fromClient(a.clientId, { t: "playerwhisper", text: "x".repeat(9000) });
    expect(hostGot("playerwhisper").pop().text.length).toBe(2000);
  });

  it("survives a port that throws on send", () => {
    const bad = { send() { throw new Error("gone"); }, close() {} };
    const { clientId } = relay.attach(bad);
    expect(clientId).toBeTruthy();
    expect(() => relay.fromHost({ t: "snapshot", seq: 1 })).not.toThrow();
  });
});
