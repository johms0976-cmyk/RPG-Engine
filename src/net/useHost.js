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
import { currentTurn } from "../engine/combat.js";

export function useHost({ g, mod, phase, enabled = true }) {
  const [peers, setPeers] = useState([]);
  const [claims, setClaims] = useState({});   // pcId -> clientId
  const queue = useRef([]);
  const seq = useRef(0);
  const gRef = useRef(g);
  gRef.current = g;
  const claimsRef = useRef(claims);
  claimsRef.current = claims;

  const onMessage = useCallback((msg) => {
    if (msg.t === "peers") {
      setPeers(msg.peers || []);
      const next = {};
      for (const p of msg.peers || []) if (p.pcId) next[p.pcId] = p.clientId;
      setClaims(next);
      return;
    }
    if (msg.t === "intent") queue.current.push(msg);
  }, []);

  const { status, send } = useSocket(enabled ? "host" : null, onMessage);

  /* ---- broadcast ---- */
  useEffect(() => {
    if (!enabled || status !== "open") return;
    send(packSnapshot({
      seq: ++seq.current,
      phase,
      mod,
      g: g && g.crew && g.crew.length ? g : null,
      claims,
      roster: peers,
    }));
  }, [
    enabled, status, send, phase, mod, claims, peers,
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

  return { status, peers, claims };
}
