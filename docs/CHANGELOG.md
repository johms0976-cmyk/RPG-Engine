# Changelog

## 2.11.0 — the first ten minutes, and the last one

Four things, and two of them are about the parts of an evening that are not the game.

### B.1 — roll me one

Six people building Mothership characters simultaneously on phones is fifteen to twenty-five minutes
in which nobody is playing anything. On a weeknight that is where you lose two of them — and they
are lost **before the game has said a single word**, which makes it the most expensive dead time in
the session.

One button on the first step of the wizard. A whole character, editable later during downtime when
there is time to care.

It returns the draft shape `CreatorPhone` already holds, so a player who takes it and then wants to
change one thing lands in the same screens as everybody else rather than in a parallel "quick
character" path that drifts out of step with the real one. It also does no validation of its own —
the draft goes through the same `blocker` checks, so anything wrong is reported in the same words in
the same place.

**The part that is not obvious** is spending the skill points. Skills have prerequisites and tiered
costs, so a greedy random walk really can strand them: take two cheap skills and the remaining
points may buy nothing the character qualifies for. The wizard blocks on exactly that, so a build
that strands points produces a character it will not let you submit — worse than no button. It
retries from scratch rather than backtracking, which is slightly wasteful and completely obvious,
and it runs once, on a phone, when somebody presses a button. The test asserts it across 200 builds
rather than one lucky one.

Offered on the first step only. Past that the player has started making decisions, and a button that
silently throws them away is a trap rather than a shortcut.

### B.2 — verbs before the parser

What a phone showed a player who had never read the book: a scrolling log, and a text box whose
placeholder was `look · search the crates · go to the workspace · ask sonya about mike · help`.

That is a syntax lesson, delivered at the moment somebody is trying to be a person in a room.

The verbs did exist — in `TurnActions`, in a drawer, behind a tab. So the failure was never "there is
nothing to do", it was "the thing to do is one navigation away and the thing in front of you is a
parser". A first-time player does not open the drawer. They put the phone down.

Five taps, directly above the command bar, chosen from what is in the room. They send the same
string the parser would get from the box, through `doFreeAction` — one code path, so the verbs can
never accept something typing would not.

**They name the thing, not the verb.** "Search the crates" is a sentence somebody can copy next
time; "Search" teaches nothing. And in a fight they step back entirely: offering "search the crates"
while something is eating the crew reads as the game not knowing what is happening, and
`TurnActions` already owns combat properly.

Phone only. On a desk the actions panel is already down the right-hand side.

### B.5 — the end card

The transcript is the right artefact for somebody who wants to reread the evening, and the wrong one
for what people actually do at the end of a session, which is send one message to a group chat.
Nobody pastes four thousand words of markdown. They say "I got eaten in the vents in the first
hour", and that message is the only artefact of the evening that reaches people who were not at it.

Name, class, whether you walked away, and one line — **lifted verbatim from the feed or absent.**
INV-6 applies here as much as it applies to a director move: if a player reads a sentence on a card
and no such sentence was ever said at the table, the card has lied about their evening in the one
artefact they are going to show other people. So it is a search, not a generator.

It sits above the module's own ending text, because what happened to you is the thing you look for
and it was previously several scrolls below what happened to the scenario.

Each phone's feed was already redacted host-side, so six cards from one table are six different and
individually honest accounts, and none can leak somebody else's secret — the text to leak was never
on the device.

### C.5 — which moves make the evening worse

This was four strings in `useDirector`, plus a special case for `describe` from the aftermath rung.
Three things were wrong and only one of them was the strings.

It lived in the **executor**, a file away from the rungs that emit the Moves — so adding a rung did
not require anybody to decide. `listen` and `lastCall` both shipped in 2.10.0 defaulting to "not
harsh" because nobody was asked. That default may even be right. Nobody chose it.

The special case proves the shape was wrong: if harshness were a property of the kind, `describe`
would not need a rung check pinned to it. It is a property of the **Move**, and the four strings were
an approximation that had already sprung one leak.

Worst, a kind nobody listed was **silently** neutral. A missing entry and a deliberate no looked
identical, so the table's rest from being screwed with quietly stopped counting things nobody had
thought about.

Now a table, next to the rungs, exhaustive over every kind `directorPlan` can emit — with a test that
reads the source and fails if a new one is missing. The judgements themselves are unchanged. This is
a change of shape, not of behaviour, and it should be: the right time to retune them is after a table
has played four hours on the couch layout.

### Tests

944 across 38 files, up from 913 across 37. `tests/first-ten.test.jsx` (31).

## 2.10.0 — the dead time, and the room

Five things, and the one that will change an evening most is the smallest.

### B.3 — something to do when it is not your go

This is where a party game is lost: one person acting and four looking at a group chat. Every answer
this engine had — share a secret, ask the room, dispute, vote — is a **move**, and a move costs
thought and arrives with consequences. There was nothing to do that cost nothing, and "nothing to do
that costs nothing" is most of what people at a real table are doing most of the time.

Six reactions, one tap, no confirmation, no undo, no mechanics. They surface on the shared screen
attributed to the character and then they go — never into the feed, because a reaction is the shape
of a room at a moment and a room at a moment is not a record.

**The vocabulary is closed and all of it is physical.** A free-text reaction would be a phone
publishing narration about the room, which is the Warden's job. A fixed set is a different act: the
player is not writing a sentence, they are pointing at one, the same as pointing at a stat. And no
dialogue — "I don't like this" was in the roadmap and is wrong for the same reason free text is
wrong. It puts specific words in a player's mouth and then attributes them on a screen the whole
room is reading. A flinch is a body. A line of dialogue is writing.

Rate-limited in the engine at twelve seconds, not on the phone: a limit a phone applies to itself
stops existing the moment somebody opens the console.

### B.4 — helping, out loud

The mechanic is old. `modifiers.js` has turned an assist into Advantage since the beginning. What
never existed was a way for the **helper** to start it — the assist was something the person
*rolling* picked off a menu of bodies, which is backwards. At a table the sentence is "I'm helping
her", said by the person helping, before the dice come out.

So the offer goes on the shared screen **before the roll**, where the person rolling can see it and
take it. That placement is the whole feature: an assist selected from a menu is a modifier; an offer
the room can see is two people in a scene together, and the mechanics underneath are identical.

Spent for the day means the button is gone, not present and refusing — a player who taps a
live-looking button and gets nothing learns not to trust the screen.

**Neither of these needed a line of router surgery.** Both go down the ordinary `intent` channel,
which already validates against `PLAYER_ACTIONS` on the server and again on the host, and already
attaches the character from the server's own record rather than trusting the phone.

### C.1 — the director hears the room

The last big thing the empty chair could not do.

All sixteen rungs triggered on **state**: a clock, a flag, a pending prompt, a stretch of silence.
Not one triggered on a thing somebody said. That is backwards — at a real table most Warden moves are
answers. Somebody says "I don't trust the engineer" and the Warden, who was planning nothing of the
kind, has the engineer do something. Sixteen rungs of impeccable state machinery still produce a
director that has never once responded to a sentence, and a table feels that immediately as "it
isn't really listening". No number of additional rungs closes it, because the gap was not in the
ladder, it was in what the ladder was allowed to look at.

`director.listeners` is a phrase set and, next to it, a Move the **author wrote**. It composes
nothing — exactly what `escalate` does, with the trigger being a player's mouth instead of a clock.
A listener with neither `effects` nor `label` is rejected at load, because that shape is what a
keyword-to-generated-sentence path would look like if anyone ever tried to build one here.

It hears only `look` and `share` lines — what a player actually typed. Never narration, never NPC
speech, never its own output: a director that could trigger on room description would be responding
to itself, and one that could trigger on its own lines would loop.

### C.3 — the rung that knows what time it is

"We have been at this two hours and there is no end in sight" is a real failure of a weeknight table
and there was no mechanism for it anywhere. Every other rung is trying to make the evening more
interesting; this is the only one whose job is to make it finish.

`sessionEndsAt` is absent by default. No table gets steered who did not ask.

**And it says so** — once, naming the fact that the session has a declared length and it has been
reached. A director quietly railroading toward an ending because a clock said so is precisely what
nobody signed up for; the same behaviour announced is a table being told the time, which is what a
Warden glancing at their watch has always done.

After it, the ladder is **narrower, not shorter**. What drops out is everything whose job is to
*open* something — a new conversation, a revisited clue, a fresh thread from something somebody
said. What stays is everything that closes: the module's own escalations, the declared ending, a
fight already coming. The table gets no new rope. It is neither railroaded nor cut off.

### A.7 — the phone that dies

Six players, four hours, one dead battery. This happens every session and there was no answer: the
character stayed claimed by a socket that was never coming back.

The rule is **unchanged for a live phone**. You still cannot take a character somebody is holding —
that is theft, and a mis-tap in a firefight must never move somebody else's body. What is new is
that a character whose phone has gone is not held by anyone, so it can be picked up. No timer, no
grace period, no "are you sure": the phone is either on the network or it is not.

**And the table is told.** Announced rather than silent, because the person playing Riley not being
the person who was playing Riley an hour ago is a fact about the room, and a table that has to work
that out from a name badge will work it out three scenes late.

What this deliberately does **not** do is split one phone across two characters. That was the other
option in `ROADMAP_2.9.md` and it degrades worse: two sets of private whispers arriving in one hand,
with a swap control between them, is a secret leak waiting for a mis-tap. Handing the body to
another phone keeps every secret exactly where it was — with the character.

### Tests

913 across 37 files, up from 877 across 36. `tests/dead-time.test.jsx` (36). The refusals: no id off
the reaction list, no dialogue in the vocabulary, no reaction after the cooldown or before it, no
listener on narration, no listener answering twice, no listener interrupting a move it just made, no
last call before the time or twice after it, no new threads once it has been said, no offer to help
a corpse or yourself, no live button when the assist is spent.

`tests/table.test.jsx` caught the three new actions having no player-facing labels before a human
did — the second release running in which an existing test found the omission.

### And the flake is fixed

Four consecutive releases recorded `tests/remoteapp.test.jsx` as flaky rather than fixing it. This
one stops.

`flush()` awaits exactly two microtask ticks. It was being used to wait for **WebRTC offer
creation** — real asynchronous work involving ICE gathering, taking a variable number of ticks that
is occasionally more than two. A fixed-tick wait racing a real async operation, losing roughly one
run in six.

Three sites, all replaced with a polling helper that has a deadline. A wait with a deadline cannot
race: it either sees the thing or it fails with the same message it always gave, and a genuine
regression still fails in under a second. Eight consecutive isolated runs and three consecutive
full-suite runs, all green.

The test was never wrong. It was telling us something took longer than we assumed, and we wrote it
down four times instead of listening.

## 2.9.0 — the couch

The headline is not a feature again, but for once it is not a bug either. It is a measurement.

The shared screen caps its pinned situation at 20px. At three metres from a 55" 1080p panel that
subtends about 0.19 degrees, under the ~0.3 degree floor for comfortable sustained reading — and
every other thing on that screen is smaller. The crew bars, the feed, the panel titles, the clock.

Nobody would ever have reported this. They would have said the television "isn't very useful" and
started reading everything off their phones, at which point the shared screen is furniture and the
entire architecture of this project — a host that holds the truth, phones that hold secrets, one
surface everybody can look at — has no surface everybody can look at.

Eight releases have gone into what the shared screen *says*. This is the first one about whether
anybody can read it.

### A distance, chosen once

`desk` is the layout this app has always had. `couch` is `src/screens/TableFar.jsx`, and it is a
second file rather than a scale factor because scaling the dashboard produces a dashboard that does
not fit — two panels, a forty-line log, a map, a handout slot and six crew cards is roughly four
screens of content at couch sizes.

So the far layout carries only what everybody needs at the same moment: **whose go it is**, the room
and the clock, the pinned situation, the crew as one strip of shapes, and the last three lines. Every
size in `tv.css` is a fraction of viewport *height*, because height is what tracks viewing distance
in a living room. Nothing on it is below 2vh — if it cannot be read from the sofa it is not rendered
to the sofa, which is why there are no timestamps.

Everything else — combat, a handout held up, the safety card, an open vote — stops being a permanent
panel competing for space the sofa cannot spare and becomes a **takeover** that owns the screen
while it matters and leaves when it stops.

It is not inferred from the viewport. A 1080p television and a 1080p monitor are the same number of
pixels and about two and a half metres apart, and nothing in the DOM tells them apart. Guessing
would be wrong half the time and silently, so it is asked once and remembered.

**Whose go it is** is now the largest thing on screen after the room name. `tempo.js` has known the
answer since 2.7.0 and it was rendered at 13px. The default state of a wardenless table is five
people politely waiting for one another, and the fix is a screen that says a name from across the
room. A brake beats a turn: while the table is held the true answer is nobody's, and a screen that
names somebody anyway has sent them to act into a pause.

### Nothing sleeps

`src/ui/useWakeLock.js`, and it is the cheapest thing in this release by a distance.

What happened without it: the spotlight fires, a phone in somebody's lap buzzes, and by the time
they have picked it up the screen has locked. Four hours, six players, and the most common
interruption of the evening was a lock screen.

**The reacquire is the load-bearing half.** The browser releases the sentinel whenever the document
stops being visible and does *not* take it back on return, so a hook that only requests on mount
works for about ninety seconds and then silently stops — worse than not having it, because nobody
reports a feature that used to work. A phone going in and out of a pocket is the normal case here.

No fallback for iOS below 16.4. The usual workaround is a muted looping video that holds the screen
awake by keeping the decoder hot, and it costs more battery than the problem it solves on a
four-hour session. Those tables get haptics and a lock screen, and we say so.

### The table screen owns audio, the phones own haptics

Proposed as an invariant. Six phones each firing the Panic stinger is not atmosphere, it is six
tinny speakers a beat apart in a room that also contains a television — which has the only good
speaker present and is the one device nobody is holding.

`playForKind` is the shared channel and is silenced outright in phone role. `playCue` is **not**,
and the distinction is the point of the rule rather than an exception to it: a cue is a sound placed
in one hand deliberately by a Warden, described in `audio.js` as "a sound in this hand and no
other". That is a private channel and it survives.

### The join card

The address, big, over the top of everything, reachable from any phase.

Six phones is six chances for onboarding to fail, and it does not only fail at the start — somebody
arrives late, a battery dies and comes back on a charger, a browser discards a tab in act two. Every
one of those needs the address again and the recovery was the person at the PC reading numbers
across a room.

A QR read from three metres has to be physically large; the 240px default is marginal at 1.5m and
hopeless from a sofa, so it is a fraction of screen height like everything else. The address
underneath is the fallback for a camera that will not focus, and the count exists so nobody has to
ask "is everyone in?", a question that gets a wrong answer roughly every time.

### More than one thing can be tightening at once

`flags.directorStage` was one integer per module, so a module with two live threads — the creature
*and* the company coming to collect — could only climb one. The other's beats sat behind it in the
same list waiting for a condition that had not happened, which is not what an author who wrote two
threads meant, and there was no way for them to find that out.

A beat may declare a `track` and climbs its own ladder in `flags["directorStage:<track>"]`.
Untracked beats share the default one and keep the bare key, so every existing module reads as it
did and every existing save restores where it was. One beat fires per tick however many are due.

### The empty chair can now be corrected

The gap this closes is the one that mattered most and was hardest to see.

Veto memory is the ladder's only feedback: three refusals and a rung stops being offered. In
assisted mode a person supplies those refusals. **With the chair empty nobody waves anything away**,
because there is no strip and no pause — the Moves are taken. So the single configuration with no
human checking the ladder was also the only one in which the ladder could not be corrected, and a
rung that was wrong for a table stayed wrong for four hours.

The wardenless equivalent shipped in 2.7.0 and was wired to nothing but the floor ledger: the
**dispute**. It now feeds the veto ledger, weighted — `DISPUTE_WEIGHT = 2`, because a Warden vetoing
`callRoll` has judged the rung while a player waving off one roll aimed at them has judged a moment
and might have been mid-sentence. A dispute that cannot be matched to a Move aimed at that player
within the spotlight's own lifetime is dropped in silence rather than guessed at.

### Tests

877 across 36 files, up from 841 across 35. `tests/couch.test.jsx` (36). Rather more than half
assert a refusal: no warden-only line on the shared screen, no clear button on the safety takeover,
no name during a hold, no fourth feed line, no beat without a trigger, no second escalation in the
same tick, no stacked wake-lock sentinels.

`tests/offline.test.js` caught the join card's `/net/info` read before a human did, which is that
test earning its keep. It is same-origin and allowlisted with a reason.

### Not in this release

Named plainly rather than half-built. `B.3` a one-tap reaction and `B.4` player-offered assistance
both need protocol, relay and `host.mjs` changes and belong in one drop together. `C.1` director
`listeners` — the last big thing the empty chair cannot do, which is respond to something somebody
said out loud. `C.3` a declared session length. `A.7` the phone that dies, which is a trade-off to
choose rather than a feature to write. See `ROADMAP_2.9.md`.

### Known

`tests/remoteapp.test.jsx` went red once during this session and green on every rerun. Third release
to record it. It should be fixed or deleted rather than recorded a fourth time.

## 2.8.0 — the block that never arrived

The headline is again not a feature, and it is worse than 2.7.0's.

**`defineModule` was dropping the `director` block on the floor.** It assembles an explicit object
rather than spreading `raw`, and `director` was never added to the key list — so `mod.director` was
`undefined` for every module in the repository. The five rungs that open with `if (!d) return null`
— escalate, aftermath, ending, callRoll, pressure — **had never fired at a table in their lives.**
Everything 2.7.0 shipped for the empty chair was unreachable.

2.7.0 fixed exactly this bug one layer up: Ypsilon 14 had no `director` key, so the rungs went
quiet. The module was then written, and the block still never arrived, because nobody checked the
door it had to come through. It survived 771 passing tests because every director test builds its
module object inline and therefore always had one.

`tests/director3.test.js` now walks the real door for both a synthetic module and the shipped one.

### The ladder can let up

Every rung on the ladder made the evening worse: `scripted` escalates, `attack` sets a threat on
somebody, `roll` tests them, `aftermath` narrates the failure, `pressure` moves the creature.
Nothing let up. A monotone ratchet stops being frightening at about minute forty, which is exactly
when a session should be at its worst.

`rungBreather` fires on three harsh moves in eight minutes and sits above `pressure` — a room that
goes quiet shortly after three bad things is a table reeling, not a table bored.

**The asymmetry is the point.** A breather the director called ends by itself, because with the
chair empty nobody is holding the button and a game that can stop but not start is worse than one
that never stops. A breather a *person* called never ends by itself, and must never grow a timer.

### New rungs

- **`attack`** — the director may choose the moment a threat comes through the door, from moments
  a module author allowed. `safeMove` gained a fifth check: the threat must already exist in the
  world (no spawning), must not be declared `unseen`, must be in the crew's room, and must be able
  to say why. Combat itself is unchanged — `runTurnsUntilPlayer` always conducted it fine.
- **`callback`** — the thing from earlier. Reaches for the oldest unresolved, non-secret clue the
  crew pinned at least twelve minutes ago. Their words, not ours; the engine adds a fixed label.
- **`breather`** — above.

### A pending prompt no longer holds the table hostage

`rungPending` returned `wait` while anything was pending, so a player who put their phone down and
went to the kitchen stopped the entire table. Now: wait under 90s, say their name once through the
spotlight, stand down at 210s so the rest of the ladder can run. It never answers the prompt on
their behalf — a director that can roll for you when you are slow has taken your character off you.

### The empty chair no longer degrades silently on other modules

`defineModule` now names every missing director list as a warning and raises problems for the four
mistakes that fail as silence — a beat with no trigger, a roll with no reason, an ending naming an
ending that does not exist, a pressure hook the module never declared.

`engine/autoDirector.js` is the floor. It is deliberately thin, and thin is why it is trustworthy:
it re-files content a module already declared and **composes nothing**, so it cannot generate
`rolls` or `attacks` — both need a sentence, and INV-6 says we do not write sentences. An empty
list now reads as a decision rather than an omission; Ypsilon 14 ships `attacks: []` because its
only threat is `unseen` and `thinkMonster` in `sim.js` is a better monster than a `when` string.

### Dying is an interruption, not the end of your evening

`DeathTakeover` was a dismissible card: it told a player beautifully that they were dead and then
handed them a phone with nothing on it, while `Contractors` and `hirelings.js` sat on the Warden's
screen where no player could reach them. With a Warden that was recoverable by somebody leaning
over. With the chair empty there was nobody to lean over.

The card now offers a way back in, and the offer stays on screen for as long as it is true. The
route is almost nothing new — a phone submitting a character mid-session was already accepted,
already added to the crew where the crew is, already sent `assigned`. All that was missing was a
door. Modules may declare `replacement.arrival`; Ypsilon 14's does not name anybody, because who
it turns out to be is the best part and it belongs to the table.

### Smaller

- Assisted mode is a remembered checkbox in `HostBar`, default on, ignored with the chair empty.
  Flagged in the 2.6.0 and 2.7.0 manifests; now a decision rather than a default.
- The feed shows which rung wrote a line, beside the clock stamp, when stamps are on. After a
  session that felt wrong the feed is the only record of what actually ran.
- The ending offers a **copy** on a phone rather than a download. Each player's copy is their own
  evening — the snapshot was redacted host-side, so six people take away six individually honest
  accounts and none contains anybody else's secrets.
- The "You're out" panel no longer says the Warden can bring in someone new. It is a door now.
- `Play.bat` opens `?mode=host`. It was opening the player join page, so the PC running the table
  got a **player** screen and there was no route to NOBODY IS THE WARDEN at all.

### Not in this release

`B.2` campaign persistence, `C.1` host-device failover, `C.2` a second module, and `C.3` bundle
weight. See `ROADMAP_2.8.md`. Failover in particular needs `INV-4` proved through the handover
before any of it is worth writing.

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
