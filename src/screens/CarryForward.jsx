/* ============================================================
   STILL TRUE? — the top of a session that is not the first.

   A campaign with facts in it opens here. The table is shown what
   they invented last time and picks what is still true.

   ------------------------------------------------------------
   WHY THIS IS A SCREEN AND NOT A SETTING

   Because the choice is the feature. `engine/continuity.js` sets
   out the argument in full; the short version is that a fact
   invented in one ship's mine is often nonsense on another, and
   software that silently reinstates something a table had
   forgotten is overruling them about their own fiction.

   So nothing is carried unless somebody taps it, "none of it" is
   a single tap, and skipping the screen entirely carries nothing.
   The safe direction is forgetting.

   ------------------------------------------------------------
   WHY EVERYTHING STARTS UNTICKED

   The tempting default is to pre-tick everything, on the grounds
   that a table who wrote these presumably meant them. That is
   the reasoning that produces forty auto-applied facts and a
   table who taps "continue" without reading — which is not
   continuity, it is clutter with a ceremony attached.

   Unticked means the only facts that come back are the ones
   somebody actively remembered wanting. Six deliberate facts
   beat forty automatic ones.
   ============================================================ */
import React, { useState } from "react";
import { Panel, Btn } from "../ui/kit.jsx";
import { offerable } from "../engine/continuity.js";

export default function CarryForward({ campaign, mod, onDone }) {
  const offered = offerable(campaign, mod && mod.id);
  const [picked, setPicked] = useState(() => new Set());

  /* Nothing to ask about. Say nothing and get out of the way —
     a screen that appears to announce it has no content is a
     screen that has wasted somebody's attention. */
  if (!offered.length) return null;

  const toggle = (i) => {
    const next = new Set(picked);
    if (next.has(i)) next.delete(i); else next.add(i);
    setPicked(next);
  };

  const carry = () => onDone(offered.filter((_, i) => picked.has(i)));

  return (
    <Panel title="Still true?">
      <p className="muted" style={{ marginTop: 0 }}>
        Things this table made true in earlier sessions. Tick whatever still
        stands. Anything you leave means it never happened.
      </p>

      <div className="stack" style={{ gap: 6, margin: "12px 0" }}>
        {offered.map((f, i) => (
          <button
            key={i}
            type="button"
            className={`carry-row${picked.has(i) ? " is-on" : ""}`}
            aria-pressed={picked.has(i)}
            onClick={() => toggle(i)}
          >
            <span className="carry-tick">{picked.has(i) ? "◼" : "◻"}</span>
            <span className="carry-text">
              {f.subject ? <strong>{f.subject} — </strong> : null}
              {f.text}
            </span>
            {/* WHO SAID IT. A fact the whole table agreed to reads
                differently from one the Warden ruled, and the second
                has an author still in the room who can be asked. */}
            <span className="carry-by">
              {f.by === "table" ? "the table" : f.by === "warden" ? "the Warden" : ""}
            </span>
          </button>
        ))}
      </div>

      <div className="row" style={{ gap: 8 }}>
        <Btn kind="accent" onClick={carry}>
          {picked.size
            ? `Carry ${picked.size} forward`
            : "Start fresh"}
        </Btn>
        {picked.size > 0 && (
          <Btn kind="ghost" onClick={() => setPicked(new Set())}>Clear</Btn>
        )}
      </div>
    </Panel>
  );
}
