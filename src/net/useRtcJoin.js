/* ============================================================
   useRtcJoin — a phone's end of remote play.

   Half the exchange, from the answering side:

     idle        waiting for the Warden's offer code
     answering   building the answer, gathering candidates
     ready       the answer code is on screen; carry it back
     open        connected — the shell takes over
     closed      it was open, and dropped

   The link exists from `ready` onward, so ClientShell can mount
   immediately and sit at "connecting" while the Warden pastes —
   the same waiting posture it already has on a LAN while the
   relay comes up. Nothing downstream knows which transport it is
   on, which was the entire point of the transport seam.
   ============================================================ */
import { useCallback, useRef, useState } from "react";
import { createAnswer, rtcSupported } from "./rtcPeer.js";
import { encodeSignal, decodeSignal } from "./rtcSignal.js";

export function useRtcJoin() {
  const [state, setState] = useState("idle");
  const [answerCode, setAnswerCode] = useState(null);
  const [error, setError] = useState(null);
  const [link, setLink] = useState(null);
  const busy = useRef(false);

  const begin = useCallback(async (pasted) => {
    if (busy.current) return;
    setError(null);

    const decoded = await decodeSignal(pasted);
    if (!decoded.ok) { setError(decoded.error); return; }
    if (decoded.desc.type !== "offer") {
      setError("That is an answer code. You want the OFFER code the Warden's screen showed.");
      return;
    }

    busy.current = true;
    setState("answering");
    try {
      const made = await createAnswer(decoded.desc, {});
      made.link.onOpen = () => setState("open");
      made.link.onClose = () => setState("closed");
      setLink(made.link);
      setAnswerCode(await encodeSignal(made.localDescription));
      setState("ready");
    } catch (e) {
      setError(`Couldn't answer that offer: ${String((e && e.message) || e)}`);
      setState("idle");
      busy.current = false;
    }
  }, []);

  return { supported: rtcSupported(), state, answerCode, error, link, begin };
}
