/* ============================================================
   useRtcHost — the Warden's end of remote play.

   Owns one relay (the router in rtcRelay.js) and a list of
   "slots", one per invited player. A slot is the state machine
   the RemotePanel renders:

     making      building the offer, gathering candidates
     offered     the code is on screen, waiting to be carried
     connecting  their answer is pasted, the handshake is running
     connected   the channel is open; the phone is at the table
     gone        it was connected, and dropped
     failed      it never connected, with the reason we have

   The slot list is UI state. The relay's roster is the truth
   about who is present — names arrive there via `hello`, exactly
   as on the LAN, and reach the Warden through the same `peers`
   messages useHost already consumes. This hook deliberately does
   not duplicate that: a slot knows its connection, not its player.

   ------------------------------------------------------------
   WHY A DROPPED REMOTE PHONE IS NOT RECONNECTED HERE

   The LAN socket reconnects by itself because the address it dials
   is stable. A manual exchange has no address — reviving a dropped
   peer means new codes carried by hand, which is a decision for
   people, not a retry loop. So `gone` is a state that asks the
   Warden to invite again, and the character was already released
   back to the table by the relay's detach.
   ============================================================ */
import { useCallback, useEffect, useRef, useState } from "react";
import { createRelay } from "./rtcRelay.js";
import { createOffer, rtcSupported } from "./rtcPeer.js";
import { encodeSignal, decodeSignal } from "./rtcSignal.js";

let slotSeq = 0;

export function useRtcHost({ enabled }) {
  const [slots, setSlots] = useState([]);
  const made = useRef(new Map()); // slotId -> { offer, link }

  /* One relay for the table's whole life, created the first render
     remote play is on. Created during render rather than in an effect
     because useHost needs it in the same pass — a relay that appears
     one render late is a socket that reports "connecting" to a Warden
     who just pressed the button. */
  const relayRef = useRef(null);
  if (enabled && !relayRef.current) relayRef.current = createRelay({});

  const patch = useCallback((id, up) => {
    setSlots((all) => all.map((s) => (s.id === id ? { ...s, ...up } : s)));
  }, []);

  /* Switching remote play off is ending the remote table, and it has
     to be done out loud: shutdown broadcasts `hostgone`, so every
     remote phone shows "the table went away" rather than an eternal
     reconnect spinner, and the links are actually closed rather than
     left holding candidates. The relay is rebuilt fresh if it is
     switched back on. */
  useEffect(() => {
    if (enabled) return;
    if (relayRef.current) { relayRef.current.shutdown(); relayRef.current = null; }
    for (const { link } of made.current.values()) { try { link.close(); } catch { /* gone */ } }
    made.current.clear();
    setSlots([]);
  }, [enabled]);

  /** Build an offer and put its code on screen. */
  const invite = useCallback(async () => {
    const id = `slot${++slotSeq}`;
    setSlots((all) => [...all, { id, state: "making", code: null, error: null }]);
    try {
      const offer = await createOffer({});
      const { link } = offer;
      made.current.set(id, { offer, link });

      link.onOpen = () => {
        const relay = relayRef.current;
        if (!relay) { link.close(); return; }
        const r = relay.attach({ send: (m) => link.send(m), close: () => link.close() });
        if (!r.ok) { patch(id, { state: "failed", error: "The table is full." }); link.close(); return; }
        /* From here the link is the relay's: everything the phone says
           goes through the same router the LAN traffic would. */
        link.onMessage = (msg) => relay.fromClient(r.clientId, msg);
        link.onClose = () => {
          relay.detach(r.clientId);
          patch(id, { state: "gone" });
        };
        patch(id, { state: "connected" });
      };
      link.onClose = () => {
        /* Reached only pre-attach — onOpen replaces this handler. */
        patch(id, { state: "failed", error: "The connection could not be made. Both ends being behind strict NAT is the usual reason." });
      };

      const code = await encodeSignal(offer.localDescription);
      patch(id, { state: "offered", code });
    } catch (e) {
      patch(id, { state: "failed", error: `Couldn't build an offer: ${String((e && e.message) || e)}` });
    }
  }, [patch]);

  /** Their answer, pasted back. */
  const acceptAnswer = useCallback(async (id, pasted) => {
    const entry = made.current.get(id);
    if (!entry) return;
    const decoded = await decodeSignal(pasted);
    if (!decoded.ok) { patch(id, { error: decoded.error }); return; }
    if (decoded.desc.type !== "answer") {
      /* The single commonest mistake in a manual exchange: their offer
         box and your answer box look identical. */
      patch(id, { error: "That is an offer code — you want the ANSWER code the player's screen showed after they pasted yours." });
      return;
    }
    try {
      const ok = await entry.offer.accept(decoded.desc);
      /* Guarded: the channel can open *during* that await — on a LAN
         the handshake is quicker than the promise — and onOpen has
         then already marked the slot connected. Stamping "connecting"
         over it now would regress the state machine, and the panel
         would sit on "connecting…" for a phone that is already at the
         table. States only move forward. */
      if (!ok) { patch(id, { error: "This invite was already completed." }); return; }
      setSlots((all) => all.map((s) =>
        s.id === id && s.state !== "connected" && s.state !== "gone"
          ? { ...s, state: "connecting", error: null }
          : s.id === id ? { ...s, error: null } : s,
      ));
    } catch (e) {
      patch(id, { error: `That answer was refused: ${String((e && e.message) || e)}` });
    }
  }, [patch]);

  /** Withdraw an invite, or clear a dead one off the panel. */
  const drop = useCallback((id) => {
    const entry = made.current.get(id);
    if (entry) { try { entry.link.close(); } catch { /* gone */ } }
    made.current.delete(id);
    setSlots((all) => all.filter((s) => s.id !== id));
  }, []);

  return {
    supported: rtcSupported(),
    relay: enabled ? relayRef.current : null,
    slots,
    invite,
    acceptAnswer,
    drop,
  };
}
