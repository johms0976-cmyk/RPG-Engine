/* ============================================================
   useSocket — one reconnecting connection to the table.

   ------------------------------------------------------------
   TRANSPORTS

   Two ways a phone reaches the Warden, chosen by `transport`:

     "relay"  the LAN WebSocket in server/host.mjs. The original
              and still the default: everyone on one wifi, the
              server does the routing, `dark` whispers are
              structurally guaranteed because the words never
              reach the Warden's machine.

     "rtc"    a direct connection between browsers, for tables
              that are not in the same building. No server holds
              game state, because no server is involved after the
              handshake. See rtcRelay.js for what changes — in
              particular that `dark` whispers cannot survive the
              move, and are refused rather than faked.

   The relay path below is untouched by the split: same code, same
   behaviour, same reconnect. A transport is selected, never
   inferred, so nothing silently changes underneath a table that
   was working.
   ============================================================ */

/* ============================================================
   The relay transport — one reconnecting WebSocket.

   Phones sleep constantly; a socket that doesn't come back by
   itself makes the game unplayable. Reconnect backs off to a
   ceiling and resyncs by simply accepting the next full
   snapshot, so there is no catch-up protocol to get wrong.
   ============================================================ */
import { useEffect, useRef, useState, useCallback } from "react";

/* The Warden's token rides on the upgrade request rather than in a
   first message, because the thing it authorises — becoming the
   authority and evicting whoever currently holds it — happens at
   connection time. Checking it afterwards would mean the takeover
   had already occurred by the time we refused it. */
export const wsUrl = (role, token) => {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const qs = new URLSearchParams();
  if (role) qs.set("role", role);
  if (token) qs.set("token", token);
  const q = qs.toString();
  return `${proto}//${location.host}/net${q ? `?${q}` : ""}`;
};

export const TRANSPORTS = ["relay", "rtc"];

/** What a caller can rely on, per transport. Read by the UI so a table
    is told about a limitation before it agrees to something. */
export const TRANSPORT_CAPABILITIES = {
  relay: { sameNetwork: true, darkWhispers: true, needsSignalling: false },
  rtc: { sameNetwork: false, darkWhispers: false, needsSignalling: true },
};

/**
 * @param role   "host" or null
 * @param onMessage
 * @param token  the Warden's session token; ignored for players
 * @param opts   { transport } — "relay" (default) or "rtc"
 */
export function useSocket(role, onMessage, token, opts = {}) {
  const transport = opts.transport === "rtc" ? "rtc" : "relay";
  /* Hooks cannot be called conditionally, so both run and one is
     inert. useRelaySocket with enabled:false opens nothing. */
  const relay = useRelaySocket(role, onMessage, token, transport === "relay");
  const rtc = useRtcSocket(role, onMessage, transport === "rtc" ? opts : null);
  return transport === "rtc" ? rtc : relay;
}

function useRelaySocket(role, onMessage, token, enabled = true) {
  const [status, setStatus] = useState("connecting");
  const ref = useRef(null);
  const handler = useRef(onMessage);
  handler.current = onMessage;

  useEffect(() => {
    if (!enabled) return undefined;
    let closed = false;
    let attempt = 0;
    let timer = null;

    const open = () => {
      if (closed) return;
      let ws;
      try { ws = new WebSocket(wsUrl(role, token)); } catch { return retry(); }
      ref.current = ws;
      ws.onopen = () => { attempt = 0; setStatus("open"); };
      ws.onmessage = (e) => {
        let msg; try { msg = JSON.parse(e.data); } catch { return; }
        /* A refused token is not a network problem and reconnecting
           harder will not fix it — it will just burn through the
           relay's attempt allowance and lock this address out. Stop,
           and let the UI ask for a token instead. */
        if (msg && msg.t === "denied" && (msg.reason === "bad-token" || msg.reason === "host-locked")) {
          closed = true;
          setStatus(msg.reason === "host-locked" ? "locked" : "unauthorised");
        }
        handler.current && handler.current(msg);
      };
      ws.onclose = () => { if (!closed) { setStatus("closed"); retry(); } };
      ws.onerror = () => { try { ws.close(); } catch { /* already gone */ } };
    };

    const retry = () => {
      if (closed) return;
      setStatus("reconnecting");
      const wait = Math.min(8000, 400 * 2 ** attempt++);
      timer = setTimeout(open, wait);
    };

    open();
    // A phone waking from sleep fires this long before the dead socket
    // notices it is dead, so we jump the backoff queue.
    const wake = () => {
      if (ref.current && ref.current.readyState > 1) { attempt = 0; clearTimeout(timer); open(); }
    };
    document.addEventListener("visibilitychange", wake);

    return () => {
      closed = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      try { ref.current && ref.current.close(); } catch { /* ignore */ }
    };
    // `token` is a dependency because a Warden who has just typed one
    // needs the socket rebuilt with it, not the old unauthorised one
    // retried forever.
  }, [role, token, enabled]);

  const send = useCallback((obj) => {
    const ws = ref.current;
    if (ws && ws.readyState === 1) { ws.send(JSON.stringify(obj)); return true; }
    return false;
  }, []);

  return { status, send };
}

/* ============================================================
   The RTC transport.

   The shape is deliberately the same — { status, send } — so the
   two call sites in useHost.js and ClientShell.jsx never learn
   which one they got. That is the whole point of the split: the
   protocol, the redaction, the resume logic and the snapshot
   loop are transport-agnostic already, and making them prove it
   was most of the work.

   The handshake itself is not a hook's job. A manual exchange is
   several seconds of a person copying a code into a chat window,
   which is a screen, not an effect. So this consumes a `link`
   that something else established, and concerns itself only with
   pumping messages once one exists.
   ============================================================ */

/**
 * @param role      "host" or null
 * @param onMessage
 * @param opts      null when this transport is inert, otherwise
 *                  { link } for a player, or { relay } for the host
 */
function useRtcSocket(role, onMessage, opts) {
  const [status, setStatus] = useState("connecting");
  const handler = useRef(onMessage);
  handler.current = onMessage;

  const link = opts && opts.link;
  const relay = opts && opts.relay;
  const ref = useRef(null);
  ref.current = role === "host" ? relay : link;

  useEffect(() => {
    if (!opts) return undefined;

    /* The host is the hub. It is "open" as soon as it is willing to
       accept peers — there is nobody to connect *to*. */
    if (role === "host") {
      setStatus(relay ? "open" : "connecting");
      return undefined;
    }

    if (!link) { setStatus("connecting"); return undefined; }

    link.onMessage = (msg) => handler.current && handler.current(msg);
    link.onOpen = () => setStatus("open");
    link.onClose = () => setStatus("closed");
    setStatus(link.open ? "open" : "connecting");

    return () => { link.onMessage = null; link.onOpen = null; link.onClose = null; };
  }, [opts, role, link, relay]);

  const send = useCallback((obj) => {
    const target = ref.current;
    if (!target) return false;
    /* On the host, "sending" is routing: the relay decides whether this
       goes to one peer or all of them, exactly as server/host.mjs does. */
    if (role === "host") return target.fromHost(obj);
    return target.send(obj);
  }, [role]);

  return { status, send };
}
