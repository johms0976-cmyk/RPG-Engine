/* ============================================================
   CLIENT SHELL — everything a phone runs.

   Connect, name yourself, claim a character, then hand the
   remote game object straight to the ordinary Play screen.
   ============================================================ */
import React, { useState, useCallback, useEffect } from "react";
import { useSocket } from "./useSocket.js";
import { useRemoteGame } from "./useRemoteGame.js";
import { newClientId } from "./protocol.js";
import Join from "../screens/Join.jsx";
import Play from "../screens/Play.jsx";
import Ending from "../screens/Ending.jsx";
import { ThemeProvider, Panel } from "../ui/kit.jsx";
import ErrorBoundary from "../ui/ErrorBoundary.jsx";
import MODULES from "../modules/index.js";
import "../ui/theme.css";
import "../ui/art.css";
import "./net.css";

const KEY = "mothership:table";
const remember = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } };
const recall = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };

export default function ClientShell() {
  const saved = recall();
  const [clientId] = useState(saved.clientId || newClientId());
  const [name, setName] = useState(saved.name || "");
  const [pcId, setPcId] = useState(saved.pcId || null);
  const [snapshot, setSnapshot] = useState(null);
  const [peers, setPeers] = useState([]);
  const [notice, setNotice] = useState(null);

  const onMessage = useCallback((msg) => {
    if (msg.t === "snapshot") setSnapshot(msg);
    else if (msg.t === "peers") setPeers(msg.peers || []);
    else if (msg.t === "hostgone") setNotice("The Warden's screen has gone. Waiting for it to come back…");
    else if (msg.t === "denied") {
      const why = {
        full: "The table is full.",
        taken: "Somebody else just took that character.",
        "not-yours": "That isn't your character.",
        "not-your-turn": "Not your turn yet.",
        dead: "That character is out of the game.",
      }[msg.reason] || msg.reason;
      setNotice(why);
      if (msg.reason === "taken") setPcId(null);
    }
  }, []);

  const { status, send } = useSocket(null, onMessage);

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

  const claim = useCallback((id) => { setPcId(id); send({ t: "claim", pcId: id }); }, [send]);
  const g = useRemoteGame(snapshot, pcId, send);

  const mod = MODULES.find((m) => m.id === (snapshot && snapshot.modId)) || MODULES[0];
  const banner = (
    <>
      {status !== "open" && <div className="net-strip is-down">Reconnecting…</div>}
      {notice && <div className="net-strip is-notice">{notice}</div>}
    </>
  );

  let body;
  if (!pcId || !g) {
    body = (
      <Join
        snapshot={snapshot}
        peers={peers}
        myName={name}
        status={status}
        onName={setName}
        onClaim={claim}
      />
    );
  } else if (g.w.ended) {
    body = <Ending mod={g.mod} w={g.w} crew={g.crew} feed={g.feed} onAgain={() => {}} onLibrary={() => setPcId(null)} />;
  } else if (!g.pc) {
    body = (
      <div className="join">
        <Panel title="You're out">
          <p>Your character is no longer in play. The Warden can bring in someone new.</p>
          <button onClick={() => setPcId(null)}>Pick another</button>
        </Panel>
      </div>
    );
  } else {
    body = <Play g={g} onQuit={() => setPcId(null)} />;
  }

  return (
    <ThemeProvider theme={mod.theme} treatment={mod.theme.treatment}>
      <ErrorBoundary mod={mod} onEject={() => setPcId(null)}>
        {banner}
        {body}
      </ErrorBoundary>
    </ThemeProvider>
  );
}
