# Changelog

## 2.7.0 — the empty chair, made dangerous

Everything in `EMPTY_CHAIR_NEXT.md`. The headline is not a feature: on the only module you can
actually play, the director could not escalate anything, because rungs 4 and 6 open with
`if (!mod.director) return null` and Ypsilon 14 had no `director` key. Its entire vocabulary was
pacing and mood. A table would feel that in about twenty minutes — the room keeps talking and the
situation never gets worse.

### The build was broken

- **`src/net/HostGate.jsx` was missing.** `HostBar` imports it; the file was not in the repository,
  so four test files failed to collect and `npm run build` could not resolve. Reconstructed from
  its call site: it renders only for `unauthorised` and `locked` — the two socket statuses that are
  answers rather than transient connection problems — and gives the one instruction that matters
  rather than the word "unauthorised".

### Four defects

- **`rungScripted` was stuck at stage 0 forever.** It read `w.directorStage`; nothing in `src/`
  ever wrote it. Entry 0 qualified, fired, re-qualified on the next tick and fired again. Now on
  `flags.directorStage`, written by the executor from the Move's own `nextStage` — a module flag,
  because an author who has to increment their own counter is hand-rolling a state machine the
  engine already owns.
- **`kind: "pressure"` was planned and then dropped.** `rungPressure` emitted it and `take`'s switch
  had no case, so it fell through to `default`. Worse than a no-op: the ladder had already spent
  rung 6, so a real pressure beat *suppressed* the atmosphere line that would otherwise have run.
- **The safety card did not pause the game.** `WARDENLESS.md` §A.5 promised this in bold. What
  actually happened: the director went quiet and nothing else did. No `tempo.held`, nothing sent to
  the phones, and clearing was a button on the device in the middle of the table — so whoever
  reached for it was visibly the person handling it. Now the card takes the existing hold, appears
  on every phone, and comes down from any of them, anonymously. It does not adjudicate between
  levels, does not resume on a timer, and does not soften the wording.
- **`dark` peer whispers were still offered with the chair empty.** The router is then a device
  belonging to somebody who is also playing, picked because they opened the tab. `allowedPeerMode`
  downgrades to `seen` and the downgrade is reported rather than absorbed.

### The ladder, extended

Nine rungs to thirteen: `safety, pending, combat, aftermath, ending, scripted, roll, npc, floor,
pressure, pacing, atmosphere, silence`.

- **`rungNpc`** — somebody opens their own mouth. The line is an untold entry from that NPC's own
  `knows` list, which is the hard limit `npcReply` already obeys, so INV-6 holds by construction.
  Two cooldowns: per person, and table-wide.
- **`rungCallRoll`** — the most frequent thing a Warden does. `safeMove` gained a fourth check: a
  called roll with no `reason` is dropped entirely. A director that can call a roll can fail
  somebody, and requiring the sentence means it can never spring a test for a danger the table was
  never shown.
- **`rungAftermath`** — a failed roll, narrated, from a room's or the module's `onFail` pool.
- **`rungEnding`** — the module's own end conditions, noticed. It cannot invent an ending: any id
  the module has not declared is refused.
- **Veto memory.** Three refusals of a rung and it stops being offered for the session. Passed into
  `directorPlan` rather than held there, so the pure function stays replayable. The strip announces
  the last refusal before it happens — a system that silently stops offering something is a system
  nobody can tell is broken.

### The table's own controls

- **`engine/vote.js`** — one primitive, five topics, and never the safety pause itself. Abstaining
  counts as no: a table of five where two tap yes has not agreed to anything. A vote nobody answers
  expires to a conservative fallback — except `veil`, where the conservative answer is to skip.
- **Whose go is it.** `tempo.js` has known the answer the whole time and it was never rendered as a
  sentence addressed to the person who needs it. Without it, the default state of a wardenless
  table is four people politely waiting for each other.
- **Ask the room.** Players could act on a room and interrogate the people in it, but could not ask
  the situation anything. Answered privately, from the room the crew has already entered and the
  clues they pinned themselves. A question it cannot answer is told so plainly.
- **Dispute.** A move addressed to you can be waved off within a few seconds, and it stops counting
  as an offer against your ledger. No threshold and no appeal — the person it was aimed at is
  simply believed.

### Ypsilon 14 has a director block

`src/modules/ypsilon14/director.js`. Five escalation beats gated on the clock and on what the crew
has found, four called rolls each carrying the sentence the player reads, a module-wide `onFail`
pool, one unambiguous ending, and a `pressure` hook that runs the module's existing `thinkMonster`
rather than moving anything itself.

It does not fire the module's set pieces. Giovanni, the pod, the showers and the self-destruct are
all reached by players doing things, and a director that walked the table through them on a timer
would be running a cutscene.

### Asking the room, properly

`src/engine/look.js` — pure, scored, and tested, replacing the regex matching the first cut used.

The regex version had the worst possible failure split: it worked for the four suggested chips and
was mediocre for anything typed, so it looked like it understood and then did not. It now scores
with the same tokeniser, stemmer and floor `npcReply` uses, matches *named* things above topics
("what's in the crates" gets the crates, not a paragraph about the bay), and handles the
contractions every one of these questions actually starts with — `tokenise` keeps the apostrophe,
so "who's" never matched "who".

**The important half is what it refuses.** A feature's `d` is a search result: ten to fifteen
minutes of game time, and for a `deep` feature an Intellect roll that can fail twice first. It sits
one property away from the name. Answering from it would have handed the whole room over for free,
silently, with nothing ever throwing — the same shape as the `dark`-whisper leak. So: **names are
visible, descriptions are earned**, checked against `w.searched` on every path. It also will not
say where somebody who is not in the room has got to, and will not name an `@ending` exit.

A question it cannot answer is told so, and pointed at searching or asking a person. It does not
return the room description in a confident tone, because a player who is given one of those reads
every subsequent answer as possibly-nonsense.

### Tests

771 passing across 33 files, up from 651 across 29. `tests/director2.test.js` (39),
`tests/look.test.js` (28), `tests/vote.test.js` (25), `tests/emptychair.test.jsx` (22), plus relay
parity for the four new client messages.

## 2.6.0 — the empty chair, and the thing only you saw

Three slices. The first is a mechanic any table can use tonight; the second and third are the
scaffolding for running without a Warden, built in the order that lets a person catch them being
wrong.

### Slice 1 — the private channel

- **`whisper` and `whisperTo` are module effect keys.** This is a fix, not a feature. `whisper()`
  has been on the game object since the beginning and was never on the module API object, so no
  module could ever fire one — everything private in the engine was a Warden pressing a button.
  `whisperTo` resolves `acting` / `alone` / `random` / a pcId, and resolution is total: every path
  either names somebody or whispers to nobody, because a private channel that fails open is not a
  private channel.
- **A pocket, on one phone.** Held secrets are derived from the feed rather than stored — the
  lines addressed to you, marked shareable, that you have not spoken about — so they survive a
  save and a reconnect for free and there is no second source of truth.
- **Four answers**: say nothing, tell them, show them, say something else. The first is the
  default and **nothing anywhere announces that a player received or withheld anything**; a screen
  saying "Riley received something" converts a secret into a visible token and the table simply
  asks.
- **Lying is a first-class move.** Paranoia is the game's engine and at a physical table lying is
  free. What keeps it honest is attribution: the shared screen says the character *said* this,
  never that the log reads it. `shareSecret` is a player action, allowed out of turn, and passes
  every tempo brake — a brake that held speech would be the software deciding when somebody may
  speak.

### Slice 2 — the empty chair, selectable

- **NOBODY IS THE WARDEN**, offered at the title beside GATHER THE TABLE, and fixed for the life
  of the session.
- **The lock.** In that mode `onView` is null and the view switcher **does not render** — absent,
  not disabled, not hidden by CSS. The moment this device can be tabbed over to the Warden deck,
  the person whose iPad it is knows where the creature is while they are also playing.
- Characters are auto-accepted, because a queue nobody drains is a table that never starts. The
  module's own crew-size limits do the refusing.
- `ready` and `start` in both routers, with ownership stamped by the router. **Any** phone may
  start — nominating one reintroduces a host role through the back door, and the person who joined
  first is not necessarily the person who knows everyone has arrived.

### Slice 3 — the director

- **`src/engine/director.js`** — a pure nine-rung priority ladder, not a weighted table: a referee
  who is random is a referee nobody can learn to read. `silence` is reachable and common.
- **`safeMove`, and it is the important part.** The director reads unredacted state and everything
  it says goes on a screen everyone can see. A Warden knows which of the things they know are
  secret because they are a person; a policy function does not. Every Move is checked before it
  can be spoken — an unvisited room, an unseen threat, or a justification tracing to a private
  line — and a failing Move is **dropped rather than rewritten**, because a rewrite is a promise
  and what is never composed cannot leak.
- **Assisted before auto.** `useDirector` proposes; a human takes or waves away every Move. Empty
  chair is the same path with the pause removed — one boolean, not a second implementation. A
  ladder nobody has vetoed is a ladder nobody has checked.

### Changed
- `useHost` gained `floorPolicy`. Part B's floor timer and the director's floor rung were two
  callers of `floorMove` with two separate cooldowns, which is two nudges for one quiet player.
  Whoever is driving stands the other down — and in assisted mode that means floor moves become
  vetoable like everything else.
- `runEffects` is exposed on the game object so the director can fire a module-authored list
  without composing anything.
- `intentLabel` learned `shareSecret`, deliberately neutral: a label reading "Lying" would be the
  software taking a view on a move whose whole point is that it does not know.

## 2.5.0 — the floor

The brakes in `tempo.js` were all things a Warden pressed. This is the thing that notices they
are needed. Off by default, one switch, and no screen anywhere shows a count.

### Added
- **`src/engine/floor.js`** — the airtime ledger and its policy. Pure, no React, no timers. Reads
  what the engine already measured (acts, `scene.cost`, idle time) plus one new signal, and
  derives a weight, a share and a starvation score per player. Six rules are written into the
  file's head and two of them are enforced by tests rather than asserted.
- **The lockout signal.** A tap that `useIntentGate` swallows is now reported to the host. This
  was the one failure shape that was completely invisible: a quiet player *trying* and being
  beaten to the intent every time looked identical, from every screen in the app, to a quiet
  player who was happy watching. It is weighted at a minute of silence apiece, because silence is
  ambiguous and an eaten tap is not.
- **Lever 1 — the ring opens with whoever has had least of it.** `makeScene` takes an optional
  comparator; `starvationOrder` is provided. Invisible by design: no player is told why they are
  first, and from the sofa it looks like the Warden asked them. Probably the highest-value thing
  in this release, and the cheapest.
- **Lever 2 — an offered floor.** A player who has gone a long time without a go gets the
  existing spotlight on their phone alone, worded as an invitation. Rate-limited per player and
  per table.
- **Lever 3 — a round, started on a stampede.** Four conditions must all hold, because any one of
  them alone describes an ordinary busy minute. Structural, so nobody is named.
- **Lever 4 — a soft hold.** A runaway waits up to nine seconds, measured from their own last
  action, and *only* while somebody else is actually behind them. It holds and drains in arrival
  order like every other brake in `tempoVerdict` — see below.
- **`tap` in both routers**, with ownership taken from the router's record of the client rather
  than from the message, exactly as an intent is. `tests/floor.test.js` keeps the two honest.
- **`tests/floor.test.js`** — 43 tests. Roughly half of them assert that a lever does *not* fire.

### Changed
- `passSceneTurn` counts as a decline when it answers an offer made in the last minute. Two
  declines and the floor stops being offered to that player for the session. Hanging back is a
  choice, and the system has to be able to hear it.
- `tests/table.test.jsx` now counts intents by type rather than counting calls, which is the
  stronger claim: it fails both if a second search escapes the gate and if the tap report is ever
  built as an intent.

### Four things worth arguing with
1. **Nothing is ever displayed.** No share, no count, no ranking — not to a player, not to the
   table, not to the Warden. The moment it is on a screen it becomes a thing to optimise, and the
   eager player is not being malicious. `tests/floor.test.js` reads the imports in `src/ui` and
   `src/screens` and fails the build if the scoring reaches either.
2. **Nobody is ever named.** `WAIT_TEXT.floor` says the room is waiting on someone else and will
   never say who.
3. **It holds, it does not refuse.** A floor correction that denied would be the first thing in
   this codebase to tell a player *no* for a social reason. The hold is measured from the
   runaway's own last action, so it always releases.
4. **It is off.** A table of four friends who have played together for a decade does not need this
   and will resent it.

## 2.3.0 — the road out of the building (N4, partial)

### Added
- **A transport seam in `useSocket`.** `{ status, send }` either way, so `useHost.js` and
  `ClientShell.jsx` never learn which transport they got. The relay path is byte-identical —
  a transport is selected, never inferred, so nothing changes under a table that was working.
- **`src/net/rtcSignal.js`** — connection codes. A session description, deflated and base64url'd
  into one pasteable token that survives a group chat. Carries no game state, no name, no token.
  The assisted (room-code) path is defined as an interface and deliberately not implemented,
  because implementing it means running something.
- **`src/net/rtcPeer.js`** — one `RTCPeerConnection` and one ordered data channel, shaped like a
  socket. ICE is gathered completely before a code is shown, because a manual exchange has no
  live channel to trickle candidates down.
- **`src/net/rtcRelay.js`** — `server/host.mjs`, ported into the host tab. Client ids, roster,
  claims, intent ownership, safety-card anonymity, `HOST_TO_CLIENT` enforcement. Written as a
  pure router taking ports, so it is testable with no WebRTC present.
- **`docs/REMOTE_PLAY.md`**.

### Changed — and a table needs to know this
- **`dark` peer whispers are refused over a direct connection, not quietly honoured.** On the
  relay, `dark` was structural: the words never reached the Warden's machine. Over a direct
  connection the Warden's browser *is* the router, so they always do. Silently keeping the name
  would convert a structural guarantee into precisely the promise `useHost.js` refuses to make,
  and a table might agree to something on the strength of it. `requestPeerMode("dark")` now
  returns `seen` and reports the downgrade. A table that needs true `dark` needs the LAN relay.

### Fixed
- `rtcSignal` originally compressed via `Blob(...).stream().pipeThrough()`, which fails in
  environments that have `CompressionStream` but not `Blob.stream()`. Feature-detecting the
  constructor while calling through `Blob` is how that ships broken to a browser nobody tested.
  Now written against the stream reader/writer directly, with a raw fallback on any failure.
- The compression writer's promises were left floating, so a truncated code — the everyday paste
  failure — produced an unhandled rejection instead of an error message.
- `tests/offline.test.js` now asserts the STUN exception explicitly: exactly one file may contact
  STUN, and no file may reference TURN, since TURN would relay game traffic through a third party.

### Not done
- The Warden-facing screen for the code exchange, and the `useHost` integration that drives it.
  Remote play is reachable from code, not yet from the interface.

## 2.2.0 — a front door, an offline install, and modules as files

### Added — the front door
- **A real `README.md`.** The repository had two lines of description in front of 41,000 lines
  of engine. What it is, what it is not, how to try it without installing anything, and how to
  write a module.
- **`CONTRIBUTING.md`** stating the invariants that were previously only discoverable by reading
  the source: host-tab authority, `src/core` staying headless, the protocol declaration rule,
  never evaluating module content, and the content-licensing position.

### Added — installable and offline
- **PWA manifest, icons and a service worker.** The engine promised offline operation and
  delivered it for the *engine* but not for *reaching* the engine: a table in a basement could
  not load the page that would then have worked perfectly. Add to home screen, then play with
  the aircraft mode on.
- Navigations are network-first so nobody gets welded to a stale build; hashed assets are
  cache-first because their hash is their version. Registration declines on dev, on plain http,
  and in tabs that are part of a live table — see `src/pwa.js`.

### Added — modules as files
- **Runtime module loading.** A module can now be a `.mship` JSON file, loaded in the browser
  with no build step and no terminal. Library → Load a module.
- `src/engine/portableModule.js` — the format, its envelope, validation, and lossy export of a
  bundled module as a starting point for authors.
- `src/engine/moduleStore.js` — persistence, separate from saves. Removing a module leaves its
  saves alone. Stored modules are re-validated on every read, so an engine change that breaks
  one surfaces at the shelf rather than three rooms into a session.
- Unknown keys are dropped rather than passed through. Bundled modules win an id collision.
- **A module is data and is never executed.** No `eval`, no `new Function`, no dynamic import
  anywhere in the load path.
- `docs/PORTABLE_MODULES.md`, with a complete worked example that is tested rather than asserted.

### Fixed
- **The no-network test did not exist.** The 2.0 changelog states the LLM Warden's removal is
  "enforced by a test that greps the source and fails the build if any reappear." No such test
  was in the repository. `tests/offline.test.js` is now that test: no model providers, no
  `XMLHttpRequest`, no `fetch` outside a named four-entry same-origin allowlist, no absolute
  websocket origins, no `eval` or `new Function`, and `src/core` still free of React.
- `Library.jsx` declared a local `broken` that would have shadowed the new prop of the same name,
  which is exactly how a shelf silently stops reporting its broken modules.
- A stored module missing its `title` rendered as an unidentifiable blank card. It now falls back
  to the name it was stored under.

## 2.1.0 — a base that runs itself

### Engine
- **Simulation hooks.** `onTick`, `onEnterRoom` and `onVanish` let a module
  run its own world between player actions. `onTick` is re-entrancy guarded.
- **Threats have a body and an address.** `start` now places a threat;
  `setThreat` patches `dmg`, `hits`, `heal` and `state`. A threat standing in
  the room you walk into ambushes you instead of waiting for a percentage.
- **Grappling.** An attack can take hold of its victim. While it does, it
  attacks nobody else, the victim saves every round, cannot Run, and gets a
  Strength contest to tear free. Grapples release when combat ends.
- **NPCs can be moved.** New `{ npc: {...} }` and `{ npcSay: {...} }` effects,
  and `api.setNpc` / `api.npcSay`.
- **`vanish` can be aimed.** Take a named person, or anyone in a named room,
  with separate text for the times the players are standing right there.
- **New predicates:** `taken:`, `npcAt:npc@room`, `threatAt:threat@room`.
- **`api.rng`.** Hooks get the world's seeded stream, so simulation is
  reproducible from a seed and survives a save/resume.

### Fixed
- `defineModule` silently dropped every module's `warden` block. It no longer
  does, and also passes through `lore` and `tutorial`.
- Devices were unreachable in play: `Play.jsx` looked for `room.devices`, which
  no module sets, and ignored features carrying `device:`. Both work now.
- The `when` filter on room and module actions was `!a.when || ctx && true`,
  which is always true. Conditional actions were never conditional.
- Combat counters ignored their `when` entirely, in the UI and on use.
- Validation now checks `npc` / `npcSay` / `vanish` targets, `retreatTo`,
  counter ids and grapple damage expressions.

### Ypsilon 14 — rewritten as the campaign's tutorial module
- **The thing has drives**: mend, feed, dry, quiet — checked in that order. It
  has a position, patrols the ducting, prefers isolated prey, will not cross
  standing water, follows noise, and goes to the pod to heal when hurt.
- **Devour** is implemented: the attack that explains the empty vaccsuit.
- **The pod can be destroyed** — burned with the cutter, or flooded by reversing
  the slurry pump from two decks away. After that it cannot mend, and it stops
  being careful.
- **The crew are people.** Posts, haunts, bonds, nerve. They work, drift, and
  when frightened they stop being alone — which makes the players the loneliest
  warm things on the base.
- **Kantaro's infection runs on its own clock** and ends in front of whoever is
  standing there.
- **The infection is tempting**: real healing and a real Strength buff, and then
  the bill.
- Water toolkit (fill the bottle, the jerrycan, the extractor, the showers),
  decoy recordings, Prince as a monster detector, suit air in the mine, a cargo
  objective that costs two hours, and the Company's actual orders in a sealed case.
- Tutorial beats fire once each, when the thing they teach happens.

## 2.0.0 — offline engine, crew play, full combat

### Removed
- **The LLM Warden is gone.** `src/engine/warden.js` is deleted. There is no
  `fetch`, no `XMLHttpRequest`, no API key, and no model call anywhere in the
  codebase — enforced by a test that greps the source and fails the build if
  any reappears. The engine costs nothing to run and works with no network.

### Added — the offline Warden
- **Command parser** (`oracle.js`) matches free text against the room's exits,
  features, items, and people, and routes to the same code the buttons use.
- **Oracle** answers unparseable questions with a weighted yes/no plus a chance
  of a complication.
- **Atmosphere engine** builds sensory lines from pools keyed to room tags.
- **Offline NPC dialogue** keyword-matches against each NPC's `knows` list and
  tracks what has already been said. NPCs cannot invent.
- **Seeded PRNG** in world state, so a resumed save continues its own stream.

### Added — Tier A
- **#4 Rest, healing and stress relief.** Body Save heals by margin, Fear Save
  sheds 1 Stress per 10 points of margin, crits double, critical failure
  reopens the wound. Once a day. Environment, drugs, cryosleep and a crewmate
  with Psychology all modify it.
- **#5 Party play.** Up to four characters. Scientist contagion, Marine panic
  contagion, Android dread, Marine proximity bonus, Teamster Panic re-roll,
  crew assistance as Advantage, death cascades, and the `nearby` panic field —
  all now actually fire.
- **#6 Combat overhaul.** Initiative by Speed Check, two actions a round, range
  bands, aiming, reloading (free if trained), automatic-fire burst rules,
  ammunition that gates the trigger, multiple enemies, distance and movement.
- **#7 Modifier system.** One pipeline for skills, gear, drugs, conditions,
  class abilities, assistance and situational calls, with a visible breakdown
  on every roll.
- **#8 `rollStats()` is 6d10 per Stat**, not 2d10+25.
- **#9 Advantage/Disadvantage rank by outcome band**, so a critical beats a
  plain success. Same-band ties are a house rule.
- **#10 230 tests and real CI.** The 1-byte `workflows/test` is gone; Pages no
  longer deploys unless the tests pass.
- **#11 Per-weapon critical effects** and `vsArmor` modifiers in gear data.
- **#12 Wake-table stat penalties are applied**, not just printed.

### Added — Tier B
- **#13 Progression.** XP, levels, +5 Stat/Save, Resolve to 5, new skills.
- **#14 Accessibility.** `aria-live` log, modal focus trap and Escape,
  `:focus-visible`, keyboard-navigable map, 44px targets, reduced motion,
  skip link.
- **#15 Warden tools.** Horror builder, job and faction generators, dice tray,
  markdown export. Entries are original; the published tables are not copied.
- **#16 Responsive layout.** Styles moved to a token stylesheet. Three columns,
  two, then feed-first with drawers on a phone.
- **#17 Save system v2.** Named slots, schema versions, v1→v2 migration,
  JSON export/import, and the save survives the ending.
- **#18 Deep module validation.** Every hook, table, track, meter, handout,
  item, room, threat, ending and dice expression resolved at load.
- **#19 Nine house rules** from the Warden's Operations Manual.
- **#20 Panic completeness.** The `Math.max(2, …)` floor is gone, so Resolve
  can produce no effect at all. Full RAW trigger set.
- **#21 `NOTICE.md`** with the Mothership third-party licensing position.
- **#22 Economy.** Priced gear, requisition screen, resale.
- **#23 Error boundary** with module problem reporting and eject.
- **#24 Recursive-descent dice parser** replaces `new Function()`.
- **#25 Session transcript export** as markdown, with a roll table.
- **#26 Typed module contract** via JSDoc and the effect-key registry.

### Fixed
- The five missing screen components are present; the build works.
- Opposed Checks re-roll ties and report both-fail instead of silently
  awarding the defender.
- Ammunition blocks firing instead of printing "Empty" and continuing.
- Byline corrected from "Mothership 0e" to 1e.
