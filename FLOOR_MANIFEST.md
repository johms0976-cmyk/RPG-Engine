# MANIFEST — Part B complete. Engine 2.4.0 → 2.5.0

Copy these over your working tree, preserving paths. `package-lock.json` is untouched and there
are no new dependencies.

**Verified before packaging:** `npm test` → **587 passed** (was 585, across 26 files),
`npm run build` clean, `node --check server/host.mjs` clean.

---

## New files

| Path | What it is |
|---|---|
| `src/engine/floor.js` | The airtime ledger and its policy. Pure — no React, no timers, no network. ~430 lines, over half of it the reasoning. |
| `tests/floor.test.js` | 43 tests. Roughly half assert that a lever does **not** fire. |
| `FLOOR_MANIFEST.md` | This file. Delete after applying. |

## Replaced files

| Path | What changed |
|---|---|
| `src/engine/tempo.js` | `makeScene` takes an optional comparator (default unchanged). `tempoVerdict` gains the floor brake, last and weakest. `WAIT_TEXT.floor` added. |
| `src/engine/useGame.js` | `floorNote` (the ledger's only writer), `warden.floor` (the switch), the comparator on scene start, the ledger reset in `settleRound`, and a decline counted in `passSceneTurn`. Exports `FLOOR_DECLINE_MS`. |
| `src/net/protocol.js` | `C_TAP`. `waitingRoom` reports a floor hold like every other hold. Imports `floorVerdict`. |
| `src/net/useIntentGate.js` | A swallowed tap is reported to the host, throttled to one per second. Exports `TAP_REPORT_MS`. Signature unchanged. |
| `src/net/rtcRelay.js` | Forwards `tap`. Ownership from the router's client record, never the message. |
| `server/host.mjs` | The same, and the two must agree — `tests/floor.test.js` checks. |
| `src/net/useHost.js` | Records an act after a job runs, files an incoming `tap`, and runs the policy on a 15s timer. Exports `FLOOR_TICK_MS`. |
| `src/screens/warden/TempoTab.jsx` | One On/Off switch and a paragraph. No counts. |
| `tests/table.test.jsx` | The gate test now counts intents **by type** rather than counting calls, plus two new tests for the report. |
| `docs/CHANGELOG.md` | 2.5.0. |
| `package.json` | 2.4.0 → 2.5.0. No dependency changes. |

---

## Requirements coverage

| ID | Where |
|---|---|
| FR-B1 share + starvation, pure | `floor.js` — `sharesOf`, `starvationOf`, `weightOf` |
| FR-B2 swallowed taps reported | `useIntentGate.js` → both routers → `useHost.js` → `floorNote(…, "swallow")` |
| FR-B3 tap acknowledged on the phone | **Already existed.** `ClientShell.jsx`'s `onTap`/`tapNote` — verified, unchanged |
| FR-B4 comparator on `makeScene` | `tempo.js` + `starvationOrder` |
| FR-B5 spotlight the starved player | `floorMove` → `useHost.js` policy timer |
| FR-B6 two declines and we stop asking | `MUTE_AFTER`, `isMuted`, `recordDecline`, survives `resetFloor` |
| FR-B7 stampede → auto round | `stampede()`, four named thresholds |
| FR-B8 `{ wait: "floor" }`, holds not denies | `floorVerdict` via `tempoVerdict`; bounded by `FLOOR_HOLD_MS` |
| FR-B9 one setting, off by default, mid-session | `w.floor.on`, `warden.floor`, TempoTab |
| FR-B10 no share/count/ranking in any UI | Enforced by a source-tree test, not by discipline |
| FR-B11 on `w.floor`, snapshots and saves | Plain world field, same contract as `w.tempo` |
| INV-7 every brake holds, none refuse | `floorVerdict` returns `{ wait }` only |

---

## Three decisions I made that you should check

**1. The ledger records even when the switch is off; only the levers are gated.**

A Warden who watches one player disappear for forty minutes and *then* turns this on should get a
system that already knows who has been quiet, not one starting from zero at the worst possible
moment. The cost is that a table which never turns it on still carries a small object in every
snapshot. If you object, the guard goes in `floorNote` and is one line.

**2. The soft hold is measured from the runaway's own last action, not from a queue position.**

This makes it a targeted, automatic `rateMs` — the mechanism the codebase already has — rather
than a new kind of thing. It is bounded by construction and therefore cannot become a refusal
even if every other guard fails. The alternative (hold until the starved player acts) is a
cleaner idea and an unbounded one, and I would not ship it.

**3. `passSceneTurn` counts as a decline only within a minute of an offer.**

Passing three scenes after a nudge is tactical patience, not "leave me alone". A minute is a
guess. `FLOOR_DECLINE_MS` in `useGame.js`.

## One thing I could not do well

`ui/Spotlight.jsx` hardcodes **"The Warden is looking at you."** as its headline; the policy's
wording arrives as the sub-line. With a Warden at the table that reads fine — they are about to
look at you, and now they have. With the empty chair it will be a lie, and the component needs a
second headline before Part A ships. I left it alone rather than churn a file for a mode that
does not exist yet.

## After applying

```bash
npm test          # expect 587 passing
npm run build
```

Then, to actually see it: start a session, TempoTab → **MIND WHO HAS NOT SPOKEN** → On. The
honest way to test lever 1 is a round with three phones where one player does nothing for two
minutes, then start a round and check who it opens with.
