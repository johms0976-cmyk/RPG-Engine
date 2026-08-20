// @vitest-environment jsdom
/* ============================================================
   REMOTE PLAY, END TO END — with no WebRTC in the room.

   jsdom has no RTCPeerConnection, which is a feature here: these
   tests substitute a fake pair whose "network" is a function
   call, and everything above the peer layer — the hooks, the
   codec, the router, the transport seam — runs for real. What the
   fake cannot vouch for is ICE itself, which is exactly the part
   that only a real pair of browsers can prove anyway.

   The finale drives the entire loop the way a table would:
   Warden invites → code → player answers → code back → Warden
   pastes → channel opens → hello → claim → intent — and asserts
   the intent lands host-side wearing the right character, with a
   spoofed one refused on the way past.
   ============================================================ */
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { makeLink } from "../src/net/rtcPeer.js";
import { useRtcHost } from "../src/net/useRtcHost.js";
import { useRtcJoin } from "../src/net/useRtcJoin.js";
import { encodeSignal, decodeSignal } from "../src/net/rtcSignal.js";

/* ---------------- the fake WebRTC layer ---------------- */

const SDP = (kind) => `v=0\r\no=- 1 1 IN IP4 0.0.0.0\r\ns=-\r\nt=0 0\r\na=fake:${kind}\r\n`;

class FakeChannel {
  constructor() { this.readyState = "connecting"; this.sent = []; this.peer = null; }
  send(data) {
    this.sent.push(data);
    /* The wire: synchronous delivery to the twin. */
    if (this.peer && this.peer.onmessage) this.peer.onmessage({ data });
  }
  close() {
    if (this.readyState === "closed") return;
    this.readyState = "closed";
    this.onclose && this.onclose();
    if (this.peer && this.peer.readyState !== "closed") this.peer.close();
  }
  _open() { this.readyState = "open"; this.onopen && this.onopen(); }
}

/** Offers and answers meet here, matched by their SDP. */
let pcs;

class FakePC {
  constructor() {
    this.iceGatheringState = "complete"; // gathered() resolves immediately
    this.signalingState = "stable";
    this.connectionState = "new";
    pcs.push(this);
  }
  addEventListener() {}
  removeEventListener() {}
  createDataChannel() { this.chan = new FakeChannel(); return this.chan; }
  async createOffer() { return { type: "offer", sdp: SDP("offer") }; }
  async createAnswer() { return { type: "answer", sdp: SDP("answer") }; }
  async setLocalDescription(d) {
    this.localDescription = d;
    this.signalingState = d.type === "offer" ? "have-local-offer" : "stable";
  }
  async setRemoteDescription(d) {
    this.remoteDescription = d;
    if (d.type === "answer") {
      this.signalingState = "stable";
      /* Both descriptions known on the offerer: "connect". Find the
         answerer, hand it a twin of our channel, open both. */
      const other = pcs.find((p) => p !== this && p.remoteDescription && p.remoteDescription.type === "offer");
      if (other && this.chan) {
        const twin = new FakeChannel();
        twin.peer = this.chan; this.chan.peer = twin;
        other.ondatachannel && other.ondatachannel({ channel: twin });
        twin._open(); this.chan._open();
      }
    }
  }
  close() { this.connectionState = "closed"; }
}

beforeEach(() => { pcs = []; vi.stubGlobal("RTCPeerConnection", FakePC); });
afterEach(() => { vi.unstubAllGlobals(); });

/** Render a hook, testing-library style. */
function mount(useIt, props) {
  const out = { current: null };
  function Probe(p) { out.current = useIt(p); return null; }
  const view = render(<Probe {...props} />);
  return { out, rerender: (p) => view.rerender(<Probe {...p} />) };
}

const flush = () => act(async () => { await Promise.resolve(); });

/* ---------------- the link itself ---------------- */

describe("the link", () => {
  it("queues outbound until the channel opens, then drains in order", () => {
    const pc = new FakePC();
    const link = makeLink(pc);
    const chan = new FakeChannel();
    link._attach(chan);

    expect(link.send({ n: 1 })).toBe(true);
    expect(link.send({ n: 2 })).toBe(true);
    expect(chan.sent).toHaveLength(0);

    chan._open();
    expect(chan.sent.map((d) => JSON.parse(d).n)).toEqual([1, 2]);
  });

  it("buffers inbound until a handler binds, then drains in order", () => {
    /* The host attaches a peer the instant the channel opens and the
       relay speaks `welcome` immediately; React binds onMessage an
       effect later. Losing that welcome is a phone that connected and
       then sits there anonymous. */
    const link = makeLink(new FakePC());
    const chan = new FakeChannel();
    link._attach(chan);
    chan._open();

    chan.onmessage({ data: JSON.stringify({ t: "welcome", clientId: "c1" }) });
    chan.onmessage({ data: JSON.stringify({ t: "peers", peers: [] }) });

    const got = [];
    link.onMessage = (m) => got.push(m.t);
    expect(got).toEqual(["welcome", "peers"]);
  });

  it("drops malformed frames rather than throwing", () => {
    const link = makeLink(new FakePC());
    const chan = new FakeChannel();
    link._attach(chan);
    link.onMessage = () => { throw new Error("should not be called"); };
    expect(() => chan.onmessage({ data: "not json {" })).not.toThrow();
  });

  it("refuses to send after close, and does not queue it either", () => {
    const link = makeLink(new FakePC());
    link._attach(new FakeChannel());
    link.close();
    expect(link.send({ n: 1 })).toBe(false);
  });
});

/* ---------------- each side alone ---------------- */

describe("the Warden's side", () => {
  it("builds an offer code and shows it on the slot", async () => {
    const { out } = mount(useRtcHost, { enabled: true });
    await act(async () => { await out.current.invite(); });

    const slot = out.current.slots[0];
    expect(slot.state).toBe("offered");
    expect(slot.code.startsWith("RPG1.o")).toBe(true);
    const back = await decodeSignal(slot.code);
    expect(back.ok).toBe(true);
    expect(back.desc.type).toBe("offer");
  });

  it("names the everyday mistake when an offer is pasted where the answer goes", async () => {
    const { out } = mount(useRtcHost, { enabled: true });
    await act(async () => { await out.current.invite(); });
    const slot = out.current.slots[0];

    await act(async () => { await out.current.acceptAnswer(slot.id, slot.code); });
    expect(out.current.slots[0].error).toMatch(/offer code/i);
    expect(out.current.slots[0].state).toBe("offered");
  });

  it("keeps the relay for the table's whole life, and none before it is on", () => {
    const off = mount(useRtcHost, { enabled: false });
    expect(off.out.current.relay).toBe(null);

    const on = mount(useRtcHost, { enabled: true });
    const first = on.out.current.relay;
    expect(first).toBeTruthy();
    on.rerender({ enabled: true });
    expect(on.out.current.relay).toBe(first);
  });

  it("ends the remote table out loud when switched off", async () => {
    const { out, rerender } = mount(useRtcHost, { enabled: true });
    await act(async () => { await out.current.invite(); });
    const relay = out.current.relay;

    /* Seat a fake phone directly on the relay so there is somebody to
       tell. */
    const phone = { sent: [], send(m) { this.sent.push(m); }, close() {} };
    act(() => { relay.attach(phone); });

    act(() => { rerender({ enabled: false }); });
    expect(phone.sent.some((m) => m.t === "hostgone")).toBe(true);
    expect(out.current.slots).toEqual([]);
    expect(out.current.relay).toBe(null);
  });
});

describe("the player's side", () => {
  it("refuses an answer code pasted where the offer goes", async () => {
    const { out } = mount(useRtcJoin, {});
    const answerish = await encodeSignal({ type: "answer", sdp: SDP("answer") });
    await act(async () => { await out.current.begin(answerish); });
    expect(out.current.error).toMatch(/answer code/i);
    expect(out.current.state).toBe("idle");
  });

  it("answers a real offer and produces the code to carry back", async () => {
    const { out } = mount(useRtcJoin, {});
    const offer = await encodeSignal({ type: "offer", sdp: SDP("offer") });
    await act(async () => { await out.current.begin(offer); });

    expect(out.current.state).toBe("ready");
    expect(out.current.answerCode.startsWith("RPG1.a")).toBe(true);
    expect(out.current.link).toBeTruthy();
  });

  it("says something useful about a garbage paste", async () => {
    const { out } = mount(useRtcJoin, {});
    await act(async () => { await out.current.begin("https://example.com"); });
    expect(out.current.error).toMatch(/not a connection code/i);
  });
});

/* ---------------- the whole exchange ---------------- */

describe("the whole exchange", () => {
  /** The dance, as a table would do it. Returns both ends, connected. */
  async function connect() {
    const host = mount(useRtcHost, { enabled: true });
    const player = mount(useRtcJoin, {});

    await act(async () => { await host.out.current.invite(); });
    const offerCode = host.out.current.slots[0].code;

    await act(async () => { await player.out.current.begin(offerCode); });
    const answerCode = player.out.current.answerCode;

    await act(async () => {
      await host.out.current.acceptAnswer(host.out.current.slots[0].id, answerCode);
    });
    await flush();
    return { host, player };
  }

  it("connects, welcomes, and routes an intent wearing the right character", async () => {
    const { host, player } = await connect();

    expect(host.out.current.slots[0].state).toBe("connected");
    expect(player.out.current.state).toBe("open");

    /* The host tab's inbox — what useHost would receive. */
    const hostInbox = [];
    host.out.current.relay.toHost = (m) => hostInbox.push(m);

    const link = player.out.current.link;
    const phoneGot = [];
    link.onMessage = (m) => phoneGot.push(m);

    /* The welcome was spoken the instant the channel opened, before any
       handler existed on the phone. The inbox buffer is what kept it. */
    const welcome = phoneGot.find((m) => m.t === "welcome");
    expect(welcome).toBeTruthy();
    const myId = welcome.clientId;

    await act(async () => {
      link.send({ t: "hello", name: "Rook" });
      link.send({ t: "claim", pcId: "pc1" });
      link.send({ t: "intent", action: "move", args: { to: "vents" }, asPc: "pc1" });
    });

    expect(phoneGot.find((m) => m.t === "claimed").pcId).toBe("pc1");
    const intent = hostInbox.find((m) => m.t === "intent");
    expect(intent).toMatchObject({ action: "move", asPc: "pc1", clientId: myId });
    /* The LAST roster: announcements also fired at attach time, before
       the phone had said hello, and those legitimately carry no name. */
    expect(hostInbox.filter((m) => m.t === "peers").pop().peers[0].name).toBe("Rook");
  });

  it("refuses a spoofed intent at the router, before the authority sees it", async () => {
    const { host, player } = await connect();
    const hostInbox = [];
    host.out.current.relay.toHost = (m) => hostInbox.push(m);

    const link = player.out.current.link;
    const phoneGot = [];
    link.onMessage = (m) => phoneGot.push(m);

    await act(async () => {
      link.send({ t: "hello", name: "Rook" });
      link.send({ t: "claim", pcId: "pc1" });
      link.send({ t: "intent", action: "move", args: {}, asPc: "pc2" });
    });

    expect(phoneGot.find((m) => m.t === "denied").reason).toBe("not-yours");
    expect(hostInbox.filter((m) => m.t === "intent")).toHaveLength(0);
  });

  it("carries a host broadcast down to the phone", async () => {
    const { host, player } = await connect();
    const link = player.out.current.link;
    const phoneGot = [];
    link.onMessage = (m) => phoneGot.push(m);

    act(() => { host.out.current.relay.fromHost({ t: "snapshot", seq: 1, phase: "play" }); });
    expect(phoneGot.find((m) => m.t === "snapshot").seq).toBe(1);
  });

  it("frees the character and marks the slot when the phone drops", async () => {
    const { host, player } = await connect();
    const hostInbox = [];
    host.out.current.relay.toHost = (m) => hostInbox.push(m);
    const link = player.out.current.link;

    await act(async () => {
      link.send({ t: "hello", name: "Rook" });
      link.send({ t: "claim", pcId: "pc1" });
    });
    await act(async () => { link.channel.close(); });

    /* The relay released the body — a dead phone must not lock its
       character out of the table. */
    expect(hostInbox.find((m) => m.t === "claim" && m.pcId === "")).toBeTruthy();
    expect(host.out.current.slots[0].state).toBe("gone");
    expect(player.out.current.state).toBe("closed");
  });
});
