# ROADMAP 2.9 — the couch

Written against `main` at 2.8.0. No code in this drop.

**One new file: `ROADMAP_2.9.md`. Nothing replaced.**

---

## 0. Where 2.8.0 actually leaves it

The empty chair is *mechanically* finished and *ergonomically* untested. Sixteen rungs, a floor
ledger, four brakes, a safety card that reaches every phone, a route out of being dead. What none
of it has been asked to survive is the configuration you described: **one PC on a TV, six people on
a sofa, six phones, nobody behind a screen.**

That configuration breaks things that a laptop-on-a-table configuration hides, and almost none of
them are in the director. They are in typography, wake locks, audio ownership and the first ten
minutes. Those are cheap. They are also the difference between a system that works and an evening
that works, and 2.9 should be entirely about the second.

### Three things to fix before any of it

- **`tests/remoteapp.test.jsx` is flaky and two manifests have now recorded it without fixing it.**
  In a repo whose entire discipline is "the tests are the guarantee," a known-red-sometimes test is
  a slow leak. Fix it or delete it; do not record it a third time.
- **`ROADMAP_2.8.md`, `WARDENLESS.md` and `EMPTY_CHAIR_NEXT.md` are cited as normative and are not
  in the repository.** `docs/CHANGELOG.md` quotes "`WARDENLESS.md` §A.5" as a promise that was
  broken. The design record for the empty chair currently lives inside two manifests that both
  instruct the reader to delete them after applying.
- **`flags.directorStage` is one integer for a whole module.** Fine today. See C.2.

---

## A. THE COUCH — the ten-foot table

This is the slice. Everything else in this document is optional; this is not.

### A.1 A viewing distance, chosen once, remembered

`TableView` sizes its pinned situation at `clamp(14px, 1.6vw, 20px)`. The cap is 20px. At three
metres from a 55" 1080p panel, 20px subtends about 0.19° — under the ~0.3° floor for comfortable
sustained reading. The crew bars, the feed and the panel titles are all smaller than that.

Nobody will report this as a bug. They will report that the TV "isn't very useful" and start
reading everything off their phones, at which point the shared screen has become furniture and the
whole architecture of the thing is pointless.

Add a distance setting in `HostBar` — `desk` (today, default) / `couch` — persisted with the
assist checkbox. It sets a scale custom property on the table-view root; everything inside sizes in
`em`.

Targets for `couch`: body text ≥ 2.2% of viewport height, headings ≥ 4%, minimum 24px body at
1080p and 34px preferred. Nothing on the far layout smaller than 20px, including timestamps —
if it can't be read from the sofa it should not be rendered from the sofa.

### A.2 The far layout is not the near layout, scaled

Scaling the dashboard produces a dashboard that doesn't fit. At couch distance the shared screen
carries only what everybody needs *simultaneously*, and nothing else:

1. **Whose go it is.** The largest element on screen after the room name. Right now this is the
   `held-strip`, one line, ordinary size. `tempo.js` has known the answer since 2.7.0; the sofa
   needs it at poster size, because the default state of a wardenless table is five people
   politely waiting for each other and the fix is a screen that says a name.
2. Room name and clock.
3. The pinned situation.
4. The crew as a **single strip** — name, health, stress, lit, dead. No numbers, no labels, no
   panel chrome. Six cards do not fit; six bars do.
5. **Three feed lines.** Not the log. Nobody reads a scrolling log from a sofa, and the log is
   already on every phone.

Everything else — the map, handouts, the enemy list, the recap, the vote — stops being a permanent
panel and becomes a card that **takes the screen when it matters and leaves when it doesn't**.
Combat takes the screen. A handout takes the screen. The map takes the screen when somebody moves
and then gets out of the way.

The idle/cinema state in `TableView` is already the right instinct and already the right size. The
far layout is that treatment applied to the *active* state rather than only to the pauses.

Suggested shape: `src/screens/TableFar.jsx`, with `TableView` routing on the distance setting and
both sharing the cinema branch. Do not fork the safety card, the vote strip or the recap.

### A.3 Nothing sleeps

There is no `wakeLock` anywhere in `src/`. On a sofa this is the single most expensive omission in
the repository.

What happens today: the spotlight fires, the phone in someone's lap buzzes, and by the time they
pick it up the screen has locked. They unlock, land wherever iOS left them, and the table waits.
Multiply by six players and four hours.

`src/ui/useWakeLock.js` — request on the host for the whole play phase, request on a phone while it
is claimed and in play. The sentinel is dropped on tab hide, so re-request on `visibilitychange`;
that re-request is the part people forget and it is the part that matters, because a phone going in
and out of a pocket is the normal case. iOS Safari 16.4+ has it. Older iOS does not, and the
correct response is to accept it and lean on `haptics.js` rather than ship the silent-looping-video
hack, which costs more battery than it saves attention.

### A.4 The join is the first impression, and it is currently a URL read aloud

Six phones is six chances for onboarding to fail, and someone always arrives late and someone
always drops.

Make the table screen able to become a **join card** on demand, bound to a key on the host and
reachable from any phase:

- The QR at ≥ 25% of screen height — 400px at 1080p, not the 240px default in `QRCanvas`. A code
  scanned from three metres has to be physically large; 240 CSS px on a 55" panel is marginal at
  1.5m and hopeless at 3m.
- The LAN address in huge type underneath, because someone's camera won't focus and the fallback
  should not be the host reading numbers out.
- A live *n* of *m* counter, so the room can see who is still not in without asking.

### A.5 One voice, one set of hands — propose this as an invariant

**The table screen owns audio. The phones own haptics.**

`ui/audio.js` has beds, sfx and cues. Six phones each firing the Panic sting is noise, and a phone
in a pocket is a bad speaker; the TV has the only good one in the room. So: audio defaults off on
any client in phone mode, on for the table screen, and the table screen plays the cue for *any*
player's event — a sting, never a sentence, so nothing leaks that redaction was protecting.

Roughly twenty lines. It is the difference between a game with sound and a room with six tinny
speakers in it.

### A.6 Coming back

`resume.js` exists. Test it against the three real failures, in order of how often they happen:
the phone locks; Safari discards the tab; **the host reloads.** The third is the one to get right,
because it is the only one where the person who has to act is not the person who was inconvenienced.

A phone that slept for ten minutes should land back where it was without scanning anything.

### A.7 The phone that dies

Six players, four hours, one dead battery — this will happen every session and there is currently
no answer.

Two options, both of which should say out loud what they cost:

- **A phone holds two characters**, swapped explicitly and visibly, so the table can see it happened.
- **A character is played from the table screen**, with the obvious consequence — its secrets are
  now public — stated on the screen rather than silently absorbed.

Name the trade-off. The one thing not to do is degrade quietly, which is the same failure shape as
the `dark`-whisper leak in 2.7.0.

---

## B. WHAT THE PLAYERS NEED

### B.1 A shorter first ten minutes

Six people building Mothership characters simultaneously on phones is twenty minutes of nobody
playing, and for a party game on a sofa that is where you lose two of them. In order of value:

- **Pregens on the shelf**, claimable with one tap from the table screen. "There are six of them,
  pick one, we start now."
- **"Roll me one"** — one button, everything randomised including the name, editable later during
  downtime. `randomFlavour` and `rollStats` already exist; this is a button, not a feature.
- **Creation that continues after the game starts** — skills chosen at the first moment they
  matter rather than up front. Larger, and it is the actual party-game unlock.

### B.2 Verbs first, sheet second

A first-time player on a sofa will not read a character sheet. Their phone needs, in this order:
what is happening, whose go it is, and three to five verbs sized for a thumb. `TurnActions.jsx`
exists; the question is whether the default screen is a sheet with actions attached or actions with
a sheet attached. For six people who did not read the book, it has to be the second.

### B.3 Something to do when it is not your go

This is where party games are lost — four people looking at a group chat while one person acts.
There is already `shareSecret`, ask-the-room, dispute and votes, and all four are good. Add the
cheapest one:

**React.** One tap, no mechanics, no cost, passes every brake. It appears on the *table screen*,
attributed to the character — a gasp, a look, "I don't like this." It gives four idle players
something that feeds the shared screen instead of their phones, and it makes the TV feel like it is
watching the room. It is small and it will do more for the evening than any rung.

### B.4 Helping, out loud

Crew assistance is already a modifier in the pipeline. Make it a **player-initiated offer** from
the phone — "I'm helping her" — that appears on the table screen *before* the roll. It converts a
solo roll into a two-person moment, which is the thing a party game is made of, and the mechanics
are already written.

### B.5 The thing they take away

The per-player transcript landed in 2.8.0 and is the right idea. Finish it: a single end card —
character, how they died, one line the engine already has. People post those. It is how one evening
turns into a second.

### B.6 A second module, and specifically a short one

The roadmap names a second module as an authoring project, which is right. But for a **party** game
the bigger unlock is a **ninety-minute** module. Ypsilon 14 is a full evening, and a full evening is
a thing people schedule rather than a thing they do. One sitting is what gets it played twice.

---

## C. WHAT THE EMPTY CHAIR NEEDS

### C.1 It cannot hear the room — this is the last big one

Sixteen rungs, and every one of them is triggered by *state*. At a real table most Warden moves are
triggered by **a sentence somebody said out loud**. The director's only route in is `look.js` and
typed intents, which means it never responds to the conversation happening on the sofa. That is the
gap a table will feel as "it isn't really listening," and no number of extra rungs will close it.

Two ways in, both of which stay inside INV-6 because neither composes anything:

- **Widen `look.js`** so anything typed can qualify as a trigger, not only questions.
- **Module-declared `listeners`** — a phrase set mapped to a Move the *author* already wrote.
  Declarative, validated at load like everything else, composes nothing.

The second is the one that will make a director feel like it was paying attention, and it is the
highest-value thing left in the empty chair.

### C.2 Named stages

`flags.directorStage` is one integer per module, so a module with two live threads — the creature
*and* the company — can only advance one of them. `directorStage.<track>`, with `escalate` entries
declaring a track. Small, and it is what non-linear modules need.

### C.3 It cannot end the evening on time

For a sofa on a weeknight, "we have been at this two hours and there is no end in sight" is a real
failure and there is no mechanism for it. A declared session length, and a rung that begins
steering toward a **declared** ending when the clock says so — never an invented one, and it should
say on the screen that it is doing it. The announcement is the honest half: a director quietly
railroading toward an ending is exactly what nobody signed up for.

### C.4 The auto path has no corrective loop

Veto memory is the director's only feedback: three refusals and a rung stops being offered. In
assisted mode a human supplies those refusals. **With the chair empty nobody vetoes anything**, so
the ledger never fills — which means the one configuration with no person checking the ladder is
also the one configuration with no way to correct it.

The wardenless equivalent already exists and shipped in 2.7.0: the **dispute**. Feed disputes into
the veto ledger at a higher threshold. Without this, the empty chair is uncorrectable by design.

### C.5 `HARSH` is four strings

Flagged in `APPLY_2.8.0.md` as the first thing to change if breathers land wrong. Once a table has
actually played four hours on a sofa, that set is the thing to revisit — before any threshold.

---

## D. ENGINE-WIDE

- **Campaign persistence (B.2).** Correctly deferred. Still dead code without the Library and
  shore-leave surfaces to sit behind.
- **Host failover (C.1).** Still needs INV-4 proved *through* the handover. Note that the couch
  configuration makes this *less* urgent, not more: the authority is a PC plugged into a TV and
  into mains power, which is the most reliable host this project has ever had.
- **Pluggable rulesets.** After the second module, not before. `rules.js`, `combat.js` and
  `gear.js` are Mothership-shaped and the second module is what will show you where.
- **Bundle weight.** `art-*.js` at 283 kB matters more on a sofa than it looks on a desk, because
  six phones pull it over one LAN at the same moment on first join. Worth measuring before the next
  time anyone demos this to strangers.

---

## E. Sequence

**2.9 — the couch.** A.1 through A.6, plus B.3 and B.1's first two bullets. None of it touches the
director. All of it is the difference between working and playable.

**2.10 — the room heard.** C.1, C.2, C.4. Plus C.3 if a session has actually overrun by then, and
it will have.

**2.11 — a short module.** Ninety minutes, written against the validator, with `listeners` and
named stages so it is the thing that proves both.

Do A.3 first regardless of everything else here. It is an afternoon and it removes the most common
interruption in the configuration you described.
