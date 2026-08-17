/* ============================================================
   LOCKER — your own characters, on your own phone.

   Export as a file, or as a QR code so one phone can hand a
   character to another with no server involved at all.
   ============================================================ */
import React, { useState, useRef } from "react";
import { Panel, Btn, Modal } from "../ui/kit.jsx";
import { listCharacters, forget, importText, stash } from "../engine/locker.js";
import { exportCharacter, toJson, toFileName, toCompact, fromCompact } from "../engine/portable.js";
import { downloadText } from "../engine/storage.js";
import { validateCharacter, summarise } from "../engine/validate.js";
import QRCanvas from "../ui/QRCanvas.jsx";

export default function Locker({ onUse, onBack, busyLabel = "Use this character" }) {
  const [items, setItems] = useState(() => listCharacters());
  const [showing, setShowing] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const refresh = () => setItems(listCharacters());

  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const text = await f.text();
    const r = importText(text);
    if (!r.ok) setError(r.error);
    else { setError(null); refresh(); }
    e.target.value = "";
  };

  const save = (file) => downloadText(toFileName(file.pc), toJson(file), "application/json");

  return (
    <div className="join">
      <Panel title="Your characters">
        {error && <p className="sig sig-dis" style={{ display: "block", marginBottom: 10 }}>{error}</p>}

        {items.length === 0 ? (
          <p style={{ opacity: 0.6 }}>
            Nothing here yet. Build one, or import a file somebody sent you.
          </p>
        ) : (
          <div className="clues">
            {items.map((it) => {
              const v = validateCharacter(it.file);
              return (
                <div key={it.key} className="clue" style={{ display: "block" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <strong>{it.name}</strong>
                    <span className="clue-meta">{it.cls} · lvl {it.level}</span>
                  </div>
                  <div className="clue-meta">
                    {it.sessions} session{it.sessions === 1 ? "" : "s"}
                    {!it.alive && " · deceased"}
                    {" · "}{summarise(v)}
                  </div>
                  <div className="btn-row" style={{ marginTop: 8 }}>
                    {onUse && it.alive && (
                      <Btn kind="primary" className="inline small" onClick={() => onUse(it.file)}>{busyLabel}</Btn>
                    )}
                    <Btn kind="ghost" className="inline small" onClick={() => save(it.file)}>Save file</Btn>
                    <Btn kind="ghost" className="inline small" onClick={() => setShowing(it.file)}>Hand over</Btn>
                    <Btn kind="danger" className="inline small"
                      onClick={() => { forget(it.key); refresh(); }}>Delete</Btn>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="btn-row" style={{ marginTop: 14 }}>
          <Btn onClick={() => fileRef.current && fileRef.current.click()}>Import a file</Btn>
          {onBack && <Btn kind="ghost" onClick={onBack}>Back</Btn>}
          <input ref={fileRef} type="file" accept=".msc,application/json,.json"
            style={{ display: "none" }} onChange={onFile} />
        </div>
      </Panel>

      {showing && (
        <Modal title={`Hand over ${showing.pc.name}`} onClose={() => setShowing(null)}>
          <p style={{ marginTop: 0 }}>
            Point another phone's camera at this. No server involved — the character
            travels in the code itself.
          </p>
          <QRCanvas text={toCompact(showing)} size={260} />
          <p className="clue-meta">
            Stats, saves, skills, gear and scars. Nothing else fits in a scannable code.
          </p>
        </Modal>
      )}
    </div>
  );
}

export { fromCompact, exportCharacter, stash };
