import React, { useState, useCallback } from "react";
import MODULES from "./modules/index.js";
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
import HostBar from "./net/HostBar.jsx";
import TableView from "./screens/TableView.jsx";
import Approvals from "./screens/Approvals.jsx";
import Lobby from "./screens/Lobby.jsx";
import ClueBoard from "./ui/ClueBoard.jsx";
import { adoptCharacter } from "./engine/portable.js";
import { newPcId } from "./engine/rules.js";
import { distortionsActive } from "./net/distort.js";
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
            modules={MODULES}
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
  const net = useHost({ g, mod, phase, lobby: roster, enabled: HOSTING });

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
        <Approvals
          queue={net.submissions}
          mod={mod}
          onAccept={acceptSubmission}
          onReject={(e) => net.resolveSubmission(e, false)}
        />
        <ClueBoard
          clues={w.clues}
          isWarden
          onPin={(t, k, o) => g.pinClue(t, k, o)}
          onResolve={(id, r) => g.setClueResolved(id, r)}
          onUnpin={(id) => g.unpinClue(id)}
        />
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
    screen = <TableView g={g} peers={net.peers} />;
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
      />
    );
  } else if (phase === "title") {
    screen = (
      <TitleSequence
        mod={mod}
        onBegin={() => setPhase("create")}
        onGather={HOSTING ? () => setPhase("lobby") : null}
        onQuick={quick}
        onBack={onEject}
      />
    );
  } else if (phase === "create") {
    screen = <Creator mod={mod} onDone={start} onBack={() => setPhase("title")} />;
  } else {
    screen = <Play g={g} core={core} onQuit={onEject} />;
  }

  return (
    <ThemeProvider theme={mod.theme} treatment={mod.theme.treatment}>
      <ErrorBoundary mod={mod} onEject={onEject}>
        {HOSTING && (
          <HostBar
            view={view} onView={setView} status={net.status} peers={net.peers} crew={crew}
            pending={net.submissions.length} distorted={distorted.length}
            onWhisper={net.whisper}
          />
        )}
        {screen}
      </ErrorBoundary>
    </ThemeProvider>
  );
}
