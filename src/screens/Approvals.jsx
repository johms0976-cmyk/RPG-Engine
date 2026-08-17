/* ============================================================
   APPROVALS — characters offered from phones, waiting on the
   Warden.

   The validator catches accidents and clumsy edits. It cannot
   catch a determined cheat, because a careful forger can always
   produce a file that decomposes correctly. That is exactly why
   this screen exists: every import lands here regardless of what
   the validator said, and a person decides.
   ============================================================ */
import React from "react";
import { Panel, Btn } from "../ui/kit.jsx";
import { validateCharacter, summarise } from "../engine/validate.js";

const LEVEL_LABEL = { error: "impossible", suspect: "unusual", note: "worth a look" };

export default function Approvals({ queue, mod, onAccept, onReject }) {
  if (!queue || !queue.length) {
    return (
      <Panel title="Characters offered">
        <p style={{ opacity: 0.6, margin: 0 }}>
          Nothing waiting. Anything a player builds or imports on their phone arrives here first.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title={`Characters offered · ${queue.length}`}>
      <div className="stack">
        {queue.map((entry) => {
          const result = validateCharacter(entry.character, { modules: mod });
          const pc = entry.character.pc;
          const h = entry.character.history || {};
          return (
            <div key={entry.id} className="clue" style={{ display: "block" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong>{pc.name}</strong>
                <span className="clue-meta">from {entry.from || "a phone"}</span>
              </div>

              <div className="clue-meta" style={{ marginTop: 4 }}>
                {pc.cls} · level {pc.level || 0} ·
                {" "}STR {pc.stats.strength} SPD {pc.stats.speed} INT {pc.stats.intellect} CBT {pc.stats.combat}
              </div>
              <div className="clue-meta">
                {(pc.skills || []).join(", ") || "no skills"}
              </div>
              {h.sessions > 0 && (
                <div className="clue-meta">
                  {h.sessions} session{h.sessions === 1 ? "" : "s"} ·
                  {" "}{h.panics} panic{h.panics === 1 ? "" : "s"}
                  {h.witnessed && h.witnessed.length > 0 && ` · watched ${h.witnessed.join(", ")} die`}
                </div>
              )}

              <div style={{ marginTop: 8 }}>
                <span className={`sig ${result.ok ? "sig-adv" : "sig-dis"}`}>{summarise(result)}</span>
              </div>

              {result.findings.length > 0 && (
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12, opacity: 0.85 }}>
                  {result.findings.map((f, i) => (
                    <li key={i}>
                      <strong>{LEVEL_LABEL[f.level]}</strong> · {f.detail}
                    </li>
                  ))}
                </ul>
              )}

              <div className="btn-row" style={{ marginTop: 10 }}>
                <Btn kind="primary" className="inline small" onClick={() => onAccept(entry)}>
                  {result.ok ? "Let them in" : "Let them in anyway"}
                </Btn>
                <Btn kind="danger" className="inline small" onClick={() => onReject(entry)}>Send back</Btn>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
