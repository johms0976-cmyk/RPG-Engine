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

/** Room tag -> texture pattern. First match wins, same ordering logic
    as the audio beds so a room sounds and looks like the same place. */
const TEXTURES = [
  [["vacuum", "eva", "airless", "0g", "zero-g"], "tex-vacuum"],
  [["organic", "flesh", "hive", "growth", "infested"], "tex-organic"],
  [["medical", "medbay", "lab", "clinic", "science"], "tex-medical"],
  [["derelict", "abandoned", "ruin", "dark", "empty", "wreck"], "tex-derelict"],
  [["industrial", "engine", "cargo", "reactor", "machine", "mining", "hangar"], "tex-industrial"],
];

export function textureFor(tags = []) {
  const lower = tags.map((t) => String(t).toLowerCase());
  for (const [keys, id] of TEXTURES) {
    if (lower.some((t) => keys.some((k) => t.includes(k)))) return id;
  }
  return null;
}

const FOG_FILL = {
  [FOG.KNOWN]: "var(--bone)",
  [FOG.SEEN]: "var(--void2)",
  [FOG.RUMOURED]: "none",
};

/* `youRoom` is the room the person holding this screen is standing
   in. `w.room` is now derived — where most of the crew is — so on a
   phone it is the wrong thing to centre on, highlight, or read out
   to a screen reader. It stays as the fallback so the Warden's desk
   and the table screen, which genuinely are looking at the party
   rather than at a person, keep working unchanged. */
export function MapV2({ mod, w, crew = [], activeId, youRoom, onGo, wardenView = false, objectives = [] }) {
  const you = youRoom || w.room;
  const map = useMemo(() => normalizeMap(mod), [mod]);
  const crewFloor = useMemo(() => floorOf(map, you), [map, you]);
  const [floorId, setFloorId] = useState(crewFloor.id);
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [focus, setFocus] = useState(you);
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
    if (floor.pos[you]) setView((v) => centreOn(floor, mod.rooms, you, VIEWPORT, v.zoom));
  }, [you, floor, mod.rooms]);

  /* ---- the movement pulse ----
     A schematic that simply redraws with the highlight somewhere else
     does not tell you the crew *moved*, and at a table with six people
     looking at six screens "wait, where are we?" costs a minute every
     time. So the corridor they came down lights up and travels, once,
     for about a second. Purely decorative — it holds no state anything
     depends on, and it is off entirely under reduced motion. */
  const [trail, setTrail] = useState(null);
  const cameFrom = useRef(you);
  useEffect(() => {
    const from = cameFrom.current;
    cameFrom.current = you;
    if (from === you || !from) return undefined;
    if (!floor.pos[from] || !floor.pos[you]) return undefined;
    setTrail({ from, to: you, at: Date.now() });
    const t = setTimeout(() => setTrail(null), 1100);
    return () => clearTimeout(t);
  }, [you, floor]);

  const reachable = useMemo(() => new Set(
    (mod.rooms[you].exits || [])
      .filter((e) => (!e.hidden || w.flags[e.hidden]) && mod.rooms[e.to])
      .map((e) => String(e.to))
  ), [mod, you, w.flags]);

  const markers = useMemo(
    () => markersFor(mod, w, { crew, activeId, youRoom: you, wardenView, objectives }),
    [mod, w, crew, activeId, you, wardenView, objectives]
  );

  /* Who is standing where, as pips along the bottom edge of a room.
     The existing crew marker is one square in the corner regardless
     of whether that is one person or five, which is exactly the fact
     a player wants when deciding whether to split the party. */
  const pips = useMemo(() => {
    const byRoom = {};
    for (const c of crew || []) {
      const at = c.room || w.room;
      if (!at) continue;
      (byRoom[at] = byRoom[at] || []).push(c);
    }
    return byRoom;
  }, [crew, you]);

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
      const from = floor.pos[focus] || floor.pos[you];
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
      setView(centreOn(floor, mod.rooms, you, VIEWPORT, 1));
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
        aria-label={`Map of ${mod.title}, ${floor.name}. You are in ${mod.rooms[you].name}. Arrow keys to move the cursor, Enter to travel, plus and minus to zoom, Page Up and Page Down to change deck.`}
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
          {/* ---- room textures, keyed to tags ----
              A schematic tells you where a room is. Texture tells you
              what it is like to stand in it, which is the thing a
              Warden otherwise has to say out loud every time somebody
              opens a door. All of it is pattern fills over the same
              boxes, so nothing about the layout maths changes. */}
          <pattern id="tex-vacuum" width="10" height="10" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill="none" />
            <circle cx="2" cy="3" r="0.8" fill="var(--graphite)" opacity="0.55" />
            <circle cx="7" cy="8" r="0.6" fill="var(--graphite)" opacity="0.4" />
          </pattern>
          <pattern id="tex-organic" width="14" height="14" patternUnits="userSpaceOnUse">
            <path d="M0 7 q3.5 -5 7 0 t7 0" fill="none" stroke="var(--blood)"
              strokeWidth="1.1" opacity="0.42" />
          </pattern>
          <pattern id="tex-industrial" width="8" height="8" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="8" y2="0" stroke="var(--graphite)" strokeWidth="1" opacity="0.35" />
            <line x1="0" y1="4" x2="8" y2="4" stroke="var(--graphite)" strokeWidth="0.6" opacity="0.22" />
          </pattern>
          <pattern id="tex-medical" width="12" height="12" patternUnits="userSpaceOnUse">
            <path d="M6 3 v6 M3 6 h6" stroke="var(--graphite)" strokeWidth="0.9" opacity="0.3" />
          </pattern>
          <pattern id="tex-derelict" width="9" height="9" patternUnits="userSpaceOnUse"
            patternTransform="rotate(-30)">
            <line x1="0" y1="0" x2="0" y2="9" stroke="var(--graphite)" strokeWidth="0.8" opacity="0.34" />
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
            const here = you === id;
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

                {/* Texture, over the fill and under everything else. Only
                    for rooms the crew has actually been in: a room you
                    have merely glimpsed does not yet have a character. */}
                {state === FOG.KNOWN && textureFor(room.tags) && (
                  <rect x={box.x} y={box.y} width={box.w} height={box.h}
                    fill={`url(#${textureFor(room.tags)})`} pointerEvents="none" />
                )}

                {/* A deck with no power reads as a room drawn in pencil
                    rather than ink — present, but not working. */}
                {room.unpowered && state !== FOG.RUMOURED && (
                  <rect x={box.x} y={box.y} width={box.w} height={box.h}
                    fill="var(--void)" opacity="0.42" pointerEvents="none" />
                )}

                {/* The Warden's screen, and only the Warden's screen,
                    shows where the thing actually is. On the player map
                    a threat marker appears when it is looked at, which
                    is the same rule secrets.js enforces on the wire. */}
                {wardenView && threat && (
                  <rect className="map2-threat-pulse"
                    x={box.x - 3} y={box.y - 3} width={box.w + 6} height={box.h + 6}
                    fill="none" stroke="var(--blood)" strokeWidth="3" pointerEvents="none" />
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

                {/* crew pips — one per person actually in the room */}
                {state !== FOG.RUMOURED && (pips[id] || []).slice(0, 6).map((c, ci) => (
                  <g key={c.id} className={`map2-pip${c.id === activeId ? " is-me" : ""}${c.alive === false ? " is-out" : ""}`}>
                    <circle
                      cx={box.x + 10 + ci * 11}
                      cy={box.y + box.h - 9}
                      r={c.id === activeId ? 4.4 : 3.4}
                      fill={c.alive === false ? "none" : c.id === activeId ? "var(--accent)" : "var(--ink)"}
                      stroke="var(--ink)"
                      strokeWidth={c.alive === false ? 1.4 : 1}
                    />
                    <title>{`${c.name}${c.alive === false ? " (dead)" : ""}`}</title>
                  </g>
                ))}

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

        {/* the crew just came down this corridor */}
        {trail && (() => {
          const d = linkPath(mod.rooms, floor, trail.from, trail.to);
          if (!d) return null;
          return (
            <g className="map2-trail" aria-hidden="true">
              <path d={d} fill="none" stroke="var(--accent)" strokeWidth="4"
                strokeLinecap="round" opacity="0.55" />
              <circle r="5" fill="var(--accent)">
                <animateMotion dur="0.9s" fill="freeze" path={d} />
              </circle>
            </g>
          );
        })()}

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
          <button className="btn tiny" onClick={() => setView(centreOn(floor, mod.rooms, you, VIEWPORT, 1))}>
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
