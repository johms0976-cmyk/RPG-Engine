# INVARIANTS

Things this engine holds true regardless of module, table, configuration or version.

## Why this file exists

`INV-4`, `INV-6` and `INV-7` are invoked by name in `src/engine/director.js`,
`src/engine/autoDirector.js`, `src/engine/reactions.js`, `src/engine/endcard.js`,
`src/ui/DeathTakeover.jsx`, `src/net/useDirector.js`, four test files and a dozen changelog
entries — and the list they belonged to was never in the repository. It lived in
`WARDENLESS.md`, `EMPTY_CHAIR_NEXT.md` and `ROADMAP_2.8.md`, none of which were ever committed,
and in a set of manifests whose own instructions told the reader to delete them after applying.

So several files justified their shape by reference to a document nobody could read. That is a
worse failure than a missing feature, because a rule nobody can look up is a rule the next
change breaks by accident. This is that document, stated once, in the place a reader looks.

**These are numbered to match the existing references.** Where a comment says INV-6, it means
the INV-6 below. Nothing has been renumbered and nothing should be.

---

## INV-1 — No model, ever

No sentence that reaches a player was generated. Every word is either written by a module
author, written by a person at the table, or written into this repository by hand.

This is not a promise, it is a build failure. `tests/offline.test.js` greps the source for the
shape of a network call to an inference endpoint and fails the suite if it finds one.

*Consequence:* the engine has no fallback for content a module did not supply. When a module
declares no `listeners`, the director does not listen. When a threat has no `attacks`, nothing
attacks. The correct response to missing content is silence, never invention.

## INV-2 — The table's device holds the truth

There is exactly one authority on world state and it is the host. Phones hold a redacted view
and send intents. A phone that disagrees with the host is wrong.

*Consequence:* every new player-facing capability is a message in `src/net/protocol.js` and a
handler in `src/net/useHost.js`, never a local mutation.

## INV-3 — Redaction happens before transmission

A player who has been lied to receives the lie. They do not receive the truth alongside a
request not to look at it.

`src/engine/secrets.js` builds each phone's snapshot host-side. The relay forwards only messages
named in `HOST_TO_CLIENT`, by `to` field, and silently drops the rest — so a new host→player
message must be declared in the protocol before it can travel at all.

*Consequence:* client code may be read by anybody holding the phone. Nothing may rely on the
client choosing not to render something.

## INV-4 — State survives the device

A session must be recoverable from what the phones last agreed on. The host tab can be closed,
refreshed, or killed mid-scene, and the evening is not lost.

`src/net/resume.js` writes every broadcast; `App.jsx` offers restoration rather than applying it,
because the second most common reason for a host tab to reload is that somebody meant to start
something else.

*Consequence, and the reason this one is invoked in changelog entries about work that has NOT
shipped:* host-device failover is blocked on proving INV-4 **through the handover**, not merely
after it. Half-built failover that breaks INV-4 silently is worse than no failover, because the
failure is invisible until the evening is already gone.

## INV-5 — Every brake is chosen, never inferred

The engine does not decide that a table is bored, tense, tired, or ready. It counts things it
knows for certain — harsh moves in a window, minutes since anybody acted, whose intents got
beaten to the punch — and acts on arithmetic.

*Consequence:* `rungBreather` fires on a count of harsh moves, not on a mood reading. The floor
measures latency and volume, not engagement. Where a judgement is genuinely required, it is
asked of the table (`src/engine/vote.js`) rather than guessed at.

## INV-6 — Nothing composes a sentence a person did not write

The strongest form of INV-1, and the one invoked most often, because it binds in places INV-1
looks like it does not reach.

An NPC may only say an untold entry from their own authored `knows` list, verbatim.
`npcReply` obeys this and so does `rungNpc`. The end-of-session card may only quote a line that
already appeared in the feed. A reaction may only select from authored pools. A director Move
may only fire effects a module author wrote.

**Selection is not composition.** Choosing *which* authored line to use is allowed and is
sometimes obligatory — `pickKnown` weights an NPC's untold lines against the room, the flags and
the clue board, because a person volunteers what is on their mind rather than item 0 and then
item 1. What is forbidden is any path from a keyword, a state, or a player's sentence to a
string that was not already in the repository.

*Consequence:* `rungListen` matches phrases to a Move the module author wrote. There is no
template, no slot-filling, and no paraphrase. A module that declares no listeners gets no
listening.

## INV-7 — Every brake holds; none refuses

A pacing mechanism may make somebody wait. It may never tell somebody no.

`floorVerdict` returns `{ wait }` and has no other verdict. The floor holds a fast player for a
moment so a slower one can get a word in; it cannot reject an intent, cannot rank players, and
cannot name anybody.

*Consequence:* there is no code path in which the engine refuses a player's action on the
grounds that they have had enough turns. If that ever becomes tempting, the answer is a longer
hold, not a refusal.

## INV-8 — A breather the table called never expires

Software may decide that a pause **it** called has run its course. It may not decide that a
pause a **person** called has run its course.

`src/engine/director.js` implements this asymmetry deliberately: a director-called breather has a
timeout, and a table-called one does not. Somebody at that table asked for a minute, and the
engine does not know why.

## INV-9 — The Warden's screen is absent, not disabled, when there is no Warden

In wardenless mode the shared screen cannot reach the Warden deck. `App.jsx` refuses to render
anything but `TableView`, and `tests/wardenless.test.jsx` asserts the switcher is **absent**
rather than disabled — a disabled control is one devtools attribute away from being pressed.

*Consequence:* anything a wardenless table needs must be reachable from `TableControls` or
`ClientShell`. A capability whose only switch is on the Warden deck does not exist for the
configuration that most needs it. This has been the root cause of two shipped-but-unreachable
features; check it before adding a third.

## INV-10 — The ladder is correctable by the people it is aimed at

With nobody behind the screen, the table is the only feedback loop, so it must be able to reach
every part of the ladder's output.

A Move addressed to a player can be waved off by that player, believed at once, no threshold and
no appeal (`C_DISPUTE`). A Move addressed to the room takes a second voice and is worth a veto
(`C_NOTTHAT`, `src/engine/objection.js`). Both feed the same per-session ledger, because two
parallel mechanisms for "the table said no" is one more than anybody could reason about later.

*Consequence:* a new Move kind that carries no `pcId` is, by default, correctable only through
the table-level route. If a new rung emits output that neither route can reach, that rung is not
finished.

## INV-11 — Content is authored, and its absence is announced

`defineModule` validates at load and reports both `problems` (this cannot work) and `warnings`
(this will silently do nothing). An author is told what is missing at the one moment they are
already reading.

The validator must survive bad input. It is called at import time, so a validator that throws
takes the whole application down with it — which is precisely backwards, since turning a bad
module into a readable complaint is the entire job.

---

## Rules of thumb that follow from the above

- **A crude guard that loses a good line beats a clever one that leaks once a session**, because
  the leak is silent and the loss is not. See `safeMove`'s five checks.
- **Assisted before auto.** The empty chair is the assisted path with the pause removed — one
  boolean, not a second implementation. That is why auto is trustworthy.
- **Prose rots; derive it.** `LADDER` is derived from `RUNGS` rather than written twice, after a
  version in which the two silently disagreed and the tests only compared the list to itself.
- **A feature that passes its unit tests and cannot be reached from the running app has not
  shipped.** Three separate features cleared their tests while being unreachable at a table.
  When adding one, write the test that drives it through `App.jsx`.
