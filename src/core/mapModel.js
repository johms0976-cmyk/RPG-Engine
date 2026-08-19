/* ============================================================
   MAP MODEL v2 — the layout format, not the renderer.

   v1 assumed one floor, one rectangle size for every room, and a
   hand-authored `pos` table. That falls over at about 20 rooms
   and cannot express Gradient Descent at all, which is nine
   floors of a facility where the vertical relationships are the
   whole point.

   v2 adds:
     - FLOORS (z-levels) with their own extents and links between
       them, so a lift shaft is a first-class object.
     - SHAPES per room: rect, or an explicit polygon, plus a size
       so a hangar reads as a hangar.
     - MARKERS derived from live world state — threats, crew,
       NPCs, objectives — rather than baked into the layout.
     - REAL FOG OF WAR: unvisited-but-adjacent rooms show as a
       shape with no detail; rooms you have never heard of are
       not drawn at all.
     - AUTO-LAYOUT that is deterministic and force-free, so a
       60-room module with no hand layout still produces
       something legible instead of a hairball.

   v1 layouts still load: normalizeMap() upgrades them.
   ============================================================ */

export const MAP_VERSION = 2;

const GRID = 4;                 // layout snaps to this, in svg units
export const CELL = { w: 116, h: 52, gapX: 26, gapY: 30 };

/* ---------------- shapes ---------------- */

/** A room's footprint. `w`/`h` are in cells, not pixels. */
export const shapeOf = (room) => {
  const s = room.shape || {};
  return {
    kind: s.points ? "poly" : "rect",
    points: s.points || null,
    w: Math.max(1, s.w || 1),
    h: Math.max(1, s.h || 1),
    round: !!s.round,
  };
};

export const roomBox = (room, [x, y]) => {
  const s = shapeOf(room);
  return { x, y, w: CELL.w * s.w + CELL.gapX * (s.w - 1), h: CELL.h * s.h + CELL.gapY * (s.h - 1) };
};

/* ---------------- normalisation ---------------- */

/**
 * Upgrade any map block — v1, v2, or absent — into a v2 layout.
 * Never throws: a broken layout downgrades to auto-layout rather
 * than taking the session with it.
 */
export function normalizeMap(mod) {
  const raw = mod.map || {};
  if (raw.v === MAP_VERSION && raw.floors) return raw;

  const rooms = mod.rooms || {};
  const onMap = Object.keys(rooms).filter((id) => rooms[id].onMap !== false);

  // --- v1: single implicit floor from `pos` ---
  if (raw.pos && Object.keys(raw.pos).length) {
    const scaleX = CELL.w / (raw.BW || 104);
    const scaleY = CELL.h / (raw.BH || 46);
    const pos = {};
    for (const [id, [x, y]] of Object.entries(raw.pos)) {
      pos[id] = [Math.round(x * scaleX), Math.round(y * scaleY)];
    }
    return {
      v: MAP_VERSION,
      floors: [{
        id: "main",
        name: raw.name || "LAYOUT",
        z: 0,
        pos,
        links: (raw.links || []).map((l) => ({ ...l, scaled: false })),
        extras: raw.extras || [],
        width: Math.round((raw.width || 360) * scaleX),
        height: Math.round((raw.height || 302) * scaleY),
      }],
      shafts: [],
      legend: raw.legend || [],
      upgraded: true,
    };
  }

  // --- authored v2 floors ---
  if (Array.isArray(raw.floors) && raw.floors.length) {
    return {
      v: MAP_VERSION,
      floors: raw.floors.map((f, i) => ({
        id: f.id || `f${i}`,
        name: f.name || `DECK ${i}`,
        z: f.z != null ? f.z : i,
        pos: f.pos || {},
        links: f.links || [],
        extras: f.extras || [],
        ...extentOf(f, rooms),
      })),
      shafts: raw.shafts || [],
      legend: raw.legend || [],
    };
  }

  // --- nothing authored: derive it ---
  return autoLayout(mod, onMap);
}

function extentOf(floor, rooms) {
  let maxX = 0, maxY = 0;
  for (const [id, [x, y]] of Object.entries(floor.pos || {})) {
    const r = rooms[id];
    if (!r) continue;
    const b = roomBox(r, [x, y]);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  return { width: floor.width || maxX + 40, height: floor.height || maxY + 40 };
}

/* ---------------- auto-layout ---------------- */

/**
 * Deterministic BFS layering. Rooms are placed in bands by their
 * distance from the start room, which for a dungeon-shaped map is
 * almost always the shape the author had in their head anyway.
 *
 * Floors come from `room.z` (or `room.floor`) when the module
 * declares them; otherwise everything lands on one deck.
 */
export function autoLayout(mod, ids) {
  const rooms = mod.rooms || {};
  const list = ids || Object.keys(rooms).filter((id) => rooms[id].onMap !== false);

  const zOf = (id) => {
    const r = rooms[id] || {};
    return r.z != null ? r.z : (r.floor != null ? r.floor : 0);
  };

  const byZ = new Map();
  for (const id of list) {
    const z = zOf(id);
    if (!byZ.has(z)) byZ.set(z, []);
    byZ.get(z).push(id);
  }

  const floors = [...byZ.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([z, members]) => {
      const set = new Set(members);
      const depth = bfsDepth(mod, members, set);

      const bands = new Map();
      for (const id of members) {
        const d = depth[id] ?? 0;
        if (!bands.has(d)) bands.set(d, []);
        bands.get(d).push(id);
      }

      const pos = {};
      let y = 20;
      let width = 0;
      // Wide bands wrap so a 20-room band does not become a 4000px row.
      const perRow = Math.max(3, Math.ceil(Math.sqrt(members.length) * 1.4));

      for (const d of [...bands.keys()].sort((a, b) => a - b)) {
        const band = bands.get(d).sort();
        for (let i = 0; i < band.length; i += perRow) {
          const row = band.slice(i, i + perRow);
          let x = 20;
          let rowH = CELL.h;
          for (const id of row) {
            const b = roomBox(rooms[id], [snap(x), snap(y)]);
            pos[id] = [snap(x), snap(y)];
            x += b.w + CELL.gapX;
            rowH = Math.max(rowH, b.h);
          }
          width = Math.max(width, x);
          y += rowH + CELL.gapY;
        }
      }

      return {
        id: `z${z}`,
        name: floorName(mod, z),
        z,
        pos,
        links: [],
        extras: [],
        width: width + 20,
        height: y + 10,
        auto: true,
      };
    });

  return { v: MAP_VERSION, floors, shafts: deriveShafts(mod, list, zOf), legend: [], auto: true };
}

const snap = (n) => Math.round(n / GRID) * GRID;

const floorName = (mod, z) =>
  (mod.floors && mod.floors[z] && mod.floors[z].name) || (z === 0 ? "MAIN DECK" : z > 0 ? `DECK ${z}` : `SUB ${Math.abs(z)}`);

function bfsDepth(mod, members, set) {
  const depth = {};
  const start = members.includes(mod.start) ? mod.start : members[0];
  const q = [start];
  depth[start] = 0;
  while (q.length) {
    const cur = q.shift();
    for (const ex of (mod.rooms[cur].exits || [])) {
      const to = String(ex.to);
      if (to.startsWith("@") || !set.has(to) || depth[to] != null) continue;
      depth[to] = depth[cur] + 1;
      q.push(to);
    }
  }
  // Anything unreachable from the start still needs a home.
  let orphanDepth = Math.max(0, ...Object.values(depth)) + 1;
  for (const id of members) if (depth[id] == null) depth[id] = orphanDepth;
  return depth;
}

/** Exits that cross a z-level become shafts on the overview. */
function deriveShafts(mod, list, zOf) {
  const shafts = [];
  const seen = new Set();
  for (const id of list) {
    for (const ex of (mod.rooms[id].exits || [])) {
      const to = String(ex.to);
      if (to.startsWith("@") || !mod.rooms[to]) continue;
      const a = zOf(id), b = zOf(to);
      if (a === b) continue;
      const key = [id, to].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      shafts.push({ from: id, to, fromZ: a, toZ: b, kind: ex.kind || "shaft", label: ex.label || null });
    }
  }
  return shafts;
}

/* ---------------- fog of war ---------------- */

export const FOG = { HIDDEN: 0, RUMOURED: 1, SEEN: 2, KNOWN: 3 };

/**
 * Real fog of war, in four states:
 *   KNOWN     you have stood in it
 *   SEEN      you can see into it from here (an open exit)
 *   RUMOURED  something has told you it exists — an adjacent exit
 *             you have not taken, a map handout, a module flag
 *   HIDDEN    you have no reason to believe it is there
 *
 * Hidden rooms are not drawn at all. That is the difference
 * between a fog-of-war map and a map with some grey boxes on it.
 */
export function fogState(mod, w, roomId) {
  if (w.visited && w.visited[roomId]) return FOG.KNOWN;

  const here = mod.rooms[w.room];
  if (here) {
    for (const ex of (here.exits || [])) {
      if (String(ex.to) !== roomId) continue;
      if (ex.hidden && !w.flags[ex.hidden]) continue;
      return ex.opaque ? FOG.RUMOURED : FOG.SEEN;
    }
  }

  // Revealed by a handout, a terminal, or an explicit flag.
  const room = mod.rooms[roomId];
  if (room && room.revealedBy && w.flags[room.revealedBy]) return FOG.RUMOURED;
  if (w.flags && w.flags[`map:${roomId}`]) return FOG.RUMOURED;
  if (w.flags && w.flags["map:all"]) return FOG.RUMOURED;

  // Adjacent to somewhere you have been: you saw the door, at least.
  for (const [id, r] of Object.entries(mod.rooms)) {
    if (!w.visited || !w.visited[id]) continue;
    for (const ex of (r.exits || [])) {
      if (String(ex.to) === roomId && !(ex.hidden && !w.flags[ex.hidden])) return FOG.RUMOURED;
    }
  }
  return FOG.HIDDEN;
}

/* ---------------- markers ---------------- */

/**
 * Derive every marker from live state. The layout stays static;
 * the map is a view over the world, not a second copy of it.
 */
export function markersFor(mod, w, opts = {}) {
  const marks = {};
  const push = (roomId, m) => {
    if (!roomId || !mod.rooms[roomId]) return;
    (marks[roomId] = marks[roomId] || []).push(m);
  };

  for (const [id, t] of Object.entries(w.threats || {})) {
    if (t.dead || !t.loc) continue;
    const known = w.visited[t.loc] || t.loc === (opts.youRoom || w.room);
    if (!known && !opts.wardenView) continue;
    push(t.loc, {
      kind: "threat",
      id,
      label: (mod.threats[id] && mod.threats[id].name) || "?",
      hot: t.retreatUntil < w.clock,
    });
  }

  for (const [id, n] of Object.entries(w.npcs || {})) {
    if (!n.alive || n.taken || !n.loc) continue;
    if (!n.met && !opts.wardenView) continue;
    push(n.loc, { kind: "npc", id, label: (mod.npcs[id] && mod.npcs[id].name) || "?" });
  }

  for (const c of (opts.crew || [])) {
    if (c.alive === false) continue;
    push(c.room || w.room, { kind: "crew", id: c.id, label: c.name, active: c.id === opts.activeId });
  }

  for (const o of (opts.objectives || [])) push(o.room, { kind: "objective", label: o.label });

  // Module-declared points of interest that the crew has learned about.
  for (const [id, r] of Object.entries(mod.rooms)) {
    if (r.marker && (w.visited[id] || opts.wardenView)) push(id, { kind: "poi", label: r.marker });
  }

  return marks;
}

/* ---------------- viewport ---------------- */

/** Clamp a pan/zoom viewport to the floor's extents. */
export function clampView(view, floor, viewport) {
  const zoom = Math.max(0.4, Math.min(4, view.zoom));
  const vw = viewport.w / zoom;
  const vh = viewport.h / zoom;
  const maxX = Math.max(0, floor.width - vw);
  const maxY = Math.max(0, floor.height - vh);
  return {
    zoom,
    x: floor.width <= vw ? (floor.width - vw) / 2 : Math.max(0, Math.min(maxX, view.x)),
    y: floor.height <= vh ? (floor.height - vh) / 2 : Math.max(0, Math.min(maxY, view.y)),
  };
}

/** Centre the viewport on a room. */
export function centreOn(floor, rooms, roomId, viewport, zoom = 1) {
  const p = floor.pos[roomId];
  if (!p) return { zoom, x: 0, y: 0 };
  const b = roomBox(rooms[roomId], p);
  return clampView({
    zoom,
    x: b.x + b.w / 2 - viewport.w / (2 * zoom),
    y: b.y + b.h / 2 - viewport.h / (2 * zoom),
  }, floor, viewport);
}

/** Which floor is a room on? */
export const floorOf = (map, roomId) =>
  map.floors.find((f) => f.pos[roomId]) || map.floors[0];

/** Straight-line connector between two rooms on the same floor. */
export function linkPath(rooms, floor, from, to) {
  const a = floor.pos[from], b = floor.pos[to];
  if (!a || !b) return null;
  const ba = roomBox(rooms[from], a), bb = roomBox(rooms[to], b);
  const ax = ba.x + ba.w / 2, ay = ba.y + ba.h / 2;
  const bx = bb.x + bb.w / 2, by = bb.y + bb.h / 2;
  // Orthogonal dogleg — reads as ship corridors rather than string.
  const mid = Math.abs(bx - ax) > Math.abs(by - ay) ? `${(ax + bx) / 2},${ay} ${(ax + bx) / 2},${by}` : `${ax},${(ay + by) / 2} ${bx},${(ay + by) / 2}`;
  return `M ${ax},${ay} L ${mid} L ${bx},${by}`;
}

/** Every same-floor exit pair, deduplicated, for drawing corridors. */
export function corridorsFor(mod, floor) {
  const out = [];
  const seen = new Set();
  for (const id of Object.keys(floor.pos)) {
    for (const ex of (mod.rooms[id].exits || [])) {
      const to = String(ex.to);
      if (to.startsWith("@") || !floor.pos[to]) continue;
      const key = [id, to].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ from: id, to, kind: ex.kind || "door", hidden: ex.hidden || null });
    }
  }
  return out;
}
