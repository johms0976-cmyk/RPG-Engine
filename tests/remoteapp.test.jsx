// @vitest-environment jsdom
/* ============================================================
   REMOTE PLAY, FROM THE INTERFACE.

   remote.test.jsx proves the hooks and the router in isolation.
   This proves what the manifest actually promises: a Warden can
   reach remote play from the screens — host mode, gather the
   table, tick the box, invite, complete the exchange — and the
   phone on the far end is then a real member of the table: it
   appears in the lobby by name, and useHost broadcasts to it.

   Shallow and slow in the manner of boot.test.jsx, because the
   failure mode for wiring a transport through App, Lobby and
   useHost is not a wrong pixel — it is a white screen, or a
   Warden stuck behind a token prompt for a relay server that
   does not exist.
   ============================================================ */
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { createAnswer } from "../src/net/rtcPeer.js";
import { decodeSignal, encodeSignal } from "../src/net/rtcSignal.js";

/* ---- the same fake WebRTC layer remote.test.jsx uses ---- */
const SDP = (kind) => `v=0\r\no=- 1 1 IN IP4 0.0.0.0\r\ns=-\r\nt=0 0\r\na=fake:${kind}\r\n`;

class FakeChannel {
  constructor() { this.readyState = "connecting"; this.sent = []; this.peer = null; }
  send(data) { this.sent.push(data); if (this.peer && this.peer.onmessage) this.peer.onmessage({ data }); }
  close() {
    if (this.readyState === "closed") return;
    this.readyState = "closed";
    this.onclose && this.onclose();
    if (this.peer && this.peer.readyState !== "closed") this.peer.close();
  }
  _open() { this.readyState = "open"; this.onopen && this.onopen(); }
}

let pcs;
class FakePC {
  constructor() { this.iceGatheringState = "complete"; this.signalingState = "stable"; pcs.push(this); }
  addEventListener() {} removeEventListener() {}
  createDataChannel() { this.chan = new FakeChannel(); return this.chan; }
  async createOffer() { return { type: "offer", sdp: SDP("offer") }; }
  async createAnswer() { return { type: "answer", sdp: SDP("answer") }; }
  async setLocalDescription(d) { this.localDescription = d; this.signalingState = d.type === "offer" ? "have-local-offer" : "stable"; }
  async setRemoteDescription(d) {
    this.remoteDescription = d;
    if (d.type === "answer") {
      this.signalingState = "stable";
      const other = pcs.find((p) => p !== this && p.remoteDescription && p.remoteDescription.type === "offer");
      if (other && this.chan) {
        const twin = new FakeChannel();
        twin.peer = this.chan; this.chan.peer = twin;
        other.ondatachannel && other.ondatachannel({ channel: twin });
        twin._open(); this.chan._open();
      }
    }
  }
  close() {}
}

beforeEach(() => {
  pcs = [];
  vi.stubGlobal("RTCPeerConnection", FakePC);
  window.matchMedia = window.matchMedia || ((q) => ({
    matches: false, media: q, onchange: null,
    addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
  }));
  Element.prototype.getBoundingClientRect = () => ({
    width: 760, height: 460, top: 0, left: 0, right: 760, bottom: 460, x: 0, y: 0,
  });
  Element.prototype.setPointerCapture = Element.prototype.setPointerCapture || (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  localStorage.clear();
});
afterEach(() => { vi.unstubAllGlobals(); });

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

/* ============================================================
   WHY THIS IS NOT `flush()`

   `flush` awaits exactly two microtask ticks. That is fine for
   settling React state, and it was being used to wait for WEBRTC
   OFFER CREATION — which is genuinely asynchronous, involves ICE
   gathering, and takes a variable number of ticks that is
   occasionally more than two.

   So the test was a fixed-tick wait racing a real async operation,
   and it lost roughly one run in six. It has been recorded as
   "flaky" in four consecutive release notes, which is the wrong
   response to a test that was correct about something being slow.

   Poll instead. A wait with a deadline cannot race: it either sees
   the thing or it fails with the same message, and a genuine
   regression still fails in under a second. ============================================================ */
async function until(fn, tries = 60) {
  for (let i = 0; i < tries; i++) {
    const got = fn();
    if (got) return got;
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((r) => { setTimeout(r, 5); }); });
  }
  return fn();
}

async function bootHostToLobby() {
  window.history.replaceState({}, "", "/?mode=host");
  vi.resetModules();
  const App = (await import("../src/App.jsx")).default;
  render(<App />);
  await act(async () => { fireEvent.click(screen.getAllByText("New game")[0]); });
  await act(async () => { fireEvent.click(screen.getByText("PRESS ANY KEY TO SKIP")); });
  await act(async () => { fireEvent.click(screen.getByText("GATHER THE TABLE")); });
}

describe("remote play from the screens", () => {
  it("walks the whole path: box ticked, invite made, phone joined, table broadcasting", async () => {
    await bootHostToLobby();

    /* The lobby, with the transport choice on it. */
    fireEvent.click(screen.getByText("SOMEONE IS NOT IN THE BUILDING"));
    expect(await screen.findByText("Remote table")).toBeTruthy();

    /* Invite. No token prompt appears at any point in this test:
       there is no relay server, so there is nothing to authenticate
       to, and the useHost auth gate must know that. */
    await act(async () => { fireEvent.click(screen.getByText("Invite a player")); });

    /* By content, not by attribute: React sets readOnly as a property
       and jsdom's attribute selector has been seen to miss it. The code
       prefix is the thing this test actually cares about anyway.

       Polled, not flushed — building the offer is real async work.
       See the note on `until`. */
    const boxes = () => [...document.querySelectorAll("textarea")];
    const offerBox = await until(() => boxes().find((t) => t.value.startsWith("RPG1.o")));
    expect(offerBox).toBeTruthy();

    /* The far end, driven directly: decode the code off the screen,
       answer it, paste the answer back into the panel. */
    const offer = await decodeSignal(offerBox.value);
    let phone;
    await act(async () => { phone = await createAnswer(offer.desc, {}); });
    const answerCode = await encodeSignal(phone.localDescription);

    const answerBox = boxes().find((t) => !t.value);
    fireEvent.change(answerBox, { target: { value: answerCode } });
    await act(async () => { fireEvent.click(screen.getByText("Connect")); });

    /* Same race: the connection completing is not a fixed number of
       ticks away from the click that started it. */
    await until(() => screen.queryAllByText(/at the table/i).length > 0);
    expect(screen.getAllByText(/at the table/i).length).toBeGreaterThan(0);

    /* The phone speaks; the Warden's lobby answers with its name. */
    const got = [];
    phone.link.onMessage = (m) => got.push(m);
    await act(async () => { phone.link.send({ t: "hello", name: "Rook" }); });

    /* And again: a message crossing the link and coming back is not
       two ticks, it is however long the link takes. */
    await until(() => got.find((m) => m.t === "welcome"));
    expect(got.find((m) => m.t === "welcome")).toBeTruthy();
    const phonesPanel = screen.getByText(/Phones · /).closest("section");
    expect(within(phonesPanel).getByText("Rook")).toBeTruthy();

    /* And the authority is talking: useHost broadcast reached the far
       end through the whole stack — App → useHost → useSocket(rtc) →
       relay → link → fake wire. */
    expect(got.some((m) => m.t === "snapshot")).toBe(true);
  }, 20000);

  it("keeps the LAN path the default — no box, no panel", async () => {
    await bootHostToLobby();
    expect(screen.queryByText("Remote table")).toBeNull();
    expect(screen.getByText("SOMEONE IS NOT IN THE BUILDING")).toBeTruthy();
  });
});
