import React, { useState, useCallback } from "react";
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
import WardenTools from "./screens/WardenTools.jsx";
import { settings as loadSettings, load as loadSave } from "./engine/storage.js";
import { useCore } from "./react/useCore.js";
import { makeShip } from "./core/index.js";
import applyDemand from "./react/demands.js";
import audio from "./ui/audio.js";
import { useHost } from "./net/useHost.js";
import { useRtcHost } from "./net/useRtcHost.js";
import RemotePanel from "./net/RemotePanel.jsx";
import HostBar from "./net/HostBar.jsx";
import TableView from "./screens/TableView.jsx";
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

/** ?mode=host turns this tab into the authority for a LAN table.
    Without it the app behaves exactly as it always has. */
export const HOSTING = new URLSearchParams(location.search).get("mode") === "host";

export default function App() {
  const [slot, setSlot] = useState(null);
  const [tools, setTools] = useState(false);
  const [run, setRun] = useState(0);
  /* Modules loaded at runtime, read once and re-read whenever the shelf
     changes. Bundled modules win an id collision — see mergeModules. */
  const [shelf, setShelf] = useState(() => loadInstalled());
  const refreshShelf = useCallback(() => setShelf(loadInstalled()), []);
  const modules = React.useMemo(() => mergeModules(MODULES, shelf.mods), [shelf.mods]);

  if (tools) {
    return (
      <ThemeProvider theme={DEFAULT_THEME} treatment={DEFAULT_THEME.treatment}>
        <ErrorBoundary onEject={() => setTools(false)}>
          <WardenTools onBack={() => setTools(false)} />
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
  /* The table's transport, chosen by a person. Off means the LAN relay,
     exactly as before; on moves the routing into this tab so players
     can arrive from anywhere. Chosen, never inferred — see useSocket. */
  const [remote, setRemote] = useState(false);
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

  const start = useCallback((newCrew) => { begin(newCrew); setPhase("play"); }, [begin]);

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

  const distorted = HOSTING && phase === "play" ? distortionsActive({ crew }) : [];

  let screen;
  if (HOSTING && view === "board") {
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
    screen = <TableView g={g} peers={net.peers} spotlight={net.spotlight} />;
  } else if (w.ended) {
    screen = <Ending mod={mod} w={w} crew={crew} feed={feed} onAgain={onRestart} onLibrary={onEject} />;
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
        onDeskCreate={() => setPhase("create")}
        onBack={() => setPhase("title")}
        safety={safety}
        onSafety={setSafety}
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
          onGather={HOSTING ? () => setPhase("lobby") : null}
          onQuick={quick}
          onBack={onEject}
        />
      </>
    );
  } else if (phase === "create") {
    screen = <Creator mod={mod} onDone={start} onBack={() => setPhase("title")} />;
  } else {
    screen = <Play g={g} core={core} onQuit={onEject} net={HOSTING ? net : null} />;
  }

  return (
    <ThemeProvider theme={mod.theme} treatment={mod.theme.treatment} feedStyles={mod.feedStyles}>
      <ErrorBoundary mod={mod} onEject={onEject}>
        {HOSTING && (
          <HostBar
            view={view} onView={setView} status={net.status} peers={net.peers} crew={crew}
            pending={net.submissions.length} distorted={distorted.length}
            activity={net.activity}
            onWhisper={net.whisper}
          />
        )}
        {screen}
        {/* Anonymous by construction — see server/host.mjs. There is
            nothing on this card that could identify anybody, because
            nothing that could ever reached this process. */}
        {HOSTING && <SafetyAlert call={net.safetyCall} onClear={net.clearSafety} />}
      </ErrorBoundary>
    </ThemeProvider>
  );
}
