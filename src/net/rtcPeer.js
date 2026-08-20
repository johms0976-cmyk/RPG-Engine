/* ============================================================
   ONE PEER CONNECTION.

   A wrapper over RTCPeerConnection and one ordered data channel,
   presenting the surface a WebSocket does: open, send an object,
   receive an object, close.

   ------------------------------------------------------------
   WHY ICE IS GATHERED COMPLETELY BEFORE THE CODE IS SHOWN

   The usual WebRTC flow trickles ICE candidates to the other side
   as they are discovered, which needs a live signalling channel.
   A manual exchange has no live channel — the code is pasted once
   and that is the whole conversation. So the code has to be
   complete, which means waiting for gathering to finish. The wait
   is capped: one unreachable STUN server must not hang the whole
   exchange, and a code missing its last candidate usually still
   connects.

   ------------------------------------------------------------
   TWO BUFFERS, BECAUSE TIMING IS NOBODY'S FRIEND HERE

   OUTBOUND, before the channel opens. The first thing either side
   wants to say is composed the moment the object exists, seconds
   before the handshake completes. A send() before open is queued
   and drained on open rather than returned false — false here
   means "never", and the caller cannot tell "never" from "not
   yet".

   INBOUND, before a handler is bound. The host attaches a peer
   the instant the channel opens and the relay speaks `welcome`
   immediately; on the phone, React binds onMessage in an effect,
   which is strictly after render. Losing that welcome means a
   phone that connected and then sits there anonymous. So arrivals
   queue until the first handler is assigned, and assigning it
   drains them, in order.

   ------------------------------------------------------------
   ORDERED AND RELIABLE, DELIBERATELY

   The protocol assumes in-order delivery: a snapshot with seq 8
   arriving before seq 7 would render the table's past over its
   present. Data channels can drop that guarantee for latency;
   this one does not.
   ============================================================ */

/* Public STUN only. STUN tells a browser what its own address looks
   like from outside; it never sees traffic. No TURN, because TURN
   relays the actual session through somebody's machine — precisely
   what this transport exists to avoid. The cost: a table behind two
   symmetric NATs may fail to connect, and the UI says so honestly.
   tests/offline.test.js pins this file as the only one allowed here. */
export const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

export const GATHER_TIMEOUT_MS = 4000;

export const rtcSupported = () => typeof RTCPeerConnection === "function";

/** Resolve once ICE gathering finishes, or the cap expires. */
function gathered(pc, timeout = GATHER_TIMEOUT_MS) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    let timer = null;
    const finish = () => {
      if (done) return;
      done = true;
      pc.removeEventListener("icegatheringstatechange", check);
      clearTimeout(timer);
      resolve();
    };
    const check = () => { if (pc.iceGatheringState === "complete") finish(); };
    pc.addEventListener("icegatheringstatechange", check);
    /* Some browsers never fire the state change but do fire a null
       candidate to mean the same thing. */
    pc.addEventListener("icecandidate", (e) => { if (!e.candidate) finish(); });
    timer = setTimeout(finish, timeout);
  });
}

/**
 * The link: one object, stable for the connection's whole life,
 * with assignable handlers. useSocket's RTC branch assigns them in
 * an effect; the property setter on onMessage is what makes that
 * safe — see the inbound buffer above.
 *
 * Exported for tests, which drive it with a fake channel because
 * their environment has no WebRTC at all.
 */
export function makeLink(pc) {
  let onMessage = null;
  const inbox = [];
  const outbox = [];

  const link = {
    pc,
    channel: null,
    onOpen: null,
    onClose: null,
    _closed: false,

    get onMessage() { return onMessage; },
    set onMessage(fn) {
      onMessage = fn;
      while (fn && inbox.length) fn(inbox.shift());
    },

    get open() { return !!(link.channel && link.channel.readyState === "open"); },

    send(obj) {
      if (link._closed) return false;
      if (link.open) {
        try { link.channel.send(JSON.stringify(obj)); return true; }
        catch { return false; }
      }
      outbox.push(obj);
      return true;
    },

    close() {
      link._closed = true;
      try { link.channel && link.channel.close(); } catch { /* gone */ }
      try { pc.close(); } catch { /* gone */ }
    },

    /** Wire a channel in — the offerer's own, or the answerer's arrival. */
    _attach(channel) {
      link.channel = channel;
      channel.onopen = () => {
        while (outbox.length && link.open) link.send(outbox.shift());
        link.onOpen && link.onOpen();
      };
      channel.onmessage = (e) => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        if (onMessage) onMessage(msg);
        else inbox.push(msg);
      };
      channel.onclose = () => { if (!link._closed) link.onClose && link.onClose("channel-closed"); };
      /* Already open by the time it got here — the answerer's channel
         can arrive open in the same tick. */
      if (channel.readyState === "open") channel.onopen();
    },
  };

  pc.onconnectionstatechange = () => {
    if (link._closed) return;
    if (pc.connectionState === "failed" || pc.connectionState === "disconnected")
      link.onClose && link.onClose(pc.connectionState);
  };

  return link;
}

/**
 * The offering side — on this engine, always the Warden. Creates the
 * channel, makes an offer, and waits for a complete candidate set
 * before handing back the description to encode.
 */
export async function createOffer({ iceServers = ICE_SERVERS } = {}) {
  const pc = new RTCPeerConnection({ iceServers });
  /* The offerer creates the channel; the answerer receives it via
     ondatachannel. A channel created on both sides is two channels. */
  const link = makeLink(pc);
  link._attach(pc.createDataChannel("rpg", { ordered: true }));

  await pc.setLocalDescription(await pc.createOffer());
  await gathered(pc);

  return {
    link,
    localDescription: pc.localDescription,
    /** Complete the handshake with the pasted answer. */
    async accept(desc) {
      if (pc.signalingState === "stable") return false;
      await pc.setRemoteDescription(desc);
      return true;
    },
  };
}

/**
 * The answering side — a player. Takes the offer, produces the answer
 * to send back, and hands over a link that becomes live when the
 * channel arrives.
 */
export async function createAnswer(offerDesc, { iceServers = ICE_SERVERS } = {}) {
  const pc = new RTCPeerConnection({ iceServers });
  const link = makeLink(pc);
  pc.ondatachannel = (e) => link._attach(e.channel);

  await pc.setRemoteDescription(offerDesc);
  await pc.setLocalDescription(await pc.createAnswer());
  await gathered(pc);

  return { link, localDescription: pc.localDescription };
}
