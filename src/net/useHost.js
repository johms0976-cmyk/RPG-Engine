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

   ------------------------------------------------------------
   WHY THE WARDEN'S SCREEN USED TO NEED A REFRESH

   The drain below is a useEffect. Effects only run after a render.
   Intents arrive on the socket and were pushed into `queue.current`
   — a ref. Writing a ref does not render. So an intent from a phone
   landed in the queue and then *nothing happened*, because nothing
   had asked React to do another pass. It sat there until something
   else on the Warden's screen happened to re-render: a click, a
   tab switch, a page refresh. From the sofa it looked like the
   phone had failed. From the desk it looked like actions only
   arrived when you touched something. Both were the same bug.

   The queue is now paired with a `pulse` counter in real state.
   Anything that could unblock the queue bumps it:

     · an intent arriving
     · a job finishing while more are waiting
     · a "wait" verdict, retried on a timer rather than on a render

   That last one also kills a busy-loop. The old effect had no
   dependency array, so while any player had a pending roll it
   re-ran on every render forever, re-checking a queue it already
   knew was blocked. Now a blocked queue sleeps for RETRY_MS and
   tries again.
   ============================================================ */
import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "./useSocket.js";
import {
  packSnapshot, decideIntent, waitingRoom, isWait, waitReason, PEER_MODES,
} from "./protocol.js";
import { redactState, VIEW } from "../engine/secrets.js";
import { keepResume } from "./resume.js";
import { distort } from "./distort.js";
import { currentTurn } from "../engine/combat.js";
import { intentLabel } from "./useIntentGate.js";
import { resolveHostToken, rememberHostToken } from "./session.js";

/** How long a blocked queue sleeps before re-checking. Short enough
    that a resolved roll releases the table immediately, long enough
    that a stuck queue costs nothing. */
export const RETRY_MS = 150;

/** How many recent player actions the Warden's bar remembers. */
const ACTIVITY_KEEP = 8;

export function useHost({ g, mod, phase, lobby, safety, enabled = true, peerWhispers = "seen", rtc = null }) {
  /* Remote play: the router lives in this tab (see rtcRelay.js), so
     there is no relay server and therefore nobody to authenticate to.
     The token exists to stop a stranger on the wifi seizing the
     authority socket; over RTC the authority never leaves this
     process, and the gate it protects does not exist. */
  const remote = !!(rtc && rtc.relay);
  /* THE TOKEN, BEFORE ANYTHING ELSE.

     `?role=host` is now an authenticated upgrade (§9.1), so the
     deck has to know its token before the socket is worth opening.
     On the machine running the relay this resolves silently from
     /net/info and the Warden never learns a token exists. Anywhere
     else it comes from the URL, from storage, or from the Warden
     typing the eight characters the terminal printed.

     `auth` is null while we are still finding out, which is
     deliberately distinguishable from "" — a socket opened with no
     token during that window would be refused and would burn one
     of this address's ten attempts for nothing. */
  const [auth, setAuth] = useState(null);
  useEffect(() => {
    let live = true;
    resolveHostToken().then((r) => { if (live) setAuth(r); }).catch(() => live && setAuth({ token: "", required: true, source: "none" }));
    return () => { live = false; };
  }, []);

  /** The Warden typed a token into the unauthorised strip. */
  const setHostToken = useCallback((t) => {
    const token = String(t || "").trim().toLowerCase();
    rememberHostToken(token);
    setAuth({ token, required: true, source: "typed" });
  }, []);

  const [peers, setPeers] = useState([]);
  /* Whispers from phones, newest first, and the safety card. Both are
     kept here rather than in the feed: one is addressed to the Warden
     alone and the other must never be attributable, and the feed is
     saved, exported and shown on the table screen. */
  const [inbox, setInbox] = useState([]);
  const [safetyCall, setSafetyCall] = useState(null);
  const [spotlight, setSpotlight] = useState(null);
  const [claims, setClaims] = useState({});     // pcId -> clientId
  const [queue_, setQueue] = useState([]);      // characters offered from phones
  const [activity, setActivity] = useState([]); // what players just did
  const [pulse, setPulse] = useState(0);        // the thing that makes the drain run
  /* Player-to-player traffic, at whatever resolution the table agreed
     to. The relay decides what reaches this array — see PEER_MODES —
     so a "dark" table's secrets are not merely undisplayed here, they
     were never sent. */
  const [peerLog, setPeerLog] = useState([]);
  const queue = useRef([]);
  /* pcId -> when that character last actually moved the world. Feeds
     the rate limit and, more usefully, the Warden's idle column: a
     player who has done nothing for four minutes is the cue to look
     at somebody, and it is invisible from behind a screen. */
  const lastActed = useRef({});
  const seq = useRef(0);
  const gRef = useRef(g);
  gRef.current = g;
  const claimsRef = useRef(claims);
  claimsRef.current = claims;
  // onMessage is built before useSocket hands us `send`, so it reaches the
  // socket through a ref rather than being rebuilt every render.
  const sendRef = useRef(null);

  /* The whole fix, in one function. Anything that puts work into the
     queue, or that might have unblocked it, calls this. */
  const bump = useCallback(() => setPulse((n) => (n + 1) % 1000000), []);

  const onMessage = useCallback((msg) => {
    if (msg.t === "peers") {
      setPeers(msg.peers || []);
      const next = {};
      for (const p of msg.peers || []) if (p.pcId) next[p.pcId] = p.clientId;
      setClaims(next);
      return;
    }

    if (msg.t === "intent") {
      queue.current.push(msg);
      bump();   // ← without this the Warden has to touch the screen
      return;
    }

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
      return;
    }

    /* A player saying something to the Warden and nobody else. It does
       not go in the feed — the feed is exported, shown on the table
       screen and read by everyone. */
    if (msg.t === "playerwhisper") {
      setInbox((list) => [{
        id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        clientId: msg.clientId,
        name: msg.name,
        pcId: msg.pcId,
        text: msg.text,
        replyTo: msg.replyTo || null,
        at: Date.now(),
        unread: true,
      }, ...list].slice(0, 40));
      return;
    }

    /* One player leaning over to another. What arrives depends on the
       mode the table set: the text, the fact, or nothing at all. */
    if (msg.t === "peernote") {
      setPeerLog((list) => [{
        id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        fromPcId: msg.fromPcId || null,
        toPcId: msg.toPcId || null,
        text: msg.text || null,
        at: Date.now(),
      }, ...list].slice(0, 40));
      return;
    }

    /* The card. Arrives with no identity attached — the relay stripped
       it — so there is nothing here to accidentally display. */
    if (msg.t === "safety") {
      setSafetyCall({ level: msg.level, at: Date.now() });
    }
  }, [bump]);

  /* Held shut until `auth` resolves — see the comment on `auth`
     above. `enabled && auth` rather than `enabled` alone is the
     whole of the wait. */
  const { status, send } = useSocket(
    enabled && (remote || auth) ? "host" : null,
    onMessage,
    auth ? auth.token : "",
    remote ? { transport: "rtc", relay: rtc.relay } : undefined,
  );
  sendRef.current = send;

  /* THE TABLE'S RULE ABOUT WHISPERS, TOLD TO THE RELAY RATHER THAN
     APPLIED HERE.

     The obvious implementation is to forward every player whisper to
     this tab and have the Warden's screen decline to render the ones
     it should not see. That is a promise not to look, and the safety
     card already establishes that this codebase does not do promises:
     what never leaves the relay cannot be displayed, logged or leaked
     by a bug upstream. So the mode goes down the wire and the relay
     — which holds no state anybody cares about — does the filtering. */
  useEffect(() => {
    if (!enabled || status !== "open") return;
    const mode = PEER_MODES.includes(peerWhispers) ? peerWhispers : "seen";
    send({ t: "config", peerWhispers: mode });
  }, [enabled, status, send, peerWhispers]);

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
      safety,
      table: g && g.w && g.w.tableHandout
        ? {
            handout: g.w.tableHandout,
            /* Who the prop is being held up to. Absent means the whole
               table; a list means those people, and the phones not on
               it are never sent the text at all. */
            only: (g.w.handoutTargets || {})[g.w.tableHandout] || null,
          }
        : null,
      waiting: g && g.crew && g.crew.length
        ? waitingRoom({ game: g, claims, currentTurn, lastActed: lastActed.current })
        : {},
    });

    // The Warden's own screen reads the live game directly, so the
    // socket only ever carries player-facing copies.
    const perPlayer = {};
    for (const [pcId, clientId] of Object.entries(claims)) {
      if (!clientId) continue;
      // `mod` is passed so redaction can strip an unseen thing out of
      // the initiative order — a creature nobody can see, sitting in a
      // visible list with a name and a hit count, is a tension leak.
      const seen = redactState(full.state, VIEW.PLAYER, pcId, mod);
      perPlayer[clientId] = { ...full, state: distort(seen, pcId) };
    }
    // Anyone who has not claimed a character yet gets the table view,
    // which is redacted with no viewer, so no addressed line reaches them.
    send({ ...full, state: redactState(full.state, VIEW.TABLE, null, mod), perPlayer });

    /* THE CRASH MAT. The state every phone just agreed on, written
       where a reloaded host tab can find it. A table whose host tab
       dies loses the session outright, which is the worst failure
       mode this architecture has — see net/resume.js. */
    if (full.state) {
      keepResume({
        modId: full.modId, phase, state: full.state, claims,
        lobby: full.lobby, safety: full.safety,
      });
    }
  }, [
    enabled, status, send, phase, mod, claims, peers, lobby, safety,
    g && g.w, g && g.crew, g && g.feed, g && g.combat,
    g && g.pending, g && g.activeId, g && g.resting, g && g.levelUp, g && g.shopping,
  ]);

  /* ---- drain the intent queue, one job per pass ----
     Runs on `pulse` (something arrived) and on the game fields that can
     turn a "wait" into a "run". A blocked queue schedules its own retry
     instead of spinning on renders. */
  useEffect(() => {
    if (!enabled) return undefined;
    const job = queue.current[0];
    if (!job) return undefined;

    const game = gRef.current;
    if (!game || !game.crew.length) { queue.current.shift(); bump(); return undefined; }

    const verdict = decideIntent({
      game, job, claims: claimsRef.current, currentTurn,
      now: Date.now(), lastActed: lastActed.current,
    });

    /* Held, not refused. Someone else is mid-prompt, or the Warden has
       the table, or it is not this player's go in the scene round. The
       job keeps its place in the queue and we try again shortly — so a
       hold costs nothing and a release drains in arrival order.

       The phone is told *why* rather than being left to watch a button
       do nothing, which is the whole lesson of useIntentGate. */
    if (isWait(verdict)) {
      const why = waitReason(verdict);
      if (why !== job.toldWhy) {
        job.toldWhy = why;
        send({ t: "holding", to: job.clientId, reason: why, action: job.action });
      }
      const t = setTimeout(bump, RETRY_MS);
      return () => clearTimeout(t);
    }

    // Make the intent's character active, then come back for the run.
    // setActiveId renders, and activeId is in this effect's deps.
    if (verdict === "activate") { game.setActiveId(job.asPc); return undefined; }

    queue.current.shift();

    if (verdict !== "run") {
      send({ t: "denied", to: job.clientId, reason: verdict.deny });
      if (queue.current.length) bump();
      return undefined;
    }

    try {
      game[job.action](...(job.args || []));
      // Only a job that actually ran counts. A refused or held intent
      // must not start somebody's cooldown or reset their idle timer.
      lastActed.current = { ...lastActed.current, [job.asPc]: Date.now() };
      /* The Warden can now see traffic arriving without reading the
         whole feed — useful when four people act at once. */
      const who = (game.crew.find((c) => c.id === job.asPc) || {}).name || "someone";
      setActivity((a) => [
        {
          id: `${job.clientId}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
          who,
          what: intentLabel(job.action),
          at: Date.now(),
        },
        ...a,
      ].slice(0, ACTIVITY_KEEP));
    } catch (err) {
      send({ t: "denied", to: job.clientId, reason: String(err && err.message) });
    }

    // Anything still waiting gets its own pass rather than being
    // stranded until the next unrelated render.
    if (queue.current.length) bump();
    return undefined;
  }, [
    pulse, enabled, send, bump,
    g && g.pending, g && g.activeId, g && g.crew, g && g.combat,
  ]);

  const whisper = useCallback((clientId, text, replyTo) => {
    send({ t: "whisper", to: clientId, text, replyTo: replyTo || null });
  }, [send]);

  /** A noise in one person's hand. Nobody else's phone makes a sound
      and nothing appears in any log, which is what makes it work: the
      player has to decide on their own whether to mention it. */
  const sound = useCallback((clientId, cue) => {
    send({ t: "sound", to: clientId, cue });
  }, [send]);

  /** THE WARDEN'S OWN VOICE, IN ONE HAND.

      The private sound cue is the best thing in here and it is
      limited to five synthesised noises. A three-second clip off the
      desk mic, arriving on one handset and written down nowhere, is
      the same mechanic with the Warden actually in it. The clip is
      passed straight through as a data URL and never touches disk on
      either side — it exists for as long as the phone is playing it. */
  const cue = useCallback((clientId, data, mime) => {
    if (!data) return;
    send({ t: "cue", to: clientId, data, mime: mime || "audio/webm" });
  }, [send]);

  /** Digital eye contact. The phone buzzes and says who is looking. */
  const spotlightPeer = useCallback((clientId, pcId, text) => {
    send({ t: "spotlight", to: clientId, text: text || null });
    setSpotlight({ clientId, pcId, at: Date.now() });
  }, [send]);

  const markRead = useCallback((id) => {
    setInbox((list) => list.map((m) => (m.id === id ? { ...m, unread: false } : m)));
  }, []);

  const clearSafety = useCallback(() => setSafetyCall(null), []);

  // The spotlight is a moment, not a mode. It lifts itself.
  useEffect(() => {
    if (!spotlight) return undefined;
    const t = setTimeout(() => setSpotlight(null), 12000);
    return () => clearTimeout(t);
  }, [spotlight]);

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

  return {
    status, peers, claims, submissions: queue_, activity,
    /* The token strip on the Warden's screen reads these. `needsToken`
       is the one the UI branches on: the socket was refused, so the
       deck should ask rather than spin on a reconnect that will keep
       being refused. */
    needsToken: !remote && (status === "unauthorised" || status === "locked"),
    tokenLocked: status === "locked",
    hostToken: auth ? auth.token : "",
    setHostToken,
    whisper, resolveSubmission,
    inbox, markRead,
    safetyCall, clearSafety,
    sound, cue, spotlight, spotlightPeer,
    /* Player-to-player traffic at the agreed resolution, and the raw
       per-character timings the Warden's "waiting on" panel reads. */
    peerLog,
    lastActed: lastActed.current,
  };
}
