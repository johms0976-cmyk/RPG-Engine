/* ============================================================
   COMPACT SIGNALS — the same handshake, small enough to scan.

   ------------------------------------------------------------
   THE PROBLEM WITH THE LONG CODE

   `RPG1.oz.…` is a whole SDP, deflated. About 700 characters in
   practice. That is fine in a chat window and hopeless as a QR
   code: 700 bytes lands around version 20, roughly 100×100
   modules, and a QR that dense does not survive being looked at
   through a video call. Which is exactly the situation this is
   for — a Warden sharing their screen, someone across the city
   pointing a phone at it.

   ------------------------------------------------------------
   WHAT IS ACTUALLY IN AN SDP

   Almost nothing. For a data-channel-only connection the whole
   description is boilerplate except for five things:

     · the ICE username fragment      4–8 characters
     · the ICE password               ~24 characters
     · the DTLS fingerprint           32 bytes, printed as 95
     · the DTLS setup role            one of three words
     · the candidates                 an address and a port each

   Everything else — the version line, the bundle group, the
   media line, the mid, the SCTP port — is either identical in
   every browser or derivable. Deflate cannot exploit that,
   because it has never seen an SDP before and has to learn the
   boilerplate from the 900 bytes in front of it.

   So: send the five things, rebuild the rest. About 100
   characters, which is QR version 6 and survives a screen share
   with room to spare.

   ------------------------------------------------------------
   WHAT IS DROPPED, AND WHY THAT IS SAFE

   HOST CANDIDATES WITH .local ADDRESSES. Every current browser
   hides local IP addresses behind an mDNS name — a UUID ending
   in .local, resolvable only by machines on the same LAN. Across
   a city they are unreachable by construction, so carrying them
   costs 40 characters each to describe a route that cannot
   exist. Dropping them also stops a code from advertising how
   many network adapters you have.

   raddr AND rport ON REFLEXIVE CANDIDATES. Informational. The
   remote end does not use them to connect.

   CANDIDATE PRIORITIES AND FOUNDATIONS. Regenerated. They order
   the connectivity checks; they are not identities.

   Retained exactly as sent: the fingerprint, the setup role, the
   SCTP port and the max message size. Those are the fields where
   browsers genuinely differ and where a wrong guess is a failed
   connection an hour into a session.

   ------------------------------------------------------------
   THE FALLBACK IS THE WHOLE SAFETY ARGUMENT

   This makes assumptions about SDP shape. Assumptions age badly,
   and the cost of one being wrong is a table that cannot connect
   at all.

   So `compact()` is allowed to give up. If the description is
   not the single-data-channel shape this understands, or the
   round-trip check fails, it returns null and the caller emits
   the old long code, which has no assumptions in it. A code that
   is longer than it needed to be is a nuisance. A code that does
   not work is the end of the evening.
   ============================================================ */

export const COMPACT_PREFIX = "RPG2";

/* ---------------- bytes ---------------- */

const b64urlEncode = (bytes) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const b64urlDecode = (str) => {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

class Writer {
  constructor() { this.b = []; }
  u8(n) { this.b.push(n & 0xff); return this; }
  u16(n) { this.b.push((n >> 8) & 0xff, n & 0xff); return this; }
  /* Varints because sctp-port is 5000 and max-message-size is
     262144 in Chrome and 1073741823 in Firefox. A fixed width big
     enough for the second wastes three bytes on the first. */
  varint(n) {
    let v = n >>> 0;
    while (v > 0x7f) { this.b.push((v & 0x7f) | 0x80); v >>>= 7; }
    this.b.push(v);
    return this;
  }
  str(s) {
    const bytes = new TextEncoder().encode(s);
    if (bytes.length > 255) throw new Error("string too long");
    this.u8(bytes.length);
    for (const x of bytes) this.b.push(x);
    return this;
  }
  raw(bytes) { for (const x of bytes) this.b.push(x); return this; }
  done() { return new Uint8Array(this.b); }
}

class Reader {
  constructor(bytes) { this.b = bytes; this.i = 0; }
  need(n) { if (this.i + n > this.b.length) throw new Error("truncated"); }
  u8() { this.need(1); return this.b[this.i++]; }
  u16() { this.need(2); const v = (this.b[this.i] << 8) | this.b[this.i + 1]; this.i += 2; return v; }
  varint() {
    let shift = 0, out = 0;
    for (;;) {
      const b = this.u8();
      out |= (b & 0x7f) << shift;
      if (!(b & 0x80)) return out >>> 0;
      shift += 7;
      if (shift > 28) throw new Error("varint too long");
    }
  }
  str() { const n = this.u8(); this.need(n); const s = new TextDecoder().decode(this.b.slice(this.i, this.i + n)); this.i += n; return s; }
  raw(n) { this.need(n); const s = this.b.slice(this.i, this.i + n); this.i += n; return s; }
  get spent() { return this.i >= this.b.length; }
}

/* ---------------- addresses ---------------- */

const isIPv4 = (a) => /^(\d{1,3}\.){3}\d{1,3}$/.test(a);

function packIPv4(a) {
  const parts = a.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return Uint8Array.from(parts);
}

const unpackIPv4 = (b) => Array.from(b).join(".");

/** Full-form expansion is not needed — browsers accept any legal
    textual IPv6 — but :: has to be resolved to pack it. */
function packIPv6(a) {
  const clean = a.replace(/^\[|\]$/g, "").split("%")[0];
  if (!/^[0-9a-fA-F:]+$/.test(clean)) return null;
  let head = clean, tail = "";
  if (clean.includes("::")) {
    const bits = clean.split("::");
    if (bits.length !== 2) return null;
    [head, tail] = bits;
  }
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const fill = 8 - h.length - t.length;
  if (fill < 0 || (!clean.includes("::") && h.length + t.length !== 8)) return null;
  const groups = [...h, ...Array(clean.includes("::") ? fill : 0).fill("0"), ...t];
  if (groups.length !== 8) return null;
  const out = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    const v = parseInt(groups[i] || "0", 16);
    if (!Number.isInteger(v) || v < 0 || v > 0xffff) return null;
    out[i * 2] = v >> 8;
    out[i * 2 + 1] = v & 0xff;
  }
  return out;
}

function unpackIPv6(b) {
  const groups = [];
  for (let i = 0; i < 8; i++) groups.push(((b[i * 2] << 8) | b[i * 2 + 1]).toString(16));
  return groups.join(":");
}

/* ---------------- the shape we understand ---------------- */

const KIND = { offer: 0, answer: 1 };
const KIND_BACK = ["offer", "answer"];
const SETUP = { actpass: 0, active: 1, passive: 2 };
const SETUP_BACK = ["actpass", "active", "passive"];
const CAND = { host: 0, srflx: 1, relay: 2, prflx: 3 };
const CAND_BACK = ["host", "srflx", "relay", "prflx"];

/* Priorities are regenerated rather than carried. These are the
   conventional bands; the exact numbers only order the checks. */
const PRIORITY = { host: 2113937151, srflx: 1677729535, prflx: 1677729535, relay: 41885439 };

const line = (sdp, re) => { const m = sdp.match(re); return m ? m[1] : null; };

/**
 * Pull the five things that matter out of an SDP.
 * @returns {object|null} null when this is not a shape we understand.
 */
export function dissect(sdp) {
  const text = String(sdp || "");

  // One media section, and it has to be the data channel. Anything
  // with audio or video in it is not something this app produced.
  const media = text.match(/^m=.*$/gm) || [];
  if (media.length !== 1) return null;
  if (!/^m=application\s+\S+\s+\S*DTLS\/SCTP\s+webrtc-datachannel/m.test(media[0])) return null;

  const ufrag = line(text, /^a=ice-ufrag:(\S+)\s*$/m);
  const pwd = line(text, /^a=ice-pwd:(\S+)\s*$/m);
  if (!ufrag || !pwd) return null;

  // sha-256 only. Every current browser uses it; anything else is
  // a browser this was not built against, so hand it to the long
  // path rather than guess.
  const fpText = line(text, /^a=fingerprint:sha-256\s+([0-9a-fA-F:]+)\s*$/m);
  if (!fpText) return null;
  const hex = fpText.split(":");
  if (hex.length !== 32) return null;
  const fingerprint = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    const v = parseInt(hex[i], 16);
    if (!Number.isInteger(v)) return null;
    fingerprint[i] = v;
  }

  const setupText = line(text, /^a=setup:(actpass|active|passive)\s*$/m);
  if (setupText === null) return null;

  const sctpPort = Number(line(text, /^a=sctp-port:(\d+)\s*$/m) || 5000);
  const maxMessage = Number(line(text, /^a=max-message-size:(\d+)\s*$/m) || 262144);

  const candidates = [];
  for (const raw of text.match(/^a=candidate:.*$/gm) || []) {
    const m = raw.match(/^a=candidate:(\S+)\s+(\d+)\s+(\S+)\s+(\d+)\s+(\S+)\s+(\d+)\s+typ\s+(host|srflx|prflx|relay)/i);
    if (!m) continue;
    const [, , component, proto, , address, port, type] = m;

    // Component 2 is RTCP, which a data channel does not have, and
    // TCP candidates for SCTP-over-DTLS are not something this app
    // will ever negotiate.
    if (component !== "1") continue;
    if (!/^udp$/i.test(proto)) continue;

    // The mDNS name of a local adapter cannot resolve off the LAN.
    if (/\.local$/i.test(address)) continue;

    const kind = CAND[type.toLowerCase()];
    if (kind === undefined) continue;

    const v4 = isIPv4(address) ? packIPv4(address) : null;
    const v6 = v4 ? null : packIPv6(address);
    if (!v4 && !v6) continue;

    const p = Number(port);
    if (!Number.isInteger(p) || p < 1 || p > 65535) continue;

    candidates.push({ type: type.toLowerCase(), address, port: p, bytes: v4 || v6, v6: !!v6 });
  }

  return { ufrag, pwd, fingerprint, setup: setupText, sctpPort, maxMessage, candidates };
}

/* ---------------- rebuild ---------------- */

function rebuild(kind, parts) {
  const { ufrag, pwd, fingerprint, setup, sctpPort, maxMessage, candidates } = parts;

  const fp = Array.from(fingerprint)
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join(":");

  /* A description with all candidates present and no trickle is
     the oldest and most widely accepted form there is, so the m=
     and c= lines carry the first candidate rather than the 9 /
     0.0.0.0 placeholder that means "more coming". */
  const first = candidates[0];
  const mPort = first ? first.port : 9;
  const cLine = first
    ? `c=IN ${first.v6 ? "IP6" : "IP4"} ${first.address}`
    : "c=IN IP4 0.0.0.0";

  const out = [
    "v=0",
    "o=- 1 1 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "a=group:BUNDLE 0",
    "a=msid-semantic: WMS",
    `m=application ${mPort} UDP/DTLS/SCTP webrtc-datachannel`,
    cLine,
    `a=ice-ufrag:${ufrag}`,
    `a=ice-pwd:${pwd}`,
    `a=fingerprint:sha-256 ${fp}`,
    `a=setup:${setup}`,
    "a=mid:0",
    `a=sctp-port:${sctpPort}`,
    `a=max-message-size:${maxMessage}`,
  ];

  candidates.forEach((c, i) => {
    out.push(
      `a=candidate:${i + 1} 1 udp ${PRIORITY[c.type] - i} ${c.address} ${c.port} typ ${c.type}` +
      (c.type === "srflx" || c.type === "prflx" || c.type === "relay" ? " raddr 0.0.0.0 rport 0" : "")
    );
  });

  return { type: kind, sdp: out.join("\r\n") + "\r\n" };
}

/* ---------------- encode ---------------- */

/**
 * @returns {string|null} a RPG2 code, or null to say "use the long form".
 */
export function compact(desc) {
  try {
    if (!desc || !desc.sdp) return null;
    const kind = KIND[desc.type];
    if (kind === undefined) return null;

    const parts = dissect(desc.sdp);
    if (!parts) return null;

    /* No routable candidate means no connection is possible from
       this description. The long code would at least carry the
       mDNS names, which work if the two ends turn out to be on one
       LAN after all, so it is strictly better here. */
    if (!parts.candidates.length) return null;

    const w = new Writer();
    w.u8(kind | (SETUP[parts.setup] << 2));
    w.str(parts.ufrag);
    w.str(parts.pwd);
    w.raw(parts.fingerprint);
    w.varint(parts.sctpPort);
    w.varint(parts.maxMessage);
    w.u8(Math.min(parts.candidates.length, 255));
    for (const c of parts.candidates.slice(0, 255)) {
      w.u8(CAND[c.type] | (c.v6 ? 0x80 : 0));
      w.raw(c.bytes);
      w.u16(c.port);
    }

    const code = `${COMPACT_PREFIX}.${b64urlEncode(w.done())}`;

    /* Round-trip before handing it out. A code that decodes to
       something other than what went in is worse than a long one,
       and this is the only moment where both versions exist to be
       compared. */
    const back = expand(code);
    if (!back.ok) return null;
    const check = dissect(back.desc.sdp);
    if (!check) return null;
    if (check.ufrag !== parts.ufrag || check.pwd !== parts.pwd) return null;
    if (check.setup !== parts.setup) return null;
    if (check.sctpPort !== parts.sctpPort || check.maxMessage !== parts.maxMessage) return null;
    if (check.candidates.length !== parts.candidates.length) return null;
    for (let i = 0; i < check.candidates.length; i++) {
      const a = check.candidates[i], b = parts.candidates[i];
      if (a.port !== b.port || a.type !== b.type) return null;
      if (a.bytes.length !== b.bytes.length) return null;
      for (let j = 0; j < a.bytes.length; j++) if (a.bytes[j] !== b.bytes[j]) return null;
    }
    if (back.desc.type !== desc.type) return null;

    return code;
  } catch {
    return null;
  }
}

/* ---------------- decode ---------------- */

/**
 * @returns {{ok: true, desc: {type, sdp}} | {ok: false, error: string}}
 */
export function expand(code) {
  const text = String(code || "").trim();
  const parts = text.split(".");
  if (parts.length !== 2 || parts[0] !== COMPACT_PREFIX)
    return { ok: false, error: "That is not a connection code." };

  try {
    const r = new Reader(b64urlDecode(parts[1]));

    const flags = r.u8();
    const kind = KIND_BACK[flags & 0x03];
    const setup = SETUP_BACK[(flags >> 2) & 0x03];
    if (!kind || !setup) return { ok: false, error: "That code is damaged." };

    const ufrag = r.str();
    const pwd = r.str();
    const fingerprint = r.raw(32);
    const sctpPort = r.varint();
    const maxMessage = r.varint();

    const n = r.u8();
    const candidates = [];
    for (let i = 0; i < n; i++) {
      const tag = r.u8();
      const v6 = !!(tag & 0x80);
      const type = CAND_BACK[tag & 0x7f];
      if (!type) return { ok: false, error: "That code is damaged." };
      const bytes = r.raw(v6 ? 16 : 4);
      const port = r.u16();
      candidates.push({ type, v6, bytes, port, address: v6 ? unpackIPv6(bytes) : unpackIPv4(bytes) });
    }

    if (!ufrag || !pwd) return { ok: false, error: "That code is damaged." };

    return {
      ok: true,
      desc: rebuild(kind, { ufrag, pwd, fingerprint, setup, sctpPort, maxMessage, candidates }),
    };
  } catch {
    return { ok: false, error: "That code is damaged or was cut short." };
  }
}

/** Which half of the exchange a compact code is, without expanding it. */
export function compactKind(code) {
  const parts = String(code || "").trim().split(".");
  if (parts.length !== 2 || parts[0] !== COMPACT_PREFIX) return null;
  try {
    const flags = b64urlDecode(parts[1])[0];
    return KIND_BACK[flags & 0x03] || null;
  } catch { return null; }
}
