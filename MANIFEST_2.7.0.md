# MANIFEST — engine 2.6.0 → 2.7.0

Everything in `EMPTY_CHAIR_NEXT.md`, implemented.

Copy these over your working tree, preserving paths. **No new dependencies**, `package-lock.json`
untouched.

**Verified before packaging:** `npm test` → **771 passed** across 33 files (was 651 across 29),
`npm run build` clean, `node --check server/host.mjs` clean.

---

## ⚠ Read this first

**`src/net/HostGate.jsx` is missing from your repository and the build does not resolve without
it.** `src/net/HostBar.jsx` imports `./HostGate.jsx` at line 30; the file is not in the
`14a77de` upload. Four test files fail to collect and `npm run build` fails outright, so the
"651 passing" in the 2.6.0 manifest is not reproducible from what is on GitHub today.

It is reconstructed here from its call site. Apply it even if you apply nothing else.

---

## New files

| Path | What it is |
|---|---|
| `src/net/HostGate.jsx` | **The missing file.** The screen for a tab the relay refused — renders only for `unauthorised` and `locked`. |
| `src/engine/look.js` | Answering "what do I see?" — pure, scored, and the search-result rule. |
| `src/engine/vote.js` | The table-vote primitive. Five topics, abstention counts as no. |
| `src/net/TableControls.jsx` | `WhoseGo`, `SafetyBanner`, `TableVote`, `AskRoom`. |
| `src/modules/ypsilon14/director.js` | **The content.** Escalation beats, called rolls, `onFail`, pressure, one ending. |
| `tests/director2.test.js` | 39 tests — the four defects as regressions, plus the new rungs. |
| `tests/look.test.js` | 28 tests. The search-rule block is the load-bearing one. |
| `tests/vote.test.js` | 25 tests. The abstention block is the load-bearing one. |
| `tests/emptychair.test.jsx` | 22 tests — the executor's new routes and the table controls. |
| `MANIFEST_2.7.0.md` | This file. Delete after applying. |

## Replaced files

| Path | What changed |
|---|---|
| `src/engine/director.js` | Ladder 9 → 13 rungs. `rungScripted` reads `flags.directorStage` and supports `when`. New `rungAftermath`, `rungEnding`, `rungCallRoll`, `rungNpc`. `safeMove` gained the called-roll guard. `vetoes` parameter. |
| `src/net/useDirector.js` | `pressure`, `callRoll`, `npcSay` and `end` cases in the switch; the `directorStage` write-back; per-session veto counts. |
| `src/net/protocol.js` | `C_CLEARSAFETY`, `C_VOTE`, `C_OPENVOTE`, `C_LOOK`, `C_DISPUTE`; `allowedPeerMode`; `safetyCall` and `vote` on the snapshot. |
| `src/net/useHost.js` | The safety hold, the vote lifecycle, `answerLook` routing, `disputeMove`, the `dark` downgrade. |
| `src/net/rtcRelay.js` · `server/host.mjs` | Forward the five new client messages. **The two must agree** — see `tests/rtcrelay.test.js`. |
| `src/net/ClientShell.jsx` | The card, the ballot, whose-go, and the wardenless table bar. |
| `src/screens/TableView.jsx` | The pause and the open question, in the middle of the table. |
| `src/App.jsx` | `SafetyAlert` gated to Warden tables; the peer-downgrade notice; vetoes into the strip. |
| `src/ui/DirectorStrip.jsx` | Names the rung; warns before the last veto retires it. |
| `src/ui/theme.css` | Banner, ballot, whose-go, ask-room, rung label. |
| `src/modules/ypsilon14/index.js` | Imports the director block; adds `directorPressure` and `raiseFearBeat` hooks. |
| `tests/rtcrelay.test.js` | Parity for the new messages, including that a clear is as anonymous as a card. |
| `docs/MODULE_FORMAT.md` | The `director` block, and the three rules the engine enforces. |
| `docs/CHANGELOG.md` · `package.json` | 2.7.0. |

---

## The four defects, as they were

Worth knowing what these looked like, because none of them would ever have thrown.

**1. `rungScripted` was stuck at stage 0 forever.** It read `w.directorStage`; nothing in `src/`
wrote it. Entry 0 qualified, fired, re-qualified on the next tick, fired again. Invisible only
because no shipped module had an `escalate` list. Now on `flags.directorStage`, written by the
executor from the Move's own `nextStage`.

**2. `kind: "pressure"` was planned and dropped.** No case in the switch, so it fell to `default`.
Worse than a no-op: the ladder had already spent rung 6, so a real pressure beat *suppressed* the
atmosphere line that would otherwise have run. The table got silence exactly where it should have
got the creature.

**3. The safety card did not pause the game.** The director went quiet — `rungSafety` returns
`halt` — and nothing else did. No `tempo.held`, nothing to the phones, and clearing was a button on
the device in the middle of the table. Now: takes the existing hold, on every phone, cleared from
any of them, anonymously both ways. It does not adjudicate between levels, does not resume on a
timer, does not soften the wording.

**4. `dark` peer whispers were still offered with the chair empty.** No mode gate anywhere.
`allowedPeerMode` downgrades to `seen` and App reports it.

---

## Four things worth checking before you play it

**1. Ypsilon 14's director block is the part that needs your judgement, not your review.**

The engine work is arithmetic and is tested. `src/modules/ypsilon14/director.js` is five pacing
judgements about your module — is minute 35 too early for the base to notice the visitors, is
minute 215 too late to mention the window. Those are wrong until a table has sat through them.
The clock times are the first thing to change.

**2. Assisted mode is still on for every hosted table.**

Flagged in 2.6.0, still true, and now it matters more: with a `director` block present, a Warden
table will start seeing escalation and called-roll suggestions bottom-right. That is how the ladder
gets evaluated, and the veto counter only earns its keep if somebody is actually pressing "No" —
but it is a visible change to existing behaviour and it is still one line in `App.jsx`.

**3. The search rule in `look.js` is the leak-shaped one.**

`tests/look.test.js` asserts that a feature's `d` is withheld until `w.searched` says otherwise.
If you add another path that answers a player's question from module content — a hint system, a
smarter oracle, anything — that test will not catch it. It guards the one door I built.

**4. `answerLook` matches names against the room you are standing in only.**

Ask about something in the next room and you get the honest miss, which is right. Ask about
something with a name close to a feature in this room and you may get that feature instead. The
`NAME_FLOOR` is a guess and is exported so you can raise it.

---

## Still not done

From `EMPTY_CHAIR_NEXT.md`, deliberately:

- **B.7 solo.** Two players and the empty chair works. One does not — the whole floor half of the
  ladder is about distribution between people. Documented rather than fixed.
- **A.6's feed labelling** is partial: the rung shows in the assisted strip, not in `FeedLog`.
- **Failover.** The host device is still the save file. Unchanged, and still the worst failure mode
  this architecture has.
