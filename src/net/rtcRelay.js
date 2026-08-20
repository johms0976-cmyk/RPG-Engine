/* ============================================================
   THE RELAY, MOVED INTO THE HOST TAB.

   On a LAN the routing lives in server/host.mjs: it assigns
   client ids, keeps the roster, forwards `to`-addressed messages,
   strips identity off the safety card and filters player-to-player
   whispers. The host tab talks to it over one socket and never
   thinks about who is on the other end.

   Peer-to-peer has no such server. The host is the hub, so the
   host has to do that job. This file is that job, deliberately
   written as a pure router: no React, no RTCPeerConnection, no
   timers. It takes ports — anything with a send() — which is what
   makes it testable in a JSDOM environment that has no WebRTC at
   all, and what would let it sit on top of a different transport
   later without being rewritten.

   It is a port of server/host.mjs, and the two must agree. Where
   they cannot, this file says so out loud.

   ============================================================
   THE ONE PLACE THEY CANNOT AGREE: "DARK" WHISPERS

   The relay offers three settings for how much of a
   player-to-player whisper the Warden sees. Two of them survive
   the move here. The third does not, and it is worth being exact
   about why rather than quietly downgrading it.

     open   the Warden sees the text          — fine
     seen   the Warden is told it happened    — fine
     dark   the Warden is told nothing        — NOT POSSIBLE HERE

   `dark` was never a policy. useHost.js says so directly: the
   filtering happens on the relay because "what never leaves the
   relay cannot be displayed, logged or leaked by a bug upstream",
   and that "this codebase does not do promises". The guarantee was
   structural — the words physically did not reach the Warden's
   machine.

   In a star topology the Warden's machine is the router. Every
   whisper passes through this process by construction. Keeping the
   name `dark` while the text sits in the host tab's memory would
   convert a structural guarantee into exactly the promise the
   original comment refuses to make, and a table might agree to
   something on the strength of it.

   So: over peer-to-peer, `dark` is refused, not silently honoured.
   requestPeerMode() downgrades it to `seen` and reports the
   downgrade so the UI can tell the table before they rely on it.
   A table that needs true `dark` needs the LAN relay, and should
   be told that rather than discovering it later.
   ============================================================ */

import { HOST_TO_CLIENT, PEER_MODES } from "./protocol.js";

/** Matches the relay's cap. */
export const MAX_CLIENTS = 12;

/** What this transport can and cannot do, for the UI to read. */
export const RTC_CAPABILITIES = {
  peerModes: ["open", "seen"],
  /* Named so a caller cannot claim the relay's guarantee by accident. */
  darkWhispers: false,
  darkReason:
    "Over a direct connection the Warden's browser is the router, so a whisper " +
    "physically passes through it. Only the LAN relay can withhold it.",
  maxClients: MAX_CLIENTS,
};

/**
 * @param {object} opts
 * @param {(msg: object) => void} opts.toHost   deliver a message to the host tab
 * @param {string} [opts.peerWhispers]          initial mode
 */
export function createRelay({ toHost: initialToHost, peerWhispers = "seen" } = {}) {
  /** clientId -> { port, name, pcId, clientId } */
  const clients = new Map();
  let nextId = 1;
  let mode = "seen";

  /* Late-bindable. The relay is created before useHost has built its
     onMessage — React builds that during render, the relay is built
     when remote play is switched on — so the destination is a slot
     rather than a closure. Anything said before a handler is bound is
     queued and drained on bind, for the same reason the peer link
     buffers its inbox: the first message is composed before the
     listener exists, and "lost" and "early" must not be the same. */
  let hostFn = initialToHost || null;
  const hostQueue = [];
  const toHost = (msg) => {
    if (hostFn) { hostFn(msg); return; }
    /* Bounded. The unbound window is normally milliseconds, but a host
       that switched transports away can leave the router speaking into
       nothing indefinitely, and an unbounded queue is a slow leak with
       a long fuse. Oldest first: a stale roster matters less than the
       intent that just arrived. */
    hostQueue.push(msg);
    while (hostQueue.length > 64) hostQueue.shift();
  };

  const say = (c, msg) => { try { c.port.send(msg); } catch { /* gone */ } };
  const broadcast = (msg) => { for (const c of clients.values()) say(c, msg); };

  /* The roster the relay publishes. Names and claims only — no ports,
     no addresses, nothing a snapshot would not already carry. */
  const roster = (forHost = false) =>
    [...clients.values()].map((c) => ({
      clientId: c.clientId,
      name: c.name || "",
      pcId: c.pcId || null,
      ...(forHost ? { connected: true } : {}),
    }));

  const announce = () => {
    toHost({ t: "peers", peers: roster(true) });
    broadcast({ t: "peers", peers: roster(false) });
  };

  /**
   * Set the whisper mode, refusing `dark`.
   * @returns {{mode: string, downgraded: boolean, reason?: string}}
   */
  function requestPeerMode(wanted) {
    const asked = PEER_MODES.includes(wanted) ? wanted : "seen";
    if (asked === "dark") {
      mode = "seen";
      return { mode, downgraded: true, reason: RTC_CAPABILITIES.darkReason };
    }
    mode = asked;
    return { mode, downgraded: false };
  }
  requestPeerMode(peerWhispers);

  /* ---------------- membership ---------------- */

  /**
   * Register a connected peer.
   * @returns {{ok: true, clientId: string} | {ok: false, reason: string}}
   */
  function attach(port) {
    if (clients.size >= MAX_CLIENTS) {
      try { port.send({ t: "denied", reason: "full" }); } catch { /* gone */ }
      return { ok: false, reason: "full" };
    }
    /* Server-assigned, exactly as the relay does it. A client that
       named itself could name itself somebody else. */
    const clientId = `c${nextId++}`;
    const c = { port, clientId, name: "", pcId: null };
    clients.set(clientId, c);
    say(c, { t: "welcome", clientId, isHost: false, peers: roster() });
    announce();
    return { ok: true, clientId };
  }

  function detach(clientId) {
    const c = clients.get(clientId);
    if (!c) return false;
    clients.delete(clientId);
    /* Tell the host the body is free again. A player whose phone died
       mid-session must not lock their character out of the table. */
    if (c.pcId) toHost({ t: "claim", clientId, pcId: "" });
    announce();
    return true;
  }

  /** Every peer loses the table at once — the host tab is going away. */
  function shutdown() {
    broadcast({ t: "hostgone" });
    for (const c of clients.values()) { try { c.port.close && c.port.close(); } catch { /* gone */ } }
    clients.clear();
  }

  /* ---------------- client -> host ---------------- */

  function fromClient(clientId, msg) {
    const c = clients.get(clientId);
    if (!c || !msg || typeof msg.t !== "string") return;

    switch (msg.t) {
      case "hello":
        c.name = String(msg.name || "").slice(0, 40);
        announce();
        return;

      case "claim": {
        const wanted = msg.pcId || "";
        if (!wanted) {
          c.pcId = null;
          toHost({ t: "claim", clientId, pcId: "" });
          announce();
          return;
        }
        /* Two phones cannot hold one character. Checked here rather
           than on the host because the roster lives here. */
        const taken = [...clients.values()].some((o) => o !== c && o.pcId === wanted);
        if (taken) return say(c, { t: "denied", reason: "taken" });
        c.pcId = wanted;
        toHost({ t: "claim", clientId, pcId: wanted });
        say(c, { t: "claimed", pcId: wanted });
        announce();
        return;
      }

      case "intent":
        /* A phone may only act as the character it holds. The host
           re-checks, but refusing here keeps a spoofed intent out of
           the authority's inbox entirely. */
        if (!c.pcId || msg.asPc !== c.pcId) return say(c, { t: "denied", reason: "not-yours" });
        toHost({ t: "intent", clientId, action: msg.action, args: msg.args, asPc: c.pcId });
        return;

      case "submit":
        toHost({ t: "submit", clientId, name: c.name, character: msg.character });
        return;

      case "withdraw":
        toHost({ t: "withdraw", clientId });
        return;

      case "playerwhisper":
        toHost({
          t: "playerwhisper",
          clientId,
          name: c.name,
          pcId: c.pcId,
          text: String(msg.text || "").slice(0, 2000),
          replyTo: msg.replyTo || null,
        });
        return;

      case "safety": {
        /* Anonymous by construction. The level travels; who pressed it
           does not, and there is nothing here for the host to log. */
        const level = String(msg.level || "check");
        toHost({ t: "safety", level });
        say(c, { t: "safetyack", level });
        return;
      }

      case "peerwhisper": {
        const text = String(msg.text || "").slice(0, 2000);
        const to = [...clients.values()].filter((o) => o.pcId && o.pcId === msg.toPcId);
        for (const o of to) say(o, { t: "peerwhisper", from: c.name, fromPcId: c.pcId, text });
        say(c, { t: "ack", state: to.length ? "whispered" : "nobody-there" });

        /* mode is never "dark" here — requestPeerMode refuses it. */
        if (mode === "open") toHost({ t: "peernote", fromPcId: c.pcId, toPcId: msg.toPcId, text });
        else toHost({ t: "peernote", fromPcId: c.pcId, toPcId: msg.toPcId });
        return;
      }

      default:
        /* Unknown verbs are dropped, not forwarded. The relay's
           vocabulary is closed on purpose. */
    }
  }

  /* ---------------- host -> clients ---------------- */

  /**
   * A message the host wants to put on the wire.
   *
   * Addressed messages go to one client and must be declared in
   * HOST_TO_CLIENT — the same rule the relay enforces, for the same
   * reason: an undeclared message is one that silently does not
   * arrive, and finding that out mid-session is expensive.
   */
  function fromHost(msg) {
    if (!msg || typeof msg.t !== "string") return false;

    /* The relay's own config verb. It is consumed here, not forwarded. */
    if (msg.t === "config") {
      requestPeerMode(msg.peerWhispers);
      return true;
    }

    if (msg.to !== undefined && msg.to !== null) {
      if (!HOST_TO_CLIENT.has(msg.t)) return false;
      const target = clients.get(msg.to)
        || [...clients.values()].find((c) => c.pcId === msg.to);
      if (!target) return false;
      const { to, ...rest } = msg;
      say(target, rest);
      return true;
    }

    broadcast(msg);
    return true;
  }

  return {
    attach, detach, shutdown,
    fromClient, fromHost,
    requestPeerMode,
    roster,
    get mode() { return mode; },
    get size() { return clients.size; },
    get toHost() { return hostFn; },
    set toHost(fn) {
      hostFn = fn;
      while (fn && hostQueue.length) fn(hostQueue.shift());
    },
    capabilities: RTC_CAPABILITIES,
  };
}
