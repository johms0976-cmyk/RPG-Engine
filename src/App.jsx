import React, { useState, useCallback } from "react";
import MODULES from "./modules/index.js";
import { ThemeProvider } from "./ui/kit.jsx";
import { useGame } from "./engine/useGame.js";
import { makeCharacter, rollStats, randomFlavour } from "./engine/rules.js";
import Library from "./screens/Library.jsx";
import Title from "./screens/Title.jsx";
import Creator from "./screens/Creator.jsx";
import Play from "./screens/Play.jsx";
import Ending from "./screens/Ending.jsx";
import { settings as loadSettings } from "./engine/storage.js";

const DEFAULT_THEME = MODULES[0].theme;

export default function App() {
  const [slot, setSlot] = useState(null);
  const [run, setRun] = useState(0);
  if (!slot) return <ThemeProvider theme={DEFAULT_THEME}><Shelf onPick={(s) => { setRun((r) => r + 1); setSlot(s); }} /></ThemeProvider>;
  return (
    <Cartridge
      key={`${slot.mod.id}:${run}`}
      mod={slot.mod}
      resume={slot.resume}
      onEject={() => setSlot(null)}
      onRestart={() => { setSlot({ mod: slot.mod }); setRun((r) => r + 1); }}
    />
  );
}

function Shelf({ onPick }) {
  return (
    <Library
      modules={MODULES}
      onPick={(m) => onPick({ mod: m })}
      onResume={(m, saved) => onPick({ mod: m, resume: saved })}
    />
  );
}

/** One loaded module. Remounting this is how "eject and reload" works. */
function Cartridge({ mod, resume, onEject, onRestart }) {
  const [phase, setPhase] = useState(resume ? "play" : "title");
  const g = useGame(mod, loadSettings());
  const { begin, w, pc } = g;

  const started = React.useRef(false);
  React.useEffect(() => {
    if (resume && !started.current) { started.current = true; begin(null, resume); }
  }, [resume, begin]);

  const start = useCallback((character) => { begin(character); setPhase("play"); }, [begin]);

  const quick = () => start(makeCharacter({
    name: "PREGEN", cls: "teamster", stats: rollStats(),
    skills: ["Zero-G", "Mechanical Repair", "Piloting"], loadout: Object.keys(mod.loadouts)[0],
    ...randomFlavour(),
  }, mod));

  let screen;
  if (w.ended) {
    screen = <Ending mod={mod} w={w} pc={pc} onAgain={onRestart} onLibrary={onEject} />;
  } else if (phase === "title") {
    screen = <Title mod={mod} onBegin={() => setPhase("create")} onQuick={quick} onBack={onEject} />;
  } else if (phase === "create") {
    screen = <Creator mod={mod} onDone={start} onBack={() => setPhase("title")} />;
  } else {
    screen = <Play g={g} onQuit={onEject} />;
  }
  return <ThemeProvider theme={mod.theme}>{screen}</ThemeProvider>;
}
