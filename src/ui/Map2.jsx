/* ============================================================
   MAP v2 — the renderer.

   The layout maths lives in core/mapModel.js and is tested
   without a DOM. This file only draws and handles input:

     - floor tabs, with the current floor and the crew's floor
       marked separately (you can look at deck 4 while standing
       on deck 1)
     - pinch/wheel zoom and drag pan, clamped to the floor
     - fog of war in four states, where HIDDEN means not drawn
       at all rather than drawn in grey
     - markers derived from live world state
     - full keyboard navigation, because the whole game is
       playable without a mouse and the map should not be the
       exception

   Everything stays SVG. At 60+ rooms canvas would be faster, but
   SVG keeps each room a real focusable element with a real
   accessible name, and a screen reader user navigating a ship
   map is worth more than the frames.
   ============================================================ */
import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  normalizeMap, roomBox, shapeOf, fogState, FOG, markersFor,
  clampView, centreOn, floorOf, corridorsFor, linkPath,
} from "../core/mapModel.js";

const VIEWPORT = { w: 760, h: 460 };

const FOG_FILL = {
  [FOG.KNOWN]: "var(--bone)",
  [FOG.SEEN]: "var(--void2)",
  [FOG.RUMOURED]: "none",
};

export function MapV2({ mod, w, crew = [], activeId, onGo, wardenView = false, objectives = [] }) {
  const map = useMemo(() => normalizeMap(mod), [mod]);
  const crewFloor = useMemo(() => floorOf(map, w.room), [map, w.room]);
  const [floorId, setFloorId] = useState(crewFloor.id);
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [focus, setFocus] = useState(w.room);
  const svgRef = useRef(null);
  const drag = useRef(null);

  const floor = map.floors.find((f) => f.id === floorId) || map.floors[0];

  // Follow the crew when they change deck, but don't yank the view
  // away if the player has deliberately gone looking at another one.
  const lastCrewFloor = useRef(crewFloor.id);
  useEffect(() => {
    if (crewFloor.id !== lastCrewFloor.current) {
      lastCrewFloor.current = crewFloor.id;
      setFloorId(crewFloor.id);
    }
  }, [crewFloor.id]);

  useEffect(() => {
    if (floor.pos[w.room]) setView((v) => centreOn(floor, mod.rooms, w.room, VIEWPORT, v.zoom));
  }, [w.room, floor, mod.rooms]);

  const reachable = useMemo(() => new Set(
    (mod.rooms[w.room].exits || [])
      .filter((e) => (!e.hidden || w.flags[e.hidden]) && mod.rooms[e.to])
      .map((e) => String(e.to))
  ), [mod, w.room, w.flags]);

  const markers = useMemo(
    () => markersFor(mod, w, { crew, activeId, wardenView, objectives }),
    [mod, w, crew, activeId, wardenView, objectives]
  );

  const fog = useCallback((id) => (wardenView ? FOG.KNOWN : fogState(mod, w, id)), [mod, w, wardenView]);

  /* ---------------- zoom & pan ---------------- */

  const zoomBy = useCallback((factor, originX, originY) => {
    setView((v) => {
      const zoom = Math.max(0.4, Math.min(4, v.zoom * factor));
      // Keep the point under the cursor stationary.
      const wx = v.x + (originX ?? VIEWPORT.w / 2) / v.zoom;
      const wy = v.y + (originY ?? VIEWPORT.h / 2) / v.zoom;
      return clampView({
        zoom,
        x: wx - (originX ?? VIEWPORT.w / 2) / zoom,
        y: wy - (originY ?? VIEWPORT.h / 2) / zoom,
      }, floor, VIEWPORT);
    });
  }, [floor]);

  const onWheel = useCallback((e) => {
    if (!e.ctrlKey && Math.abs(e.deltaY) < 2) return;
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const ox = ((e.clientX - rect.left) / rect.width) * VIEWPORT.w;
    const oy = ((e.clientY - rect.top) / rect.height) * VIEWPORT.h;
    zoomBy(e.deltaY < 0 ? 1.12 : 0.89, ox, oy);
  }, [zoomBy]);

  const onPointerDown = (e) => {
    if (e.target.closest("[data-room]")) return;   // clicking a room isn't a drag
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scale = VIEWPORT.w / rect.width / view.zoom;
    setView((v) => clampView({
      zoom: v.zoom,
      x: drag.current.vx - (e.clientX - drag.current.x) * scale,
      y: drag.current.vy - (e.clientY - drag.current.y) * scale,
    }, floor, VIEWPORT));
  };
  const onPointerUp = () => { drag.current = null; };

  /* ---------------- keyboard ---------------- */

  const visibleRooms = useMemo(
    () => Object.keys(floor.pos).filter((id) => mod.rooms[id] && fog(id) !== FOG.HIDDEN),
    [floor, mod.rooms, fog]
  );

  const onKeyDown = (e) => {
    const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (dirs[e.key]) {
      e.preventDefault();
      const [dx, dy] = dirs[e.key];
      const from = floor.pos[focus] || floor.pos[w.room];
      if (!from) return;
      // Nearest room in the pressed direction, by projected distance.
      let best = null, bestScore = Infinity;
      for (const id of visibleRooms) {
        if (id === focus) continue;
        const p = floor.pos[id];
        const vx = p[0] - from[0], vy = p[1] - from[1];
        const along = vx * dx + vy * dy;
        if (along <= 0) continue;
        const off = Math.abs(vx * dy) + Math.abs(vy * dx);
        const score = along + off * 2;
        if (score < bestScore) { bestScore = score; best = id; }
      }
      if (best) {
        setFocus(best);
        setView((v) => centreOn(floor, mod.rooms, best, VIEWPORT, v.zoom));
      }
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && reachable.has(focus)) {
      e.preventDefault();
      onGo(focus);
    }
    if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBy(1.2); }
    if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomBy(0.83); }
    if (e.key === "0") {
      e.preventDefault();
      setView(centreOn(floor, mod.rooms, w.room, VIEWPORT, 1));
    }
    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const i = map.floors.indexOf(floor);
      const next = map.floors[i + (e.key === "PageUp" ? 1 : -1)];
      if (next) setFloorId(next.id);
    }
  };

  /* ---------------- drawing ---------------- */

  const corridors = useMemo(() => corridorsFor(mod, floor), [mod, floor]);
  const vb = `${view.x} ${view.y} ${VIEWPORT.w / view.zoom} ${VIEWPORT.h / view.zoom}`;

  const shaftsHere = map.shafts.filter(
    (s) => floor.pos[s.from] && fog(s.from) !== FOG.HIDDEN
  );

  return (
    <div className="map2">
      {map.floors.length > 1 && (
        <div className="map2-floors" role="tablist" aria-label="Decks">
          {[...map.floors].sort((a, b) => b.z - a.z).map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={f.id === floor.id}
              className={`map2-floor ${f.id === floor.id ? "on" : ""} ${f.id === crewFloor.id ? "crew" : ""}`}
              onClick={() => setFloorId(f.id)}
              title={f.id === crewFloor.id ? "The crew is on this deck" : undefined}
            >
              <span className="z">{f.z}</span>
              <span className="nm">{f.name}</span>
              {f.id === crewFloor.id && <span className="dot" aria-label="you are here" />}
            </button>
          ))}
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={vb}
        className="map2-svg"
        tabIndex={0}
        role="application"
        aria-label={`Map of ${mod.title}, ${floor.name}. You are in ${mod.rooms[w.room].name}. Arrow keys to move the cursor, Enter to travel, plus and minus to zoom, Page Up and Page Down to change deck.`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--graphite)" strokeWidth="1.4" opacity="0.5" />
          </pattern>
          <filter id="mapGrain">
            <feTurbulence baseFrequency="0.85" numOctaves="2" result="n" />
            <feColorMatrix in="n" type="saturate" values="0" />
            <feComponentTransfer><feFuncA type="linear" slope="0.055" /></feComponentTransfer>
          </filter>
        </defs>

        {/* corridors under rooms */}
        <g className="map2-links">
          {corridors.map((c, i) => {
            const fa = fog(c.from), fb = fog(c.to);
            if (fa === FOG.HIDDEN || fb === FOG.HIDDEN) return null;
            if (c.hidden && !w.flags[c.hidden]) return null;
            const d = linkPath(mod.rooms, floor, c.from, c.to);
            if (!d) return null;
            const faint = fa === FOG.RUMOURED || fb === FOG.RUMOURED;
            return (
              <path key={i} d={d} fill="none"
                stroke="var(--ink)"
                strokeWidth={c.kind === "shaft" ? 3.5 : 2}
                strokeDasharray={c.kind === "crack" || c.kind === "airlock" ? "5 4" : c.kind === "locked" ? "2 4" : undefined}
                opacity={faint ? 0.28 : 0.75} />
            );
          })}
        </g>

        {/* rooms */}
        <g className="map2-rooms">
          {Object.entries(floor.pos).map(([id, p]) => {
            const room = mod.rooms[id];
            if (!room) return null;
            const state = fog(id);
            if (state === FOG.HIDDEN) return null;

            const box = roomBox(room, p);
            const shape = shapeOf(room);
            const here = w.room === id;
            const canGo = reachable.has(id);
            const known = state === FOG.KNOWN;
            const marks = markers[id] || [];
            const threat = marks.some((m) => m.kind === "threat");

            const label = [
              room.name,
              here && "you are here",
              canGo && "reachable",
              state === FOG.RUMOURED && "unexplored",
              state === FOG.SEEN && "visible from here",
              threat && "danger",
              marks.filter((m) => m.kind === "npc").map((m) => m.label).join(", "),
            ].filter(Boolean).join(", ");

            return (
              <g key={id}
                data-room={id}
                className={`map2-room ${canGo ? "go" : ""} ${here ? "here" : ""} ${focus === id ? "focus" : ""}`}
                role={canGo ? "button" : "img"}
                tabIndex={-1}
                aria-label={label}
                onClick={() => { setFocus(id); if (canGo) onGo(id); }}
              >
                {shape.kind === "poly" ? (
                  <polygon
                    points={shape.points.map(([px, py]) => `${box.x + px},${box.y + py}`).join(" ")}
                    fill={here ? "var(--accent)" : FOG_FILL[state]}
                    stroke="var(--ink)" strokeWidth={here ? 3 : 2}
                    strokeDasharray={state === FOG.RUMOURED ? "4 4" : undefined}
                  />
                ) : (
                  <rect
                    x={box.x} y={box.y} width={box.w} height={box.h}
                    rx={shape.round ? Math.min(box.w, box.h) / 2 : 0}
                    fill={here ? "var(--accent)" : FOG_FILL[state]}
                    stroke="var(--ink)" strokeWidth={here ? 3 : 2}
                    strokeDasharray={state === FOG.RUMOURED ? "4 4" : undefined}
                  />
                )}

                {/* rumoured rooms get hatching and no detail at all */}
                {state === FOG.RUMOURED && (
                  <>
                    <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="url(#hatch)" opacity="0.5" />
                    <text x={box.x + box.w / 2} y={box.y + box.h / 2 + 5} textAnchor="middle"
                      className="map2-unknown">?</text>
                  </>
                )}

                {state !== FOG.RUMOURED && (
                  <>
                    {room.n != null && (
                      <>
                        <rect x={box.x} y={box.y} width={26} height={18} fill="var(--ink)" />
                        <text x={box.x + 13} y={box.y + 14} textAnchor="middle" className="map2-num">{room.n}</text>
                      </>
                    )}
                    <text x={box.x + (room.n != null ? 32 : 8)} y={box.y + 14} className="map2-name"
                      opacity={known || here ? 1 : 0.55}>
                      {room.name.split(" — ")[0].slice(0, Math.floor(box.w / 6.4))}
                    </text>
                    {(room.tags || []).length > 0 && (
                      <text x={box.x + 8} y={box.y + box.h - 8} className="map2-tags">
                        {room.tags.join(" · ").slice(0, Math.floor(box.w / 4.6))}
                      </text>
                    )}
                  </>
                )}

                {canGo && <circle cx={box.x + box.w - 10} cy={box.y + box.h - 10} r={4} fill="var(--ink)" />}

                {/* markers */}
                <g className="map2-marks">
                  {marks.slice(0, 5).map((m, i) => {
                    const mx = box.x + box.w - 14 - i * 17;
                    const my = box.y + 15;
                    if (m.kind === "threat") {
                      return (
                        <g key={i} className={`mark threat ${m.hot ? "hot" : ""}`}>
                          <circle cx={mx} cy={my} r={8} fill="var(--blood)" />
                          <text x={mx} y={my + 4.5} textAnchor="middle" className="mark-glyph">!</text>
                          <title>{m.label}</title>
                        </g>
                      );
                    }
                    if (m.kind === "npc") {
                      return (
                        <g key={i} className="mark npc">
                          <circle cx={mx} cy={my} r={7} fill="none" stroke="var(--ink)" strokeWidth="2" />
                          <circle cx={mx} cy={my} r={2.5} fill="var(--ink)" />
                          <title>{m.label}</title>
                        </g>
                      );
                    }
                    if (m.kind === "crew") {
                      return (
                        <g key={i} className={`mark crew ${m.active ? "active" : ""}`}>
                          <rect x={mx - 6} y={my - 6} width={12} height={12}
                            fill={m.active ? "var(--ink)" : "none"} stroke="var(--ink)" strokeWidth="2" />
                          <title>{m.label}</title>
                        </g>
                      );
                    }
                    if (m.kind === "objective") {
                      return (
                        <g key={i} className="mark objective">
                          <polygon points={`${mx},${my - 8} ${mx + 7},${my + 5} ${mx - 7},${my + 5}`}
                            fill="var(--accent)" stroke="var(--ink)" strokeWidth="1.6" />
                          <title>{m.label}</title>
                        </g>
                      );
                    }
                    return (
                      <g key={i} className="mark poi">
                        <circle cx={mx} cy={my} r={5} fill="var(--accent)" stroke="var(--ink)" strokeWidth="1.5" />
                        <title>{m.label}</title>
                      </g>
                    );
                  })}
                </g>
              </g>
            );
          })}
        </g>

        {/* shafts to other decks */}
        <g className="map2-shafts">
          {shaftsHere.map((s, i) => {
            const p = floor.pos[s.from];
            const box = roomBox(mod.rooms[s.from], p);
            const up = s.toZ > s.fromZ;
            return (
              <g key={i} className="shaft" onClick={() => setFloorId(`z${s.toZ}`)}>
                <rect x={box.x + box.w - 20} y={box.y + box.h - 20} width={16} height={16}
                  fill="var(--void2)" stroke="var(--ink)" strokeWidth="1.6" />
                <text x={box.x + box.w - 12} y={box.y + box.h - 8} textAnchor="middle" className="shaft-glyph">
                  {up ? "▲" : "▼"}
                </text>
                <title>{`${s.kind} to ${mod.rooms[s.to].name}`}</title>
              </g>
            );
          })}
        </g>

        <rect x={view.x} y={view.y} width={VIEWPORT.w / view.zoom} height={VIEWPORT.h / view.zoom}
          filter="url(#mapGrain)" pointerEvents="none" opacity="0.7" />
      </svg>

      <div className="map2-hud">
        <div className="map2-zoom">
          <button className="btn tiny" onClick={() => zoomBy(0.83)} aria-label="Zoom out">−</button>
          <span className="z-level">{Math.round(view.zoom * 100)}%</span>
          <button className="btn tiny" onClick={() => zoomBy(1.2)} aria-label="Zoom in">+</button>
          <button className="btn tiny" onClick={() => setView(centreOn(floor, mod.rooms, w.room, VIEWPORT, 1))}>
            RECENTRE
          </button>
        </div>
        <div className="map2-legend">
          <span><i className="lg here" /> here</span>
          <span><i className="lg known" /> explored</span>
          <span><i className="lg unknown" /> unexplored</span>
          <span><i className="lg threat" /> threat</span>
        </div>
      </div>
    </div>
  );
}

export default MapV2;
