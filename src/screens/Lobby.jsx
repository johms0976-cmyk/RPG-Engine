/* ============================================================
   LOBBY — the table assembling, before there is a session.

   This is the step the engine was missing. The Warden could build
   a whole crew alone on the desk, or start a session and let phones
   claim bodies they had no hand in making — but there was nowhere
   for the ordinary thing to happen, which is five people sitting
   round a table making characters at the same time while the
   Warden watches them arrive.

   The Warden's job on this screen is to approve and to know when
   to start. Everything else is other people typing. So: who is
   connected and what they are doing, what is waiting on you, who
   is already in, and one button that goes when the module says
   there are enough of them.
   ============================================================ */
import React from "react";
import { Panel, Btn, Label } from "../ui/kit.jsx";
import Approvals from "./Approvals.jsx";

/** What a connected phone is doing right now, in the Warden's terms.
    Derived rather than reported: a phone that has claimed a character
    is playing it, a phone with an offer in the queue is waiting on
    you, anything else is still deciding. */
function peerState(peer, submissions, roster) {
  if (peer.pcId) {
    const pc = roster.find((c) => c.id === peer.pcId);
    return { kind: "in", label: pc ? pc.name : "in the crew" };
  }
  if (submissions.some((s) => s.clientId === peer.clientId)) {
    return { kind: "waiting", label: "waiting on you" };
  }
  return { kind: "building", label: "building…" };
}

export default function Lobby({
  mod, peers = [], submissions = [], roster = [],
  onAccept, onReject, onDrop, onBegin, onBack, onDeskCreate, joinUrl,
}) {
  const min = (mod.crewSize && mod.crewSize.min) || 1;
  const max = (mod.crewSize && mod.crewSize.max) || 6;
  const short = Math.max(0, min - roster.length);
  const full = roster.length >= max;

  return (
    <div className="lobby">
      <Panel title={`${mod.title} — gathering the table`}>
        <div className="stack">
          <p className="lobby-lede">
            Players join on their phones and build a character each. Everything
            they offer lands here for you to wave through or send back. Nothing
            starts until you say so.
          </p>
          {joinUrl && (
            <div className="note-box">
              Same wifi, then: <strong>{joinUrl.replace(/^https?:\/\//, "")}</strong>
              {" "}— or use Show QR in the bar above.
            </div>
          )}
        </div>
      </Panel>

      <div className="lobby-grid">
        <div className="stack">
          <Panel title={`Phones · ${peers.length}`}>
            {peers.length === 0 ? (
              <p className="clue-meta" style={{ margin: 0 }}>
                Nobody yet. They need to be on the same wifi and open the address above.
              </p>
            ) : (
              <ul className="lobby-peers">
                {peers.map((p) => {
                  const st = peerState(p, submissions, roster);
                  return (
                    <li key={p.clientId} className={`lobby-peer is-${st.kind}`}>
                      <span className="who">{p.name}</span>
                      <span className="what">{st.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title={`At the table · ${roster.length}`}>
            {roster.length === 0 ? (
              <p className="clue-meta" style={{ margin: 0 }}>
                Nobody approved yet. {min > 1 ? `This module wants at least ${min}.` : ""}
              </p>
            ) : (
              <ul className="lobby-roster">
                {roster.map((c) => (
                  <li key={c.id}>
                    <span className="who">{c.name}</span>
                    <span className="what">{c.cls}</span>
                    <Btn kind="ghost" className="inline small" onClick={() => onDrop(c.id)}>
                      Remove
                    </Btn>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="stack">
          <Approvals queue={submissions} mod={mod} onAccept={onAccept} onReject={onReject} />
        </div>
      </div>

      <div className="lobby-foot">
        {full && (
          <div className="warn-box">
            The table is full at {max}. Remove someone before letting another in.
          </div>
        )}
        <div className="btn-grid">
          <Btn kind="accent" disabled={short > 0} onClick={onBegin}>
            {short > 0
              ? `Need ${short} more character${short === 1 ? "" : "s"}`
              : `Begin with ${roster.length} character${roster.length === 1 ? "" : "s"}`}
          </Btn>
          {onDeskCreate && (
            <Btn kind="ghost" onClick={onDeskCreate}>
              Build the crew here instead
            </Btn>
          )}
          <Btn kind="ghost" onClick={onBack}>Back</Btn>
        </div>
        <div>
          <Label>Note</Label>
          <p className="clue-meta" style={{ margin: 0 }}>
            Anyone who turns up late can still build a character mid-session — it
            arrives on the Board tab and joins the crew when you approve it.
          </p>
        </div>
      </div>
    </div>
  );
}
