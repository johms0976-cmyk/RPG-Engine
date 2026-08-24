# MANIFEST — engine 2.10.0 → 2.11.0

B.1, B.2, B.5 and C.5 from `ROADMAP_2.9.md`. B.6 (a ninety-minute module) is left out by agreement
and is an authoring project rather than a code drop.

Copy these over your working tree, preserving paths. **No new dependencies**, `package-lock.json`
untouched.

**Verified before packaging:** `npx vitest run` → **944 passed across 38 files** (was 913 across 37),
green on two consecutive full runs, `npm run build` clean, `package.json` valid JSON at 2.11.0.

> **This drop is incremental, 2.10.0 → 2.11.0** — unlike the last one. You said you have applied
> 2.10.0, so these files assume it. If you are coming from 2.8.0, apply `rpg-engine-2.10.0.zip`
> first.

---

## New files

| Path | What it is |
|---|---|
| `src/engine/randomDraft.js` | B.1. Pure, RNG-as-argument. Returns the draft shape `CreatorPhone` already holds. |
| `src/ui/QuickVerbs.jsx` | B.2. The verb strip, plus `verbsFor` exported separately so the choosing is testable without a DOM. |
| `src/ui/verbs.css` | B.2 styles. Hidden above 780px. |
| `src/engine/endcard.js` | B.5. `endCard` and `endCardText`. A search, not a generator. |
| `tests/first-ten.test.jsx` | 31 tests across all four. |
| `APPLY_2.11.0.md` | This file. Delete after applying. |

## Replaced files

| Path | What changed |
|---|---|
| `src/screens/CreatorPhone.jsx` | The "Roll me one" button, first step only. |
| `src/screens/Play.jsx` | `QuickVerbs` above the command bar in the feed column. |
| `src/screens/Ending.jsx` | The end card, above the module's ending text. Takes `pcId`. |
| `src/net/ClientShell.jsx` | Passes `pcId` to `Ending`. |
| `src/engine/director.js` | `MOVE_HARSH` and `isHarshMove` (C.5). |
| `src/net/useDirector.js` | Uses them; the local four-string set is gone. |
| `src/ui/wizard.css` | Styles for the quick button and the end card. |
| `docs/CHANGELOG.md` · `package.json` | 2.11.0. |

---

## Four things worth knowing

**1. C.5 changed shape, not behaviour — deliberately.**

Every judgement the four strings made is preserved, including the aftermath special case. What is
new is that the table is exhaustive and a test reads `director.js` and fails if a kind is missing.

I did **not** retune the set, because I have not played four hours on the couch layout and you have
not told me it lands wrong. Retuning it from here would be guessing dressed as a fix. What the drop
buys you is that the next person to add a rung has to decide, and that `listen` and `lastCall` now
have decisions on record rather than defaults nobody chose.

**2. The exhaustiveness test reads the source with a regex.**

There is no runtime registry of rungs to ask, so the alternative was a hand-kept list in the test —
the same problem one file further away. It matches `kind: "..."` in `director.js`. If you ever emit
a kind through a variable rather than a literal, the test will not see it and will pass while
missing something. That is the known limit of the approach and it is written down in the test.

**3. B.1's skill spending retries rather than backtracks.**

Up to 40 attempts, and if all of them strand points it returns the closest rather than nothing — so
the wizard says which step needs attention instead of a button appearing to do nothing. Across 200
builds in the test it has never needed the fallback, but the fallback is the honest behaviour if a
future class makes it reachable.

**4. B.2 is phone-only and that is a CSS rule, not a prop.**

`verbs.css` hides the strip above 780px, matching how `.desk-only` already works in `phone.css`. If
you change the breakpoint in one place, change it in both.

---

## `ROADMAP_2.9.md` is now finished

Every item is built except **B.6**, a ninety-minute module, which we agreed to take separately.

For that one, the thing worth deciding before any writing starts: Ypsilon 14 is a full evening, and
a full evening is a thing people schedule rather than a thing they do. A one-sitting scenario is
what gets this played twice — and it is now also the natural place to prove `listeners` and named
`escalate` tracks, since neither has a shipped module using it.

## After applying

```bash
npm test          # expect 944 passing
npm run build
```

To see B.2 working: open a table on a phone-width window and try to do something without reading the
placeholder.
