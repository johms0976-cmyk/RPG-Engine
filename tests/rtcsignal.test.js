// @vitest-environment jsdom
/* ============================================================
   SIGNALLING CODES

   The codec is the part of the manual exchange a person touches,
   so most of these tests are about what happens when they paste
   the wrong thing — which they will, because the exchange has an
   offer box and an answer box and they look identical.
   ============================================================ */

import { describe, it, expect } from "vitest";
import {
  encodeSignal, decodeSignal, signalKind, CODE_PREFIX, manualSignaller, SIGNALLERS,
} from "../src/net/rtcSignal.js";

/* A structurally real SDP. Nothing here is connectable — the codec
   never inspects semantics, only that it round-trips and starts with
   the version line every SDP starts with. */
const SDP = [
  "v=0",
  "o=- 4611731400430051336 2 IN IP4 127.0.0.1",
  "s=-",
  "t=0 0",
  "a=group:BUNDLE 0",
  "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
  "c=IN IP4 0.0.0.0",
  "a=ice-ufrag:4ZcD",
  "a=ice-pwd:2/1muCWoOi3uLifh0NuRHlZw",
  "a=fingerprint:sha-256 4A:AD:B9:B1:3F:82:18:3B:54:02:12:DF:3E:5D:49:6B",
  "a=setup:actpass",
  "a=mid:0",
  "a=sctp-port:5000",
].join("\r\n");

const offer = { type: "offer", sdp: SDP };
const answer = { type: "answer", sdp: SDP };

describe("encoding", () => {
  it("round-trips an offer", async () => {
    const code = await encodeSignal(offer);
    const back = await decodeSignal(code);
    expect(back.ok).toBe(true);
    expect(back.desc.type).toBe("offer");
    expect(back.desc.sdp).toBe(SDP);
  });

  it("round-trips an answer, and keeps the two distinguishable", async () => {
    const back = await decodeSignal(await encodeSignal(answer));
    expect(back.ok).toBe(true);
    expect(back.desc.type).toBe("answer");
  });

  it("produces something a person could actually paste", async () => {
    const code = await encodeSignal(offer);
    expect(code.startsWith(`${CODE_PREFIX}.`)).toBe(true);
    /* One token, no whitespace — it has to survive a group chat. */
    expect(code).not.toMatch(/\s/);
    /* base64url only: nothing a chat client will linkify or eat. */
    expect(code.split(".")[2]).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("reads the kind without decoding", async () => {
    expect(signalKind(await encodeSignal(offer))).toBe("offer");
    expect(signalKind(await encodeSignal(answer))).toBe("answer");
    expect(signalKind("garbage")).toBe(null);
  });

  it("refuses to encode something that is not a description", async () => {
    await expect(encodeSignal(null)).rejects.toThrow();
    await expect(encodeSignal({ type: "offer" })).rejects.toThrow();
  });

  it("survives a code with whitespace around it", async () => {
    const code = await encodeSignal(offer);
    const back = await decodeSignal(`\n  ${code}  \n`);
    expect(back.ok).toBe(true);
  });
});

describe("bad pastes", () => {
  it("says something useful about an empty box", async () => {
    const r = await decodeSignal("");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Nothing pasted/i);
  });

  it("refuses text that is not a code at all", async () => {
    for (const junk of ["hello", "https://example.com", "{}", "RPG1", "A.B.C"]) {
      const r = await decodeSignal(junk);
      expect(r.ok).toBe(false);
      expect(typeof r.error).toBe("string");
    }
  });

  it("refuses a code that was cut short in copying", async () => {
    /* The commonest real failure: a chat client wrapped the line and
       only half of it got selected. */
    const code = await encodeSignal(offer);
    const r = await decodeSignal(code.slice(0, Math.floor(code.length * 0.6)));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/damaged|cut short/i);
  });

  it("never throws, whatever is pasted", async () => {
    for (const junk of [null, undefined, 42, {}, [], "\u0000\u0001"]) {
      await expect(decodeSignal(junk)).resolves.toHaveProperty("ok");
    }
  });

  it("refuses a well-formed code whose payload is not an SDP", async () => {
    const notSdp = btoa("this is not a session description")
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const r = await decodeSignal(`${CODE_PREFIX}.or.${notSdp}`);
    expect(r.ok).toBe(false);
  });
});

describe("what a code contains", () => {
  it("carries the SDP and nothing else", async () => {
    const code = await encodeSignal(offer);
    const back = await decodeSignal(code);
    /* No name, no token, no game state — the exchange is a way to
       find a browser, not a way to join a session. Anything more in
       here would be travelling through a group chat. */
    expect(Object.keys(back.desc).sort()).toEqual(["sdp", "type"]);
  });
});

describe("the signaller interface", () => {
  it("offers the manual exchange and says it needs nothing running", () => {
    expect(manualSignaller.needsServer).toBe(false);
    expect(SIGNALLERS).toContain(manualSignaller);
  });
});
