/* ============================================================
   LINT — narrow on purpose.

   This exists because of one bug. 2.16.0 shipped
   `src/ui/RollPrompt.jsx` calling `useState` without importing
   it; the component threw on every render, it is the surface a
   phone shows every time anybody rolls anything, and
   `npm run build` passed — Vite does not resolve free
   identifiers, so a component referencing an undefined binding
   compiles and ships.

   `no-undef` catches that in about a second.

   ------------------------------------------------------------
   WHY IT IS NOT A STYLE CONFIG

   Because a style config would be the wrong tool used loudly.
   This codebase has a strong and deliberate house style — long
   argued header comments, prose that explains why rather than
   what, `RUNGS` derived rather than repeated — and none of that
   is anything a linter has an opinion worth hearing about. A
   default preset would produce several thousand complaints about
   formatting nobody asked it to judge, everybody would run it
   once, and then `npm run lint` would be a command that fails on
   purpose, which is worse than not having one.

   So the rule set is the errors that can reach a table:

     no-undef            the RollPrompt bug, exactly
     no-unused-vars      an import left behind by a refactor is
                         usually a call site that moved and a
                         second one that did not
     no-dupe-keys        a module manifest with the same key
                         twice silently loses one, and module
                         manifests here are thousands of lines
     no-unreachable      code after a return in an effect chain
     rules-of-hooks      a hook behind a condition breaks on the
                         render where it matters and not before

   Everything else is off. If a rule ever fires on something that
   is not a bug, delete the rule rather than adding a disable
   comment: a disable comment is a lie the next reader has to
   verify.
   ============================================================ */
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "public/sw.js"],
  },
  {
    files: ["src/**/*.{js,jsx}", "server/**/*.mjs", "scripts/**/*.mjs", "tests/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        ...globals.node,
        /* vitest, which this project uses with `globals: true`. */
        describe: "readonly", it: "readonly", expect: "readonly",
        vi: "readonly", beforeEach: "readonly", afterEach: "readonly",
        beforeAll: "readonly", afterAll: "readonly",
        __dirname: "readonly",
      },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...js.configs.recommended.rules,

      /* ---- ON, because each one has shipped or could ---- */
      "no-undef": "error",
      "no-dupe-keys": "error",
      "no-unreachable": "error",
      "no-dupe-args": "error",
      "no-func-assign": "error",
      "react-hooks/rules-of-hooks": "error",

      /* THE ONES THAT FIRED ON EXISTING, CORRECT CODE, AND WHY
         THEY ARE OFF RATHER THAN FIXED.

         `useItem` and `useCounter` are game functions — using an
         item, using a device counter. `rules-of-hooks` sees the
         `use` prefix and assumes React. That is a naming
         collision and not a bug, and renaming a dozen call sites
         to satisfy a linter's guess is the tail wagging the dog.
         The rule is kept ON because it found a real one on its
         first run — `ShipSheet` called `useState` after an early
         return, which would have thrown on the render where a
         crew first acquires a ship. Two false positives and one
         genuine screen-losing bug is a rule worth its noise. */
      "no-useless-assignment": "off",

      /* An unused import is usually half of a move. Args are
         exempt: this codebase passes whole option objects and
         destructures what it needs, and complaining about the
         rest would be noise. Warn rather than error — 60-odd
         existing ones are dead weight, not defects, and a lint
         command that fails on day one is a lint command nobody
         runs on day two. */
      "no-unused-vars": ["warn", {
        args: "none",
        /* `React` is exempt because JSX compiles to calls this
           rule cannot see, so every .jsx file in the project
           reports its own React import as dead. The proper answer
           is eslint-plugin-react's `jsx-uses-react`; the cheap one
           is this, and the cheap one adds no dependency to answer
           a question nobody at this table is asking. */
        varsIgnorePattern: "^(_|React$)",
        caughtErrors: "none",
      }],

      /* ---- OFF, deliberately ---- */
      /* JSX makes React look unused; there is no React plugin
         here to tell it otherwise, and adding one to answer a
         question nobody asked is how a narrow config stops being
         narrow. */
      "no-empty": "off",
      /* Control characters appear in the terminal escape codes
         the host script prints. */
      "no-control-regex": "off",
      /* The atmosphere and effect files use sparse conditionals
         that read better than the "correct" form. */
      "no-cond-assign": "off",
    },
  },

  /* ============================================================
     THE NAMING COLLISION, NAMED.

     `useItem` and `useCounter` are game verbs — a character uses
     an item, a player uses a device counter — and they predate
     this config by a long way. `rules-of-hooks` matches on the
     `use` prefix and cannot know that. `useRemoteGame` inside a
     test callback is the same shape.

     Listed here by file rather than silenced globally, because
     the rule earned its place on its first run: it found
     `ShipSheet` calling `useState` after an early return, which
     would have thrown on the render where a crew first acquires
     a ship — the exact moment a campaign gets interesting.

     An override with a reason beside it is better than a
     scattering of `eslint-disable` comments, which are lies the
     next reader has to verify one at a time. If either function
     is ever renamed, delete the matching line here.
     ============================================================ */
  {
    files: ["src/engine/useGame.js", "src/screens/Play.jsx", "tests/playerview.test.jsx"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
];
