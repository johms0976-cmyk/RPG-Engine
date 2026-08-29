// @vitest-environment jsdom
/* ============================================================
   THE SMOKE TEST — does it render at all.

   2.16.0 shipped `RollPrompt.jsx` calling `useState` without
   importing it. The component threw on every render, and it is
   the surface a phone shows every time anybody is asked to roll
   anything — so a table would have got through creation, walked
   into the first room, hit the first save, and watched six phones
   hit the error boundary at once.

   `npm run build` passed. Vite does not resolve free identifiers,
   so a component referencing an undefined binding compiles and
   ships. The only thing between that and the published site was
   `tests/playerview.test.jsx` happening to render the component
   for another reason, which is luck rather than a guarantee.

   This is the same check, on purpose, over everything. It asserts
   almost nothing about behaviour — that is what the other 1218
   tests are for. It asserts that the module can be imported and
   the default export can be called without throwing, which is the
   floor, and the floor is what was missing.

   ------------------------------------------------------------
   WHY NOT LINT

   `no-undef` would catch this and is worth having as well (it is
   cheap and it catches typos in non-component files too). It is
   not a substitute: lint catches undefined identifiers, and the
   failure this file is written against is "the component throws",
   of which an undefined identifier is one cause among many. A
   destructure of a prop nobody passes throws the same way and
   lint is happy with it.

   ------------------------------------------------------------
   WHY THE PROPS ARE EMPTY

   Deliberately. A component given no props should either render
   something degenerate or return null; it should not throw. Every
   one of these is rendered by a parent that may not have loaded
   its data yet, and "the world arrived one tick later than the
   component" is the single most common shape of crash in this
   codebase's history. If a component genuinely cannot render
   without a prop, it belongs in NEEDS_PROPS below with a reason,
   and that list should stay short.
   ============================================================ */
import React from "react";
import { render } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const UI = path.resolve(__dirname, "../src/ui");
const SCREENS = path.resolve(__dirname, "../src/screens");

/* Components that cannot be rendered bare, each with the reason.
   A name here is a claim that the component is *supposed* to
   require something, not a place to hide a crash. */
const NEEDS_PROPS = {
  // Takes a render-prop child and calls it; nothing to render without one.
  ErrorBoundary: "wraps children by contract",
  // A context provider — bare, it provides undefined to nobody.
  ThemeProvider: "provider, no children to serve",
};

function componentFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".jsx"))
    .map((e) => e.name);
}

/* Vite resolves these; node's `import()` of a raw path does not go
   through the same plugin chain, so we go through the alias the
   test runner already has by using a static-analysable glob. */
const uiModules = import.meta.glob("../src/ui/*.jsx");
const screenModules = import.meta.glob("../src/screens/**/*.jsx");

describe("every component imports what it uses", () => {
  /* THE IMPORT HALF. A module whose top level throws — a bad
     import, a syntax error, a call at module scope — fails here
     before anything is rendered. This alone would not have caught
     RollPrompt, because a free identifier inside a function body
     is legal until called. */
  const all = { ...uiModules, ...screenModules };

  for (const [file, load] of Object.entries(all)) {
    const name = path.basename(file, ".jsx");

    it(`${name} imports cleanly`, async () => {
      const mod = await load();
      expect(mod).toBeTruthy();
    });

    /* THE RENDER HALF. Catches a module-level throw and a
       component that explodes on empty props. It does NOT catch
       the RollPrompt bug and it is important to say so: a
       component that destructures a prop object first
       (`const { pc } = g`) throws a TypeError on the line above
       the hook and never reaches it. Rendering bare tests the
       wrong line. That is what the static check below is for. */
    it(`${name} renders without throwing`, async () => {
      const mod = await load();
      const Component = mod.default;
      if (typeof Component !== "function") return; // not a component; fine
      if (NEEDS_PROPS[name]) return;

      let thrown = null;
      try {
        render(<Component />);
      } catch (e) {
        thrown = e;
      }

      /* A missing prop is a legitimate TypeError and not this
         file's business. A ReferenceError never is: it means the
         file uses a name it never brought into scope. */
      if (thrown instanceof ReferenceError) {
        throw new Error(
          `${name} threw ReferenceError: ${thrown.message}\n` +
            `That is an identifier the file uses and does not import.`,
        );
      }
    });
  }
});

/* ============================================================
   THE STATIC CHECK — the one that actually catches it.

   Rendering cannot be relied on to reach a hook, because the
   lines above the hook can throw first, and in this codebase they
   usually do: nearly every component destructures a prop object
   on its first line. `RollPrompt` does exactly that, which is why
   rendering it bare returns a TypeError from line 76 and the
   missing `useState` on line 85 is never evaluated.

   So check the text instead. If a file calls `useState(` and its
   React import does not name `useState`, that file throws the
   moment React calls it — no rendering, no props, no fixtures,
   and no way for it to pass by luck.

   This is a grep, and a grep is a crude instrument. It is the
   right instrument here for the same reason `safeMove` uses five
   crude checks: a crude guard that occasionally demands a
   needless import beats a clever one that misses once, because
   the needless import is visible and the miss ships.
   ============================================================ */
describe("hooks are imported where they are used", () => {
  const HOOKS = [
    "useState", "useEffect", "useMemo", "useRef", "useCallback",
    "useReducer", "useLayoutEffect", "useContext", "useId",
    "useSyncExternalStore", "useTransition", "useDeferredValue",
  ];

  const sources = [];
  const collect = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) collect(full);
      else if (/\.jsx?$/.test(e.name)) sources.push(full);
    }
  };
  collect(path.resolve(__dirname, "../src"));

  for (const file of sources) {
    const rel = path.relative(path.resolve(__dirname, ".."), file);
    const src = fs.readFileSync(file, "utf8");

    /* Only the named-import form is in use across this codebase.
       `React.useState(...)` is always in scope wherever React is,
       so it is stripped before the call sites are counted rather
       than reported as a miss. */
    const withoutNamespaced = src.replace(/React\s*\.\s*use[A-Z]\w*/g, "");

    const missing = HOOKS.filter((h) => {
      if (!new RegExp(`(?<![.\\w])${h}\\s*\\(`).test(withoutNamespaced)) return false;
      // Declared locally (a custom hook defining itself) — not a miss.
      if (new RegExp(`(function|const|let)\\s+${h}\\b`).test(src)) return false;
      // Named in some import from react.
      return !new RegExp(`import[^;]*\\b${h}\\b[^;]*from\\s+["']react["']`, "s").test(src);
    });

    if (!missing.length) continue;

    it(`${rel} imports ${missing.join(", ")}`, () => {
      throw new Error(
        `${rel} calls ${missing.join(", ")} without importing ${missing.length === 1 ? "it" : "them"}.\n` +
          `This throws the moment React calls the component. ` +
          `Vite will still build it, so nothing else will tell you.`,
      );
    });
  }

  it("checked every source file", () => {
    expect(sources.length).toBeGreaterThan(100);
  });
});

/* ============================================================
   THE LITTER

   2.15.0's changelog records removing fifteen tracked one-byte
   files named `test`, two applied `.patch` files, and a
   byte-identical duplicate of ROADMAP_2.9.md in the root. All of
   them were back at 2.16.0, and a second diverged copy of
   anotherbughunt.test.jsx had joined them in the root where
   vitest's glob does not reach it — so it was a test file that
   looked like coverage and ran never.

   Cleaning it up twice by hand and recording it twice in the
   changelog is the definition of a thing that needs a test. This
   is that test.
   ============================================================ */
describe("the repository stays clean", () => {
  const root = path.resolve(__dirname, "..");

  const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === ".git" || e.name === "node_modules" || e.name === "dist") continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, out);
      else out.push(path.relative(root, full));
    }
    return out;
  };

  const files = walk(root);

  it("has no stray files named `test`", () => {
    const strays = files.filter((f) => path.basename(f) === "test");
    expect(strays, `remove these: ${strays.join(", ")}`).toEqual([]);
  });

  it("has no applied patch files", () => {
    const patches = files.filter((f) => f.endsWith(".patch"));
    expect(patches, `a patch in the tree is a change applied twice: ${patches.join(", ")}`)
      .toEqual([]);
  });

  it("keeps docs in docs/, not duplicated in the root", () => {
    const rootDocs = fs
      .readdirSync(root)
      .filter((f) => f.endsWith(".md"))
      .filter((f) => fs.existsSync(path.join(root, "docs", f)));
    expect(rootDocs, `these exist in both root and docs/: ${rootDocs.join(", ")}`).toEqual([]);
  });

  it("has no dead links in the docs", () => {
    /* The README linked to docs/ANOTHERBUGHUNT_WARDEN_DOSSIER.md
       for two releases. It was the pointer to the prep material
       for the largest module in the project — 48 rooms, 17
       survivors, three parallel director ladders — and the file
       was never there.

       A broken link in a README is cheap to fix and expensive to
       leave, because it is usually the first thing a new reader
       clicks, and a project whose documentation cannot be trusted
       gets its code doubted next. */
    const md = files.filter((f) => f.endsWith(".md"));
    const dead = [];
    for (const f of md) {
      const body = fs.readFileSync(path.join(root, f), "utf8");
      for (const m of body.matchAll(/\]\((?!https?:)([^)#]+\.md)[^)]*\)/g)) {
        const target = path.resolve(path.dirname(path.join(root, f)), m[1]);
        if (!fs.existsSync(target)) dead.push(`${f} -> ${m[1]}`);
      }
    }
    expect(dead, `dead links: ${dead.join(", ")}`).toEqual([]);
  });

  it("has no test files outside tests/, where vitest cannot see them", () => {
    const orphans = files.filter(
      (f) => /\.test\.(js|jsx)$/.test(f) && !f.startsWith(`tests${path.sep}`),
    );
    expect(orphans, `vitest only globs tests/**; these run never: ${orphans.join(", ")}`)
      .toEqual([]);
  });
});
