/* ============================================================
   RECAP — "Previously on…"

   Session two of a saved game starts with twenty minutes of
   five people half-remembering session one, and the engine has
   every fact needed to fix that: it wrote the feed. What it
   never had was a way to say the feed back.

   Assembled entirely by template in engine/tempo.js — deaths,
   finds, rooms, panics, clocks, and the beat titles the Warden
   dropped. There is no model here. If the feed does not say it,
   this cannot say it either, which is exactly the constraint
   that makes it trustworthy at the top of a session.
   ============================================================ */
import React from "react";

export default function RecapCard({ recap, onClose, flat = false }) {
  if (!recap) return null;

  const body = (
    <div className="recap">
      <div className="recap-head">
        <span className="recap-kicker">Previously</span>
        <h2>{recap.title}</h2>
      </div>
      <ul className="recap-lines">
        {recap.lines.map((l, i) => <li key={i}>{l}</li>)}
      </ul>
      {onClose && (
        <button type="button" className="btn ghost inline" onClick={onClose}>
          <span>Take it down</span>
        </button>
      )}
    </div>
  );

  if (flat) return body;
  return <div className="recap-scrim">{body}</div>;
}
