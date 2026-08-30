/* ============================================================
   DOSSIER — what the Warden is holding, and what has gone off.

   Every module already ships the material a Warden needs: the
   setting brief, the voice, the constraints, the endings, and
   the `knows` list that is simultaneously each NPC's script and
   the hard ceiling on what they may say. All of it was written
   and none of it was on screen. The Warden's answer to "wait,
   what does Sonya know about the shower?" was to alt-tab to a
   markdown file, which is the moment the session stops.

   So this reads the loaded module against the live world and
   produces a Warden-only view of it, with the things that have
   already happened ticked off:

     · secrets      the module's flags, and whether they are set
     · triggers     clocks and countdowns, running or not
     · cast         every NPC's knows list, marked told/untold
     · endings      which are still reachable
     · constraints  the module's own rules for running it

   Pure. No DOM, no state, no writes. Given the same module and
   the same world it returns the same object, which is what makes
   it testable and what keeps it honest: the dossier cannot
   invent a secret the module did not write.
   ============================================================ */

/** Turn a flag id into something a human can read at speed.
    `knows_water` -> "knows water". Module authors name flags well;
    this only has to undo the underscores. */
export const readableFlag = (id) =>
  String(id).replace(/[_:]+/g, " ").replace(/\b(\w)/g, (m) => m).trim();

/**
 * Every flag the module can set, gathered from the places a module
 * is allowed to set one. This is a static read of the module — it
 * does not care what has happened yet.
 */
export function declaredFlags(mod) {
  const found = new Map();   // id -> Set of "where"

  const note = (id, where) => {
    if (!id || typeof id !== "string") return;
    if (!found.has(id)) found.set(id, new Set());
    found.get(id).add(where);
  };

  const walkEffects = (effects, where) => {
    for (const e of effects || []) {
      if (!e || typeof e !== "object") continue;
      if (typeof e.flag === "string") note(e.flag, where);
      else if (e.flag && typeof e.flag === "object") {
        for (const k of Object.keys(e.flag)) note(k, where);
      }
      // Effects nest: when/then, onFail, onPass, choices.
      for (const key of ["then", "else", "onFail", "onPass", "onCrit", "effects"]) {
        if (Array.isArray(e[key])) walkEffects(e[key], where);
      }
    }
  };

  for (const [id, r] of Object.entries(mod.rooms || {})) {
    walkEffects(r.onEnter, r.name || id);
    walkEffects(r.onFirstEnter, r.name || id);
    for (const [k, f] of Object.entries(r.features || {})) {
      walkEffects(f.effects, `${r.name || id} — ${f.name || k}`);
      /* `setsFlag` is the shorthand form and it was invisible here.
         A feature that sets a flag by declaring `setsFlag` rather
         than by running `{ flag: … }` is doing the same thing, and
         the Warden's list of secrets has never included any of
         them. */
      if (typeof f.setsFlag === "string") note(f.setsFlag, `${r.name || id} — ${f.name || k}`);
    }
    for (const a of r.actions || []) walkEffects(a.effects, r.name || id);
    /* THE GATES, which are the flags that matter most and were the
       ones missing. A locked door's flag IS the state of that door,
       it is the single most common flag in every module in the
       repository, and until now `declaredFlags` walked past every
       one of them because a gate is not an effect. The Warden's
       dossier has been listing the module's secrets minus its
       locks. */
    for (const e of r.exits || []) {
      if (!e || !e.gate) continue;
      const where = `${r.name || id} — ${e.label || `to ${e.to}`}`;
      if (typeof e.gate.flag === "string") note(e.gate.flag, where);
      for (const rt of e.gate.routes || []) walkEffects(rt.effects, where);
    }
  }
  for (const [id, h] of Object.entries(mod.handouts || {})) walkEffects(h.effects, h.label || id);
  for (const [id, d] of Object.entries(mod.devices || {})) {
    for (const a of d.actions || []) walkEffects(a.effects, d.title || id);
  }
  for (const a of mod.actions || []) walkEffects(a.effects, "module action");
  for (const c of mod.clocks || []) walkEffects(c.effects, `clock ${c.id}`);

  return [...found.entries()].map(([id, wheres]) => ({ id, where: [...wheres] }));
}

/**
 * The whole dossier for the Warden's screen.
 * `w` may be undefined (title screen), in which case nothing is fired.
 */
export function dossierFor(mod, w) {
  const flags = (w && w.flags) || {};
  const npcState = (w && w.npcs) || {};
  const clockState = (w && w.clocks) || {};
  const countdowns = (w && w.countdowns) || {};

  const secrets = declaredFlags(mod)
    .map((f) => ({ ...f, fired: !!flags[f.id], label: readableFlag(f.id) }))
    .sort((a, b) => {
      if (a.fired !== b.fired) return a.fired ? 1 : -1;
      return a.id.localeCompare(b.id);
    });

  const triggers = [
    ...(mod.clocks || []).map((c) => {
      const st = clockState[c.id] || {};
      return {
        id: c.id,
        kind: "clock",
        label: c.id.toUpperCase(),
        detail: c.every ? `every ${c.every}` : c.start != null ? `at ${c.start}` : "once",
        running: st.on !== false,
        next: st.next,
      };
    }),
    ...Object.entries(countdowns).map(([id, c]) => ({
      id,
      kind: "countdown",
      label: id.toUpperCase(),
      detail: `${c.left}m left`,
      running: !c.paused,
      next: c.left,
    })),
  ];

  const cast = (mod.npcOrder || Object.keys(mod.npcs || {})).map((id) => {
    const n = mod.npcs[id] || {};
    const st = npcState[id] || {};
    const told = new Set(st.told || []);
    const knows = (n.knows || []).map((text, i) => ({
      i,
      text,
      told: told.has(i) || told.has(text),
    }));
    return {
      id,
      name: n.name || id,
      role: n.role || "",
      note: n.note || null,
      brief: n.brief || null,
      alive: st.alive !== false,
      met: !!st.met,
      loc: st.loc || null,
      where: st.loc && mod.rooms[st.loc] ? mod.rooms[st.loc].name : null,
      knows,
      left: knows.filter((k) => !k.told).length,
    };
  });

  const endings = Object.entries(mod.endings || {}).map(([id, e]) => ({
    id,
    title: e.title || id,
    good: !!e.good,
    reached: !!(w && w.ended === id),
  }));

  return {
    title: mod.title,
    setting: (mod.warden && mod.warden.setting) || null,
    voice: (mod.warden && mod.warden.voice) || null,
    constraints: (mod.warden && mod.warden.constraints) || [],
    npcNote: (mod.warden && mod.warden.npcNote) || null,
    secrets,
    triggers,
    cast,
    endings,
    counts: {
      secretsFired: secrets.filter((s) => s.fired).length,
      secretsTotal: secrets.length,
      linesLeft: cast.reduce((n, c) => n + c.left, 0),
    },
  };
}
