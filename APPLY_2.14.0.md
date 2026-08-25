# APPLY 2.14.0 — the correction, the record, and a module you can finish

Copy these over your working tree, **preserving paths**. No new dependencies,
`package-lock.json` untouched, **no `npm install` needed**.

**Verified before packaging** against a clean clone of `johms0976-cmyk/RPG-Engine` at
`d836ce3`:

- `npm test` → **1049 passed** across 43 files (was 1002 across 41)
- `npx vite build` → clean
- `node --check server/host.mjs` → clean
- `node scripts/doctor.mjs` → clean

---

## Read this first — six of the thirteen findings were already fixed

The review was written against `0eeba1c`. Your repo is now at `d836ce3` / **2.13.0**, and the
drop documented in `APPLY_2.13.0.md` had already closed **F1, F2, F3, F4, F8 and F9**. I verified
each one in the source rather than trusting the manifest:

| Finding | Already done at `d836ce3` | Where |
|---|---|---|
| F1 session clock dead code | ✅ | `App.jsx` passes `sessionEndsAt: endsAt`; `SessionLength` panel in `Lobby.jsx` |
| F2 floor unreachable | ✅ | `VOTE_TOPICS.floor`; "Share the floor" on the wardenless table bar |
| F3 director not split-aware | ✅ | `focusRoom` at `director.js:267`; `api.sayIn` routing in `useDirector.js` |
| F4 listeners without content | ✅ | twelve listeners in `ypsilon14/director.js`, exported |
| F8 `LADDER` drift | ✅ | `RUNGS` declared once, `LADDER` derived from it |
| F9 `crewSize.max` default 4 | ✅ | `defineModule.js` now defaults to 6 |

**This drop is F5, F6, F7, F10, F11, F12 and F13** — everything the review left outstanding.

---

## New files — 8

| Path | What it is |
|---|---|
| `src/engine/objection.js` | **F6.** The pure quorum layer for a table-level "not that". Decides; `useHost` executes — same split as `floor.js`. |
| `src/engine/campaign.js` | **F7.** The record a fixed group accumulates between evenings. Storage, export/import, summaries. |
| `src/screens/CampaignPanel.jsx` | **F7.** The lobby surface for naming or picking one. Defaults to "just this session". |
| `src/modules/deadweight/index.js` | **F5.** The ninety-minute module. Nine rooms, two hulls, one countdown. |
| `src/modules/deadweight/director.js` | **F5.** Its director block — three escalation beats, eight listeners, and a non-empty `attacks`. |
| `docs/INVARIANTS.md` | **F12.** INV-1…INV-11, numbered to match every existing reference in the codebase. |
| `tests/party-review.test.js` | 35 tests. Quorum arithmetic, the campaign ledger, the NPC weighting, the new module. |
| `tests/correction-wired.test.jsx` | 12 tests. The half with hands — the wire, not the arithmetic. |

## Replaced files — 16

| Path | What changed |
|---|---|
| `src/engine/director.js` | **F13.** `mindWords` and `pickKnown`; `rungNpc` now weights an NPC's untold lines instead of `findIndex`. Ties break to lowest index. |
| `src/engine/defineModule.js` | **Bonus.** `give`/`take` validation no longer throws on a non-array. This was a crash-at-import, not a warning. |
| `src/net/protocol.js` | **F6.** `C_NOTTHAT` declared. |
| `src/net/rtcRelay.js` | **F6.** Forwards `notthat` with `asPc`. |
| `src/net/useHost.js` | **F6.** The quorum tally, the two acknowledgement lines, `lastObjection` on the returned object. |
| `src/net/useDirector.js` | **F6.** `lastTaken` records *every* Move's rung; carried objections fold into the ledger as vetoes. |
| `src/net/ClientShell.jsx` | **F6.** "Not that" on the wardenless table bar, and — see below — the personal dispute finally gets a sender. |
| `src/ui/Spotlight.jsx` | **F6.** `onNotMe` renders "Not what I meant" on the spotlight card. |
| `src/ui/warden.css` | **F6.** `.spotlight-not`. |
| `src/App.jsx` | **F6/F7.** Passes `objection: net.lastObjection`; holds the campaign selection and hands it to `Lobby` and `Ending`. |
| `src/screens/Lobby.jsx` | **F7.** Mounts `CampaignPanel` beneath `SessionLength`. |
| `src/screens/Ending.jsx` | **F7.** Records the evening, once, on the shared screen only. |
| `src/modules/index.js` | **F5.** `deadweight` on the shelf. |
| `package.json` | **F10.** 2.13.0 → **2.14.0**. |
| `docs/CHANGELOG.md` | **F10.** The 2.14.0 entry. |
| `CHANGELOG.md` | **F10.** No longer a stale duplicate — now a pointer to `docs/`. |
| `README.md` | Two modules, not one. |

## Moved — 1

| From | To |
|---|---|
| `ROADMAP_2.9.md` | `docs/ROADMAP_2.9.md` |

`git mv ROADMAP_2.9.md docs/ROADMAP_2.9.md` — or take the copy in the zip and delete the root
one. It is cited as a design record and belongs with the other design records.

## Delete — 26 files (F11)

**Ten apply/manifest documents.** Several of them instruct the reader to delete them after
applying, and were not deleted:

```
MANIFEST.md  MANIFEST_2.7.0.md  EMPTY_CHAIR_MANIFEST.md  FLOOR_MANIFEST.md
APPLY_2.8.0.md  APPLY_2.9.0.md  APPLY_2.10.0.md  APPLY_2.11.0.md  APPLY_2.13.0.md
UPDATE_2.12.0.md
```

**Two loose patch files:**

```
phone-ux.patch  player-experience.patch
```

**Fourteen stray one-byte files named `test`.** The 2.0.0 changelog claimed to have removed one
of these; they are all back:

```
.github/workflows/test   docs/test   public/test   scripts/test   server/test   tests/test
src/core/test   src/engine/test   src/net/test   src/react/test   src/screens/test
src/screens/warden/test   src/ui/test   src/modules/ypsilon14/assets/casettes/test
```

One-liner for all of them, from the repo root:

```bash
rm -f MANIFEST.md MANIFEST_2.7.0.md EMPTY_CHAIR_MANIFEST.md FLOOR_MANIFEST.md \
      APPLY_2.8.0.md APPLY_2.9.0.md APPLY_2.10.0.md APPLY_2.11.0.md APPLY_2.13.0.md \
      UPDATE_2.12.0.md phone-ux.patch player-experience.patch
find . -name test -type f -size -2c -not -path './node_modules/*' -delete
git mv ROADMAP_2.9.md docs/ROADMAP_2.9.md
```

Then unzip this package over the root, and delete `APPLY_2.14.0.md` when you are done — which is
advice the last ten of these gave and which nobody took, so consider adding it to `.gitignore`
instead.

## Untouched, deliberately

`src/engine/useGame.js`, `src/engine/party.js`, `src/engine/floor.js`, `src/engine/secrets.js`,
`src/engine/storage.js`, `src/engine/locker.js`, `server/host.mjs`, and the whole RTC stack.

Worth calling out: **campaign persistence did not need a single line inside `useGame.js`**, and
that is by design rather than by luck. See "the record is a ledger, not a rule" below.

---

## Six things worth checking

### 1. The dispute button did not exist

The review's F6 says the corrective loop cannot reach unaddressed Moves. That is true and it
understates the problem. While wiring the fix I traced `C_DISPUTE` end to end:

- declared in `protocol.js` — ✅ since 2.7.0
- forwarded by `rtcRelay.js` with `asPc` — ✅
- handled by `useHost.disputeMove`, lifting the spotlight and clearing the floor offer — ✅
- folded into the ladder by `useDirector`'s ledger — ✅
- **sent by any screen in the application — ✗**

`grep -rn dispute src/**/*.jsx` returned exactly one hit, and it was `App.jsx` passing the
prop *out*. So the correction the wardenless design leans on hardest was, for three versions, a
message with no button. It is the fourth feature in this repository to pass its unit tests while
being unreachable at a table, after `sessionEndsAt`, `floor.on` and `listeners`.

It now hangs off the spotlight card, which is the moment the empty chair is unambiguously
pointing at a person. `tests/correction-wired.test.jsx` asserts a sender exists in the source,
crudely, on purpose — the same spirit as `tests/offline.test.js` grepping for `fetch`.

### 2. The quorum is two people, and that number is the design

A personal dispute is believed instantly and without appeal, and that is right: the person it was
aimed at is the only authority on whether it was aimed well, and nobody else is worse off.

An atmosphere line has no such person. It was said to the room, so only the room can judge it —
and one player pressing a button is not the room, it is one player who might be bored of vents
while four other people are enjoying them. Hence a second, different voice within forty-five
seconds.

It is deliberately **not** a `vote.js` topic. A table stopping to hold a referendum on a sentence
has already lost more to the interruption than the sentence cost.

Weighting: a carried objection is worth **one veto**, not `DISPUTE_WEIGHT` disputes. Two people
agreeing about a line said to both of them is stronger evidence than one Warden's single veto and
much stronger than one player waving off one moment. So three carried objections retire a rung,
against a lone player's six — which also softens the review's complaint that a table irritated by
the pacing nudges has to wave them off six times every evening.

A lone objection still says something out loud (`OBJECTION_NOTED`). That is not decoration: a
button that appears to do nothing gets pressed once and never again, and this one genuinely does
nothing on the first press, so it has to say so or the ladder loses the only feedback it has.

Neither line ever names anybody. Same reasoning as `C_SAFETY` and rule 1 of the floor.

### 3. The NPC weighting cannot change any existing module

`pickKnown` breaks ties to the **lowest index**, so an NPC standing somewhere that matches nothing
returns exactly what `findIndex` returned. That is the assertion to look at first
(`tests/party-review.test.js`, "recites in authored order when nothing matches"), and it is why
this was safe to add to a module written before it existed. Every Ypsilon 14 test passed
unchanged, which was the signal being watched for.

INV-6 is untouched. **Selecting which authored line to use is not composing one.** The text
returned is a verbatim entry from the module author's own array and there is no path from a
keyword to a generated string. `mindWords` reads the focus room's name and tags, set flags and
their string values, and non-secret pinned clues — secret clues are excluded for the same reason
`rungCallback` excludes them.

### 4. The campaign record is a ledger, not a rule

Nothing in the engine reads `campaign.js` to decide anything. No rung consults it, no module can
gate on it, and a session started inside a campaign is byte-identical to one started outside.
Two tests enforce this by reading the source of `director.js`, `useGame.js`, `effects.js`,
`floor.js`, `useDirector.js` and `useHost.js` and asserting none of them import it.

That is deliberate, and it is the same argument the floor's rule 6 makes: a feature that quietly
changes how the game plays because of something that happened three weeks ago is a feature nobody
at the table can reason about.

Three stores, three lifetimes, no overlap:

| | holds | for how long | on whose device |
|---|---|---|---|
| `storage.js` | one session, mid-flight | until restored | the table's |
| `campaign.js` | the record between evenings | forever | the table's |
| `locker.js` | one character | forever | **the player's** |

Recording happens once, on the shared screen only (`phone` guard in `Ending.jsx`) — six phones
each writing the same evening into six local campaigns is six different half-true records. It is
idempotent on a derived `sessionId`, which matters more than it looks: `Ending.jsx` sets state
twice for its two copy buttons, so it re-renders during an ordinary end-of-session and a naive
effect would append the evening every time somebody copied their card.

Losses are **marked, not removed**. A campaign that quietly deletes the dead cannot tell you what
it cost.

### 5. DEAD WEIGHT was written to a constraint, not trimmed to one

Ninety minutes came first and everything else fits inside it: nine rooms, one threat, one
countdown running from minute zero, three endings, and a cold open with no arrival and no
shopping.

Two things about it are worth reading against Ypsilon 14, because they disagree on purpose:

- **`attacks` is not empty.** Ypsilon 14 ships an empty array with a long comment explaining that
  its threat is `unseen: true` and `safeMove` would silently drop every entry. The Passenger has a
  body, is slow, and can be seen coming — so this module fills it in, and the two shipped modules
  now demonstrate both halves of that rule in *content* rather than only in tests.
- **The umbilical costs eight minutes each way.** That single number is the module. It is what
  makes splitting a decision rather than a habit, and it is why this module exists at a version
  where the director can finally follow a split party — built to exercise 2.13.0's `focusRoom`,
  not to tolerate it. There is an NPC on each side of it, so neither half of a split table is
  just waiting.

It loads with **zero problems and zero warnings** from `defineModule`.

### 6. The validator was one character from taking the app down

Writing `give: "torch"` instead of `give: ["torch"]` threw a `TypeError` from *inside*
`validate()`. That function runs at import time from `defineModule`, so a single-character
mistake in one module crashed the whole application with a stack trace pointing at the validator.

Which is precisely backwards: turning a bad module into a readable complaint is that function's
entire job, and it must survive the input it exists to complain about. Both `give` and `take` now
coerce through `[].concat`. I found this by making the mistake myself while writing DEAD WEIGHT.

---

## What is still open

Honest accounting. Everything in the review's section 6 is now done, but two things it raised are
larger than a drop:

- **A third module.** F5 asked for a ninety-minute module and this is one. The argument for a
  fourth is now about variety rather than about session length.
- **Spending what a campaign accumulates.** `campaign.js` records ships, credits and rosters
  across sessions, and `ShoreLeave.jsx`, `Contractors.jsx` and `core/ship.js` can all consume that
  shape — but the wiring between them is a design question about how much a campaign is allowed to
  matter, and per point 4 above the current answer is deliberately "not at all". Making a campaign
  affect play is a decision, not a task, and it should be taken on purpose rather than because the
  data happened to be there.

Two smaller ones I noticed and did not act on, because both are judgement calls that belong to
you:

- `DISPUTE_WINDOW_MS` is shared between personal disputes and table objections. A table needs
  longer to agree with each other than a person needs to wave off something aimed at them, so
  these arguably want different windows. Left as one because two tunables for one idea is how the
  floor's six rules nearly became nine.
- `rungNpc` still walks NPCs in `Object.keys` order and picks the first eligible one. The
  weighting added here decides *what* somebody says, not *who* speaks. Same fix would apply.
