/* ============================================================
   FEED — the same stream, told apart.

   The engine tags every line with a kind and the old renderer
   treated them all as text, so a room description and a reload
   confirmation carried identical weight and players scrolled
   past the thing that mattered. Three registers now: the fiction
   reads as prose, mechanics sit inset where the eye can skip
   them on a reread, and panic interrupts.
   ============================================================ */
import React, { useEffect, useRef } from "react";

const MECHANICAL = new Set(["roll", "rollgood", "rollbad", "item", "system", "combat", "heal", "ammo"]);
const LOUD = new Set(["panic", "death", "end"]);

export function classify(line) {
  if (line.to || line.kind === "whisper") return "whisper";
  if (LOUD.has(line.kind)) return "panic";
  if (MECHANICAL.has(line.kind)) return "mech";
  return "say";
}

export default function Feed2({ feed, autoScroll = true, emptyText = "Nothing yet." }) {
  const end = useRef(null);
  useEffect(() => {
    if (autoScroll && end.current) end.current.scrollIntoView({ block: "end" });
  }, [feed.length, autoScroll]);

  if (!feed || !feed.length) {
    return <p style={{ opacity: 0.6, margin: 0 }}>{emptyText}</p>;
  }

  return (
    <div className="feed2">
      {feed.map((line) => {
        const reg = classify(line);
        return (
          <div
            key={line.id}
            className={`feed2-${reg}${line.phantom ? " feed2-phantom" : ""}`}
            data-kind={line.kind}
          >
            {line.text}
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}
