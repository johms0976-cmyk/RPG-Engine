// @vitest-environment jsdom
/* ============================================================
   COMPACT SIGNALS.

   The thing worth testing here is not that a good SDP survives
   the round trip. It is that a BAD one is refused — because the
   safety of this whole change rests on `compact()` declining
   rather than guessing, and a decline is silent by design. A
   regression that made it guess would look exactly like success
   until a table somewhere failed to connect.

   So: several sections assert null.
   ============================================================ */
import { describe, it, expect } from "vitest";
import { compact, expand, dissect, compactKind } from "../src/net/rtcCompact.js";
import { encodeSignal, decodeSignal, signalKind, cleanCode } from "../src/net/rtcSignal.js";
import { joinLink, offerFromLocation, PUBLIC_APP_URL } from "../src/net/joinLink.js";

/* A realistic Chrome data-channel offer: mDNS host candidates,
   reflexive candidates from two STUN servers, gathering complete. */
const CHROME_OFFER = [
  "v=0",
  "o=- 4611731400430051336 2 IN IP4 127.0.0.1",
  "s=-",
  "t=0 0",
  "a=group:BUNDLE 0",
  "a=extmap-allow-mixed",
  "a=msid-semantic: WMS",
  "m=application 56789 UDP/DTLS/SCTP webrtc-datachannel",
  "c=IN IP4 203.0.113.44",
  "a=candidate:1510613869 1 udp 2113937151 8f4a2b1c-6d3e-4f21-9a7b-2c8d1e0f3a5b.local 56789 typ host generation 0",
  "a=candidate:842163049 1 udp 1677729535 203.0.113.44 56789 typ srflx raddr 0.0.0.0 rport 0 generation 0",
  "a=candidate:842163050 1 udp 1677729279 203.0.113.44 41022 typ srflx raddr 0.0.0.0 rport 0 generation 0",
  "a=ice-ufrag:Xk9Q",
  "a=ice-pwd:l0Jd3Kx8vTqR2mN7pYbA4wZs",
  "a=ice-options:trickle",
  "a=fingerprint:sha-256 7B:4C:1A:9F:22:E3:0D:58:6A:B1:CC:47:90:2F:D8:35:61:AE:74:19:C0:3B:8E:52:F6:0A:97:D4:2B:E5:13:68",
  "a=setup:actpass",
  "a=mid:0",
  "a=sctp-port:5000",
  "a=max-message-size:262144",
].join("\r\n") + "\r\n";

const FIREFOX_ANSWER = [
  "v=0",
  "o=mozilla...THIS_IS_SDPARTA-99.0 2938471928374 0 IN IP4 0.0.0.0",
  "s=-",
  "t=0 0",
  "a=fingerprint:sha-256 11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00",
  "a=group:BUNDLE 0",
  "a=ice-options:trickle",
  "a=msid-semantic:WMS *",
  "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
  "c=IN IP4 0.0.0.0",
  "a=candidate:0 1 UDP 2122252543 198.51.100.9 44321 typ host",
  "a=candidate:2 1 UDP 1686052863 198.51.100.9 44321 typ srflx raddr 0.0.0.0 rport 0",
  "a=sendrecv",
  "a=ice-pwd:8b2c4a1f9e7d3b5a6c8e0f2d4b6a8c1e",
  "a=ice-ufrag:a1b2c3d4",
  "a=mid:0",
  "a=setup:active",
  "a=sctp-port:5000",
  "a=max-message-size:1073741823",
].join("\r\n") + "\r\n";

describe("compact codes", () => {
  it("shrinks a real Chrome offer to something a QR can hold", () => {
    const code = compact({ type: "offer", sdp: CHROME_OFFER });
    expect(code).toBeTruthy();
    expect(code.startsWith("RPG2.")).toBe(true);

    /* The number that matters. Under 200 keeps the join link inside
       QR version 10 at error correction Q, which is the density that
       still reads off a screen share. If a change pushes this up,
       the QR stops working before anything else does. */
    expect(code.length).toBeLessThan(200);
  });

  it("carries every field a connection actually depends on", () => {
    const code = compact({ type: "offer", sdp: CHROME_OFFER });
    const back = expand(code);
    expect(back.ok).toBe(true);

    const before = dissect(CHROME_OFFER);
    const after = dissect(back.desc.sdp);

    expect(after.ufrag).toBe(before.ufrag);
    expect(after.pwd).toBe(before.pwd);
    expect(after.setup).toBe(before.setup);
    expect(after.sctpPort).toBe(before.sctpPort);
    expect(after.maxMessage).toBe(before.maxMessage);
    expect([...after.fingerprint]).toEqual([...before.fingerprint]);
  });

  it("keeps Firefox's max-message-size rather than assuming Chrome's", () => {
    const back = expand(compact({ type: "answer", sdp: FIREFOX_ANSWER }));
    expect(back.ok).toBe(true);
    expect(back.desc.sdp).toContain("a=max-message-size:1073741823");
    expect(back.desc.sdp).toContain("a=setup:active");
    expect(back.desc.type).toBe("answer");
  });

  it("drops mDNS host candidates and keeps the routable ones", () => {
    const back = expand(compact({ type: "offer", sdp: CHROME_OFFER }));
    expect(back.desc.sdp).not.toContain(".local");
    expect(back.desc.sdp).toContain("203.0.113.44 56789 typ srflx");
    expect(back.desc.sdp).toContain("203.0.113.44 41022 typ srflx");
  });

  it("keeps a real-IP host candidate", () => {
    const back = expand(compact({ type: "answer", sdp: FIREFOX_ANSWER }));
    expect(back.desc.sdp).toContain("198.51.100.9 44321 typ host");
  });

  it("knows which half a code is without expanding it", () => {
    expect(compactKind(compact({ type: "offer", sdp: CHROME_OFFER }))).toBe("offer");
    expect(compactKind(compact({ type: "answer", sdp: FIREFOX_ANSWER }))).toBe("answer");
    expect(compactKind("RPG1.oz.abc")).toBe(null);
  });

  it("survives IPv6 candidates", () => {
    const sdp = CHROME_OFFER.replace(
      "a=candidate:842163050 1 udp 1677729279 203.0.113.44 41022 typ srflx raddr 0.0.0.0 rport 0 generation 0",
      "a=candidate:842163050 1 udp 1677729279 2001:db8::1a2b 41022 typ host"
    );
    const back = expand(compact({ type: "offer", sdp }));
    expect(back.ok).toBe(true);
    expect(back.desc.sdp).toContain("2001:db8:0:0:0:0:0:1a2b");
  });
});

describe("compact refuses rather than guesses", () => {
  it("declines an SDP with audio or video in it", () => {
    const av = CHROME_OFFER + "m=audio 9 UDP/TLS/RTP/SAVPF 111\r\n";
    expect(compact({ type: "offer", sdp: av })).toBe(null);
  });

  it("declines a fingerprint that is not sha-256", () => {
    const sdp = CHROME_OFFER.replace("sha-256", "sha-512");
    expect(compact({ type: "offer", sdp })).toBe(null);
  });

  it("declines when nothing routable was gathered", () => {
    const sdp = CHROME_OFFER
      .split("\r\n")
      .filter((l) => !/typ srflx/.test(l))
      .join("\r\n");
    expect(compact({ type: "offer", sdp })).toBe(null);
  });

  it("declines anything that is not a session description", () => {
    expect(compact(null)).toBe(null);
    expect(compact({ type: "offer" })).toBe(null);
    expect(compact({ type: "banana", sdp: CHROME_OFFER })).toBe(null);
  });

  it("reports damage instead of throwing", () => {
    expect(expand("RPG2.zzzz").ok).toBe(false);
    expect(expand("").ok).toBe(false);
    expect(expand("RPG2.").ok).toBe(false);
    const good = compact({ type: "offer", sdp: CHROME_OFFER });
    expect(expand(good.slice(0, good.length - 20)).ok).toBe(false);
  });
});

describe("encodeSignal picks a format and decodeSignal reads both", () => {
  it("emits the compact form for a real description", async () => {
    const code = await encodeSignal({ type: "offer", sdp: CHROME_OFFER });
    expect(code.startsWith("RPG2.")).toBe(true);
    const back = await decodeSignal(code);
    expect(back.ok).toBe(true);
    expect(back.desc.type).toBe("offer");
  });

  it("falls back to the long form when compaction declines", async () => {
    const odd = "v=0\r\no=- 1 1 IN IP4 0.0.0.0\r\ns=-\r\nt=0 0\r\na=fake:offer\r\n";
    const code = await encodeSignal({ type: "offer", sdp: odd });
    expect(code.startsWith("RPG1.o")).toBe(true);

    /* And the long form still round-trips, byte for byte — a table
       running an older build is on the other end of this. */
    const back = await decodeSignal(code);
    expect(back.ok).toBe(true);
    expect(back.desc.sdp).toBe(odd);
  });

  it("identifies either format", async () => {
    expect(signalKind(await encodeSignal({ type: "offer", sdp: CHROME_OFFER }))).toBe("offer");
    expect(signalKind(await encodeSignal({ type: "answer", sdp: FIREFOX_ANSWER }))).toBe("answer");
    expect(signalKind("not a code")).toBe(null);
  });
});

describe("what people actually paste", () => {
  it("accepts the whole join link, because phones copy the address bar", async () => {
    const code = await encodeSignal({ type: "offer", sdp: CHROME_OFFER });
    const back = await decodeSignal(joinLink(code));
    expect(back.ok).toBe(true);
    expect(back.desc.type).toBe("offer");
  });

  it("accepts a code a chat client has wrapped over three lines", async () => {
    const code = await encodeSignal({ type: "offer", sdp: CHROME_OFFER });
    const mangled = `${code.slice(0, 40)}\n${code.slice(40, 80)}\n  ${code.slice(80)}  `;
    expect((await decodeSignal(mangled)).ok).toBe(true);
  });

  it("still says something useful about an empty box", async () => {
    expect((await decodeSignal("")).error).toMatch(/nothing/i);
    expect((await decodeSignal("hello")).error).toMatch(/not a connection code/i);
  });

  it("leaves a bare code alone", () => {
    expect(cleanCode("  RPG2.abc  ")).toBe("RPG2.abc");
  });
});

describe("join links", () => {
  it("puts the code in the fragment, where no server sees it", () => {
    const link = joinLink("RPG2.abc");
    expect(link).toContain("?mode=join#RPG2.abc");
    expect(link.split("#")[0]).not.toContain("RPG2");
  });

  it("falls back to the public build when the Warden is on localhost", () => {
    // jsdom serves at http://localhost, which no remote player can reach.
    expect(joinLink("RPG2.abc").startsWith(PUBLIC_APP_URL)).toBe(true);
  });

  it("does not double the slash on a base that has one", () => {
    expect(joinLink("RPG2.abc", "https://example.com/app/")).toBe(
      "https://example.com/app/?mode=join#RPG2.abc"
    );
    expect(joinLink("RPG2.abc", "https://example.com/app")).toBe(
      "https://example.com/app/?mode=join#RPG2.abc"
    );
  });

  it("reads an offer back out of a location", () => {
    expect(offerFromLocation({ hash: "#RPG2.abc-def_ghi" })).toBe("RPG2.abc-def_ghi");
    expect(offerFromLocation({ hash: "#o=RPG2.abc" })).toBe("RPG2.abc");
    expect(offerFromLocation({ hash: "" })).toBe(null);
    expect(offerFromLocation({ hash: "#settings" })).toBe(null);
  });

  it("round-trips a scanned link end to end", async () => {
    const code = await encodeSignal({ type: "offer", sdp: CHROME_OFFER });
    const link = joinLink(code);
    const scanned = offerFromLocation({ hash: `#${link.split("#")[1]}` });
    const back = await decodeSignal(scanned);
    expect(back.ok).toBe(true);
    expect(dissect(back.desc.sdp).ufrag).toBe("Xk9Q");
  });
});
