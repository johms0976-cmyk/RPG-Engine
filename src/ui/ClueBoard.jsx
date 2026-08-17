/* ============================================================
   CLUE BOARD — what the crew actually knows.

   Separate from the feed on purpose. The feed is what happened;
   this is what it meant, and it does not scroll away.
   ============================================================ */
import React, { useState } from "react";
import { Panel, Btn, Field } from "./kit.jsx";
import { CLUE_KINDS, visibleClues } from "../engine/board.js";

export default function ClueBoard({ clues, isWarden = false, onPin, onResolve, onUnpin, canWrite = true }) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState("fact");
  const [secret, setSecret] = useState(false);
  const list = visibleClues(clues, isWarden);

  const pin = () => {
    if (!text.trim()) return;
    onPin && onPin(text.trim(), kind, { secret: isWarden && secret });
    setText("");
    setSecret(false);
  };

  return (
    <Panel title={`What we know${list.length ? ` · ${list.filter((c) => !c.resolved).length} open` : ""}`}>
      {canWrite && (
        <div className="stack" style={{ marginBottom: 12 }}>
          <Field label="Pin something">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && pin()}
              maxLength={240}
              placeholder="Door code 4471. Hall says don't trust Voss."
            />
          </Field>
          <div className="btn-row">
            {Object.entries(CLUE_KINDS).map(([k, v]) => (
              <Btn key={k} kind={kind === k ? "accent" : "ghost"} className="inline small"
                title={v.blurb} onClick={() => setKind(k)}>
                {v.label}
              </Btn>
            ))}
            {isWarden && (
              <Btn kind={secret ? "danger" : "ghost"} className="inline small"
                title="Only you will see this" onClick={() => setSecret((s) => !s)}>
                {secret ? "Warden only" : "Public"}
              </Btn>
            )}
            <Btn kind="primary" className="inline small" disabled={!text.trim()} onClick={pin}>Pin</Btn>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <p style={{ opacity: 0.6, margin: 0 }}>Nothing established yet.</p>
      ) : (
        <div className="clues">
          {list.map((c) => (
            <div key={c.id} className={`clue${c.resolved ? " is-resolved" : ""}`}>
              <span className="clue-kind">{c.secret ? "warden" : CLUE_KINDS[c.kind].label}</span>
              <span className="clue-text">{c.text}</span>
              <span className="clue-meta">
                {c.by ? `${c.by}` : "the Warden"}{c.room ? ` · ${c.room}` : ""}
              </span>
              <span className="clue-actions">
                <Btn kind="ghost" className="inline small"
                  title={c.resolved ? "Put it back on the board" : "Dealt with"}
                  onClick={() => onResolve && onResolve(c.id, !c.resolved)}>
                  {c.resolved ? "↺" : "✓"}
                </Btn>
                {isWarden && (
                  <Btn kind="ghost" className="inline small" title="Remove" onClick={() => onUnpin && onUnpin(c.id)}>×</Btn>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
