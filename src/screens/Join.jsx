/* ============================================================
   JOIN — the first thing a phone sees. Name, then pick a body.
   ============================================================ */
import React, { useState } from "react";
import { Panel, Btn, Field } from "../ui/kit.jsx";

export default function Join({ snapshot, peers, myName, onName, onClaim, status }) {
  const [draft, setDraft] = useState(myName || "");
  const state = snapshot && snapshot.state;
  const crew = (state && state.crew) || [];
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

  if (!crew.length) {
    return (
      <div className="join">
        <Panel title="Waiting for the Warden">
          <p>
            {status === "open"
              ? "Connected. The session hasn't started yet — this screen will fill in on its own."
              : "Looking for the table…"}
          </p>
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
          return (
            <button
              key={c.id}
              className={`join-pc${owner || dead ? " is-taken" : ""}`}
              disabled={!!owner || dead}
              onClick={() => onClaim(c.id)}
            >
              <span className="join-pc-name">{c.name}</span>
              <span className="join-pc-cls">{c.cls}</span>
              <span className="join-pc-state">
                {dead ? "deceased" : owner ? `taken by ${owner}` : "free"}
              </span>
            </button>
          );
        })}
      </Panel>
    </div>
  );
}
