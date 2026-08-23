# MANIFEST — engine 2.7.0 → 2.8.0

Everything in `ROADMAP_2.8.md` except the four items listed at the bottom under **Not in this
drop**, and except 0.2, which you said you would do by hand.

Copy these over your working tree, preserving paths. **No new dependencies**, `package-lock.json`
untouched.

**Verified before packaging:** `npm test` → **841 passed across 35 files** (was 771 across 33),
`npm run build` clean, `node --check server/host.mjs` clean.

---

## ⚠ Read this first

**`defineModule` was dropping the `director` block on the floor.**

It assembles an explicit object rather than spreading `raw`, and `director` was never added to the
key list. So `mod.director` was `undefined` for **every module in the repository**, and the five
rungs that open with `if (!d) return null` — escalate, aftermath, ending, callRoll, pressure — had
never fired at a table in their lives. Everything 2.7.0 shipped for the empty chair was
unreachable.

2.7.0 fixed exactly this bug one layer up: Ypsilon 14 had no `director` key, so those rungs went
quiet. The module was then written — and the block still never arrived, because nobody checked the
door it had to come through. It survived 771 passing tests because every director test builds its
module object inline and therefore always had one.

Apply `src/engine/defineModule.js` even if you apply nothing else. Then run
`tests/director3.test.js`, which walks the real door for both a synthetic module and the shipped
one.

---

## New files

| Path | What it is |
|---|---|
| `src/engine/autoDirector.js` | The floor under the empty chair. Derives a thin director block from declared content and **composes nothing**. Also `directorGaps`, which is what the validator warns from. |
| `tests/director3.test.js` | 52 tests. The `defineModule` regression, the validator, the floor, and the four new/changed rungs. |
| `tests/replacement.test.jsx` | 18 tests. The route out of being dead, and the per-player transcript. |
| `APPLY_2.8.0.md` | This file. Delete after applying. |

## Replaced files

| Path | What changed |
|---|---|
| `src/engine/defineModule.js` | **The fix.** `director` and `replacement` carried through. Validates the director block: four new problems, and a warning per missing list. |
| `src/engine/director.js` | Ladder 13 → 16 rungs. New `rungAttack`, `rungBreather`, `rungCallback`. `rungPending` rewritten to three states. `safeMove` gained a fifth check for combat. The breather asymmetry in `directorPlan`. |
| `src/net/useDirector.js` | `combat`, `callback`, `breather`, `resume`, `nudge` cases. Harsh-move ledger, pending clock, callback memory. Feed lines now carry their rung. |
| `src/engine/useGame.js` | `wardenSay` takes `extra`; `wardenBreather` takes `opts` so a breather can say who called it. |
| `src/App.jsx` | Assisted mode is a remembered setting, not a constant. `directorOn` respects it. |
| `src/net/HostBar.jsx` | The suggestions checkbox three manifests have now asked for. |
| `src/net/ClientShell.jsx` | The door out of being dead, in the takeover and as a persistent strip. The ended branch passes `phone`. "You're out" is a door rather than a description. |
| `src/ui/DeathTakeover.jsx` | `onNewCharacter` and `arrival`. Offered only for actual death, never for unconsciousness. |
| `src/screens/Ending.jsx` | Copy-to-clipboard; `phone` mode hides the download and "run it again". |
| `src/ui/FeedLog.jsx` | Shows which rung wrote a line, beside the clock stamp. |
| `src/ui/theme.css` · `src/ui/phone.css` | The rung tag, the assist switch, the dead-player strip, the takeover's second button. |
| `src/modules/ypsilon14/director.js` | `attacks: []` — a decision, with the reasoning. |
| `src/modules/ypsilon14/index.js` | A `replacement.arrival` line that names nobody. |
| `tests/wardenless.test.jsx` | One assertion updated: it asserted the infinite pending wait, which is the thing that was fixed. |
| `docs/MODULE_FORMAT.md` | `attacks`, `replacement`, the validator, the floor, and a fourth enforced rule. |
| `docs/CHANGELOG.md` · `package.json` | 2.8.0. |
| `Play.bat` | From the previous drop, included again in case you have not applied it. Opens `?mode=host`. |

---

## Three things worth checking before you play it

**1. The breather asymmetry is the design decision I would most want you to disagree with out loud.**

A breather the *director* called ends by itself after four minutes. A breather a *person* called
never ends by itself and has no timer anywhere. The reasoning is in `directorPlan` and in
`wardenBreather`: with the chair empty nobody is holding the button, so a game that can stop but
not start would be worse than one that never stops — but somebody who put the game down did so for
a reason, and software that decides the reason has expired has overruled the only instruction it
was given. If you think the director's should also be manual, it is a two-line change.

**2. The floor is much thinner than "generic fallback director" sounds, on purpose.**

`autoDirector` cannot produce `rolls` or `attacks`, because both need a `reason` — a sentence — and
the engine does not write sentences. That is INV-6 applied to the referee rather than to an NPC. So
the floor stops a module being mood-only and does not make it Ypsilon 14. The *warning* is the
load-bearing half of A.2, and it is the half that will actually change what authors write.

**3. `HARSH` in `useDirector` is a judgement and it is four strings long.**

`escalate`, `combat`, `callRoll`, `pressure`, plus an aftermath line. If a table gets offered
breathers at the wrong moments, that set is the first thing to change, not the thresholds — and it
is counted on Moves that were *taken*, so in assisted mode a Warden's vetoes correctly do not count
towards it.

---

## Not in this drop

Named plainly rather than half-built.

- **B.2 campaign persistence.** Tractable as `engine/campaign.js` plus storage, but dead code
  without the Library and shore-leave surfaces to sit behind, and that is a slice of its own.
- **C.1 host-device failover.** The fan-out design fits the invariants, but it needs `INV-4`
  (exactly one authority) proved *through the handover*, with tests, before any of it is worth
  writing. Half-built failover that breaks INV-4 silently is worse than none — and the failure
  mode would be two authorities disagreeing mid-session, which is the one thing this architecture
  has never had to handle.
- **C.2 a second module.** An authoring project, not an engineering one. The format is not the
  blocker and now has a validator that will tell an author what they have missed.
- **C.3 bundle weight.** `art-*.js` is 283 kB. Worth a look, not worth a project, and not worth
  touching in the same drop as sixteen rungs.

## Known

`tests/remoteapp.test.jsx` went red once during this session and passed in isolation and on every
subsequent full run. Same flake the 2.6.0 manifest recorded: it walks a long RTC handshake and is
timing-sensitive on a loaded machine. Not fixed, and you should know it can go red.

## After applying

```bash
npm test          # expect 841 passing
npm run build
```

To see the thing that was broken: put a `console.log(mod.director)` in any module's boot path
before applying, and after.
