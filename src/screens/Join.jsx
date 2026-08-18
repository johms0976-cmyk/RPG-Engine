/* ============================================================
   JOIN — the first thing a phone sees. Name, then pick a body.
   ============================================================ */
import React, { useState } from "react";
import { Panel, Btn, Field } from "../ui/kit.jsx";

export default function Join({
  snapshot, peers, myName, onName, onClaim, onLocker, onBuild, status, phase, claiming, myPcId,
}) {
  const [draft, setDraft] = useState(myName || "");
  const state = snapshot && snapshot.state;
  const crew = (state && state.crew) || [];
  const lobby = (snapshot && snapshot.lobby) || [];
  const taken = Object.fromEntries((peers || []).filter((p) => p.pcId).map((p) => [p.pcId, p.name]));

  if (!myName) {
    return (
      <div className="join">
        <Panel title="Join the table">
          <Field label="Your name">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={24}
              placeholder="Sam"
              autoFocus
            />
          </Field>
          <Btn kind="primary" disabled={!draft.trim()} onClick={() => onName(draft.trim())}>
            Continue
          </Btn>
        </Panel>
      </div>
    );
  }

  /* No crew yet means no session yet. What the player should do about
     that depends entirely on where the Warden is, and the snapshot has
     been carrying that all along — it just wasn't being read. */
  if (!crew.length) {
    const gathering = phase === "lobby";
    /* Already approved, just nothing to play yet. Without this the
       player is shown "build a character" again and cheerfully builds a
       second one, which the Warden then has to reject. */
    const mine = myPcId && lobby.find((c) => c.id === myPcId);
    if (mine) {
      return (
        <div className="join">
          <Panel title="You're in">
            <div className="stack">
              <div className="wait-mark" aria-hidden="true"><i /><i /><i /></div>
              <p style={{ margin: 0 }}>
                <strong>{mine.name}</strong> is at the table. The game starts when
                the Warden says so.
              </p>
              {lobby.length > 1 && (
                <div className="note-box">
                  With you: {lobby.filter((c) => c.id !== myPcId).map((c) => c.name).join(" · ")}
                </div>
              )}
              <p className="clue-meta" style={{ margin: 0 }}>
                Nothing to do — this screen changes on its own.
              </p>
            </div>
          </Panel>
        </div>
      );
    }
    return (
      <div className="join">
        <Panel title={gathering ? "The table is gathering" : "Waiting for the Warden"}>
          <div className="stack">
            <p style={{ margin: 0 }}>
              {status !== "open"
                ? "Looking for the table…"
                : gathering
                  ? "Build a character now. It goes to the Warden for a look, and the game starts once everyone's in."
                  : "Connected. The Warden hasn't opened the table yet — this screen will change on its own when they do."}
            </p>

            {lobby.length > 0 && (
              <div className="note-box">
                Already in: {lobby.map((c) => c.name).join(" · ")}
              </div>
            )}

            <div className="btn-grid">
              {onBuild && (
                <Btn kind={gathering ? "accent" : "primary"} onClick={onBuild}>
                  Build a character
                </Btn>
              )}
              {onLocker && <Btn kind="ghost" onClick={onLocker}>Bring one of your own</Btn>}
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="join">
      <Panel title="Pick your character">
        {crew.map((c) => {
          const owner = taken[c.id];
          const dead = c.alive === false;
          const mine = claiming === c.id;
          // While a claim is in the air every row is locked, not just the
          // one tapped: the answer might be that somebody beat you to it.
          const locked = !!owner || dead || !!claiming;
          return (
            <button
              key={c.id}
              className={`join-pc${locked ? " is-taken" : ""}${mine ? " is-claiming" : ""}`}
              disabled={locked}
              onClick={() => onClaim(c.id)}
            >
              <span className="join-pc-name">{c.name}</span>
              <span className="join-pc-cls">{c.cls}</span>
              <span className="join-pc-state">
                {mine ? "claiming…" : dead ? "deceased" : owner ? `taken by ${owner}` : "free"}
              </span>
            </button>
          );
        })}
        <div className="btn-row" style={{ marginTop: 10 }}>
          {onBuild && <Btn kind="ghost" onClick={onBuild}>Build a new one</Btn>}
          {onLocker && <Btn kind="ghost" onClick={onLocker}>Bring one of your own</Btn>}
        </div>
      </Panel>
    </div>
  );
}
