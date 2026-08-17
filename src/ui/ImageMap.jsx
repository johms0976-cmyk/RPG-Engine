/* ============================================================
   IMAGE MAP — published module maps as they were drawn.

   Gradient Descent's floors are the artifact. You cannot
   regenerate them from room geometry and you should not try: the
   layout is authored, the labels are part of the art, and the
   thing players point at on the table is the picture. So this
   renders the picture and hangs the engine's room state on top
   of it as hotspots.

   A module opts in by giving a floor an `image`:

     floors: [{
       id: "f1", name: "Floor 1",
       image: { src: "/maps/deep-f1.webp", w: 2000, h: 1400 },
       hotspots: { reactor: { x: 410, y: 880, w: 220, h: 160 } },
     }]

   Coordinates are in the image's own pixels, so a hotspot map
   drawn against the source art keeps working at any display size.
   Rooms without a hotspot simply are not clickable, which lets a
   map be adopted incrementally rather than all at once.
   ============================================================ */
import React, { useState } from "react";
import { FOG, fogState } from "../core/mapModel.js";
import { markSummary, MARK_KINDS } from "../engine/board.js";

const FOG_STYLE = {
  [FOG.HIDDEN]: { opacity: 0, pointer: "none" },
  [FOG.RUMOURED]: { opacity: 0.55, pointer: "auto" },
  [FOG.SEEN]: { opacity: 0.22, pointer: "auto" },
  [FOG.KNOWN]: { opacity: 0, pointer: "auto" },
};

export default function ImageMap({
  mod, w, floor, crew = [], activeId, marks = [],
  wardenView = false, onGo, onMark,
}) {
  const [hover, setHover] = useState(null);
  const img = floor.image;
  if (!img) return null;

  const spots = floor.hotspots || {};
  const summary = markSummary(marks);
  const crewRoom = w.room;

  return (
    <div className="imagemap" style={{ position: "relative", width: "100%" }}>
      <svg
        viewBox={`0 0 ${img.w} ${img.h}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label={`${floor.name || "Deck"} plan`}
      >
        <image href={img.src} x="0" y="0" width={img.w} height={img.h} />

        {Object.entries(spots).map(([roomId, box]) => {
          const room = mod.rooms[roomId];
          if (!room) return null;
          const fog = wardenView ? FOG.KNOWN : fogState(mod, w, roomId);
          const style = FOG_STYLE[fog] || FOG_STYLE[FOG.HIDDEN];
          const here = roomId === crewRoom;
          const mark = summary[roomId];

          return (
            <g key={roomId}
              style={{ cursor: onGo && style.pointer === "auto" ? "pointer" : "default" }}
              onClick={() => style.pointer === "auto" && onGo && onGo(roomId)}
              onMouseEnter={() => setHover(roomId)}
              onMouseLeave={() => setHover((h) => (h === roomId ? null : h))}
            >
              {/* Unvisited rooms are covered rather than removed, so the
                  shape of the deck stays legible while its contents don't. */}
              {style.opacity > 0 && (
                <rect x={box.x} y={box.y} width={box.w} height={box.h}
                  fill="#0A0A0B" opacity={style.opacity} />
              )}

              {here && (
                <rect x={box.x} y={box.y} width={box.w} height={box.h}
                  fill="none" stroke="#F5C518" strokeWidth={4} />
              )}

              {hover === roomId && !here && style.pointer === "auto" && (
                <rect x={box.x} y={box.y} width={box.w} height={box.h}
                  fill="#F5C518" opacity={0.12} />
              )}

              {mark && (
                <text
                  x={box.x + box.w - 14} y={box.y + 26}
                  textAnchor="end" fontSize={26} fontWeight="700"
                  fill={mark.kind === "danger" ? "#E24B4A" : mark.kind === "safe" ? "#5DCAA5" : "#EF9F27"}
                >
                  {MARK_KINDS[mark.kind].glyph}{mark.count > 1 ? mark.count : ""}
                </text>
              )}

              {onMark && style.pointer === "auto" && (
                <rect x={box.x} y={box.y} width={box.w} height={box.h}
                  fill="transparent"
                  onContextMenu={(e) => { e.preventDefault(); onMark(roomId); }} />
              )}
            </g>
          );
        })}

        {crew.filter((c) => c.alive !== false).map((c, i) => {
          const box = spots[crewRoom];
          if (!box) return null;
          return (
            <circle key={c.id}
              cx={box.x + 18 + i * 22} cy={box.y + box.h - 18} r={8}
              fill={c.id === activeId ? "#F5C518" : "#EDEAE3"} />
          );
        })}
      </svg>

      {hover && mod.rooms[hover] && (
        <p className="clue-meta" style={{ marginTop: 6 }}>{mod.rooms[hover].name}</p>
      )}
    </div>
  );
}

/** Does this floor have authored art, or should MapV2 draw it? */
export const hasImage = (floor) => !!(floor && floor.image && floor.image.src);
