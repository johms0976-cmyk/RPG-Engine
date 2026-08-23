# MANIFEST — engine 2.8.0 → 2.9.0

Slice A of `ROADMAP_2.9.md` in full, plus C.2 and C.4. The four items deliberately left out are
named at the bottom under **Not in this drop**.

Copy these over your working tree, preserving paths. **No new dependencies**, `package-lock.json`
untouched.

**Verified before packaging:** `npm test` → **877 passed across 36 files** (was 841 across 35),
`npm run build` clean, `node --check server/host.mjs` clean.

---

## New files

| Path | What it is |
|---|---|
| `src/ui/useWakeLock.js` | The screen does not sleep. The reacquire on `visibilitychange` is the load-bearing half — without it the hook works for ninety seconds and then silently stops. |
| `src/ui/tv.css` | The ten-foot stylesheet. Every size a fraction of viewport **height**, floor of 2vh, scoped to `.tv` so the desk layout is untouched. |
| `src/screens/TableFar.jsx` | The shared screen read from a sofa. Whose-go, room, situation, crew as one strip, last three lines, and one takeover at a time. |
| `src/ui/JoinCard.jsx` | The address, big, over the top of everything, from any phase. |
| `tests/couch.test.jsx` | 36 tests. Rather more than half assert a refusal. |
| `APPLY_2.9.0.md` | This file. Delete after applying. |

## Replaced files

| Path | What changed |
|---|---|
| `src/screens/TableView.jsx` | Takes `distance`; delegates the **active** state to `TableFar` at `couch`. The cinema branch is above the fork and shared — a screen that has gone quiet was always the right size for a sofa. |
| `src/net/HostBar.jsx` | The distance select and the join-card button. |
| `src/App.jsx` | Remembered `distance`, the host's own wake lock, the join card, and `net.lastDispute` into the director. |
| `src/net/ClientShell.jsx` | Declares itself a phone (`audio.setRole`) and holds its screen awake. |
| `src/ui/audio.js` | `setRole` / `isTable`. `playForKind` silent on a handset; `playCue` deliberately **not**. |
| `src/engine/director.js` | `stageFlag()` and named escalation tracks in `rungScripted`. |
| `src/net/useDirector.js` | The dispute ledger, `DISPUTE_WEIGHT`, `DISPUTE_WINDOW_MS`, and `stageFlag` honoured on write-back. |
| `src/net/useHost.js` | Publishes `lastDispute`. Nothing else about disputing changes. |
| `tests/offline.test.js` | Allowlists the join card's `/net/info` read, with the reason. |
| `docs/MODULE_FORMAT.md` | `track`, and the one-beat-per-tick rule. |
| `docs/CHANGELOG.md` · `package.json` | 2.9.0. |

---

## Four things worth checking before you play it

**1. The measurement is the argument, and you should check it against your own television.**

20px at three metres from a 55" 1080p panel subtends about 0.19°, against a ~0.3° floor for
comfortable sustained reading. That is where every number in `tv.css` comes from. If your table sits
closer, or the screen is a 32" monitor on a shelf, the couch layout will feel enormous and the right
answer is to leave it on `desk` — the setting exists because there is no way to tell from the DOM.

**2. `TableFar` is a second surface that must hold no secrets, and nothing enforces that but care.**

`TableView` says of itself that it deliberately holds no secrets. That sentence now has to be true
of two files. Everything in `TableFar` is derived from the same places `TableView` derives from and
nothing new is read, and there is a test asserting a `wardenOnly` line never reaches it — but that
test guards the one door I knew about. If you add anything to that screen, the question to ask is
not "is this useful from a sofa" but "does the person sitting furthest from the television have the
right to know it".

**3. `DISPUTE_WEIGHT` is a judgement and it is the number 2.**

It is the smallest number that says "more than once". If the empty chair turns out to retire rungs
too eagerly, change that before you touch `VETO_LIMIT` — and note that a dispute unmatched to a Move
aimed at that player within `DISPUTE_WINDOW_MS` is dropped in silence, so the ledger under-counts by
design rather than guessing.

**4. Audio now turns itself on when you choose `couch`.**

Choosing the distance is a click, which is the gesture WebAudio has been waiting for, and a shared
screen across a room is the one configuration where sound is unambiguously wanted. It is still a
behaviour change for an existing table and it is one line in `chooseDistance` if you disagree.

---

## Not in this drop

- **B.3 a one-tap reaction** and **B.4 player-offered assistance.** Both need `protocol.js`,
  `rtcRelay.js`, `host.mjs`, `useHost.js` and `ClientShell.jsx`, and the two routers must agree.
  They belong in one drop together rather than split across two.
- **C.1 director `listeners`.** The last big thing the empty chair cannot do — respond to something
  somebody said out loud. Every one of the sixteen rungs triggers on state, and no number of extra
  rungs closes that.
- **C.3 a declared session length.** Worth writing after a table has actually overrun on this
  layout, so the steering is tuned against a real evening rather than a guess.
- **A.7 the phone that dies.** A trade-off to choose rather than a feature to write, and the one
  thing not to do is degrade quietly.

## Known

`tests/remoteapp.test.jsx` went red once during this session and green on every rerun. This is the
third release to record it. Fix it or delete it rather than recording it a fourth time.

## After applying

```bash
npm test          # expect 877 passing
npm run build
```

To see the thing this release is about: start a hosted table, put the shared screen on a television,
sit down, and try to read the pinned situation before and after switching the distance.
