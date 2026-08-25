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
  allowedPeerMode,
} from "./protocol.js";
import {
  openVote, castVote, closeVote, voteLine, VOTE_TOPICS,
} from "../engine/vote.js";
import { answerLook as answerLookIn } from "../engine/look.js";
import { redactState, VIEW } from "../engine/secrets.js";
import { keepResume } from "./resume.js";
import { distort } from "./distort.js";
import { currentTurn } from "../engine/combat.js";
import { intentLabel } from "./useIntentGate.js";
import { resolveHostToken, rememberHostToken } from "./session.js";
import { floorMove } from "../engine/floor.js";

/** How long a blocked queue sleeps before re-checking. Short enough
    that a resolved roll releases the table immediately, long enough
    that a stuck queue costs nothing. */
export const RETRY_MS = 150;

/** How many recent player actions the Warden's bar remembers. */
const ACTIVITY_KEEP = 8;

/** How often the floor policy is consulted. Slow on purpose: the
    thing it is watching for takes minutes to develop, and a cooldown
    inside floorMove means a faster tick would change nothing except
    how much work a quiet table does for no reason. */
export const FLOOR_TICK_MS = 15 * 1000;

export function useHost({
  g, mod, phase, lobby, safety, enabled = true, peerWhispers = "seen", rtc = null,
  /* "warden" | "wardenless". Fixed for the life of a session — see
     TABLE_MODES in protocol.js. The host only needs it for two
     things: telling the phones, and knowing whether a `start` from a
     phone is a request it should honour or ignore. */
  mode = "warden",
  onAutoAccept = null,
  onStart = null,
  /* WHO OWNS THE FLOOR MOVES.

     Part B shipped this timer as the only thing acting on
     engine/floor.js, and for a Warden table with no director that is
     still exactly right. But the director's ladder has a floor rung
     of its own, and two callers of `floorMove` with two separate
     cooldowns is two nudges for one quiet player.

     So whoever is driving stands the other one down. With a director
     running, floor moves become Moves like everything else — which
     is better than a parallel path anyway, because in assisted mode
     it means the Warden gets to veto them too. */
  floorPolicy = true,
}) {
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
  /* Callbacks reached through refs because onMessage is memoised on
     `bump` alone and must not be rebuilt every time the Cartridge
     re-renders — a socket handler that changes identity on every
     render reattaches on every render. */
  const startRef = useRef(null);
  const acceptRef = useRef(null);
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

  startRef.current = onStart;
  acceptRef.current = onAutoAccept;

  const [peers, setPeers] = useState([]);
  /* Whispers from phones, newest first, and the safety card. Both are
     kept here rather than in the feed: one is addressed to the Warden
     alone and the other must never be attributable, and the feed is
     saved, exported and shown on the table screen. */
  const [inbox, setInbox] = useState([]);
  const [safetyCall, setSafetyCall] = useState(null);
  /* THE TABLE'S OPEN QUESTION, if it has one. At most one at a time:
     two ballots on five phones is a form, not a table. See
     engine/vote.js. */
  const [vote, setVote] = useState(null);
  const [spotlight, setSpotlight] = useState(null);
  /* The most recent "that is not what I meant", for anything that
     wants to learn from it. Kept as an object with a timestamp so a
     second dispute of the same move by the same player is a new
     value rather than an identical one nothing notices. */
  const [lastDispute, setLastDispute] = useState(null);
  const [claims, setClaims] = useState({});     // pcId -> clientId
  /* clientId -> true. Pre-session only, carries no character. */
  const [ready, setReady] = useState({});
  const [queue_, setQueue] = useState([]);      // characters offered from phones
  const [activity, setActivity] = useState([]); // what players just did
  const [pulse, setPulse] = useState(0);        // the thing that makes the drain run
  /* Player-to-player traffic, at whatever resolution the table agreed
     to. The relay decides what reaches this array — see PEER_MODES —
     so a "dark" table's secrets are not merely undisplayed here, they
     were never sent. */
  const [peerLog, setPeerLog] = useState([]);
  /* Set when the table asked for a peer mode it cannot have. Surfaced
     rather than silently applied — see the config effect below. */
  const [peerDowngrade, setPeerDowngrade] = useState(null);
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
  /* Answering a question and hearing a complaint both need the live
     game, which onMessage deliberately does not close over. Same ref
     pattern as onStart and onAutoAccept above. */
  const lookRef = useRef(null);
  const disputeRef = useRef(null);

  /* The whole fix, in one function. Anything that puts work into the
     queue, or that might have unblocked it, calls this. */
  const bump = useCallback(() => setPulse((n) => (n + 1) % 1000000), []);

  const onMessage = useCallback((msg) => {
    if (msg.t === "peers") {
      setPeers(msg.peers || []);
      const next = {};
      for (const p of msg.peers || []) if (p.pcId) next[p.pcId] = p.clientId;
      /* A.7 — A CHARACTER THAT CHANGED HANDS.

         Detected here rather than from the `claim` message because
         claims reach this hook through the roster and nowhere else,
         and because a diff catches every route in: a pickup after a
         battery died, a deliberate handover, a phone that came back
         on a charger and took its own character again.

         Said out loud, because the person playing Riley not being
         the person who was playing Riley an hour ago is a fact about
         the room. A table that has to work that out from a name
         badge on a screen will work it out three scenes late. */
      const before = claimsRef.current || {};
      const game = gRef.current;
      if (game && game.say && Object.keys(before).length) {
        for (const [pcId, clientId] of Object.entries(next)) {
          if (!before[pcId] || before[pcId] === clientId) continue;
          const pc = (game.crew || []).find((c) => c.id === pcId);
          const who = (msg.peers || []).find((p) => p.clientId === clientId);
          if (pc && who) game.say("system", `${who.name} is playing ${pc.name} now.`);
        }
      }
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
      /* WARDENLESS: THE APPROVAL QUEUE HAS NOBODY TO SHOW ITSELF TO.

         With a Warden, a submitted character sits in a queue until a
         person looks at it, which is right — they are the one who
         knows whether a fifth Teamster is what this table needs.
         With the chair empty there is no such person, and a queue
         nothing drains is a table that never starts. So the
         submission goes straight through, and the crew-size limits
         the module already declares are what does the refusing. */
      if (acceptRef.current) {
        acceptRef.current({ clientId: msg.clientId, from: msg.name, character: msg.character });
        if (sendRef.current) sendRef.current({ t: "ack", to: msg.clientId, state: "received" });
        return;
      }
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

    if (msg.t === "ready") {
      setReady((r) => ({ ...r, [msg.clientId]: msg.ready !== false }));
      return;
    }

    /* Any phone may start a table that is ready. The check that
       matters is not who asked but whether there is a crew, and that
       lives in the callback — a phone tapping GO into an empty lobby
       must do nothing rather than begin a session with no
       characters in it. */
    if (msg.t === "start") {
      if (startRef.current) startRef.current();
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

    /* A tap the phone's own gate ate — see TELLING THE HOST in
       useIntentGate. It moves nothing and is not queued: it goes
       straight into the floor ledger, which is the only thing in the
       engine that cares that somebody tried and was outrun.

       Deliberately not routed through the intent queue. A report
       about a *failure* to act must never be able to wait behind the
       actions that caused it. */
    if (msg.t === "tap") {
      const game = gRef.current;
      if (game && game.floorNote && msg.asPc && claimsRef.current[msg.asPc] === msg.clientId) {
        game.floorNote(msg.asPc, "swallow");
      }
      return;
    }

    /* The card. Arrives with no identity attached — the relay stripped
       it — so there is nothing here to accidentally display. */
    if (msg.t === "safety") {
      setSafetyCall({ level: msg.level, at: Date.now() });
      return;
    }

    /* Taken down again, from whichever phone. Also anonymous, so
       there is nothing here to record about who did it either — see
       C_CLEARSAFETY. The effect of clearing (releasing the hold) is
       applied by the effect below rather than here, so that the one
       place that decides what a card does is the one place that
       decides what un-doing it does. */
    if (msg.t === "clearsafety") {
      setSafetyCall(null);
      return;
    }

    /* ---- the table deciding things ---- */
    if (msg.t === "openvote") {
      const topic = msg.topic;
      if (!VOTE_TOPICS[topic]) return;
      setVote((v) => {
        // One at a time. A second question while the first is open is
        // dropped rather than queued: by the time the queue drained,
        // the thing being asked about would be four minutes gone.
        if (v && !v.result) return v;
        const of = Object.values(claimsRef.current || {}).filter(Boolean);
        return openVote(topic, { of, by: msg.clientId }) || v;
      });
      return;
    }

    if (msg.t === "vote") {
      setVote((v) => (v ? castVote(v, msg.clientId, msg.choice) : v));
      return;
    }

    /* "What do I see?" Answered privately, from what this character
       can already know — see `answerLook`. */
    if (msg.t === "look") {
      if (lookRef.current) lookRef.current(msg.clientId, msg.asPc, msg.about);
      return;
    }

    /* "That is not what I meant." */
    if (msg.t === "dispute") {
      if (disputeRef.current) disputeRef.current(msg.asPc, msg.moveId);
      return;
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
    /* THE PROMISE WE WILL NOT MAKE WITH THE CHAIR EMPTY.

       `dark` says the words pass through nobody. With a Warden that
       is close enough to true. Without one the router is a device
       belonging to somebody who is also playing, picked because they
       opened the tab — see `allowedPeerMode`. It downgrades to
       `seen`, and the downgrade is announced rather than absorbed,
       because a privacy promise that quietly stops being kept is
       worse than one that was never offered. */
    const asked = PEER_MODES.includes(peerWhispers) ? peerWhispers : "seen";
    const granted = allowedPeerMode(asked, mode);
    send({ t: "config", peerWhispers: granted });
    if (granted !== asked) setPeerDowngrade({ asked, granted });
    else setPeerDowngrade(null);
  }, [enabled, status, send, peerWhispers, mode]);

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
      mode,
      ready,
      /* Both new, and both for the same reason: a table with no
         Warden has nowhere else to see them. See packSnapshot. */
      safetyCall,
      vote,
      /* B.3/B.4. Neither is in the feed and neither is redacted:
         a reaction is a body everybody in the room can see, and an
         offer of help is one being made out loud. Both are the
         same for every viewer, which is why they ride on the
         envelope rather than inside `state`. */
      reactions: (g && g.reactions) || [],
      assistOffers: (g && g.assistOffers) || [],
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
    enabled, status, send, phase, mod, claims, peers, lobby, safety, mode, ready,
    safetyCall, vote,
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
      /* The same fact, written somewhere it survives. `lastActed` is
         a ref in this tab and dies with it; the floor ledger is on
         the world, so it snapshots and saves. */
      if (game.floorNote) game.floorNote(job.asPc, "act");
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

  /* ============================================================
     THE CARD, DOING SOMETHING

     WARDENLESS.md said this in bold and main did not do it: a
     `stop` card set no brake, reached no phone, and could only be
     taken down from the device in the middle of the table.

     What it did do was make the director go quiet — `rungSafety`
     returns `halt` — which is the worst of both worlds. The
     narrator stops; the game does not. The person who played the
     card watches four people carry on searching a cupboard and
     concludes the card is decorative, which is the one thing a
     safety tool must never teach.

     So the card takes the brake that already exists. `tempo.held`
     is the Warden's own hold, every phone already understands it,
     every action already checks it, and it is already on the
     snapshot. Nothing new had to be invented; it simply had to be
     connected.

     THREE THINGS THIS DELIBERATELY DOES NOT DO.

     It does not adjudicate. `check`, `veil` and `stop` all hold the
     table identically. Deciding that a check-in is a smaller
     interruption than a stop is exactly the judgement a person
     should be making and a policy should not.

     It does not resume on a timer. Nothing here has a timeout. The
     table comes back when a human says it does, and if that takes
     ten minutes then it took ten minutes.

     It does not soften the wording. The line in the feed says a
     card was played, in the words the card uses.
     ============================================================ */
  const heldBySafety = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    const game = gRef.current;
    if (!game || !game.warden || !game.crew || !game.crew.length) return;

    if (safetyCall && !heldBySafety.current) {
      heldBySafety.current = true;
      /* The `why` is what the whole table reads on the held banner.
         It names the level and nothing else — there is no identity
         here to leak, and there never was. */
      game.warden.hold(true, `someone played the ${safetyCall.level} card`);
      return;
    }
    if (!safetyCall && heldBySafety.current) {
      heldBySafety.current = false;
      game.warden.hold(false);
    }
  }, [enabled, safetyCall, g && g.crew && g.crew.length]);

  /* A veil card is the one level that asks the table a question
     afterwards, because "put this off-screen" has a decision in it
     that "stop" does not: skip past the beat, or carry on
     differently. The pause is not the question and is never voted
     on — see the header of engine/vote.js. */
  const veiled = useRef(0);
  useEffect(() => {
    if (!enabled || !safetyCall || safetyCall.level !== "veil") return;
    if (veiled.current === safetyCall.at) return;
    veiled.current = safetyCall.at;
    const of = Object.values(claimsRef.current || {}).filter(Boolean);
    setVote((v) => (v && !v.result ? v : (openVote("veil", { of }) || v)));
  }, [enabled, safetyCall]);

  /* ============================================================
     THE VOTE, RESOLVED

     Ticks rather than waiting for a message, because the most
     important transition a vote has is the one nobody sends: it
     ran out of time and nobody answered. See `expired`.
     ============================================================ */
  const openTopic = useCallback((topic) => {
    if (!VOTE_TOPICS[topic]) return;
    const of = Object.values(claimsRef.current || {}).filter(Boolean);
    setVote((v) => (v && !v.result ? v : (openVote(topic, { of }) || v)));
  }, []);

  const applied = useRef(0);
  useEffect(() => {
    if (!enabled || !vote) return undefined;

    const settle = () => {
      setVote((v) => (v ? closeVote(v, Date.now()) : v));
    };

    if (!vote.result) {
      settle();
      const id = setInterval(settle, 1000);
      return () => clearInterval(id);
    }

    /* Landed. Say so once, do the thing once, then let it sit on the
       snapshot for a few seconds so a phone that was looking away
       still sees the answer rather than an empty space. */
    if (applied.current === vote.at) return undefined;
    applied.current = vote.at;

    const game = gRef.current;
    const choice = vote.result.choice;
    if (game && game.warden) {
      const line = voteLine(vote);
      if (line) game.warden.say(line, "system");

      if (vote.topic === "breather" && choice === "yes") game.warden.breather(true);
      if (vote.topic === "callit" && choice === "yes") {
        game.warden.recap(true);
        /* Deliberately a recap and a hold rather than an ending. The
           module's endings are things that happen *in* the fiction;
           "we are stopping now" is a thing that happens in the room,
           and dressing one as the other would put a title card on an
           evening that simply ran out of Sunday. */
        game.warden.hold(true, "the table called it");
      }
      if (vote.topic === "rewind" && choice === "yes" && game.warden.canUndo) {
        game.warden.undo();
      }
      if (vote.topic === "restart" && choice === "yes") game.warden.scene("start");
      /* Both ways round, deliberately. A table that turned it on and
         found it fussy must be able to turn it off by the same route
         it turned it on, or the vote is a trap rather than a switch. */
      if (vote.topic === "floor") game.warden.floor(choice === "yes");
      if (vote.topic === "veil" && choice === "skip") {
        game.warden.say("— veiled. That happens off-screen. —", "system");
        game.warden.passTime(10);
      }
    }

    const id = setTimeout(() => setVote(null), 6000);
    return () => clearTimeout(id);
  }, [enabled, vote]);

  /* ============================================================
     ASKING THE SITUATION SOMETHING

     The largest hole in a wardenless table's *player* experience,
     and the one nobody writes down because with a person it is not
     a feature, it is just talking. A player could act on a room,
     search it, and interrogate anybody standing in it — but could
     not ask the room itself anything. What do I see. How far is
     that. Is the door still open.

     Nothing new is invented and nothing new is revealed: the
     answer is assembled from the room the crew has already
     entered, the exits it already lists, the people already
     visible, and the clue board the crew wrote themselves. It is
     retrieval, and it goes back to one phone as a whisper so a
     table of five asking at once does not bury the feed.
     ============================================================ */
  const answerLook = useCallback((clientId, pcId, about) => {
    const game = gRef.current;
    if (!game || !game.w || !mod) return;
    const pc = (game.crew || []).find((c) => c.id === pcId) || null;

    /* All the judgement lives in engine/look.js, which is pure and
       tested — including the rule that decides whether a player has
       earned a feature's description. That is not a detail worth
       trusting to a hook: it is a search result, it costs time and
       sometimes a roll, and getting it backwards would quietly hand
       the whole room over with nothing ever throwing. */
    const { text } = answerLookIn({ mod, w: game.w, pc, about });

    /* Back to one phone. A table of five asking at once would
       otherwise bury the feed under answers only one person wanted,
       and the answer to "what do I see" is already redacted per
       player by virtue of being about their own room. */
    send({ t: "whisper", to: clientId, text });
  }, [send, mod]);
  lookRef.current = answerLook;

  /* ============================================================
     "THAT IS NOT WHAT I MEANT"

     A director move addressed to one player can be waved off by
     that player. Two things happen and they are both about the
     ledger rather than about the fiction: the spotlight lifts, and
     the offer stops counting as an offer, so the floor policy does
     not conclude this person has now had their go.

     There is no argument, no threshold and no appeal. The person
     the move was aimed at is the only one who can dispute it and
     they are simply believed — which is precisely what a person
     behind the screen would have done.
     ============================================================ */
  const disputeMove = useCallback((pcId) => {
    const game = gRef.current;
    setSpotlight((sp) => (sp && sp.pcId === pcId ? null : sp));
    if (game && game.floorNote) game.floorNote(pcId, "decline");
    /* Published so the director can learn from it. This is the only
       correction the empty chair has — see the ledger in
       useDirector — and it changes nothing here: the spotlight still
       lifts, the offer still stops counting, and the player is still
       simply believed with no threshold and no appeal. */
    setLastDispute({ pcId, at: Date.now() });
  }, []);
  disputeRef.current = disputeMove;

  // The spotlight is a moment, not a mode. It lifts itself.
  useEffect(() => {
    if (!spotlight) return undefined;
    const t = setTimeout(() => setSpotlight(null), 12000);
    return () => clearTimeout(t);
  }, [spotlight]);

  /* ============================================================
     THE FLOOR, ACTED ON

     engine/floor.js decides; this executes. One move at a time, on
     a slow timer, and silence is the usual answer — a system that
     intervenes every few seconds is worse than one that never
     does, which is the same argument ui/Spotlight.jsx makes about
     rarity being the whole value.

     Two moves exist, and neither can refuse anybody anything:
     open a scene round (structural, nobody named), or offer the
     floor to one phone (private, and worded as an invitation).

     `lastMove` is a ref rather than state because a move being due
     is not a reason to repaint the Warden's screen, and because
     the timer below reads it on every tick.
     ============================================================ */
  const lastMove = useRef(0);
  useEffect(() => {
    if (!enabled || status !== "open" || !floorPolicy) return undefined;
    const tick = () => {
      const game = gRef.current;
      if (!game || !game.crew || !game.crew.length) return;
      const move = floorMove({
        w: game.w, crew: game.crew, now: Date.now(), lastMoveAt: lastMove.current,
      });
      if (!move) return;
      lastMove.current = Date.now();

      if (move.kind === "scene") {
        if (game.warden) game.warden.scene("start");
        return;
      }
      if (move.kind === "spotlight") {
        /* Only reaches a phone that is actually holding that
           character. Offering the floor to an empty seat is noise,
           and worse, it would burn the per-player cooldown on
           somebody who never saw it. */
        const clientId = claimsRef.current[move.pcId];
        if (!clientId) return;
        send({ t: "spotlight", to: clientId, text: move.text });
        setSpotlight({ clientId, pcId: move.pcId, at: Date.now() });
        if (game.floorNote) game.floorNote(move.pcId, "offer");
      }
    };
    const id = setInterval(tick, FLOOR_TICK_MS);
    return () => clearInterval(id);
  }, [enabled, status, send, floorPolicy]);

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
    /* The table's own decisions. `openTopic` is how a screen asks a
       question; the answer arrives from the phones and resolves
       itself — see the vote effect above. */
    vote, openTopic,
    /* Set when the table asked for `dark` peer whispers on a table
       that cannot honestly offer them. Surfaced, never absorbed. */
    peerDowngrade,
    sound, cue, spotlight, spotlightPeer, lastDispute,
    /* Player-to-player traffic at the agreed resolution, and the raw
       per-character timings the Warden's "waiting on" panel reads. */
    peerLog,
    ready,
    lastActed: lastActed.current,
  };
}
