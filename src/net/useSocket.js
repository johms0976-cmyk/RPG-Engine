/* ============================================================
   useSocket — one reconnecting WebSocket.

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

/**
 * @param role   "host" or null
 * @param onMessage
 * @param token  the Warden's session token; ignored for players
 */
export function useSocket(role, onMessage, token) {
  const [status, setStatus] = useState("connecting");
  const ref = useRef(null);
  const handler = useRef(onMessage);
  handler.current = onMessage;

  useEffect(() => {
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
  }, [role, token]);

  const send = useCallback((obj) => {
    const ws = ref.current;
    if (ws && ws.readyState === 1) { ws.send(JSON.stringify(obj)); return true; }
    return false;
  }, []);

  return { status, send };
}
