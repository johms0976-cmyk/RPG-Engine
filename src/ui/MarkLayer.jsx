/* ============================================================
   MARK LAYER — the crew's pen on the map.

   Every real table draws on the map. "DON'T GO IN HERE" scrawled
   across a room does more for a session than any amount of
   fog-of-war fidelity, because it is the crew's reasoning made
   visible to the crew. Marks are public, author-owned, and sit
   above the map geometry without touching it.
   ============================================================ */
import React, { useState } from "react";
import { Btn, Modal, Field } from "./kit.jsx";
import { MARK_KINDS, marksIn, markSummary, canRemoveMark } from "../engine/board.js";

/** Glyphs painted over a floor plan. Given the same room-position map
    MapV2 uses, so the two always agree about where a room is. */
export function MarkGlyphs({ marks, positions, box = { w: 1, h: 1 } }) {
  const summary = markSummary(marks);
  return (
    <g className="mark-layer" aria-hidden="true">
      {Object.entries(summary).map(([room, s]) => {
        const p = positions[room];
        if (!p) return null;
        return (
          <g key={room} transform={`translate(${p.x + (p.w || box.w) - 9}, ${p.y + 11})`}>
            <text className={`mark-glyph mark-${s.kind}`} textAnchor="middle">{s.glyph}</text>
            {s.count > 1 && (
              <text className="mark-count" y={10} textAnchor="middle">{s.count}</text>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** The editor for one room's marks. */
export default function MarkEditor({ roomId, roomName, marks, pcId, isWarden, onAdd, onRemove, onClose }) {
  const [kind, setKind] = useState("danger");
  const [text, setText] = useState("");
  const here = marksIn(marks, roomId);

  const add = () => {
    onAdd && onAdd(roomId, kind, text.trim());
    setText("");
  };

  return (
    <Modal title={`Mark ${roomName || roomId}`} onClose={onClose}>
      <div className="stack">
        <div className="btn-row">
          {Object.entries(MARK_KINDS).map(([k, v]) => (
            <Btn key={k} kind={kind === k ? "accent" : "ghost"} className="inline small"
              title={v.blurb} onClick={() => setKind(k)}>
              {v.glyph} {v.label}
            </Btn>
          ))}
        </div>

        <Field label="Note (optional)">
          <input value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            maxLength={60} placeholder="Something in the vent" />
        </Field>

        <Btn kind="primary" onClick={add}>Mark it</Btn>

        {here.length > 0 && (
          <div className="clues" style={{ marginTop: 8 }}>
            {here.map((m) => (
              <div key={m.id} className="clue">
                <span className={`clue-kind mark-${m.kind}`}>{MARK_KINDS[m.kind].glyph} {MARK_KINDS[m.kind].label}</span>
                <span className="clue-text">{m.text || <em style={{ opacity: 0.6 }}>no note</em>}</span>
                <span className="clue-meta">{m.byName || "someone"}</span>
                <span className="clue-actions">
                  {canRemoveMark(m, { pcId, isWarden }) && (
                    <Btn kind="ghost" className="inline small" onClick={() => onRemove && onRemove(m.id)}>×</Btn>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
