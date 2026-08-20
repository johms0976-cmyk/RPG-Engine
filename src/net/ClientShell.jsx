/* ============================================================
   CLIENT SHELL — everything a phone runs.

   Connect, name yourself, get a character, then hand the remote
   game object straight to the ordinary Play screen.

   Most of what changed here is about a phone knowing what it is
   waiting for. The old shell sent messages and moved on: offering
   a character left the builder on screen with the button still
   live, so tapping it twice made two of you; claiming set your
   character before the server had agreed; and every action button
   stayed enabled whether or not the host was in a position to run
   it. None of that was visible from the phone, which is why it
   read as the app ignoring you.

   So there are now three explicit waits, each with a screen or a
   strip attached: waiting on the Warden to look at your character,
   waiting on the table for someone else's roll, and waiting on the
   host to acknowledge the thing you just tapped.

   ------------------------------------------------------------
   AND THEN THE FOURTH THING, WHICH IS THE OPPOSITE PROBLEM

   All three of those are about *waiting*. Nothing was about
   *arriving*. You tapped "look at the showers", the tap was
   acknowledged, the world moved — and the only evidence was some
   new lines at the bottom of a log you weren't reading. So you
   tapped the next thing, and the next, and the description of the
   thing in the drain went past unread.

   Two additions close that:

     · PlayerStatus — a permanent strip carrying the three facts a
       player checks between every action: where I am, how hurt I
       am, whose turn it is. All three used to be behind a drawer.

     · useOutcome + OutcomeSheet — a beat after the tap. Small
       stuff gets a receipt that fades. Damage, Stress, Panic, a
       failed save, a find, a whisper: those get a card over the
       buttons that has to be dismissed, because carrying on
       should be a decision rather than momentum.
   ============================================================ */
import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useSocket } from "./useSocket.js";
import { useRemoteGame } from "./useRemoteGame.js";
import { useIntentGate, intentLabel } from "./useIntentGate.js";
import { useOutcome } from "./useOutcome.js";
import { buzz, stopBuzz, cueFor, hapticsOn, setHaptics, canVibrate } from "../ui/haptics.js";
import { currentTurn as currentTurnOf } from "../engine/combat.js";
import { useStrain } from "../ui/usePressure.js";
import { blockedBy } from "./protocol.js";
import { resumeKey } from "./session.js";
import { duressOf } from "../engine/duress.js";
import { tempoOf, WAIT_TEXT } from "../engine/tempo.js";
import PlayerStatus from "./PlayerStatus.jsx";
import SafetyCard from "./SafetyCard.jsx";
import Spotlight from "../ui/Spotlight.jsx";
import Duress from "../ui/Duress.jsx";
import PanicTakeover, { panicFrom } from "../ui/PanicTakeover.jsx";
import DeathTakeover, { deathFrom } from "../ui/DeathTakeover.jsx";
import ClassAlert from "../ui/ClassAlert.jsx";
import { classAlert } from "../engine/classfx.js";
import { SituationBanner, SceneChip, HeldStrip } from "../ui/SituationBanner.jsx";
import TradeOffer from "../ui/TradeOffer.jsx";
import RecapCard from "../ui/RecapCard.jsx";
import audio from "../ui/audio.js";
import Join from "../screens/Join.jsx";
import Locker from "../screens/Locker.jsx";
import CreatorPhone from "../screens/CreatorPhone.jsx";
import Play from "../screens/Play.jsx";
import Ending from "../screens/Ending.jsx";
import { ThemeProvider, Panel, Btn } from "../ui/kit.jsx";
import ErrorBoundary from "../ui/ErrorBoundary.jsx";
import OutcomeSheet from "../ui/OutcomeSheet.jsx";
import MODULES from "../modules/index.js";
import "../ui/theme.css";
import "../ui/art.css";
import "../ui/dread.css";
import "./net.css";
// Last, so it is allowed to correct the layout rules above it.
import "../ui/phone.css";

const KEY = "mothership:table";
const remember = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } };
const recall = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };

const DENIAL_TEXT = {
  full: "The table is full.",
  "no-session": "The Warden hasn't started yet.",
  "no-warden": "The Warden's screen isn't connected.",
  rejected: "The Warden sent that character back.",
  taken: "Somebody else just took that character.",
  "not-yours": "That isn't your character.",
  "not-your-turn": "Not your turn yet.",
  dead: "That character is out of the game.",
  "unknown-action": "The table wouldn't accept that.",
};

export default function ClientShell() {
  const saved = recall();
  /* WHAT THIS PHONE KNOWS ABOUT ITSELF.

     It used to be a clientId this file invented and announced, which
     the relay accepted on trust and then published to every other
     phone — so a player could read a neighbour's id out of the roster
     and reconnect wearing it, collecting the private snapshot that
     secrets.js and distort.js exist to protect (§9.2).

     Now the phone holds a `resume` key it never receives from anyone
     and nothing broadcasts, and the relay hands back an id in the
     welcome. Waking from sleep still lands on the same character;
     knowing another player's name gets you nothing, because the name
     was never what was being checked. */
  const [resume] = useState(() => resumeKey());
  const [clientId, setClientId] = useState(null);
  const [name, setName] = useState(saved.name || "");
  const [pcId, setPcId] = useState(saved.pcId || null);
  const [snapshot, setSnapshot] = useState(null);
  const [peers, setPeers] = useState([]);
  const [notice, setNotice] = useState(null);
  /* The relay's answer to our last claim, kept as an object rather
     than a bare pcId so two attempts at the same character still
     produce a state change the effect below can see. */
  const [claimed, setClaimed] = useState(null);
  const [locker, setLocker] = useState(false);
  /* Low-light reading, in three steps. Stored per phone rather than
     per session because it is a property of the room the player is
     sitting in, not of the game — and the room is usually the same
     room next week. */
  const [dim, setDim] = useState(() => {
    try { return Number(localStorage.getItem("ms:dim")) || 0; } catch { return 0; }
  });
  const cycleDim = useCallback(() => {
    setDim((d) => {
      const next = (d + 1) % 3;
      try { localStorage.setItem("ms:dim", String(next)); } catch { /* ephemeral */ }
      return next;
    });
  }, []);
  const [haptics, setHapticsOn] = useState(() => hapticsOn());
  const toggleHaptics = useCallback(() => {
    setHapticsOn((on) => { setHaptics(!on); if (!on) buzz("turn"); return !on; });
  }, []);
  const [building, setBuilding] = useState(false);
  /* null | { state: "pending"|"received"|"rejected", pc }
     The one piece of state that stops the double-offer: while this is
     set the builder is gone and there is nothing left to tap. */
  const [offer, setOffer] = useState(null);
  // A pcId we have asked for but the server hasn't confirmed yet.
  const [claiming, setClaiming] = useState(null);
  // Why the last thing we sent has not run yet, if it hasn't.
  const [holding, setHolding] = useState(null);
  /* The Warden looking at you. Held here rather than raised as an
     outcome card because it is not a consequence — it does not want
     dismissing, it wants noticing. */
  const [spot, setSpot] = useState(null);
  /* The last whisper, kept so a reply can be threaded back to it. */
  const [replyTo, setReplyTo] = useState(null);
  /* A Panic that has not yet had its two seconds. Held separately from
     the OutcomeSheet, which still has to be dismissed underneath it —
     the takeover is punctuation on top of a record, not instead of one. */
  const [panic, setPanic] = useState(null);
  const lastPanicId = React.useRef(0);
  /* 0 Health, and the roll that decided. Held separately from the
     panic takeover because it does not lift on its own — see
     ui/DeathTakeover.jsx for why that difference is the point. */
  const [death, setDeath] = useState(null);
  const lastDeathId = React.useRef(0);
  /* A class rule that fired on somebody else's sheet and landed on
     this one. Newest wins; these do not queue, because four of them
     stacked during a bad round is a wall, not information. */
  const [classFx, setClassFx] = useState(null);
  const lastClassId = React.useRef(0);
  /* The recap the Warden put up, once this phone has read it. */
  const [recapDown, setRecapDown] = useState(0);
  /* WHEN THE LINE WENT QUIET, AND HOW QUIET.

     `status !== "open"` used to render one string — "Reconnecting…" —
     for a two-second blip and for a host that has been gone for ten
     minutes. Those are completely different situations for the
     person holding the phone: the first wants ignoring, the second
     wants them to look up and say something out loud. The only
     thing the strip needed was to know how long it had been. */
  const [downSince, setDownSince] = useState(null);
  const [, tick] = useState(0);

  const gateRef = React.useRef(null);
  // useOutcome is declared below the socket, but onMessage needs to raise
  // whisper cards, so it reaches the hook through a ref.
  const raiseRef = React.useRef(null);

  const onMessage = useCallback((msg) => {
    if (msg.t === "snapshot") { setSnapshot(msg); return; }
    if (msg.t === "peers") { setPeers(msg.peers || []); return; }
    /* The relay telling us which id it gave us. The only message in
       the protocol that carries a clientId to a phone, and it carries
       only that phone's own. */
    if (msg.t === "welcome") { if (msg.clientId) setClientId(msg.clientId); return; }
    if (msg.t === "claimed") { setClaimed({ pcId: msg.pcId || null, at: Date.now() }); return; }
    if (msg.t === "hostgone") {
      setNotice("The Warden's screen has gone. Waiting for it to come back…");
      setDownSince((d) => d || Date.now());
      return;
    }
    /* A whisper used to be a strip at the top that faded after four
       seconds — for the one mechanic whose entire value is that only
       one person sees it. It is now a card you have to dismiss. */
    if (msg.t === "whisper") {
      if (raiseRef.current) {
        raiseRef.current({ id: `whisper:${Date.now()}`, kind: "whisper", text: msg.text });
      }
      // Whatever they said last is what a reply is a reply to.
      setReplyTo(msg.replyTo || `w:${Date.now()}`);
      return;
    }

    /* A sound in this hand and no other. It deliberately produces no
       feed line and no card the player must dismiss: the whole point
       is that there is no record, so mentioning it is their choice. */
    if (msg.t === "sound") {
      const played = audio.playCue(msg.cue);
      if (navigator.vibrate) navigator.vibrate(played ? 20 : [30, 40, 30]);
      return;
    }

    /* The Warden's actual voice, recorded three seconds ago at the
       desk. Same contract as the synthesised cue: it plays, it buzzes,
       and it leaves no trace anywhere — including here. The object URL
       is revoked as soon as it has finished. */
    if (msg.t === "cue") {
      try {
        const a = new Audio(msg.data);
        a.play().catch(() => {});
      } catch { /* a phone that will not play it simply does not */ }
      if (navigator.vibrate) navigator.vibrate([25, 60, 25]);
      return;
    }

    /* Another player leaning over. Arrives as the same card a Warden
       whisper does, because it is the same act — and is labelled with
       who, because the whole point is that you know and nobody else
       does. */
    if (msg.t === "peerwhisper") {
      if (raiseRef.current) {
        raiseRef.current({
          id: `peer:${Date.now()}`,
          kind: "whisper",
          text: `${msg.from}: ${msg.text}`,
        });
      }
      return;
    }

    if (msg.t === "spotlight") {
      setSpot({ at: Date.now(), text: msg.text || null });
      return;
    }

    // The relay's private receipt for a safety call. Nothing renders
    // from it beyond the confirmation the card shows itself.
    if (msg.t === "safetyack") return;

    /* The Warden has looked at your character. "received" is the
       important one — it is the difference between a button that did
       nothing and a button that did something you can't see yet. */
    if (msg.t === "ack") {
      if (msg.state === "received") setOffer((o) => (o ? { ...o, state: "received" } : o));
      else if (msg.state === "accepted") { setOffer(null); setBuilding(false); }
      else if (msg.state === "rejected") setOffer((o) => (o ? { ...o, state: "rejected" } : o));
      else if (msg.state === "withdrawn") setOffer(null);
      return;
    }

    if (msg.t === "assigned") {
      setOffer(null);
      setBuilding(false);
      setClaiming(null);
      setPcId(msg.pcId);
      return;
    }

    /* The host has the intent and is sitting on it. Not a refusal —
       it will run — so the gate deliberately stays shut and only the
       strip changes. This is the difference between a pause and a
       button that appears to have broken. */
    if (msg.t === "holding") {
      setHolding({ reason: msg.reason, at: Date.now() });
      return;
    }

    if (msg.t === "denied") {
      setNotice(DENIAL_TEXT[msg.reason] || msg.reason);
      /* AN OFFER THAT WAS NEVER DELIVERED IS NOT AN OFFER PENDING.

         A phone that submitted a character while no Warden was
         attached got `no-warden` back, showed it as a four-second
         toast, and then sat on "Waiting for the Warden · Sending…"
         for the rest of the evening — with a Warden who, by
         definition, had never seen it. The toast was the only
         evidence and it deleted itself.

         The offer is marked unsent instead, so the waiting room says
         what happened and there is something to press when the
         Warden's screen finally connects. */
      if (msg.reason === "no-warden") {
        setOffer((o) => (o ? { ...o, state: "unsent" } : o));
      }
      if (msg.reason === "taken") { setPcId(null); setClaiming(null); }
      if (msg.reason === "rejected") setOffer((o) => (o ? { ...o, state: "rejected" } : o));
      // A refused intent is a finished intent: let the buttons back on.
      if (gateRef.current) gateRef.current.clear();
    }
  }, []);

  const { status, send } = useSocket(null, onMessage);

  const seq = snapshot && snapshot.seq;
  /* THE THREE THINGS A TAP DOES NOW.

     It used to do one: send. The other two are local, synchronous
     and owe the network nothing — a short buzz, and a line that
     says the tap was received. Both fire whether the intent goes
     out or is swallowed by the one-at-a-time gate, because from
     the player's side those cases feel identical and the answer
     to both is "yes, I heard you". */
  const [tapNote, setTapNote] = useState(null);
  const onTap = useCallback((action, swallowed) => {
    setTapNote({
      text: swallowed ? "Still waiting…" : intentLabel(action),
      at: Date.now(),
      swallowed,
    });
  }, []);
  const gate = useIntentGate(send, seq, undefined, onTap);
  gateRef.current = gate;

  // Re-announce on every (re)connect, so a phone waking from sleep
  // lands back on the same character without the player doing anything.
  useEffect(() => {
    if (status !== "open") return;
    send({ t: "hello", resume, name: name || "Player" });
    if (pcId) send({ t: "claim", pcId });
  }, [status, send, resume, name, pcId]);

  useEffect(() => { remember({ name, pcId }); }, [name, pcId]);

  /* One timestamp and a slow tick. Nothing else is needed to tell a
     blip apart from an outage, and a strip that re-renders once a
     second costs nothing when it is not on screen. */
  useEffect(() => {
    if (status === "open") { setDownSince(null); return undefined; }
    setDownSince((d) => d || Date.now());
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [status]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  /* The server answers a claim with a fresh roster. Seeing ourselves in
     it is the confirmation. Until then the character list stays locked,
     because two phones tapping the same name at the same moment used to
     both light up and then one got bounced. */
  /* The relay answers a claim on the socket that made it. Confirming
     from the broadcast roster is no longer possible — it carries no
     identifiers for phones to match themselves against — and an
     addressed ack was always the better answer anyway: two phones
     tapping the same character in the same second each hear about
     their own attempt rather than inferring it from a shared list. */
  useEffect(() => {
    if (!claiming || !claimed) return;
    if (claimed.pcId === claiming) { setPcId(claiming); setClaiming(null); }
  }, [claimed, claiming]);

  useEffect(() => {
    if (!claiming) return;
    const t = setTimeout(() => setClaiming(null), 4000);
    return () => clearTimeout(t);
  }, [claiming]);

  const claim = useCallback((id) => {
    setClaiming(id);
    send({ t: "claim", pcId: id });
  }, [send]);

  const g = useRemoteGame(snapshot, pcId, gate.send);

  const mod = MODULES.find((m) => m.id === (snapshot && snapshot.modId)) || MODULES[0];
  const phase = (snapshot && snapshot.phase) || null;
  const waitingOn = useMemo(
    () => blockedBy(snapshot && snapshot.state, pcId),
    [snapshot, pcId],
  );

  // In play, with a living character. Only then does a feed line count
  // as news rather than as backlog.
  const inPlay = !!(g && g.pc && !g.w.ended && !offer && !building && !locker);
  const { outcome, dismiss, raise } = useOutcome(g && g.feed, { live: inPlay });
  raiseRef.current = raise;

  /* Damage, Stress, Panic and a whisper each get their own pattern.
     The OutcomeSheet is already the thing that must be dismissed —
     this is the same event reaching a player who is not looking. */
  /* The feed degrades with the character's Stress — see dread.css.
     Published as a CSS property rather than passed as a prop so that
     nothing re-renders when it changes, and so a module that does not
     want the treatment can simply not style against it. */
  useStrain(inPlay ? g.pc : null);

  const lastBuzzed = React.useRef(null);
  useEffect(() => {
    if (!outcome || outcome === lastBuzzed.current) return;
    lastBuzzed.current = outcome;
    const cue = cueFor(outcome);
    if (cue) buzz(cue);
  }, [outcome]);

  /* ---------------- the tactile channel ----------------

     Three cues, each one accompanying something already visible on
     screen — see ui/haptics.js for why that constraint is
     load-bearing rather than tidy. */

  // The tap acknowledgement is a flash, not a status. It clears
  // itself so it can never become a stale label.
  useEffect(() => {
    if (!tapNote) return undefined;
    const t = setTimeout(() => setTapNote(null), tapNote.swallowed ? 1400 : 700);
    return () => clearTimeout(t);
  }, [tapNote]);

  // "It is your turn" is the cue the whole feature is for: the phone
  // is face-down on the table and the game is waiting on its owner.
  const myTurnNow = !!(g && g.combat && g.pc && (() => {
    const turn = currentTurnOf(g.combat);
    return turn && turn.side === "pc" && turn.id === g.pc.id;
  })());
  const wasMyTurn = React.useRef(false);
  useEffect(() => {
    if (myTurnNow && !wasMyTurn.current) buzz("turn");
    wasMyTurn.current = myTurnNow;
  }, [myTurnNow]);

  useEffect(() => () => stopBuzz(), []);

  /* HOW MUCH TROUBLE AM I IN, RIGHT NOW.

     Derived every render from state the phone already has — see
     engine/duress.js. Nothing is stored, nothing is sent, and nothing
     has to be remembered to switch off, which is what stops it
     becoming the warning light everybody learns to ignore. */
  const duress = useMemo(
    () => (inPlay ? duressOf({ pc: g.pc, combat: g.combat, w: g.w, mod: g.mod, crew: g.crew }) : null),
    [inPlay, g && g.pc, g && g.combat, g && g.w, g && g.mod, g && g.crew],
  );

  /* Panic gets the whole screen for two seconds. It is the thing that
     actually kills Mothership characters and it was being given the
     same weight as being handed a torch. */
  useEffect(() => {
    if (!inPlay || !g || !g.feed) return;
    for (let i = g.feed.length - 1; i >= 0; i--) {
      const line = g.feed[i];
      if (line.kind !== "panic") continue;
      if (line.id <= lastPanicId.current) break;
      // Only mine. Watching somebody else's Panic is the feed's job.
      if (line.pcId && line.pcId !== pcId) break;
      lastPanicId.current = line.id;
      setPanic(panicFrom(line));
      break;
    }
  }, [inPlay, g && g.feed, pcId]);

  /* 0 HEALTH. Scanned separately from Panic rather than folded into
     the same loop: a Body Save at 0 Health can arrive in the same
     snapshot as the Panic that watching it caused somebody else, and
     the two must not race for one slot. `extra.death` is stamped by
     the engine, so nothing here reads prose. */
  useEffect(() => {
    if (!inPlay || !g || !g.feed) return;
    for (let i = g.feed.length - 1; i >= 0; i--) {
      const line = g.feed[i];
      if (!line.extra || !line.extra.death) continue;
      if (line.id <= lastDeathId.current) break;
      const ev = deathFrom(line, pcId);
      lastDeathId.current = line.id;
      if (ev) setDeath(ev);
      break;
    }
  }, [inPlay, g && g.feed, pcId]);

  /* A class rule firing on this phone because of somebody else's
     sheet. The only rules in Mothership a player cannot look up when
     they happen, because the sheet they are written on is in another
     person's hand. */
  useEffect(() => {
    if (!inPlay || !g || !g.feed) return;
    for (let i = g.feed.length - 1; i >= 0; i--) {
      const line = g.feed[i];
      if (!line.extra || !line.extra.classfx) continue;
      if (line.id <= lastClassId.current) break;
      lastClassId.current = line.id;
      const card = classAlert(line, pcId, (g && g.crew) || []);
      if (card) setClassFx(card);
      break;
    }
  }, [inPlay, g && g.feed, pcId]);

  // A snapshot means the world moved, so whatever was being held is not.
  useEffect(() => { setHolding(null); }, [seq]);

  const tempo = tempoOf(g && g.w);
  /* Something being held out to me, and nobody else's business. */
  const myTrade = useMemo(() => {
    if (!inPlay) return null;
    return ((g.w.trades || []).find((t) => t.to === pcId)) || null;
  }, [inPlay, g && g.w && g.w.trades, pcId]);

  const recap = inPlay && g.w.recap && g.w.recap.at !== recapDown ? g.w.recap : null;

  /* A pending roll is already a modal that stops everything, and it is
     the more urgent of the two. Don't stack a card behind it. */
  const showOutcome = inPlay && !(g && g.pending);

  const banner = (
    <>
      {status !== "open" && <ConnectionStrip since={downSince} status={status} />}
      {notice && <div className="net-strip is-notice">{notice}</div>}
      {waitingOn && pcId && (
        <div className="net-strip is-hold">Waiting on {waitingOn} to roll</div>
      )}
      {gate.busy && (
        <div className="net-strip is-busy" role="status">
          {intentLabel(gate.inFlight.action)}
          {holding ? ` · ${WAIT_TEXT[holding.reason] || "held"}` : "…"}
          {gate.ignored > 0 ? " · one at a time" : ""}
        </div>
      )}
    </>
  );

  /* Characters you build or import on your own phone are offered to the
     Warden, never inserted directly. Approval is theirs — and until they
     give it, there is nothing on screen to press again. */
  const makeOffer = useCallback((file) => {
    send({ t: "submit", character: file });
    setLocker(false);
    setBuilding(false);
    // The whole file, not just its `pc`, so a resend after `no-warden`
    // sends the character that was actually built rather than a
    // reconstruction of it.
    setOffer({ state: "pending", pc: file.pc, file });
  }, [send]);

  const withdraw = useCallback(() => {
    send({ t: "withdraw" });
    setOffer(null);
  }, [send]);

  /* Player -> Warden, and nobody else. The half of the loop that was
     missing: "I quietly pocket the keycard" is destroyed by being said
     out loud, and until now the only way to say it was out loud. */
  const whisperBack = useCallback((text) => {
    const t = String(text || "").trim();
    if (!t) return;
    send({ t: "playerwhisper", text: t, replyTo });
  }, [send, replyTo]);

  /* Player to player. Routed by character, because a player knows who
     Riley is and has never seen a clientId. Whether the Warden gets a
     copy is the relay's decision, not this phone's — see PEER_MODES. */
  const whisperPeer = useCallback((toPcId, text) => {
    const t = String(text || "").trim();
    if (!t || !toPcId) return;
    send({ t: "peerwhisper", toPcId, text: t });
  }, [send]);

  /* The card. Sent raw — the relay strips who sent it before the
     Warden's screen ever sees it. */
  const callSafety = useCallback((level) => {
    send({ t: "safety", level });
  }, [send]);

  let body;
  if (offer) {
    body = (
      <OfferStatus offer={offer} onWithdraw={withdraw}
        onResend={() => {
          if (!offer.pc) return;
          send({ t: "submit", character: offer.file || offer.pc });
          setOffer((o) => (o ? { ...o, state: "pending" } : o));
        }}
        onAgain={() => { setOffer(null); setBuilding(true); }} />
    );
  } else if (building && mod) {
    body = <CreatorPhone mod={mod} playerName={name} onOffer={makeOffer} onBack={() => setBuilding(false)} />;
  } else if (locker) {
    body = <Locker onUse={makeOffer} onBack={() => setLocker(false)} busyLabel="Offer to the Warden" />;
  } else if (!pcId || !g) {
    body = (
      <Join
        snapshot={snapshot}
        mod={mod}
        peers={peers}
        myName={name}
        status={status}
        phase={phase}
        claiming={claiming}
        myPcId={pcId}
        onName={setName}
        onClaim={claim}
        onLocker={() => setLocker(true)}
        onBuild={() => setBuilding(true)}
      />
    );
  } else if (g.w.ended) {
    body = <Ending mod={g.mod} w={g.w} crew={g.crew} feed={g.feed} onAgain={() => {}} onLibrary={() => setPcId(null)} />;
  } else if (!g.pc) {
    body = (
      <div className="join">
        <Panel title="You're out">
          <p>Your character is no longer in play. The Warden can bring in someone new.</p>
          <Btn kind="primary" onClick={() => setPcId(null)}>Pick another</Btn>
        </Panel>
      </div>
    );
  } else {
    body = (
      <Play
        g={g}
        onQuit={() => setPcId(null)}
        onLocker={() => setLocker(true)}
        onWhisper={whisperBack}
        onWhisperPeer={whisperPeer}
        tableHandout={(snapshot && snapshot.table && snapshot.table.handout) || null}
        tableHandoutOnly={(snapshot && snapshot.table && snapshot.table.only) || null}
        /* The table's lines and veils. Packed into every snapshot
           since the protocol was written, read by nothing until
           now — a contract one party cannot re-read mid-session is
           not a contract. It lives on the Notes tab. */
        safety={(snapshot && snapshot.safety) || null}
      />
    );
  }

  return (
    <ThemeProvider theme={mod.theme} treatment={mod.theme.treatment} feedStyles={mod.feedStyles}>
      <ErrorBoundary mod={mod} onEject={() => setPcId(null)}>
        {/* The dim treatment dresses the whole shell, modals included
            — a player who has dimmed their phone did not mean "except
            when I open my inventory". */}
        <div className="app" data-dim={dim || undefined} style={{ display: "contents" }}>
        {banner}
        {inPlay && <HeldStrip w={g.w} />}
        {inPlay && <SituationBanner w={g.w} />}
        {inPlay && <PlayerStatus g={g} waitingOn={waitingOn} duress={duress} />}
        {inPlay && <SceneChip w={g.w} crew={g.crew} myPcId={pcId} />}
        {body}
        {showOutcome && <OutcomeSheet outcome={outcome} onDismiss={dismiss} />}
        {/* Above the buttons and below the modals: something being put
            in your hand is not an interruption, it is a question. */}
        {inPlay && myTrade && !g.pending && (
          <TradeOffer
            trade={myTrade} items={g.items} crew={g.crew}
            autoAccept={!!g.combat}
            onAccept={(id) => g.acceptTrade(id)}
            onDecline={(id) => g.declineTrade(id)}
          />
        )}
        {recap && <RecapCard recap={recap} onClose={() => setRecapDown(recap.at)} />}
        {/* Outside the play grid on purpose — it dresses the whole
            screen, including the modals, because being held by
            something does not stop while you read your inventory. */}
        {inPlay && <Duress duress={duress} />}
        <PanicTakeover event={panic} onDone={() => setPanic(null)} />
        {/* Above Panic in the stack, because 0 Health outranks it and
            because this one waits to be acknowledged. */}
        <DeathTakeover event={death} onDismiss={() => setDeath(null)} />
        <ClassAlert alert={classFx} onDismiss={() => setClassFx(null)} />
        <Spotlight spot={spot} onDone={() => setSpot(null)} />
        {/* Outside every other screen and above every modal, on purpose:
            the moment you most need this is the moment the game is most
            insistently asking you for something. */}
        {status === "open" && (
          <SafetyCard safety={(snapshot && snapshot.safety) || null} onCall={callSafety} />
        )}

        {/* Local, immediate, and gone in under a second. */}
        {tapNote && <div className="tap-ack" role="status">{tapNote.text}</div>}

        {/* Comfort controls. Deliberately at the bottom of the shell
            and deliberately tiny: these are set once at the start of
            a session and never touched again. */}
        {inPlay && (
          <div className="phone-comfort">
            <button type="button" className="phone-comfort-btn" onClick={cycleDim}
              aria-label={`Screen brightness, currently ${["normal", "dim", "darkest"][dim]}`}>
              {["◐", "◑", "●"][dim]}
            </button>
            {canVibrate() && (
              <button type="button" className="phone-comfort-btn" onClick={toggleHaptics}
                aria-pressed={haptics} aria-label={`Vibration ${haptics ? "on" : "off"}`}>
                {haptics ? "≋" : "≁"}
              </button>
            )}
          </div>
        )}
        </div>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

/* ============================================================
   THE LINE, AND HOW LONG IT HAS BEEN DOWN.

   Three states, because they ask three different things of the
   player:

     under 5s   a blip. Say almost nothing; it will fix itself
                before anybody has finished reading the strip.
     under 30s  a real interruption. Say so, and say that nothing
                has been lost, because the fear is that it has.
     beyond     the host is gone. Stop reassuring and tell them to
                look up — the fix for this one is in the room, not
                on the phone.
   ============================================================ */
export function ConnectionStrip({ since, status }) {
  const secs = since ? Math.floor((Date.now() - since) / 1000) : 0;

  if (secs < 5) return <div className="net-strip is-down">Reconnecting…</div>;

  if (secs < 30) {
    return (
      <div className="net-strip is-down">
        Reconnecting… {secs}s · nothing you did has been lost
      </div>
    );
  }

  return (
    <div className="net-strip is-notice" role="alert">
      No answer from the Warden&apos;s screen for {secs < 120 ? `${secs} seconds` : `${Math.floor(secs / 60)} minutes`}.
      {" "}Worth saying out loud — this phone will reattach on its own the moment it is back.
      {status === "closed" ? " (the connection is closed, not slow)" : ""}
    </div>
  );
}

/* ============================================================
   The waiting room. Its whole job is to be a screen with nothing
   on it to press twice.
   ============================================================ */
export function OfferStatus({ offer, onWithdraw, onAgain, onResend }) {
  const pc = offer.pc || {};

  /* The relay took it and had nowhere to put it. Distinct from
     "rejected" — nobody has looked at this and decided anything;
     there was simply no Warden attached to the table when it was
     sent. Saying so is the difference between a screen that is
     waiting and a screen that is stuck. */
  if (offer.state === "unsent") {
    return (
      <div className="join">
        <Panel title="Nobody picked that up">
          <div className="stack">
            <p style={{ margin: 0 }}>
              <strong>{pc.name}</strong> did not reach anyone. The table server
              is running — you are talking to it — but the Warden&apos;s screen
              is not attached to it, so there was nowhere to deliver this.
            </p>
            <div className="note-box">
              Worth saying out loud. If the top of their screen says anything
              other than a list of phones, that is the problem — and on the
              machine running the server the Warden screen has to be the
              <code> localhost </code> address, not the one your phone uses.
            </div>
            <div className="btn-grid">
              {onResend && <Btn kind="primary" onClick={onResend}>Send it again</Btn>}
              <Btn kind="ghost" onClick={onAgain}>Change something first</Btn>
            </div>
            <p className="clue-meta" style={{ margin: 0 }}>
              A copy is in your locker either way, so nothing is lost.
            </p>
          </div>
        </Panel>
      </div>
    );
  }

  if (offer.state === "rejected") {
    return (
      <div className="join">
        <Panel title="Sent back">
          <div className="stack">
            <p style={{ margin: 0 }}>
              The Warden sent <strong>{pc.name}</strong> back. Usually that means
              something wants changing — ask them what. They're in the room.
            </p>
            <p className="clue-meta" style={{ margin: 0 }}>
              A copy is still in your locker, so nothing is lost.
            </p>
            <Btn kind="primary" onClick={onAgain}>Build another</Btn>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="join">
      <Panel title="Waiting for the Warden">
        <div className="stack">
          <div className="wait-mark" aria-hidden="true"><i /><i /><i /></div>
          <p style={{ margin: 0 }}>
            <strong>{pc.name}</strong> is on the Warden's screen.
            {offer.state === "received"
              ? " They have it — they'll wave you in when they've had a look."
              : " Sending…"}
          </p>
          <dl className="wiz-review">
            <dt>Class</dt><dd>{pc.cls}</dd>
            <dt>Skills</dt><dd>{(pc.skills || []).join(" · ") || "None."}</dd>
          </dl>
          <p className="clue-meta" style={{ margin: 0 }}>
            Nothing to do here — this screen changes on its own.
          </p>
          <Btn kind="ghost" onClick={onWithdraw}>Take it back and change something</Btn>
        </div>
      </Panel>
    </div>
  );
}
