/* ============================================================
   MAP — draws whatever the module's `map` block describes,
   and is navigable by keyboard.
   ============================================================ */
import React from "react";

export function BaseMap({ mod, w, onGo, threatRooms = [], crewRooms = [] }) {
  const { pos, links = [], BW, BH, width, height, extras = [] } = mod.map;
  const reachable = new Set(
    (mod.rooms[w.room].exits || [])
      .filter((e) => (!e.hidden || w.flags[e.hidden]) && mod.rooms[e.to])
      .map((e) => e.to)
  );

  const dash = (kind) =>
    kind === "crack" || kind === "airlock" ? "4 3" : kind === "locked" ? "2 3" : undefined;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", display: "block" }}
      role="group" aria-label={`Map of ${mod.title}. You are in ${mod.rooms[w.room].name}.`}>
      {links.map((l, i) => (
        <path key={i} d={l.p} fill="none" stroke="var(--ink)"
          strokeWidth={l.kind === "shaft" ? 3 : 2} strokeDasharray={dash(l.kind)} />
      ))}
      {Object.entries(pos).map(([id, [x, y]]) => {
        const r = mod.rooms[id];
        if (!r) return null;
        const isHere = w.room === id;
        const seen = w.visited[id];
        const canGo = reachable.has(id);
        const danger = threatRooms.includes(id);
        const label = `${r.name}${isHere ? ", you are here" : ""}${canGo ? ", reachable" : ""}${seen ? "" : ", unexplored"}`;
        return (
          <g key={id} className={`map-room ${canGo ? "reachable" : ""}`}
            role={canGo ? "button" : "img"}
            tabIndex={canGo ? 0 : -1}
            aria-label={label}
            onClick={() => canGo && onGo(id)}
            onKeyDown={(e) => { if (canGo && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onGo(id); } }}>
            <rect x={x} y={y} width={BW} height={BH}
              fill={isHere ? "var(--accent)" : seen ? "var(--bone)" : "none"}
              stroke="var(--ink)" strokeWidth={isHere ? 3 : 2} />
            {!seen && !isHere && (
              <rect x={x} y={y} width={BW} height={BH} fill="none"
                stroke="var(--ink)" strokeWidth="2" strokeDasharray="3 3" />
            )}
            {r.n != null && (
              <>
                <rect x={x} y={y} width={22} height={16} fill="var(--ink)" />
                <text x={x + 11} y={y + 12.5} textAnchor="middle" fill="var(--bone)"
                  style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 12 }}>{r.n}</text>
              </>
            )}
            <text x={x + (r.n != null ? 27 : 6)} y={y + 13} fill="var(--ink)"
              style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 10.5, letterSpacing: "0.06em", opacity: seen || isHere ? 1 : 0.35 }}>
              {r.name.split(" — ")[0].slice(0, 17)}
            </text>
            {canGo && <circle cx={x + BW - 9} cy={y + BH - 9} r={3.5} fill="var(--ink)" />}
            {danger && seen && (
              <text x={x + BW - 22} y={y + 14} fill="var(--blood)"
                style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 13 }}>!</text>
            )}
            {(seen || isHere) && (r.tags || []).length > 0 && (
              <text x={x + 6} y={y + BH - 12} fill="var(--graphite)"
                style={{ fontFamily: "var(--mono)", fontSize: 6.5, letterSpacing: "0.08em" }}>
                {r.tags.join(" · ").slice(0, 26)}
              </text>
            )}
          </g>
        );
      })}
      {extras.map((e, i) => (
        <g key={`x${i}`}>
          <rect x={e.x} y={e.y} width={e.w} height={e.h}
            fill={w.room === e.room ? "var(--accent)" : "none"}
            stroke="var(--ink)" strokeWidth="2" strokeDasharray="4 3" />
          <text x={e.x + 8} y={e.y + 13} fill="var(--ink)"
            style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 11, letterSpacing: "0.1em" }}>{e.label}</text>
          {e.note && (
            <text x={e.x + 8} y={e.y + 24} fill="var(--graphite)"
              style={{ fontFamily: "var(--mono)", fontSize: 6.5, letterSpacing: "0.08em" }}>{e.note}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

export default BaseMap;
