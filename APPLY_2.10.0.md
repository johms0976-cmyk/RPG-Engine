# MANIFEST — engine 2.9.0 → 2.10.0

B.3, B.4, C.1, C.3 and A.7 from `ROADMAP_2.9.md`. Everything named in that roadmap is now built.

Copy these over your working tree, preserving paths. **No new dependencies**, `package-lock.json`
untouched.

**Verified before packaging:** `npx vitest run` → **913 passed across 37 files** (was 877 across 36),
`npm run build` clean, `node --check server/host.mjs` clean, `package.json` valid JSON at 2.10.0.

> **This zip is cumulative: 2.8.0 → 2.10.0.** It contains the 2.9.0 files as well, so it supersedes
> `rpg-engine-2.9.0.zip` entirely — apply this one over a clean 2.8.0 tree and ignore the earlier
> drop. If you have already applied 2.9.0, applying this over it is still correct; the 2.9.0 files
> here are byte-identical to the ones you have.
>
> The file table below lists only what is **new in 2.10.0**. For the 2.9.0 half, see
> `APPLY_2.9.0.md`, which is not in this zip but is unchanged.

---

## New files

| Path | What it is |
|---|---|
| `src/engine/reactions.js` | B.3. The closed vocabulary, the cooldown, and the visibility window. Pure — no clock, no React. |
| `src/ui/ReactBar.jsx` | B.3/B.4. Both phone controls. Below the fold, never the loudest thing on the screen. |
| `src/ui/react.css` | Styles for both, plus the shared screen's copy. |
| `tests/dead-time.test.jsx` | 36 tests across all five features. |
| `APPLY_2.10.0.md` | This file. Delete after applying. |

## Replaced files

| Path | What changed |
|---|---|
| `src/engine/useGame.js` | `react`, `offerAssist`, `withdrawAssist` and their two lists. Neither list is in the feed. |
| `src/engine/director.js` | `rungListen` (C.1), `rungLastCall` (C.3), both wired into the ladder, plus the narrowing after last call. |
| `src/engine/defineModule.js` | Validates `director.listeners`. |
| `src/engine/tempo.js` | The three new actions in `TEMPO_FREE`. |
| `src/net/protocol.js` | The three in `PLAYER_ACTIONS` and `OUT_OF_TURN`. |
| `src/net/useDirector.js` | Executors for `listen` and `lastCall`; the `heard` and `lastCallAt` refs; `sessionEndsAt`. |
| `src/net/useHost.js` | Reactions and offers on the snapshot; the A.7 handover announcement from the roster diff. |
| `src/net/useIntentGate.js` | Player-facing labels for the three new intents. |
| `src/net/ClientShell.jsx` | Sends the three intents; renders both controls. |
| `src/net/rtcRelay.js` · `server/host.mjs` | A.7. Comments only — see below. |
| `src/screens/TableFar.jsx` · `src/screens/TableView.jsx` | Reactions and offers on the shared screen. |
| `tests/remoteapp.test.jsx` | The four-release flake, fixed. See below. |
| `docs/MODULE_FORMAT.md` | `listeners`, with the rules and an example. |
| `docs/CHANGELOG.md` · `package.json` | 2.10.0. |

---

## Five things worth checking before you play it

**1. `package.json` was clobbered mid-session and restored from git.**

A nested `open()` in a scripted edit read a file it had already truncated. I caught it, restored, and
re-verified — but a write went wrong in a file the build depends on, so check it first. It should
read `"version": "2.10.0"` and parse. Nothing else in the drop shares that failure mode; it was one
bad one-liner, not a pattern.

**2. A.7 is a comment change in both routers, not a logic change — and that is the point.**

I set out to add a `pickedUp` flag to `claim` in `host.mjs` and `rtcRelay.js`, then found that
`useHost` learns claims from the **roster**, not from `claim` messages, so the flag went nowhere. I
removed it. The handover is detected by diffing the roster in `useHost`, which is strictly better
because it catches every route in — a pickup after a battery died, a deliberate handover, a phone
that came back on a charger.

So the two routers already permitted this and nobody had noticed: a dropped phone leaves the
`clients`/`players` map, so its character stops appearing as taken. What the routers gained is the
long note explaining that this is deliberate. **If you diff them expecting behaviour, you will find
prose.** That is accurate.

**3. The reaction cooldown is twelve seconds and it is a guess.**

Long enough to read as a response to something, short enough never to feel like a resource. It is
the first number to change if a table finds it stingy, and it lives in one place
(`REACT_COOLDOWN_MS`). The phone's local cooldown is cosmetic only — the engine owns the real one,
for the reason `jumpIn` does.

**4. C.1's 20-second quiet window is doing more work than it looks.**

`rungListen` will not fire within 20 seconds of the director's last move. Without it, a director
that answers three seconds after speaking reads as interruption rather than attention, which is the
opposite of the feeling the rung exists to create. If listeners feel unresponsive, look here before
you look at the phrase matching.

**5. `sessionEndsAt` has no UI yet.**

The rung, the executor and the narrowing are all built and tested, but nothing on the host sets the
value — it defaults to 0, which means no table is steered. Wiring it is a number input in `HostBar`
and one line in `App.jsx`, deliberately left until a table has actually overrun on the couch layout
so the length is chosen against a real evening.

---

## Now finished from `ROADMAP_2.9.md`

Slice A (all), B.1 partially (pregens and roll-me-one still open), B.3, B.4, C.1, C.2, C.3, C.4, A.7.

Still open, and worth their own drop: **B.1** a shorter first ten minutes, **B.2** verbs before the
sheet, **B.5** the end card, **B.6** a ninety-minute module, **C.5** revisiting `HARSH` after real
play, and the `sessionEndsAt` control above.

## The flake is fixed

`tests/remoteapp.test.jsx` had been recorded as flaky in four consecutive release notes, including
mine. Recording it a fifth time would have been the wrong response to a test that was correct about
something being slow.

The cause: `flush()` awaits exactly two microtask ticks, and it was being used to wait for **WebRTC
offer creation** — genuinely asynchronous, involving ICE gathering, and taking a variable number of
ticks that is occasionally more than two. A fixed-tick wait racing a real async operation, losing
about one run in six.

Three such sites, all replaced with a polling helper (`until`) that has a deadline. A wait with a
deadline cannot race: it either sees the thing or it fails with the same message, and a genuine
regression still fails in under a second. Verified with eight consecutive isolated runs and three
consecutive full-suite runs, all green.

The file is `tests/remoteapp.test.jsx`, added to the replaced list above.

## After applying

```bash
npm test          # expect 913 passing
npm run build
```

To see what this release is for: start a table with five phones, give one player a scene to
themselves, and watch what the other four do.
