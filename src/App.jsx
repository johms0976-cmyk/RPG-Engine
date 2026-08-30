import React, { useState, useCallback, useEffect } from "react";
import MODULES from "./modules/index.js";
import { loadInstalled, mergeModules } from "./engine/moduleStore.js";
import { ThemeProvider } from "./ui/kit.jsx";
import ErrorBoundary from "./ui/ErrorBoundary.jsx";
import { useGame } from "./engine/useGame.js";
import { makeCharacter, rollStats, randomFlavour, CLASSES } from "./engine/rules.js";
import Library from "./screens/Library.jsx";
import TitleSequence from "./ui/TitleSequence.jsx";
import Creator from "./screens/Creator.jsx";
import Play from "./screens/Play.jsx";
import Ending from "./screens/Ending.jsx";
import { activeCampaignId, setActiveCampaign } from "./engine/campaign.js";
import WardenTools from "./screens/WardenTools.jsx";
import Editor from "./screens/Editor.jsx";
import Paper from "./screens/Paper.jsx";
import { settings as loadSettings, saveSettings, load as loadSave } from "./engine/storage.js";
import { useCore } from "./react/useCore.js";
import { makeShip } from "./core/index.js";
import applyDemand from "./react/demands.js";
import audio from "./ui/audio.js";
import { useHost } from "./net/useHost.js";
import { useDirector } from "./net/useDirector.js";
import DirectorStrip from "./ui/DirectorStrip.jsx";
import { useRtcHost } from "./net/useRtcHost.js";
import RemotePanel from "./net/RemotePanel.jsx";
import HostBar from "./net/HostBar.jsx";
import TableView from "./screens/TableView.jsx";
import useVoice from "./ui/useVoice.js";
import JoinCard from "./ui/JoinCard.jsx";
import useWakeLock from "./ui/useWakeLock.js";
import Approvals from "./screens/Approvals.jsx";
import Lobby from "./screens/Lobby.jsx";
import ClueBoard from "./ui/ClueBoard.jsx";
import { SafetyAlert } from "./net/SafetyCard.jsx";
import { adoptCharacter } from "./engine/portable.js";
import { newPcId } from "./engine/rules.js";
import { distortionsActive } from "./net/distort.js";
import { readResume, describeResume, restoreFrom, dropResume } from "./net/resume.js";
import "./net/net.css";
import "./ui/dread.css";
import "./ui/theme.css";
import "./ui/art.css";

const DEFAULT_THEME = MODULES[0].theme;

const URL_MODE = new URLSearchParams(location.search).get("mode");

/** ?mode=host turns this tab into the authority for a LAN table.
    Without it the app behaves exactly as it always has. */
export const HOSTING = URL_MODE === "host";

/* ============================================================
   THE EMPTY CHAIR WITHOUT A SERVER

   The empty chair used to require HOSTING, which means
   `npm run host` or Play.bat — a terminal. Three things followed
   from that and all three were bad:

     · the hosted build could never demonstrate it. main.jsx
       probes /net/info, which 404s on a static host, so every
       visitor to the published page landed in `solo` — the one
       configuration where the director provably never ran.
     · the most natural physical setup for four to six friends —
       one laptop on the table, everybody round it, nobody
       running a server — could build a crew and then had no
       Warden at all.
     · so the thing the project is proudest of was reachable only
       by the people least likely to need convincing.

   SOLO_WARDENLESS is that setup: one device, pass-and-play, the
   ladder running locally, no socket and no phones.

   The lock it does NOT relax is the important one. This device
   still never shows the Warden deck — see `wardenless` below and
   the `wardenless` prop on Play. On a shared screen an accidental
   Warden is worse, not better, because everyone is reading it.
   ============================================================ */
export const SOLO_WARDENLESS = URL_MODE === "wardenless";

/* ============================================================
   THE THIRD DOOR

   Remote play shipped in 2.13 and stayed invisible for three
   releases. It worked — the transport, the codec and the router
   were all tested — and the only way to reach it was to know that
   `?mode=host` existed, add it by hand, and then find a checkbox
   in the lobby labelled SOMEONE IS NOT IN THE BUILDING.

   That is the same failure INV-9 names: a capability whose only
   switch is somewhere the person who needs it never looks has not
   shipped. And it is the worst instance of it, because remote is
   the configuration MOST groups need — most tables that play at
   all play online — and it is the one this engine can do without
   anything running anywhere, on the published static build.

   `?mode=host&remote=1` is that door. It exists as a URL rather
   than as state because HOSTING is decided at module load from
   the query string, so entering host mode is a navigation, not a
   setState. The title screen sends people through it.
   ============================================================ */
export const REMOTE_DOOR =
  HOSTING && new URLSearchParams(location.search).get("remote") === "1";

export default function App() {
  const [slot, setSlot] = useState(null);
  const [tools, setTools] = useState(false);
  /* THE EDITOR. Null is closed; a string or object is a module being
     opened; `false` is a fresh draft. Three states rather than a
     boolean plus a payload, because "open the editor on nothing" and
     "open the editor on this" are different acts and collapsing them
     is how the second one silently starts discarding the first's
     autosaved draft. */
  const [writing, setWriting] = useState(null);
  /* PAPER MODE. The module being printed, or null. Held here rather
     than inside Library because printing takes over the whole page —
     `@media print` deletes every other surface — and a screen that
     replaces the app is a route, not a modal. */
  const [printing, setPrinting] = useState(null);
  const [run, setRun] = useState(0);
  /* Modules loaded at runtime, read once and re-read whenever the shelf
     changes. Bundled modules win an id collision — see mergeModules. */
  const [shelf, setShelf] = useState(() => loadInstalled());
  const refreshShelf = useCallback(() => setShelf(loadInstalled()), []);
  const modules = React.useMemo(() => mergeModules(MODULES, shelf.mods), [shelf.mods]);

  if (printing) {
    return (
      <ThemeProvider theme={printing.theme} treatment={printing.theme.treatment}>
        <ErrorBoundary onEject={() => setPrinting(null)}>
          <Paper mod={printing} onBack={() => setPrinting(null)} />
        </ErrorBoundary>
      </ThemeProvider>
    );
  }

  if (writing !== null) {
    return (
      <ThemeProvider theme={DEFAULT_THEME} treatment={DEFAULT_THEME.treatment}>
        <ErrorBoundary onEject={() => setWriting(null)}>
          <Editor
            open={writing || null}
            onShelfChange={refreshShelf}
            onBack={() => setWriting(null)}
          />
        </ErrorBoundary>
      </ThemeProvider>
    );
  }

  if (tools) {
    return (
      <ThemeProvider theme={DEFAULT_THEME} treatment={DEFAULT_THEME.treatment}>
        <ErrorBoundary onEject={() => setTools(false)}>
          <WardenTools onBack={() => setTools(false)} modules={modules} />
        </ErrorBoundary>
      </ThemeProvider>
    );
  }

  if (!slot) {
    return (
      <ThemeProvider theme={DEFAULT_THEME} treatment={DEFAULT_THEME.treatment}>
        <ErrorBoundary>
          <Library
            modules={modules}
            broken={shelf.broken}
            onShelfChange={refreshShelf}
            onPick={(m) => { setRun((r) => r + 1); setSlot({ mod: m, slotName: "auto" }); }}
            onResume={(m, name) => { setRun((r) => r + 1); setSlot({ mod: m, slotName: name, resume: loadSave(m.id, name) }); }}
            onWardenTools={() => setTools(true)}
            onWrite={(open) => setWriting(open || false)}
            onPaper={(m) => setPrinting(m)}
          />
        </ErrorBoundary>
      </ThemeProvider>
    );
  }

  return (
    <Cartridge
      key={`${slot.mod.id}:${run}`}
      mod={slot.mod}
      slotName={slot.slotName}
      resume={slot.resume}
      onEject={() => setSlot(null)}
      onRestart={() => { setSlot({ mod: slot.mod, slotName: "auto" }); setRun((r) => r + 1); }}
    />
  );
}

/** One loaded module. Remounting this is how "eject and reload" works. */
function Cartridge({ mod, slotName, resume, onEject, onRestart }) {
  const [phase, setPhase] = useState(resume ? "play" : "title");
  const [view, setView] = useState("warden");
  /* ============================================================
     WHO IS RUNNING THIS TABLE

     "warden" is everything as it was. "wardenless" is the empty
     chair: this device shows the table screen, the director runs
     the module, and nobody has a deck.

     Chosen at the title and FIXED FOR THE LIFE OF THE SESSION.
     Not a toggle you can reach mid-game, because the moment this
     device can be tabbed over to the Warden deck the person who
     owns it is an accidental Warden who knows where the creature
     is — and they are also playing. TableView says of itself that
     it deliberately holds no secrets; that sentence is the whole
     requirement, and a switch would break it.
     ============================================================ */
  const [tableMode, setTableMode] = useState(SOLO_WARDENLESS ? "wardenless" : "warden");
  /* No longer gated on HOSTING. A table mode is a statement about
     who is refereeing, not about whether a socket is open. */
  const wardenless = tableMode === "wardenless";
  /* Reached through refs because useHost holds these for the life of
     the socket: a callback that changes identity every render would
     reattach the socket handler every render. Declared here, filled
     in below once the things they point at exist. */
  const acceptRef = React.useRef(null);
  const startRef = React.useRef(null);
  const rosterRef = React.useRef([]);
  /* ASSISTED, THEN AUTO.

     The director runs on any hosted table in play. What changes with
     the mode is only whether a person is asked first: with a Warden
     present every Move is a suggestion they take or wave away, and
     with the chair empty the same Moves are taken immediately.

     That ordering is deliberate and it is the whole reason assisted
     mode exists. A ladder nobody has vetoed is a ladder nobody has
     checked, and the version with a human in it is the version that
     can tell you it is wrong. Empty chair is then one boolean, not a
     second implementation. */
  /* ============================================================
     ASSISTED MODE IS NOW A CHOICE.

     `directorOn = HOSTING && phase === "play"` — flagged in the
     2.6.0 manifest, flagged again in 2.7.0, and true until now. It
     mattered very little while `mod.director` was being dropped by
     defineModule and no rung above `floor` could fire. It matters a
     great deal the moment that is fixed: a Warden-run table that
     upgrades will start getting escalation, attack and called-roll
     suggestions bottom-right without anybody having asked for them.

     Default on, because assisted mode is how the ladder gets
     evaluated and a rung nobody has vetoed is a rung nobody has
     checked. But a default is not the same thing as a decision, and
     a Warden who wants their table back should not have to edit a
     source file to get it. The switch lives in HostBar and is
     remembered across sessions — unlike the veto counts, which are
     deliberately per-session (see useDirector).

     With the chair empty this is ignored: there is no Warden to
     assist, and the director *is* the Warden. */
  const [assist, setAssist] = React.useState(() => {
    const s = loadSettings();
    return s.assist === undefined ? true : !!s.assist;
  });
  const toggleAssist = React.useCallback((on) => {
    setAssist(on);
    saveSettings({ ...loadSettings(), assist: !!on });
  }, []);
  /* ============================================================
     HOW FAR AWAY THE ROOM IS SITTING

     Remembered like the assist switch, because a table's furniture
     does not change between sessions and being asked about it every
     evening is worse than a wrong default.

     It is deliberately NOT inferred from the viewport. A 1080p
     television and a 1080p monitor are the same number of pixels
     and about two and a half metres apart, and there is nothing in
     the DOM that tells them apart. Guessing would be wrong roughly
     half the time and silently — so it is asked once. ============================================================ */
  const [distance, setDistance] = React.useState(() => {
    const s = loadSettings();
    return s.distance === "couch" ? "couch" : "desk";
  });
  const chooseDistance = React.useCallback((d) => {
    const next = d === "couch" ? "couch" : "desk";
    setDistance(next);
    saveSettings({ ...loadSettings(), distance: next });
    /* Choosing this is a click, which is the gesture WebAudio has
       been waiting for. A shared screen across a room is the one
       configuration where sound is unambiguously wanted: it is the
       only good speaker in the room and nobody is holding it. */
    if (next === "couch") audio.setEnabled(true);
  }, []);

  /* ============================================================
     WHEN THIS EVENING FINISHES

     `rungLastCall` has been able to steer a session toward a
     declared ending since 2.10.0, and `sessionEndsAt` has never had
     a producer: nothing set it, nothing carried it, and this file
     constructed useDirector without it. The rung returned null on
     every tick of every session ever played, and the tests were
     green the whole time because they exercised the rung directly.

     Agreed in the lobby as a LENGTH and converted to a wall-clock
     stamp at `start`, because "three hours" is what a table says to
     each other and "21:47" is what a clock needs. Zero means nobody
     asked to be steered, which stays the default — the honest half
     of this feature is that a table which did not ask for a finish
     time never gets one.
     ============================================================ */
  const [sessionMins, setSessionMins] = React.useState(0);
  const [endsAt, setEndsAt] = React.useState(0);

  /* ============================================================
     WHETHER TONIGHT IS PART OF SOMETHING

     Null means "just this session", which is the default and stays
     the default — see screens/CampaignPanel.jsx. Seeded from the
     last selection so a table that has a campaign running does not
     have to find it again every week, and cleared the moment they
     pick "just this session".

     It changes NOTHING about how the session plays. It is read at
     exactly one place — the ending screen, where the evening is
     written down — and no rung, module or rule consults it. See
     the header of engine/campaign.js for why that is deliberate.
     ============================================================ */
  const [campaignId, setCampaignId] = React.useState(() => activeCampaignId());
  const chooseCampaign = React.useCallback((id) => {
    setCampaignId(id);
    setActiveCampaign(id);
  }, []);

  /* The card, raised from the bar and dismissed by any key. Held
     here rather than in HostBar because it covers the whole screen
     including the bar that raised it. */
  const [joinCard, setJoinCard] = React.useState(false);

  /* The machine driving the television must not sleep either. Its
     own screen blanking mid-scene is rarer than a phone's and much
     more disruptive, because it takes the room's shared reference
     with it. */
  useWakeLock(HOSTING);

  /* The ladder runs whenever nobody is refereeing, socket or not.
     Assisted mode still requires HOSTING, because a suggestion
     strip with no Warden to read it is just latency. */
  const directorOn = phase === "play" && (wardenless || (HOSTING && assist));

  /* ============================================================
     THE VOICE

     Off unless somebody asks. See ui/useVoice.js for why this is
     the shared screen's job and never a phone's.

     Defaulted on for a local wardenless table and still switchable,
     because that is the one configuration where there is provably
     nobody whose job it is to read the room description out — the
     Warden's chair is empty AND there are no phones for the prose
     to arrive on privately. Everywhere else it stays silent until
     asked.
     ============================================================ */
  const [voiceOn, setVoiceOn] = useState(wardenless && !HOSTING);
  const voice = useVoice({ enabled: voiceOn });

  /* Characters approved in the lobby, before a session exists. They are
     held here rather than pushed straight into the game because begin()
     *replaces* the crew — approving people and then starting used to
     delete every one of them. */
  const [roster, setRoster] = useState([]);
  const [joinUrl, setJoinUrl] = useState(null);
  /* Lines and veils, agreed at the lobby and carried in every
     snapshot so any phone can re-read them mid-session. Held here
     rather than in the world because they are the table's contract
     with itself, not a fact about the fiction. */
  const [safety, setSafety] = useState({ lines: [], veils: [], enabled: true });
  /* Somebody who came through the remote door already answered the
     question the title screen asks, so asking it again is a step that
     only loses people. Straight to the lobby, where the connection
     codes are. */
  useEffect(() => {
    if (REMOTE_DOOR) setPhase((p) => (p === "title" ? "lobby" : p));
  }, []);
  /* The table's transport, chosen by a person. Off means the LAN relay,
     exactly as before; on moves the routing into this tab so players
     can arrive from anywhere. Chosen, never inferred — see useSocket. */
  const [remote, setRemote] = useState(REMOTE_DOOR);
  /* How much of a player-to-player whisper the Warden is shown. The
     table agrees this out loud before the session; the relay enforces
     it, so a "dark" table's secrets never reach this process at all.
     "seen" — the Warden knows a whisper happened and between whom, but
     not what it said — is the default because it is the setting that
     keeps a Warden able to run the scene without reading the plot. */
  const [peerWhispers, setPeerWhispers] = useState("seen");
  // The core is created after useGame but must be saved alongside it,
  // so the getter is handed over by reference and filled in below.
  const coreSnapshot = React.useRef(null);
  const g = useGame(mod, {
    ...loadSettings(),
    slot: slotName,
    getExtra: () => (coreSnapshot.current ? coreSnapshot.current() : undefined),
  });
  const { begin, w, crew, feed } = g;

  /* Spoken HERE rather than inside a screen, because which screen is
     the shared one changes with the configuration — TableView with
     phones, Play without — and the queue must not restart when the
     view does. One device, one voice, one place.

     Below the destructure, not above it: `feed` is a const from `g`
     and reading it earlier is a temporal-dead-zone crash on the
     very first render. */
  React.useEffect(() => { voice.speakFeed(feed); }, [feed, voice]);

  // The headless core owns ships, contractors and downtime. It
  // narrates into the same feed and hands back "demands" that
  // only the character layer can carry out.
  const gRef = React.useRef(g);
  gRef.current = g;
  const core = useCore({
    seed: w.seed,
    credits: (crew[0] && crew[0].credits) || 0,
    restore: resume && resume.core,
    onNarrate: (kind, text) => {
      gRef.current.api && gRef.current.api.say(kind, text);
      audio.playForKind(kind);
    },
    onDemand: (d) => applyDemand(gRef.current, d),
  });
  coreSnapshot.current = core.snapshot;

  // `core.do` is memoised on the store and never changes; `core` itself
  // moves whenever core state moves. Depending on the whole object here
  // is what made these effects re-run on every render.
  const coreDo = core.do;
  const hasShip = !!core.state.ship;

  // Install the module's ship, once, when the session actually starts.
  React.useEffect(() => {
    if (!mod.ship || hasShip || !crew.length) return;
    coreDo.install(makeShip(mod.ship));
  }, [mod.ship, hasShip, crew.length, coreDo]);

  // Keep the core's view of the crew current without it ever
  // holding a reference to a character object.
  React.useEffect(() => {
    coreDo.context({
      aboardCount: crew.filter((c) => c.alive !== false).length,
      negotiatorIntellect: (g.pc && g.pc.stats.intellect) || 30,
      crewNames: Object.fromEntries(crew.map((c) => [c.id, c.name])),
      addictionCount: crew.filter((c) => (c.conditions || []).includes("Addiction")).length,
      savvy: crew.some((c) => (c.skills || []).includes("Rimwise")),
    });
  }, [crew, g.pc, coreDo]);

  const started = React.useRef(false);
  React.useEffect(() => {
    if (resume && !started.current) { started.current = true; begin(null, resume); }
  }, [resume, begin]);

  /* THE CRASH MAT. Every broadcast writes the state the phones last
     agreed on — see net/resume.js — so a host tab that was closed,
     refreshed, or killed by a laptop deciding to install an update
     can put the session back. Offered rather than applied: the
     second most common reason for this tab to reload is that the
     Warden wanted to start something else. */
  const [crashMat, setCrashMat] = React.useState(
    () => (HOSTING && !resume ? readResume() : null),
  );
  const resumeTable = React.useCallback(() => {
    if (!crashMat) return;
    started.current = true;
    begin(null, restoreFrom(crashMat));
    setPhase("play");
    setCrashMat(null);
  }, [crashMat, begin]);
  const dismissCrashMat = React.useCallback(() => { dropResume(); setCrashMat(null); }, []);
  const crashOffer = crashMat && crashMat.modId === mod.id && phase !== "play"
    ? describeResume(crashMat) : null;

  /* FACTS CARRIED FROM EARLIER SESSIONS.

     Held here rather than applied at the lobby, because the world
     does not exist until `begin` runs. The table ticks them in the
     lobby; they land the moment play starts.

     Empty is the normal state and the safe direction — see
     engine/continuity.js on why nothing is ever carried
     automatically. */
  const [carried, setCarried] = useState([]);

  const start = useCallback((newCrew) => {
    begin(newCrew);
    /* Through `warden.rule`, the same door table rulings use.
       `commitW` is not on the game object — reaching for it here
       would have been a call to a function that does not exist,
       which is exactly the class of bug the 2.17 smoke test was
       written for. One place appends a ruling and this is not a
       second one.

       `by: "carried"` so the transcript does not imply somebody
       invented these thirty seconds ago. */
    if (carried.length && g && g.warden && g.warden.rule) {
      for (const f of carried) {
        g.warden.rule(f.text, {
          scope: f.scope,
          subject: f.subject || undefined,
          room: f.room || undefined,
          by: "carried",
        });
      }
    }
    /* Stamped from the moment play actually begins, not from when
       somebody opened the lobby — half an hour of character
       creation is not half an hour of the session. */
    setEndsAt(sessionMins > 0 ? Date.now() + sessionMins * 60000 : 0);
    setPhase("play");
  }, [begin, sessionMins, carried, g]);

  React.useEffect(() => {
    if (!HOSTING) return;
    fetch("/net/info").then((r) => r.json()).then((i) => setJoinUrl(i.url)).catch(() => {});
  }, []);

  const quick = () => {
    const cls = CLASSES.teamster;
    start([makeCharacter({
      name: "PREGEN", cls: "teamster", stats: rollStats(),
      skills: [...cls.fixedSkills, "Piloting", "Rimwise", "Athletics", "First Aid"],
      loadout: Object.keys(mod.loadouts)[0],
      ...randomFlavour(),
    }, mod)]);
  };

  // Everything above is unchanged single-player behaviour. The host
  // bridge only opens a socket when this tab was asked to host.
  const rtc = useRtcHost({ enabled: HOSTING && remote });
  const net = useHost({
    g, mod, phase, lobby: roster, safety, enabled: HOSTING, peerWhispers,
    rtc: HOSTING && remote ? rtc : null,
    mode: tableMode,
    /* The director owns floor moves whenever it is running, so the
       host's own timer stands down rather than nudging in parallel.
       See `floorPolicy` in useHost. */
    floorPolicy: !directorOn,
    /* With the chair empty there is nobody to look at an approval
       queue, and a queue nothing drains is a table that never
       starts. Null in Warden mode, so the queue behaves exactly as
       it always has. */
    onAutoAccept: wardenless ? (entry) => acceptRef.current(entry) : null,
    onStart: wardenless ? () => startRef.current() : null,
  });

  /* An approved character gets a fresh id and its session bookkeeping
     cleared, then goes either into the lobby roster (no session yet) or
     straight into the live crew. Either way the phone that offered it is
     told which body is now theirs, so nobody has to hunt for their own
     character in a list of names. */
  const acceptSubmission = React.useCallback((entry) => {
    const pc = adoptCharacter(entry.character, newPcId());
    if (phase === "play") gRef.current.addCrewMember(pc);
    else setRoster((r) => [...r, pc]);
    net.resolveSubmission(entry, true, pc.id);
  }, [net, phase]);

  const beginFromLobby = React.useCallback(() => {
    if (!roster.length) return;
    start(roster);
  }, [roster, start]);

  acceptRef.current = acceptSubmission;
  startRef.current = React.useCallback(() => {
    /* The check that matters is not who asked but whether there is
       anybody to play. A phone tapping GO into an empty lobby does
       nothing rather than starting a session with no crew in it. */
    if (phase !== "lobby") return;
    const min = (mod.crewSize && mod.crewSize.min) || 1;
    if (rosterRef.current.length < min) return;
    start(rosterRef.current);
  }, [phase, mod, start]);
  rosterRef.current = roster;

  /* The spotlight is the one Move that needs a socket. The director
     names who; the host routes it; the ledger records that the floor
     was offered so the same player is not asked again in three
     minutes. Three things, in the one place that has all three. */
  const spotlightPc = React.useCallback((pcId, text) => {
    const clientId = net.claims[pcId];
    if (!clientId) return;
    net.spotlightPeer(clientId, pcId, text);
    if (gRef.current && gRef.current.floorNote) gRef.current.floorNote(pcId, "offer");
  }, [net]);

  const director = useDirector({
    g, mod,
    enabled: directorOn,
    auto: wardenless,
    safetyCall: net.safetyCall,
    onSpotlight: spotlightPc,
    /* The only correction the empty chair has. See the ledger in
       useDirector: with nobody to wave a suggestion away, a player
       waving off a move aimed at them is the whole feedback loop. */
    dispute: net.lastDispute,
    /* ...and the other half of it. A dispute can only ever be about
       a Move addressed to a named character, which excludes every
       atmosphere line, every NPC interruption, every clock and
       every callback — most of what a wardenless table actually
       hears. This is the correction for those, and it takes two
       people rather than one. See engine/objection.js. */
    objection: net.lastObjection,
    /* C.3, finally connected to something. Zero unless the table
       set a length in the lobby. */
    sessionEndsAt: endsAt,
  });

  /* ============================================================
     THE FLOOR, ARMED ONCE, FOR THE TABLES THAT NEED IT

     `floor.js` rule 6 is off by default, and the reason given is a
     table of four veterans who will resent it. That reasoning holds
     and is not being overturned — what it assumed was a person
     sitting there who would notice the problem and flip the switch,
     and in wardenless mode there is nobody, and the switch is behind
     a deck this device deliberately cannot reach.

     THE THRESHOLD, AND THE ARGUMENT IT REPLACES.

     This was five, on the reasoning that at four airtime broadly
     self-corrects and only five and six need help. That is a real
     argument and it may well be right — but it was written for a
     table with somebody in the chair who could notice and flip the
     switch, and the case here is the one where nobody can. The
     switch lives behind a deck this device deliberately cannot
     reach, so a wardenless four that does have a runaway player
     has no route to the fix at all.

     What tips it is the asymmetry of being wrong. Arming it on a
     four that did not need it costs a nine-second hold, once,
     only when somebody else is actually waiting, and the table can
     vote it off. Not arming it on a four that did need it costs a
     player their evening, silently, with no way to tell anybody.

     If your tables of four find it intrusive, this line is the
     whole of it — put it back to 5.

     ARMED ONCE, and the latch is the important half. A table that
     votes it off must stay off — an effect that re-armed on every
     render would overrule the room every ten seconds, which is worse
     than never having offered it. */
  const floorArmed = React.useRef(false);
  React.useEffect(() => {
    if (!wardenless || phase !== "play") return;
    if (floorArmed.current) return;
    if (crew.length < 4) return;
    floorArmed.current = true;
    if (g.warden && !(w.floor && w.floor.on)) g.warden.floor(true);
  }, [wardenless, phase, crew.length, g, w]);

  const distorted = HOSTING && phase === "play" ? distortionsActive({ crew }) : [];

  let screen;
  /* THE LOCK. In wardenless mode this device is the shared screen and
     nothing else — no board, no deck, no route to either. See the
     comment on `tableMode`.

     WITH PHONES, that shared screen is TableView: it holds no input
     because every input is in somebody's hand.

     WITHOUT PHONES it cannot be, because then there is nowhere left
     to type. A local wardenless table gets the ordinary play screen
     with the deck locked out of it — same lock, different surface.
     Sending a laptop-only table to TableView would hand them a
     beautiful display and no way to say anything to it. */
  if (wardenless && HOSTING && phase === "play" && crew.length) {
    screen = (
      <TableView
        g={g} peers={net.peers} spotlight={net.spotlight}
        safetyCall={net.safetyCall} vote={net.vote} distance={distance}
      />
    );
  } else if (HOSTING && view === "board") {
    screen = (
      <div className="join" style={{ maxWidth: 900 }}>
        {remote && <RemotePanel rtc={rtc} />}
        <Approvals
          queue={net.submissions}
          mod={mod}
          onAccept={acceptSubmission}
          onReject={(e) => net.resolveSubmission(e, false)}
        />
        <ClueBoard
          clues={w.clues}
          links={w.clueLinks}
          isWarden
          onPin={(t, k, o) => g.pinClue(t, k, o)}
          onResolve={(id, r) => g.setClueResolved(id, r)}
          onUnpin={(id) => g.unpinClue(id)}
          onLink={(a, b) => g.linkClues(a, b)}
          onUnlink={(id) => g.unlinkClues(id)}
        />

        {/* Player-to-player traffic, at whatever resolution the table
            agreed to. Shown here rather than in the Warden deck because
            it is a standing arrangement, not a lever pulled mid-scene. */}
        <div className="clue" style={{ display: "block", marginTop: 12 }}>
          <span className="clue-kind">between players</span>
          <div className="btn-row" style={{ margin: "6px 0" }}>
            {[
              ["open", "I see the text"],
              ["seen", "I see that it happened"],
              ["dark", "I see nothing"],
            ].map(([k, label]) => (
              <button key={k} type="button"
                className={`btn inline small ${peerWhispers === k ? "accent" : "ghost"}`}
                onClick={() => setPeerWhispers(k)}>
                <span>{label}</span>
              </button>
            ))}
          </div>
          <p className="clue-meta" style={{ margin: 0 }}>
            The relay applies this, not this screen — on "I see nothing"
            the words never reach this machine, so there is nothing here
            to leak. Agree it out loud before you start.
          </p>
          {net.peerLog && net.peerLog.length > 0 && (
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12 }}>
              {net.peerLog.slice(0, 8).map((m) => {
                const from = crew.find((c) => c.id === m.fromPcId);
                const to = crew.find((c) => c.id === m.toPcId);
                return (
                  <li key={m.id}>
                    {(from && from.name) || "someone"} → {(to && to.name) || "someone"}
                    {m.text ? `: ${m.text}` : " · said something"}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {distorted.length > 0 && (
          <div className="clue" style={{ display: "block", marginTop: 12 }}>
            <span className="sig sig-secret">Being lied to</span>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12 }}>
              {distorted.map((d) => (
                <li key={d.pcId}>{d.name} — {d.kinds.join(", ")}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  } else if (HOSTING && view === "table" && phase === "play" && crew.length) {
    screen = (
      <TableView
        g={g} peers={net.peers} spotlight={net.spotlight}
        safetyCall={net.safetyCall} vote={net.vote} distance={distance}
      />
    );
  } else if (w.ended) {
    screen = (
      <Ending
        mod={mod} w={w} crew={crew} feed={feed}
        onAgain={onRestart} onLibrary={onEject}
        campaignId={campaignId}
      />
    );
  } else if (phase === "lobby") {
    screen = (
      <Lobby
        mod={mod}
        peers={net.peers}
        submissions={net.submissions}
        roster={roster}
        joinUrl={joinUrl}
        onAccept={acceptSubmission}
        onReject={(e) => net.resolveSubmission(e, false)}
        onDrop={(id) => setRoster((r) => r.filter((c) => c.id !== id))}
        onBegin={beginFromLobby}
        wardenless={wardenless}
        ready={net.ready}
        onDeskCreate={() => setPhase("create")}
        onBack={() => setPhase("title")}
        safety={safety}
        onSafety={setSafety}
        sessionMins={sessionMins}
        onSessionMins={setSessionMins}
        campaignId={campaignId}
        onCampaign={chooseCampaign}
        onCarry={setCarried}
        remote={remote}
        onRemote={setRemote}
        rtc={rtc}
      />
    );
  } else if (phase === "title") {
    screen = (
      <>
        {crashOffer && (
          <div className="join" style={{ maxWidth: 640, marginBottom: 0 }}>
            <div className="note-box">
              <strong>There is a table here that did not finish.</strong>
              <div style={{ margin: "6px 0" }}>{crashOffer.text} · {crashOffer.crew}</div>
              <div className="btn-row">
                <button type="button" className="btn inline small accent" onClick={resumeTable}>
                  Put it back
                </button>
                <button type="button" className="btn inline small ghost" onClick={dismissCrashMat}>
                  Start fresh
                </button>
              </div>
              <p className="clue-meta" style={{ margin: "6px 0 0" }}>
                {crashOffer.stale
                  ? "This is old enough to be last week's session. Check before you press it."
                  : "The phones will reattach to the same characters on their own."}
              </p>
            </div>
          </div>
        )}
        <TitleSequence
          mod={mod}
          onBegin={() => setPhase("create")}
          onGather={HOSTING ? () => { setTableMode("warden"); setPhase("lobby"); } : null}
          /* THE THIRD DOOR. When this tab is already hosting we just go
             to the lobby with the transport switched over. When it is
             not — the published build, a file on disk, vite dev — we
             cannot setState our way into host mode, because HOSTING was
             decided at load. So we navigate, and REMOTE_DOOR picks it up
             on the other side. Same page, one reload, no server. */
          onRemote={() => {
            if (HOSTING) { setRemote(true); setTableMode("warden"); setPhase("lobby"); return; }
            const q = new URLSearchParams(location.search);
            q.set("mode", "host");
            q.set("remote", "1");
            location.search = q.toString();
          }}
          /* The empty chair, offered beside the Warden's own door
             rather than buried in a setting. It is a different kind
             of evening, not a preference. */
          onGatherAlone={() => {
            setTableMode("wardenless");
            /* With a socket there is a lobby to run — phones to
               approve, a session length to agree. Without one there
               is nobody to wait for, so it goes straight to making
               the crew. */
            setPhase(HOSTING ? "lobby" : "create");
          }}
          onQuick={quick}
          onBack={onEject}
        />
      </>
    );
  } else if (phase === "create") {
    screen = <Creator mod={mod} onDone={start} onBack={() => setPhase("title")} />;
  } else {
    screen = <Play g={g} core={core} onQuit={onEject} net={HOSTING ? net : null} wardenless={wardenless} />;
  }

  return (
    <ThemeProvider theme={mod.theme} treatment={mod.theme.treatment} feedStyles={mod.feedStyles}>
      <ErrorBoundary mod={mod} onEject={onEject}>
        {HOSTING && (
          <HostBar
            view={view} onView={wardenless ? null : setView} status={net.status} peers={net.peers} crew={crew}
            pending={net.submissions.length} distorted={distorted.length}
            activity={net.activity}
            onWhisper={net.whisper}
            /* Null with the chair empty — there is no assistance to
               turn off when the director is not assisting anybody. */
            assist={wardenless ? null : assist}
            onAssist={toggleAssist}
            distance={distance} onDistance={chooseDistance}
            onJoinCard={() => setJoinCard(true)}
          />
        )}
        {/* THE ONLY CONTROL THE VOICE GETS.

            One button, on the device that is doing the speaking, in
            reach for the whole session. A voice you cannot stop
            immediately is a voice a table will never turn on in the
            first place — so it is deliberately not buried in a
            settings panel two taps away. Hidden entirely where the
            browser has no synthesiser, rather than offered and then
            doing nothing. */}
        {voice.available && phase === "play" && (
          <button
            className="voice-toggle"
            aria-pressed={voiceOn}
            title={voiceOn ? "Stop reading the feed aloud" : "Read the feed aloud"}
            onClick={() => setVoiceOn((v) => !v)}>
            {voiceOn ? "VOICE ON" : "VOICE OFF"}
          </button>
        )}
        {screen}
        {/* Over the top of every phase, because the phone that needs
            it is as likely to be one that dropped in act two as one
            that never joined. */}
        {HOSTING && joinCard && (
          <JoinCard
            peers={net.peers}
            expected={crew.length}
            onClose={() => setJoinCard(false)}
          />
        )}
        {/* Anonymous by construction — see server/host.mjs. There is
            nothing on this card that could identify anybody, because
            nothing that could ever reached this process. */}
        {/* Assisted mode only. With the chair empty the Moves are
            taken rather than proposed, so there is nothing to show
            and nobody to show it to. */}
        {directorOn && !wardenless && (
          <DirectorStrip
            move={director.move} mod={mod} crew={crew}
            onTake={director.take} onDismiss={director.dismiss}
            vetoes={director.vetoes} limit={director.VETO_LIMIT}
          />
        )}
        {/* THE ALERT STAYS, BUT ONLY WHERE THERE IS SOMEBODY TO READ IT.

            With a Warden, the card is addressed to one person who then
            does something human, and this is their copy of it. With
            the chair empty this device is the middle of the table, and
            a clear button sitting there would mean whoever reached for
            it was visibly the person handling it — so clearing lives
            on the phones instead, where it identifies nobody. The
            table screen shows the pause without the button. */}
        {HOSTING && !wardenless && (
          <SafetyAlert call={net.safetyCall} onClear={net.clearSafety} />
        )}
        {/* Asked for a promise this table cannot keep. Reported rather
            than absorbed — see allowedPeerMode. */}
        {HOSTING && net.peerDowngrade && (
          <div className="net-strip is-notice" role="status">
            Player whispers are set to <strong>{net.peerDowngrade.granted}</strong>, not{" "}
            {net.peerDowngrade.asked}: with nobody in the Warden&apos;s chair the messages
            pass through a device belonging to somebody at this table, and we will not
            attach that promise to it.
          </div>
        )}
      </ErrorBoundary>
    </ThemeProvider>
  );
}
