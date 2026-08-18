/* ============================================================
   THE SITUATION BANNER, AND THE SCENE CHIP.

   Two one-line answers to the two questions a player asks most
   often, both of which the feed answers badly because the feed
   scrolls.

   SITUATION — "what is going on?" The Warden types one sentence
   and it is pinned to the top of every phone and the shared
   screen until they replace it. "The lights are out. Something
   is in the vents. The shuttle leaves in twenty minutes." A
   player who looked away for a minute is caught up without
   reading a word of scrollback.

   SCENE — "is it my go, and when?" During an out-of-combat scene
   round this says either that the room is yours or exactly how
   many people are ahead of you and who you follow. "You're up
   after Riley" is the single line that converts a stampede into
   a conversation.
   ============================================================ */
import React from "react";
import { tempoOf, scenePosition, scenePredecessor, sceneHolder, WAIT_TEXT } from "../engine/tempo.js";

export function SituationBanner({ w }) {
  const t = tempoOf(w);
  if (!t.situation) return null;
  return (
    <div className="situation" role="status" aria-live="polite">
      <span className="situation-mark" aria-hidden="true" />
      <span className="situation-text">{t.situation}</span>
    </div>
  );
}

/**
 * Where I am in the ring. Renders nothing when no scene is running,
 * which is most of the time — this is a mode, not furniture.
 */
export function SceneChip({ w, crew, myPcId }) {
  const t = tempoOf(w);
  if (!t.scene || !t.scene.order.length) return null;

  const pos = scenePosition(t, myPcId);
  const nameOf = (id) => {
    const pc = (crew || []).find((c) => c.id === id);
    return (pc && pc.name) || "…";
  };

  if (pos === -1) {
    return (
      <div className="scene-chip is-out" role="status">
        Round the room · {nameOf(sceneHolder(t))} has it
      </div>
    );
  }

  if (pos === 0) {
    return (
      <div className="scene-chip is-mine" role="status" aria-live="assertive">
        <strong>The room is yours.</strong>
        <span>Say what you do. Pass it on when you're done.</span>
      </div>
    );
  }

  const after = scenePredecessor(t, myPcId);
  return (
    <div className="scene-chip" role="status" aria-live="polite">
      <strong>{pos === 1 ? "You're next" : `${pos} ahead of you`}</strong>
      <span>{after ? `You're up after ${nameOf(after)}.` : `${nameOf(sceneHolder(t))} has the room.`}</span>
    </div>
  );
}

/**
 * The brake strip. One line saying why the buttons are quiet, which
 * is the difference between a pause and a phone that has crashed.
 */
export function HeldStrip({ w, reason }) {
  const t = tempoOf(w);
  const why = reason || (t.breather ? "breather" : t.held ? "held" : null);
  if (!why) return null;
  return (
    <div className={`held-strip is-${why}`} role="status" aria-live="polite">
      {t.heldWhy || WAIT_TEXT[why] || "Hold on."}
    </div>
  );
}

export default SituationBanner;
