/* ============================================================
   useSocket — one reconnecting WebSocket.

   Phones sleep constantly; a socket that doesn't come back by
   itself makes the game unplayable. Reconnect backs off to a
   ceiling and resyncs by simply accepting the next full
   snapshot, so there is no catch-up protocol to get wrong.
   ============================================================ */
import { useEffect, useRef, useState, useCallback } from "react";

export const wsUrl = (role) => {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/net${role ? `?role=${role}` : ""}`;
};

export function useSocket(role, onMessage) {
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
      try { ws = new WebSocket(wsUrl(role)); } catch { return retry(); }
      ref.current = ws;
      ws.onopen = () => { attempt = 0; setStatus("open"); };
      ws.onmessage = (e) => {
        let msg; try { msg = JSON.parse(e.data); } catch { return; }
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
  }, [role]);

  const send = useCallback((obj) => {
    const ws = ref.current;
    if (ws && ws.readyState === 1) { ws.send(JSON.stringify(obj)); return true; }
    return false;
  }, []);

  return { status, send };
}
