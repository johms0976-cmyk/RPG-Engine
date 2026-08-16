/* ============================================================
   MAP — draws whatever the module's `map` block describes.
   A module can hand-place rooms (pos + links) or let
   defineModule auto-lay them out on a grid.
   ============================================================ */
import React from "react";
import { useTheme } from "./kit.jsx";

export function BaseMap({ mod, w, onGo }) {
  const C = useTheme();
  const { pos, links = [], BW, BH, width, height, extras = [] } = mod.map;
  const reachable = new Set(
    (mod.rooms[w.room].exits || [])
      .filter((e) => (!e.hidden || w.flags[e.hidden]) && mod.rooms[e.to])
      .map((e) => e.to)
  );

  const dash = (kind) =>
    kind === "crack" || kind === "airlock" ? "4 3" : kind === "locked" ? "2 3" : undefined;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", display: "block" }} role="img" aria-label="Map">
      {links.map((l, i) => (
        <path key={i} d={l.p} fill="none" stroke={C.ink} strokeWidth={l.kind === "shaft" ? 3 : 2} strokeDasharray={dash(l.kind)} />
      ))}
      {Object.entries(pos).map(([id, [x, y]]) => {
        const r = mod.rooms[id];
        if (!r) return null;
        const isHere = w.room === id;
        const seen = w.visited[id];
        const canGo = reachable.has(id);
        return (
          <g key={id} onClick={() => canGo && onGo(id)} style={{ cursor: canGo ? "pointer" : "default" }}>
            <rect x={x} y={y} width={BW} height={BH} fill={isHere ? C.accent : seen ? C.bone : "none"} stroke={C.ink} strokeWidth={isHere ? 3 : 2} />
            {!seen && !isHere && <rect x={x} y={y} width={BW} height={BH} fill="none" stroke={C.ink} strokeWidth="2" strokeDasharray="3 3" />}
            {r.n != null && <>
              <rect x={x} y={y} width={22} height={16} fill={C.ink} />
              <text x={x + 11} y={y + 12.5} textAnchor="middle" fill={C.bone} style={{ fontFamily: C.display, fontWeight: 700, fontSize: 12 }}>{r.n}</text>
            </>}
            <text x={x + (r.n != null ? 27 : 6)} y={y + 13} fill={C.ink}
              style={{ fontFamily: C.display, fontWeight: 700, fontSize: 10.5, letterSpacing: "0.06em", opacity: seen || isHere ? 1 : 0.35 }}>
              {r.name.split(" — ")[0].slice(0, 17)}
            </text>
            {canGo && <circle cx={x + BW - 9} cy={y + BH - 9} r={3.5} fill={C.ink} />}
            {(seen || isHere) && (r.tags || []).length > 0 && (
              <text x={x + 6} y={y + BH - 12} fill={C.graphite} style={{ fontFamily: C.mono, fontSize: 6.5, letterSpacing: "0.08em" }}>
                {r.tags.join(" · ").slice(0, 26)}
              </text>
            )}
          </g>
        );
      })}
      {extras.map((e, i) => (
        <g key={`x${i}`}>
          <rect x={e.x} y={e.y} width={e.w} height={e.h} fill={w.room === e.room ? C.accent : "none"} stroke={C.ink} strokeWidth="2" strokeDasharray="4 3" />
          <text x={e.x + 8} y={e.y + 13} fill={C.ink} style={{ fontFamily: C.display, fontWeight: 700, fontSize: 11, letterSpacing: "0.1em" }}>{e.label}</text>
          {e.note && <text x={e.x + 8} y={e.y + 24} fill={C.graphite} style={{ fontFamily: C.mono, fontSize: 6.5, letterSpacing: "0.08em" }}>{e.note}</text>}
        </g>
      ))}
    </svg>
  );
}
