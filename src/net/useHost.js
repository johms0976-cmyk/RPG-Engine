/* ============================================================
   useHost — turns a live useGame into the authority for the table.

   Two jobs:
     1. Broadcast a snapshot whenever anything changes.
     2. Accept intents from phones and run them against the real
        engine, in order, one at a time.

   The ordering matters more than it looks. Almost every player
   action in useGame resolves through P(), the *active* character.
   So an intent from Riley cannot simply be invoked — activeId has
   to be Riley first. setActiveId is async, and activeRef is synced
   in an effect, so we set the active character, wait one pass, and
   only then dispatch. That single-slot queue is also what stops
   two phones mutating the world in the same tick.
   ============================================================ */
import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "./useSocket.js";
import { packSnapshot, decideIntent } from "./protocol.js";
import { redactState, VIEW } from "../engine/secrets.js";
import { distort } from "./distort.js";
import { currentTurn } from "../engine/combat.js";

export function useHost({ g, mod, phase, lobby, enabled = true }) {
  const [peers, setPeers] = useState([]);
  const [claims, setClaims] = useState({});   // pcId -> clientId
  const [queue_, setQueue] = useState([]);    // characters offered from phones
  const queue = useRef([]);
  const seq = useRef(0);
  const gRef = useRef(g);
  gRef.current = g;
  const claimsRef = useRef(claims);
  claimsRef.current = claims;
  // onMessage is built before useSocket hands us `send`, so it reaches the
  // socket through a ref rather than being rebuilt every render.
  const sendRef = useRef(null);

  const onMessage = useCallback((msg) => {
    if (msg.t === "peers") {
      setPeers(msg.peers || []);
      const next = {};
      for (const p of msg.peers || []) if (p.pcId) next[p.pcId] = p.clientId;
      setClaims(next);
      return;
    }
    if (msg.t === "intent") { queue.current.push(msg); return; }

    if (msg.t === "submit") {
      /* One offer per phone, replaced rather than stacked. A player who
         taps the button twice used to produce two identical cards here,
         and two "let them in" taps produced two of the same character in
         the crew. The phone is told its offer landed, which is what stops
         the tapping in the first place. */
      setQueue((q) => {
        const entry = { clientId: msg.clientId, from: msg.name, character: msg.character };
        const i = q.findIndex((e) => e.clientId === msg.clientId);
        if (i === -1) return [...q, { ...entry, id: `${msg.clientId}:${Date.now()}` }];
        const next = q.slice();
        next[i] = { ...entry, id: q[i].id, resubmitted: true };
        return next;
      });
      if (sendRef.current) sendRef.current({ t: "ack", to: msg.clientId, state: "received" });
      return;
    }

    if (msg.t === "withdraw") {
      setQueue((q) => q.filter((e) => e.clientId !== msg.clientId));
      if (sendRef.current) sendRef.current({ t: "ack", to: msg.clientId, state: "withdrawn" });
    }
  }, []);

  const { status, send } = useSocket(enabled ? "host" : null, onMessage);
  sendRef.current = send;

  /* ---- broadcast ----
     One snapshot is packed, then redacted and distorted once per
     recipient. Redaction happens here rather than on the phone because
     a secret that reaches the client has already leaked: a curious
     player with a devtools console is a player who knows their own
     hallucination timer. What the phone never receives, it cannot
     reveal. */
  useEffect(() => {
    if (!enabled || status !== "open") return;
    const full = packSnapshot({
      seq: ++seq.current,
      phase,
      mod,
      g: g && g.crew && g.crew.length ? g : null,
      claims,
      roster: peers,
      lobby,
    });

    // The Warden's own screen reads the live game directly, so the
    // socket only ever carries player-facing copies.
    const perPlayer = {};
    for (const [pcId, clientId] of Object.entries(claims)) {
      if (!clientId) continue;
      const seen = redactState(full.state, VIEW.PLAYER, pcId);
      perPlayer[clientId] = { ...full, state: distort(seen, pcId) };
    }
    // Anyone who has not claimed a character yet gets the table view,
    // which is redacted with no viewer, so no addressed line reaches them.
    send({ ...full, state: redactState(full.state, VIEW.TABLE, null), perPlayer });
  }, [
    enabled, status, send, phase, mod, claims, peers, lobby,
    g && g.w, g && g.crew, g && g.feed, g && g.combat,
    g && g.pending, g && g.activeId, g && g.resting, g && g.levelUp, g && g.shopping,
  ]);

  /* ---- drain the intent queue, one per pass ---- */
  useEffect(() => {
    if (!enabled) return;
    const job = queue.current[0];
    if (!job) return;
    const game = gRef.current;
    if (!game || !game.crew.length) { queue.current.shift(); return; }

    const verdict = decideIntent({ game, job, claims: claimsRef.current, currentTurn });
    if (verdict === "wait") return;
    if (verdict === "activate") { game.setActiveId(job.asPc); return; }
    if (verdict !== "run") {
      queue.current.shift();
      return send({ t: "denied", to: job.clientId, reason: verdict.deny });
    }

    queue.current.shift();
    try { game[job.action](...(job.args || [])); }
    catch (err) { send({ t: "denied", to: job.clientId, reason: String(err && err.message) }); }
  });

  const whisper = useCallback((clientId, text) => {
    send({ t: "whisper", to: clientId, text });
  }, [send]);

  /* Accepting is two messages, not one. The ack ends the phone's waiting
     state; the assignment hands it the body it just built, so nobody has
     to find their own character in a list of names. */
  const resolveSubmission = useCallback((entry, accepted, pcId) => {
    setQueue((q) => q.filter((e) => e.id !== entry.id));
    if (!accepted) {
      send({ t: "ack", to: entry.clientId, state: "rejected" });
      return;
    }
    send({ t: "ack", to: entry.clientId, state: "accepted" });
    if (pcId) send({ t: "assigned", to: entry.clientId, pcId });
  }, [send]);

  return { status, peers, claims, submissions: queue_, whisper, resolveSubmission };
}
