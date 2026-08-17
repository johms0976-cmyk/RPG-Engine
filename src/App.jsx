import React, { useState, useCallback } from "react";
import MODULES from "./modules/index.js";
import { ThemeProvider } from "./ui/kit.jsx";
import ErrorBoundary from "./ui/ErrorBoundary.jsx";
import { useGame } from "./engine/useGame.js";
import { makeCharacter, rollStats, randomFlavour, CLASSES } from "./engine/rules.js";
import Library from "./screens/Library.jsx";
import Title from "./screens/Title.jsx";
import Creator from "./screens/Creator.jsx";
import Play from "./screens/Play.jsx";
import Ending from "./screens/Ending.jsx";
import WardenTools from "./screens/WardenTools.jsx";
import { settings as loadSettings, load as loadSave } from "./engine/storage.js";
import "./ui/theme.css";

const DEFAULT_THEME = MODULES[0].theme;

export default function App() {
  const [slot, setSlot] = useState(null);
  const [tools, setTools] = useState(false);
  const [run, setRun] = useState(0);

  if (tools) {
    return (
      <ThemeProvider theme={DEFAULT_THEME}>
        <ErrorBoundary onEject={() => setTools(false)}>
          <WardenTools onBack={() => setTools(false)} />
        </ErrorBoundary>
      </ThemeProvider>
    );
  }

  if (!slot) {
    return (
      <ThemeProvider theme={DEFAULT_THEME}>
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
  const g = useGame(mod, { ...loadSettings(), slot: slotName });
  const { begin, w, crew, feed } = g;

  const started = React.useRef(false);
  React.useEffect(() => {
    if (resume && !started.current) { started.current = true; begin(null, resume); }
  }, [resume, begin]);

  const start = useCallback((newCrew) => { begin(newCrew); setPhase("play"); }, [begin]);

  const quick = () => {
    const cls = CLASSES.teamster;
    start([makeCharacter({
      name: "PREGEN", cls: "teamster", stats: rollStats(),
      skills: [...cls.fixedSkills, "Piloting", "Rimwise", "Athletics", "First Aid"],
      loadout: Object.keys(mod.loadouts)[0],
      ...randomFlavour(),
    }, mod)]);
  };

  let screen;
  if (w.ended) {
    screen = <Ending mod={mod} w={w} crew={crew} feed={feed} onAgain={onRestart} onLibrary={onEject} />;
  } else if (phase === "title") {
    screen = <Title mod={mod} onBegin={() => setPhase("create")} onQuick={quick} onBack={onEject} />;
  } else if (phase === "create") {
    screen = <Creator mod={mod} onDone={start} onBack={() => setPhase("title")} />;
  } else {
    screen = <Play g={g} onQuit={onEject} />;
  }

  return (
    <ThemeProvider theme={mod.theme}>
      <ErrorBoundary mod={mod} onEject={onEject}>{screen}</ErrorBoundary>
    </ThemeProvider>
  );
}
