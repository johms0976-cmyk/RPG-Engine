/* ============================================================
   WAITING ON — the desk-side answer to "is anyone stuck?".

   The activity ticker says what just happened. It does not say
   what is *not* happening, and that is the more useful half:

     · somebody blocked behind another player's roll is the
       reason the table has gone quiet, and it is completely
       invisible from the Warden's chair
     · somebody idle for four minutes has stopped playing and
       started reading their phone, which is the cue to look at
       them — the one thing the Spotlight exists for and the one
       thing nothing prompts you to use

   All of it is derived host-side by waitingRoom() in protocol.js
   from state that already exists. Nothing new is maintained.
   ============================================================ */
import React from "react";
import { Btn, Label } from "../../ui/kit.jsx";
import { WAIT_TEXT } from "../../engine/tempo.js";

const STATE_LABEL = {
  acting: "acting",
  rolling: "rolling",
  blocked: "blocked",
  held: "held",
  idle: "idle",
  open: "free",
  out: "out of the game",
};

const mins = (ms) => (ms == null ? null : `${Math.floor(ms / 60000)}m`);

/* `sound` and `whispers` are the two panels that used to be tabs
   of their own. Both are things done *to the phones at the table*,
   which is what this tab already means — a Warden hunting for
   "make Riley's handset knock" should not have to remember which
   of three tabs owns the phones. They arrive as elements rather
   than as imports so this file stays a reader of state and the
   deck keeps owning what a lever is. */
export default function TableTab({ g, net, sound, whispers }) {
  const { crew } = g;
  const waiting = (net && net.waiting) || {};
  const peers = (net && net.peers) || [];

  if (!net) {
    return <p className="clue-meta">This panel reads the phones. Host a session to use it.</p>;
  }

  const peerFor = (pcId) => peers.find((p) => p.pcId === pcId) || null;

  return (
    <div className="stack">
      <Label>WHO IS WAITING ON WHAT</Label>
      <div className="waiting">
        {crew.map((c) => {
          const st = waiting[c.id] || { state: c.alive === false ? "out" : "open" };
          const peer = peerFor(c.id);
          const blocker = st.by && crew.find((x) => x.id === st.by);
          return (
            <div key={c.id} className={`waiting-row is-${st.state}`}>
              <span className="waiting-who">
                <strong>{c.name}</strong>
                <i>{peer ? peer.name : "no phone"}</i>
              </span>

              <span className="waiting-state">
                {STATE_LABEL[st.state] || st.state}
                {st.state === "blocked" && blocker ? ` by ${blocker.name}` : ""}
                {st.state === "held" && st.why ? ` · ${WAIT_TEXT[st.why] || st.why}` : ""}
              </span>

              <span className="waiting-since">
                {st.since != null && st.since > 60000 ? `quiet ${mins(st.since)}` : ""}
              </span>

              {peer && (
                <Btn kind={st.state === "idle" ? "accent" : "ghost"} className="inline small"
                  title="Buzz their phone and mark them on the table screen"
                  onClick={() => net.spotlightPeer(peer.clientId, c.id)}>
                  Look at them
                </Btn>
              )}
            </div>
          );
        })}
      </div>

      <p className="clue-meta" style={{ margin: 0 }}>
        <strong>blocked</strong> means the whole table is queued behind one
        prompt — usually the reason it has gone quiet.{" "}
        <strong>idle</strong> means four minutes without acting, which is
        rarely a decision.
      </p>
    
      {sound && (
        <>
          <hr className="rule" />
          {sound}
        </>
      )}

      {whispers && (
        <>
          <hr className="rule" />
          {whispers}
        </>
      )}
</div>
  );
}
