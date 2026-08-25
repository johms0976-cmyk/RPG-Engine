/* ============================================================
   SIGNALLING — getting two browsers to find each other.

   WebRTC needs the two ends to swap a session description before
   a connection exists. That swap is the one thing peer-to-peer
   cannot do peer-to-peer, and it is why every "serverless" WebRTC
   demo still has a server in it somewhere.

   ------------------------------------------------------------
   TWO WAYS ACROSS, AND WHY BOTH

   MANUAL. The offer and the answer are turned into codes and
   carried by whatever the table is already using to talk —
   a group chat, a voice call, an email. No server, nothing to
   trust, nothing to run, nothing that can go down.

   ASSISTED. A signalling service does the swap. One paste, or a
   room code. Someone has to run it.

   Manual is implemented here because it is the one that needs no
   infrastructure and therefore no decisions. The assisted path is
   defined as an interface (see `Signaller`) so it can be added
   without touching anything that calls this.

   ------------------------------------------------------------
   TWO CODE FORMATS

     RPG2.<base64url>      compact. About 110 characters.
     RPG1.<oz|ar|…>.<b64>  the whole SDP, deflated. About 700.

   RPG2 is the default because 700 characters is not a code, it is
   a paragraph, and a QR code holding 700 bytes is too dense to
   read off a shared screen on a video call — which is the exact
   situation remote play is for. See rtcCompact.js for how it gets
   from 700 to 110 and what it leaves behind.

   RPG1 remains, in both directions:

     · `encodeSignal` falls back to it whenever compaction
       declines — an SDP shape rtcCompact does not recognise, a
       fingerprint that is not sha-256, a description with no
       routable candidate. Those are the cases where guessing
       would cost a table its evening, so it stops guessing.

     · `decodeSignal` still reads it, so a code from an older
       build, or from a Warden who has not updated, still works.
       Both ends of a handshake do not have to be the same
       version, which matters when the two ends are in different
       cities and only one of them has pulled.

   ------------------------------------------------------------
   WHAT A CODE CONTAINS

   An SDP description: candidate addresses, ports, and the
   fingerprint of the DTLS certificate that will be used.

   It contains NO game state, no character, no name and no token.
   It is not secret in the sense that a password is secret, but it
   does contain your public IP address, which is worth knowing
   before pasting one into a public channel.
   ============================================================ */

import { compact, expand, compactKind, COMPACT_PREFIX } from "./rtcCompact.js";

export const CODE_PREFIX = "RPG1";
export { COMPACT_PREFIX };

/* Compression cuts a typical SDP from ~2KB to ~700 chars.

   Written against the CompressionStream reader/writer directly rather
   than the shorter Blob(...).stream().pipeThrough() form, because
   Blob.stream() is missing in some environments that DO have
   CompressionStream — jsdom among them. Feature-detecting the
   constructor while calling through Blob is how this fails in a
   browser nobody tested.

   Every path is also wrapped: if compression throws for any reason the
   code is emitted raw, which is longer and works. */
const hasCS = () => typeof CompressionStream !== "undefined";

async function pump(stream, bytes) {
  const writer = stream.writable.getWriter();
  /* These two promises must not float. When the stream errors — a
     truncated code is the everyday case — an unawaited write() rejects
     with nothing attached and surfaces as an unhandled rejection,
     which in a browser is a console error the user cannot act on and
     in the test runner is a failure with no failing test.

     The reader below is the single place the error is reported, so
     these are silenced rather than awaited: awaiting them would
     deadlock, because write() does not settle until the reader pulls. */
  writer.write(bytes).catch(() => {});
  writer.close().catch(() => {});

  const reader = stream.readable.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }

  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

const b64urlEncode = (bytes) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const b64urlDecode = (str) => {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

async function deflate(text) {
  const bytes = new TextEncoder().encode(text);
  if (!hasCS()) return { bytes, z: false };
  try {
    return { bytes: await pump(new CompressionStream("deflate-raw"), bytes), z: true };
  } catch {
    return { bytes, z: false };
  }
}

async function inflate(bytes, z) {
  if (!z) return new TextDecoder().decode(bytes);
  return new TextDecoder().decode(await pump(new DecompressionStream("deflate-raw"), bytes));
}

/**
 * Turn an RTCSessionDescription into something a person can paste,
 * or scan.
 *
 * Compact when it can be, legacy when it cannot.
 *
 * Legacy format: RPG1.<o|a><z|r>.<base64url>
 *   o/a  offer or answer — so the receiving end can refuse a code
 *        pasted into the wrong box, which is the single commonest
 *        mistake in a manual exchange.
 *   z/r  deflated or raw.
 */
export async function encodeSignal(desc) {
  if (!desc || !desc.type || !desc.sdp) throw new Error("not a session description");

  /* compact() is deliberately allowed to decline, and returns null
     when it does rather than throwing, because "this is not a shape
     I understand" is an ordinary answer and not an error. */
  const small = compact(desc);
  if (small) return small;

  const kind = desc.type === "offer" ? "o" : "a";
  const { bytes, z } = await deflate(desc.sdp);
  return `${CODE_PREFIX}.${kind}${z ? "z" : "r"}.${b64urlEncode(bytes)}`;
}

/**
 * The reverse, for either format. Never throws on user input — a
 * person pasting into this box will paste the wrong thing, and the
 * answer to that is a sentence, not a stack trace.
 *
 * Tolerant of what a code picks up in transit: surrounding
 * whitespace, a newline a chat client wrapped it with, or the whole
 * join URL when somebody copies the address bar instead of the code.
 *
 * @returns {{ok: true, desc: {type, sdp}} | {ok: false, error: string}}
 */
export async function decodeSignal(code) {
  const text = cleanCode(code);
  if (!text) return { ok: false, error: "Nothing pasted." };

  if (text.startsWith(`${COMPACT_PREFIX}.`)) return expand(text);

  const parts = text.split(".");
  if (parts.length !== 3 || parts[0] !== CODE_PREFIX)
    return { ok: false, error: "That is not a connection code." };

  const [kind, comp] = parts[1].split("");
  if (kind !== "o" && kind !== "a")
    return { ok: false, error: "That code is damaged." };

  try {
    const sdp = await inflate(b64urlDecode(parts[2]), comp === "z");
    if (!/^v=0/m.test(sdp)) return { ok: false, error: "That code is damaged." };
    return { ok: true, desc: { type: kind === "o" ? "offer" : "answer", sdp } };
  } catch {
    return { ok: false, error: "That code is damaged or was cut short." };
  }
}

/**
 * Get a bare code out of whatever was actually pasted.
 *
 * People paste the join URL, because that is what a phone's address
 * bar contains after scanning and "copy the link" is a thing phones
 * offer to do. Refusing it with "that is not a connection code" when
 * the code is visibly right there in the string is the kind of
 * correctness nobody thanks you for.
 */
export function cleanCode(input) {
  let text = String(input || "").trim();
  if (!text) return "";

  // A URL — the code lives in the fragment.
  const hash = text.indexOf("#");
  if (hash !== -1 && /^https?:\/\//i.test(text)) text = text.slice(hash + 1);

  // Chat clients wrap. Base64url has no whitespace in it, so any
  // that survived is damage rather than content.
  text = text.replace(/\s+/g, "");

  // A leading key from a fragment like #o=RPG2.…
  const eq = text.indexOf("=");
  if (eq !== -1 && eq <= 4 && !text.startsWith(CODE_PREFIX) && !text.startsWith(COMPACT_PREFIX)) {
    text = text.slice(eq + 1);
  }

  return text;
}

/** Which half of the exchange a code is, without decoding it. */
export function signalKind(code) {
  const text = cleanCode(code);
  if (text.startsWith(`${COMPACT_PREFIX}.`)) return compactKind(text);
  const parts = text.split(".");
  if (parts.length !== 3 || parts[0] !== CODE_PREFIX) return null;
  return parts[1][0] === "o" ? "offer" : parts[1][0] === "a" ? "answer" : null;
}

/* ============================================================
   THE ASSISTED PATH, AS AN INTERFACE ONLY.

   A Signaller carries an offer to a room and brings an answer
   back. Implementing one means running something; defining it
   here means the rest of the RTC code never learns whether one
   exists.

     publish(roomCode, offer) -> Promise<void>
     collect(roomCode, onAnswer) -> unsubscribe
     join(roomCode, onOffer) -> Promise<void>
     close() -> void

   A signaller sees connection metadata and never game state:
   everything after the handshake goes directly between browsers
   over an encrypted data channel.
   ============================================================ */

/** The manual exchange, wearing the Signaller interface. */
export const manualSignaller = {
  kind: "manual",
  label: "Scan or paste",
  blurb:
    "You carry the codes yourself, in whatever you already use to talk. " +
    "Nothing to run and nothing to trust — the offer is a QR code they " +
    "can scan off your screen, and the answer comes back as one line.",
  needsServer: false,
};

export const SIGNALLERS = [manualSignaller];
