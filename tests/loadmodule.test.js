// @vitest-environment jsdom
/* ============================================================
   RUNTIME MODULE LOADING

   jsdom because moduleStore is built on localStorage. The engine
   half (portableModule.js) has no DOM dependency at all and would
   run in node; they are tested together because they are one
   feature and splitting them would hide the seam.

   A loaded module is somebody else's file. Nearly every test here
   is about what happens when it is wrong, malicious, or written
   by a person who has not read the format doc — because the
   happy path was never the risk.
   ============================================================ */

import { describe, it, expect, beforeEach } from "vitest";
import {
  readPortableModule, unwrap, toPortable, portableFilename,
  PMOD_KIND, PMOD_VERSION, PMOD_EXT,
} from "../src/engine/portableModule.js";
import {
  installModule, loadInstalled, removeModule, exportInstalled,
  clearShelf, installedIds, mergeModules,
} from "../src/engine/moduleStore.js";
import ypsilon from "../src/modules/ypsilon14/index.js";

/* A minimal but genuinely valid module. */
const good = () => ({
  id: "test-hold",
  title: "THE THING IN THE HOLD",
  blurb: "Something is in the cargo.",
  start: "hold",
  rooms: {
    hold: {
      name: "CARGO HOLD",
      look: "Containers, stacked four high.",
      exits: [{ to: "bridge", label: "Ladder up", mins: 2 }],
      features: { crate: { name: "A split crate", d: "Empty." } },
    },
    bridge: { name: "BRIDGE", look: "Dark.", exits: [{ to: "hold", label: "Down", mins: 2 }] },
  },
  endings: { out: { title: "OUT", text: "You leave.", good: true } },
});

const wrap = (module) => JSON.stringify({ kind: PMOD_KIND, v: PMOD_VERSION, module });

beforeEach(() => { localStorage.clear(); clearShelf(); });

/* ---------------- the envelope ---------------- */

describe("unwrap", () => {
  it("accepts a wrapped module", () => {
    const r = unwrap(wrap(good()));
    expect(r.ok).toBe(true);
    expect(r.raw.id).toBe("test-hold");
  });

  it("accepts a bare module, because people will hand-write these", () => {
    const r = unwrap(JSON.stringify(good()));
    expect(r.ok).toBe(true);
  });

  it("accepts an already-parsed object", () => {
    expect(unwrap(good()).ok).toBe(true);
  });

  it("refuses invalid JSON with the parser's reason", () => {
    const r = unwrap("{ nope");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/valid JSON/i);
  });

  it("refuses a save file by name", () => {
    const r = unwrap(JSON.stringify({ kind: "mothership-save", save: {} }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/mothership-save/);
  });

  it("refuses a format version from the future", () => {
    const r = unwrap(JSON.stringify({ kind: PMOD_KIND, v: PMOD_VERSION + 1, module: good() }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Update the engine/);
  });

  it("refuses arrays and primitives", () => {
    expect(unwrap("[]").ok).toBe(false);
    expect(unwrap("42").ok).toBe(false);
    expect(unwrap('"a string"').ok).toBe(false);
  });
});

/* ---------------- reading ---------------- */

describe("readPortableModule", () => {
  it("returns a module the engine can use", () => {
    const r = readPortableModule(wrap(good()));
    expect(r.ok).toBe(true);
    expect(r.mod.title).toBe("THE THING IN THE HOLD");
    expect(r.mod.portable).toBe(true);
    expect(r.mod.problems).toEqual([]);
  });

  it("fills in engine defaults — gear, loadouts, a map", () => {
    const { mod } = readPortableModule(wrap(good()));
    expect(Object.keys(mod.items).length).toBeGreaterThan(10);
    expect(mod.loadouts).toBeTruthy();
    expect(mod.map.pos.hold).toBeTruthy();
  });

  it("refuses hooks outright and says why", () => {
    const r = readPortableModule(wrap({ ...good(), hooks: { boom: "not a function" } }));
    expect(r.ok).toBe(false);
    expect(r.detail.join(" ")).toMatch(/cannot carry JavaScript hooks/);
  });

  it("refuses { run: … } with the real reason, not a dangling reference", () => {
    const m = good();
    m.rooms.hold.onEnter = [{ run: "spookyThing" }];
    const r = readPortableModule(wrap(m));
    expect(r.ok).toBe(false);
    /* The unhelpful version of this error is "run spookyThing has no
       matching hook", which is true and tells the author nothing. */
    expect(r.detail.join(" ")).toMatch(/cannot carry hooks/);
    expect(r.detail.join(" ")).toMatch(/spookyThing/);
  });

  it("finds a run effect nested deep inside control flow", () => {
    const m = good();
    m.rooms.hold.onEnter = [
      { when: "has:keycard", then: [{ pick: [[1, [{ run: "buried" }]]] }] },
    ];
    const r = readPortableModule(wrap(m));
    expect(r.ok).toBe(false);
    expect(r.detail.join(" ")).toMatch(/buried/);
  });

  it("drops unknown keys rather than passing them through", () => {
    const r = readPortableModule(wrap({ ...good(), evilPayload: { a: 1 } }));
    expect(r.ok).toBe(true);
    expect(r.mod.evilPayload).toBeUndefined();
    expect(r.mod.warnings.join(" ")).toMatch(/evilPayload/);
  });

  it("refuses a module that somehow contains a function", () => {
    const r = readPortableModule({ ...good(), rooms: { hold: { name: "X", look: () => "no" } } });
    expect(r.ok).toBe(false);
    expect(r.detail.join(" ")).toMatch(/functions/);
  });

  it("keeps validation problems on the module instead of failing the load", () => {
    /* Same behaviour as a bundled module: it appears on the shelf with
       its problems listed and the library refuses to start it. */
    const m = good();
    m.rooms.hold.exits = [{ to: "nowhere", label: "A door", mins: 1 }];
    const r = readPortableModule(wrap(m));
    expect(r.ok).toBe(true);
    expect(r.mod.problems.length).toBeGreaterThan(0);
  });

  it("warns about a device that would have needed a function", () => {
    const m = good();
    m.devices = { term: { title: "Terminal", label: "Use it", status: ["READY"], actions: [] } };
    const r = readPortableModule(wrap(m));
    expect(r.ok).toBe(true);
    expect(r.mod.warnings.join(" ")).toMatch(/status lines need a function/);
  });

  it("never throws on garbage", () => {
    for (const junk of ["", "null", "{}", '{"id":1}', JSON.stringify({ id: "x", title: "y", rooms: "no" })]) {
      expect(() => readPortableModule(junk)).not.toThrow();
    }
  });
});

/* ---------------- writing ---------------- */

describe("toPortable", () => {
  it("round-trips a simple module", () => {
    const first = readPortableModule(wrap(good()));
    const { json } = toPortable(first.mod);
    const second = readPortableModule(json);
    expect(second.ok).toBe(true);
    expect(second.mod.id).toBe(first.mod.id);
    expect(Object.keys(second.mod.rooms)).toEqual(Object.keys(first.mod.rooms));
  });

  it("reports what could not travel when dumping a bundled module", () => {
    const { json, lost } = toPortable(ypsilon);
    /* Ypsilon 14 simulates its creature in JS. That cannot survive, and
       the export has to say so rather than hand over a file that looks
       complete and plays wrong. */
    expect(lost.length).toBeGreaterThan(0);
    expect(lost.join(" ")).toMatch(/hooks/);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("strips every function rather than emitting something unparseable", () => {
    /* Not a text search — the word "function" and the token "=>" both occur
       legitimately in module prose. What matters is that the structure that
       comes back out contains no callable values and no hooks block. */
    const { json } = toPortable(ypsilon);
    const parsed = JSON.parse(json);
    expect(parsed.module.hooks).toBeUndefined();

    let callables = 0;
    const walk = (n, d = 0) => {
      if (!n || typeof n !== "object" || d > 24) return;
      for (const v of Object.values(n)) {
        if (typeof v === "function") callables++;
        else walk(v, d + 1);
      }
    };
    walk(parsed);
    expect(callables).toBe(0);
  });

  it("emits a module that still loads", () => {
    const { json } = toPortable(ypsilon);
    const back = readPortableModule(json);
    /* Ypsilon 14 without its hooks is not a playable module, and the
       re-read has to say so rather than pretend. Either it refuses for
       the run-effects it can no longer satisfy, or it loads carrying
       problems — never silently fine. */
    if (back.ok) expect(back.mod.problems.length).toBeGreaterThan(0);
    else expect(back.detail.join(" ")).toMatch(/hooks/);
  });

  it("makes a filesystem-safe filename", () => {
    expect(portableFilename({ id: "My Module/v2" })).toBe(`my-module-v2${PMOD_EXT}`);
    expect(portableFilename({})).toBe(`module${PMOD_EXT}`);
  });
});

/* ---------------- the shelf ---------------- */

describe("moduleStore", () => {
  it("installs and reads back", () => {
    expect(installModule(wrap(good())).ok).toBe(true);
    const { mods, broken } = loadInstalled();
    expect(mods).toHaveLength(1);
    expect(broken).toHaveLength(0);
    expect(mods[0].title).toBe("THE THING IN THE HOLD");
  });

  it("refuses a duplicate id, then allows an explicit overwrite", () => {
    installModule(wrap(good()));
    const dup = installModule(wrap({ ...good(), title: "DIFFERENT" }));
    expect(dup.ok).toBe(false);
    expect(dup.conflict).toBe("test-hold");

    expect(installModule(wrap({ ...good(), title: "DIFFERENT" }), { overwrite: true }).ok).toBe(true);
    expect(loadInstalled().mods[0].title).toBe("DIFFERENT");
  });

  it("does not install a module that fails to read", () => {
    expect(installModule(wrap({ ...good(), hooks: { a: 1 } })).ok).toBe(false);
    expect(installedIds()).toEqual([]);
  });

  it("removes cleanly", () => {
    installModule(wrap(good()));
    expect(removeModule("test-hold")).toBe(true);
    expect(loadInstalled().mods).toHaveLength(0);
    expect(removeModule("test-hold")).toBe(false);
  });

  it("gives back the bytes that were stored, not a re-serialisation", () => {
    const text = wrap(good());
    installModule(text);
    expect(exportInstalled("test-hold")).toBe(text);
  });

  it("reports a stored module that no longer parses instead of hiding it", () => {
    installModule(wrap(good()));
    /* The realistic corruption: a module stored by a NEWER engine, now
       being read by an older one. Downgrading is not exotic — it is what
       happens when a table syncs a shared file and one laptop is behind. */
    const raw = JSON.parse(localStorage.getItem("rpg-engine:shelf:v1"));
    raw.mods["test-hold"].json = JSON.stringify({
      kind: "rpg-engine-module", v: 99, module: good(),
    });
    localStorage.setItem("rpg-engine:shelf:v1", JSON.stringify(raw));

    const { mods, broken } = loadInstalled();
    expect(mods).toHaveLength(0);
    expect(broken).toHaveLength(1);
    expect(broken[0].title).toBe("THE THING IN THE HOLD");
    expect(broken[0].error).toMatch(/Update the engine/);
  });

  it("keeps a titleless module identifiable on the shelf", () => {
    installModule(wrap(good()));
    const raw = JSON.parse(localStorage.getItem("rpg-engine:shelf:v1"));
    raw.mods["test-hold"].json = JSON.stringify({
      kind: "rpg-engine-module", v: 1, module: { id: "test-hold", rooms: {} },
    });
    localStorage.setItem("rpg-engine:shelf:v1", JSON.stringify(raw));

    /* It parses, so it lands on the shelf carrying problems — the same
       place a broken bundled module lands. It must still have a name. */
    const { mods } = loadInstalled();
    expect(mods).toHaveLength(1);
    expect(mods[0].title).toBe("THE THING IN THE HOLD");
    expect(mods[0].problems.length).toBeGreaterThan(0);
  });

  it("survives corrupt storage without throwing", () => {
    localStorage.setItem("rpg-engine:shelf:v1", "not json at all");
    expect(() => loadInstalled()).not.toThrow();
    expect(loadInstalled().mods).toEqual([]);
  });

  it("keeps the shelf separate from saves", () => {
    installModule(wrap(good()));
    /* storage.js owns "mothership:v2"; the shelf must not be under it. */
    expect(localStorage.getItem("mothership:v2")).toBeNull();
    expect(localStorage.getItem("rpg-engine:shelf:v1")).toBeTruthy();
  });
});

describe("mergeModules", () => {
  it("appends loaded modules after bundled ones", () => {
    const merged = mergeModules([{ id: "a" }], [{ id: "b" }]);
    expect(merged.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("does not let a loaded module shadow a bundled one", () => {
    const merged = mergeModules([{ id: "a", bundled: true }], [{ id: "a", bundled: false }]);
    expect(merged).toHaveLength(1);
    expect(merged[0].bundled).toBe(true);
  });
});
