import React from "react";
import { Panel, Btn, Label } from "../ui/kit.jsx";

export default function Title({ mod, onBegin, onQuick, onBack }) {
  return (
    <div className="center-screen">
      <div style={{ width: "100%", maxWidth: 620 }} className="stack">
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.22em", color: "var(--accent)" }}>
            {mod.subtitle}
          </div>
          <h1 style={{ fontFamily: "var(--display)", fontSize: 44, fontWeight: 700, letterSpacing: "0.06em",
            color: "var(--bone)", margin: "8px 0 0", lineHeight: 0.98 }}>
            {mod.title}
          </h1>
          {mod.byline && (
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--graphite)", marginTop: 10 }}>
              {mod.byline}
            </div>
          )}
        </div>

        <Panel>
          <div className="stack">
            {mod.pitch.map((p, i) => (
              <p key={i} style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55 }}>{p}</p>
            ))}
          </div>
        </Panel>

        {mod.contentWarning && (
          <div className="warn-box" role="note">
            <strong>Before you start.</strong> {mod.contentWarning}
          </div>
        )}

        <div className="btn-grid">
          <Btn kind="accent" onClick={onBegin}>Assemble a crew</Btn>
          <Btn kind="ghost" onClick={onQuick} hint="one pregenerated teamster">Skip creation and play</Btn>
          <Btn kind="ghost" onClick={onBack}>Back to the shelf</Btn>
        </div>

        <div className="note-box">
          Everything runs on this machine. There is no Warden model, no request, and no token
          cost. Free text goes to a local parser first, and to an oracle if the parser can't
          place it.
        </div>
      </div>
    </div>
  );
}
