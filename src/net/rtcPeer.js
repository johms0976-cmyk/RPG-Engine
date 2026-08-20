/* ============================================================
   ONE PEER CONNECTION.

   A thin wrapper over RTCPeerConnection and one ordered data
   channel, presenting the same surface a WebSocket does: open,
   send an object, receive an object, close.

   ------------------------------------------------------------
   WHY ICE IS GATHERED COMPLETELY BEFORE THE CODE IS SHOWN

   The usual WebRTC flow trickles ICE candidates to the other side
   as they are discovered, which needs a live signalling channel.
   A manual exchange has no live channel — the code is pasted once
   and that is the whole conversation. So the code has to be
   complete, which means waiting for gathering to finish.

   That wait is normally under a second on a LAN and a couple of
   seconds over the internet. It is capped, because a single
   unreachable STUN server would otherwise hang the whole exchange
   forever, and a code missing its last candidate usually still
   connects.

   ------------------------------------------------------------
   ORDERED AND RELIABLE, DELIBERATELY

   The protocol assumes in-order delivery: a snapshot with seq 8
   arriving before seq 7 would render the table's past over its
   present. Data channels can be configured to drop that guarantee
   for latency, and this one is not.
   ============================================================ */

/* Public STUN only. STUN tells a browser what its own public address
   looks like from outside; it never sees traffic. No TURN, because
   TURN relays the actual media and would mean running a server that
   game data passes through — which is precisely what this transport
   exists to avoid. The cost is that a table behind two symmetric NATs
   may fail to connect, and the UI has to say so honestly. */
export const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

export const GATHER_TIMEOUT_MS = 4000;

export const rtcSupported = () =>
  typeof RTCPeerConnection !== "undefined" && typeof RTCPeerConnection === "function";

/** Resolve once ICE gathering finishes, or the cap expires. */
function gathered(pc, timeout = GATHER_TIMEOUT_MS) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
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
    const timer = setTimeout(finish, timeout);
  });
}

/**
 * Wrap a connection and its channel in something that behaves like a
 * socket. `onMessage` receives parsed objects; malformed frames are
 * dropped rather than thrown, exactly as useSocket does.
 */
function wrap(pc, channel, { onMessage, onOpen, onClose }) {
  let closed = false;

  channel.onopen = () => onOpen && onOpen();
  channel.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    onMessage && onMessage(msg);
  };
  channel.onclose = () => { if (!closed) onClose && onClose("channel-closed"); };

  pc.onconnectionstatechange = () => {
    if (closed) return;
    if (pc.connectionState === "failed" || pc.connectionState === "disconnected")
      onClose && onClose(pc.connectionState);
  };

  return {
    pc,
    channel,
    get open() { return channel.readyState === "open"; },
    send(obj) {
      if (channel.readyState !== "open") return false;
      try { channel.send(JSON.stringify(obj)); return true; }
      catch { return false; }
    },
    close() {
      closed = true;
      try { channel.close(); } catch { /* already gone */ }
      try { pc.close(); } catch { /* already gone */ }
    },
  };
}

/**
 * The offering side. Creates the channel, makes an offer, and waits
 * for a complete set of candidates before handing back the code.
 *
 * @returns {{link, localDescription, accept(answerDesc)}}
 */
export async function createOffer({ onMessage, onOpen, onClose, iceServers = ICE_SERVERS } = {}) {
  const pc = new RTCPeerConnection({ iceServers });
  /* The offerer creates the channel. The answerer receives it via
     ondatachannel — a channel created on both sides is two channels. */
  const channel = pc.createDataChannel("rpg", { ordered: true });
  const link = wrap(pc, channel, { onMessage, onOpen, onClose });

  await pc.setLocalDescription(await pc.createOffer());
  await gathered(pc);

  return {
    link,
    localDescription: pc.localDescription,
    /** Feed in the answer code's description to complete the handshake. */
    async accept(desc) {
      if (pc.signalingState === "stable") return false;
      await pc.setRemoteDescription(desc);
      return true;
    },
  };
}

/**
 * The answering side. Takes the offer, produces an answer, and waits
 * for its own candidates before handing back the code.
 */
export async function createAnswer(offerDesc, { onMessage, onOpen, onClose, iceServers = ICE_SERVERS } = {}) {
  const pc = new RTCPeerConnection({ iceServers });

  let link = null;
  const pending = [];
  pc.ondatachannel = (e) => {
    link = wrap(pc, e.channel, {
      onMessage,
      onOpen,
      onClose,
    });
    /* Anything queued before the channel arrived goes out now. */
    while (pending.length) link.send(pending.shift());
  };

  await pc.setRemoteDescription(offerDesc);
  await pc.setLocalDescription(await pc.createAnswer());
  await gathered(pc);

  return {
    localDescription: pc.localDescription,
    get link() { return link; },
    /* A send before ondatachannel fires is queued rather than lost.
       The window is small but real, and losing the first `hello` means
       a phone that connects and then sits there anonymous. */
    send(obj) {
      if (link) return link.send(obj);
      pending.push(obj);
      return true;
    },
    close() {
      if (link) link.close();
      else { try { pc.close(); } catch { /* already gone */ } }
    },
  };
}
