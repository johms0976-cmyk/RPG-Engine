# APPLY 2.13.0 — the room, the clock, and the floor

Copy these over your working tree, **preserving paths**. No new dependencies, `package-lock.json`
untouched, **no `npm install` needed**.

**Verified before packaging:** `npm test` → **1002 passed** across 41 files (was 968 across 39),
`npx vite build` clean, `node --check server/host.mjs` clean.

---

## New files — 3

| Path | What it is |
|---|---|
| `tests/party-attention.test.js` | 25 tests. The focus-room rotation, the derived ladder, the Ypsilon 14 listeners, the floor vote. |
| `tests/attention-wired.test.jsx` | 9 tests. The half with hands — the two defects the unit tests were structurally blind to. |
| `APPLY_2.13.0.md` | This file. Delete after applying. |

## Replaced files — 11

| Path | What changed |
|---|---|
| `src/engine/director.js` | `focusRoom` and the party-split rewiring of six rungs; `RUNGS` declared once with `LADDER` derived from it; `safeMove`'s combat check now tests the Move's own room. Header ladder comment corrected from nine rungs to seventeen. |
| `src/net/useDirector.js` | `speak()` routes room-scoped Moves through `api.sayIn`; `roomServedAt` rotation ledger, stamped on the way out in `take`. |
| `src/App.jsx` | `sessionMins` / `endsAt` state, stamped at `start`, passed to `useDirector`; the floor armed once for wardenless tables of 5+. |
| `src/screens/Lobby.jsx` | The `SessionLength` panel. |
| `src/engine/vote.js` | `VOTE_TOPICS.floor`. |
| `src/net/useHost.js` | Applies the floor vote, both ways round. |
| `src/net/ClientShell.jsx` | "Share the floor" on the wardenless table bar. |
| `src/engine/defineModule.js` | Undeclared `crewSize` defaults to max **6**, was 4. |
| `src/modules/ypsilon14/director.js` | Twelve `listeners`, and `listeners` added to the exported director object. |
| `docs/CHANGELOG.md` | 2.13.0, and the 2.12.0 entry that was never written. |
| `package.json` | 2.11.1 → **2.13.0**. |

## Untouched, deliberately

`src/engine/useGame.js`, `src/engine/party.js`, `src/engine/floor.js`, `src/net/protocol.js`,
`server/host.mjs`, and the whole RTC stack.

`useGame.js` is the one worth calling out: making the director room-aware looked like it needed a
new verb on the warden API, and it did not — `api.sayIn` has been on the returned game object since
per-PC rooms landed. The director had simply never reached for it. **Nothing in a 3,000-line file
had to be touched to fix the bug that file's own sibling was written to prevent.**

---

## Four things worth checking

### 1. The unsplit case is the load-bearing assertion

Every existing director test in this repo describes a party standing in one room, and **not one of
them needed changing.** That was the signal being watched for. If any had, it would have meant the
change was wrong rather than that the tests were.

`focusRoom` returns `w.room` when there is one occupied room or none, and `audienceFor` returns
null while everybody is together — so a table that never splits gets a byte-identical public line.
`tests/party-attention.test.js` asserts this twice, once with a cold ledger and once with a stale
one, because a resumed save must not change what the director says.

### 2. The rotation is crude and should stay crude

Least-recently-served, ties to the majority room. It does not weight by group size, by who is in
danger, or by what is happening — and it should not, yet. A director that decided the three people
in the mine were more interesting than the two in the mess would be making an editorial judgement
about which players matter, on a shared screen, with nobody to overrule it.

Tune it after a table has actually played four hours split, not before.

### 3. The floor arming is the one claim here that overrides a stated design rule

`floor.js` rule 6 is "off by default" and this turns it on unasked for wardenless tables of five or
more. That is a real override of a rule the author wrote down with reasons, and it is the first
thing to remove if it lands badly — it is one effect in `App.jsx` and the vote topic works without
it.

The argument for it: rule 6's reasoning is about four veterans who will resent it, and it assumed a
person present who could turn it on. Both halves of that assumption fail at six people with an
empty chair. The latch matters as much as the default — a table that votes it off must stay off,
and an effect without the ref would overrule the room every ten seconds.

### 4. The listeners are content and content is arguable

Twelve is a starting set, not a considered vocabulary. They were written against what a table
plausibly says at this module — splitting up, the vents, the water, Mike, the cat, weapons, calling
for help, leaving, not trusting the crew, sealing up, hiding, the goo — and every one of them is a
judgement that deserves to be argued with after somebody has heard them fire.

The test that matters is `keeps the module's answer to its own mystery out of them`. It reads the
spoken text only, and if a future listener confirms a correct player theory it will fail. Do not
relax it.

---

## Two known gaps, unchanged

**The dispute ledger cannot reach most of what the director says.** Only Moves carrying a `pcId`
can be disputed, so `describe`, `atmosphere`, `npcSay`, `clock` and `callback` — the majority of a
wardenless table's experience — are structurally uncorrectable. Flagged as C.4 in `ROADMAP_2.9.md`,
half-fixed in 2.7.0, still half-fixed. It wants a table-level "not that" at a higher threshold than
a personal dispute, and it needs a protocol message, which is why it is not in this drop.

**The design record is still missing.** `ROADMAP_2.8.md`, `WARDENLESS.md` and
`EMPTY_CHAIR_NEXT.md` are cited as normative across comments and changelog entries and are not in
the repository. `INV-4` and `INV-6` are invoked by name in `director.js`, `autoDirector.js` and
`docs/CHANGELOG.md` with nothing anywhere defining them. This is the third release to record it.
One `docs/INVARIANTS.md` fixes it and it is load-bearing: several files justify their shape by
reference to a document nobody can read.

---

## After applying

```bash
npm test          # expect 1002 passing across 41 files
npm run build
```

**To see the split-party fix without waiting:** start a wardenless table with five characters, move
two of them into a different room, and watch the feed on the two phones diverge. Before this drop
both phones received the majority room's narration and nothing about where they actually were.

**To see the clock:** set a length in the lobby, then start. At the declared time the table is told
once, `flags.lastCall` is set, and the ladder narrows — no new conversations, no revisited clues,
no fresh pressure, while the module's own escalations and endings keep running.

**Not done in this drop:** a 90-minute second module, campaign persistence, and the table-level
dispute. The first is authoring rather than engineering and is the biggest remaining constraint on
a weeknight table of six.
