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
import { newClientId, blockedBy } from "./protocol.js";
import PlayerStatus from "./PlayerStatus.jsx";
import SafetyCard from "./SafetyCard.jsx";
import Spotlight from "../ui/Spotlight.jsx";
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
  const [clientId] = useState(saved.clientId || newClientId());
  const [name, setName] = useState(saved.name || "");
  const [pcId, setPcId] = useState(saved.pcId || null);
  const [snapshot, setSnapshot] = useState(null);
  const [peers, setPeers] = useState([]);
  const [notice, setNotice] = useState(null);
  const [locker, setLocker] = useState(false);
  const [building, setBuilding] = useState(false);
  /* null | { state: "pending"|"received"|"rejected", pc }
     The one piece of state that stops the double-offer: while this is
     set the builder is gone and there is nothing left to tap. */
  const [offer, setOffer] = useState(null);
  // A pcId we have asked for but the server hasn't confirmed yet.
  const [claiming, setClaiming] = useState(null);
  /* The Warden looking at you. Held here rather than raised as an
     outcome card because it is not a consequence — it does not want
     dismissing, it wants noticing. */
  const [spot, setSpot] = useState(null);
  /* The last whisper, kept so a reply can be threaded back to it. */
  const [replyTo, setReplyTo] = useState(null);

  const gateRef = React.useRef(null);
  // useOutcome is declared below the socket, but onMessage needs to raise
  // whisper cards, so it reaches the hook through a ref.
  const raiseRef = React.useRef(null);

  const onMessage = useCallback((msg) => {
    if (msg.t === "snapshot") { setSnapshot(msg); return; }
    if (msg.t === "peers") { setPeers(msg.peers || []); return; }
    if (msg.t === "hostgone") {
      setNotice("The Warden's screen has gone. Waiting for it to come back…");
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

    if (msg.t === "denied") {
      setNotice(DENIAL_TEXT[msg.reason] || msg.reason);
      if (msg.reason === "taken") { setPcId(null); setClaiming(null); }
      if (msg.reason === "rejected") setOffer((o) => (o ? { ...o, state: "rejected" } : o));
      // A refused intent is a finished intent: let the buttons back on.
      if (gateRef.current) gateRef.current.clear();
    }
  }, []);

  const { status, send } = useSocket(null, onMessage);

  const seq = snapshot && snapshot.seq;
  const gate = useIntentGate(send, seq);
  gateRef.current = gate;

  // Re-announce on every (re)connect, so a phone waking from sleep
  // lands back on the same character without the player doing anything.
  useEffect(() => {
    if (status !== "open") return;
    send({ t: "hello", clientId, name: name || "Player" });
    if (pcId) send({ t: "claim", pcId });
  }, [status, send, clientId, name, pcId]);

  useEffect(() => { remember({ clientId, name, pcId }); }, [clientId, name, pcId]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  /* The server answers a claim with a fresh roster. Seeing ourselves in
     it is the confirmation. Until then the character list stays locked,
     because two phones tapping the same name at the same moment used to
     both light up and then one got bounced. */
  useEffect(() => {
    if (!claiming) return;
    const mine = peers.find((p) => p.clientId === clientId);
    if (mine && mine.pcId === claiming) { setPcId(claiming); setClaiming(null); }
  }, [peers, claiming, clientId]);

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

  /* A pending roll is already a modal that stops everything, and it is
     the more urgent of the two. Don't stack a card behind it. */
  const showOutcome = inPlay && !(g && g.pending);

  const banner = (
    <>
      {status !== "open" && <div className="net-strip is-down">Reconnecting…</div>}
      {notice && <div className="net-strip is-notice">{notice}</div>}
      {waitingOn && pcId && (
        <div className="net-strip is-hold">Waiting on {waitingOn} to roll</div>
      )}
      {gate.busy && (
        <div className="net-strip is-busy" role="status">
          {intentLabel(gate.inFlight.action)}…{gate.ignored > 0 ? " · one at a time" : ""}
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
    setOffer({ state: "pending", pc: file.pc });
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

  /* The card. Sent raw — the relay strips who sent it before the
     Warden's screen ever sees it. */
  const callSafety = useCallback((level) => {
    send({ t: "safety", level });
  }, [send]);

  let body;
  if (offer) {
    body = (
      <OfferStatus offer={offer} onWithdraw={withdraw}
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
        tableHandout={(snapshot && snapshot.table && snapshot.table.handout) || null}
      />
    );
  }

  return (
    <ThemeProvider theme={mod.theme} treatment={mod.theme.treatment} feedStyles={mod.feedStyles}>
      <ErrorBoundary mod={mod} onEject={() => setPcId(null)}>
        {banner}
        {inPlay && <PlayerStatus g={g} waitingOn={waitingOn} />}
        {body}
        {showOutcome && <OutcomeSheet outcome={outcome} onDismiss={dismiss} />}
        <Spotlight spot={spot} onDone={() => setSpot(null)} />
        {/* Outside every other screen and above every modal, on purpose:
            the moment you most need this is the moment the game is most
            insistently asking you for something. */}
        {status === "open" && (
          <SafetyCard safety={(snapshot && snapshot.safety) || null} onCall={callSafety} />
        )}
      </ErrorBoundary>
    </ThemeProvider>
  );
}

/* ============================================================
   The waiting room. Its whole job is to be a screen with nothing
   on it to press twice.
   ============================================================ */
export function OfferStatus({ offer, onWithdraw, onAgain }) {
  const pc = offer.pc || {};

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
