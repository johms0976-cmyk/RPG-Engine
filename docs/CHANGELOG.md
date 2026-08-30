# Changelog

## 2.20.0 — on paper, read back, and a seam under the rules

The last three items on the backlog. Two are finished. The third is half finished and the changelog
says which half, because a version number is not a place to round up.

### 21 — Paper mode

**The whole module, laid out to be printed, from a button on its library card.** The pitch on the
front of this project is "no network, no API key, no tokens"; the furthest honest end of that
sentence is *no computer*, and until now the software did not go there. A table whose laptop died,
a table in a room with no power, a Warden who simply prefers a folder — none of them could get
anything out of this engine except by running `npm run dossier` in a terminal, which is the
toolchain the last two releases were spent removing.

`engine/paper.js` builds the pack; `screens/Paper.jsx` lays it out; `ui/paper.css` is where the
actual work is, under `@media print`. Rooms with their exits and features, the cast with every line
they can say, threats with their attacks, handouts one to a page because a prop gets cut out, the
endings, the flags, and as many blank character sheets as the module suggests.

**It reproduces, it does not summarise.** Every string on the page is one the module's author wrote,
copied verbatim. Nothing paraphrases a room or writes a bridging sentence — same line `misses.js`
draws, same reason. What it adds is mechanical labelling: "gives: fuse", "FEAR save", "locked:
bridge_open". That is the author's own declaration read back, not new writing.

**A world is optional.** Pass none and you get the module as written, which is what prepping on a
train wants. Pass one and what the table has already used is struck through rather than removed,
which is what reprinting in week three wants.

**It is black on white, in points and millimetres.** Every other surface here is bone on void
because a horror game wants a dark screen; printing that costs a cartridge and produces a page that
is harder to read under a table lamp. The screen is the preview, so the preview is inverted too.

**A real bug fell out of this.** `declaredFlags` in `dossier.js` walked every effect in a module and
never once looked at a gate. A locked door's flag *is* the state of that door and it is the
commonest flag in every module in this repository — so the Warden's dossier has been listing each
module's secrets minus its locks since the dossier shipped. `setsFlag` and `onFirstEnter` were
missing for the same reason. Fixed.

### 22 — Table analytics

**Which rooms nobody reaches, which locks cost an evening, which endings nobody has ever seen.**
Cheaper than its score, exactly as the 2.19.0 manifest predicted, because almost all the reading was
already being done and nothing joined it up: `coverage.js` knows what the module declares,
`misses.js` knows what players said it had no answer for, `dossier.js` knows which flags fired, and
`campaign.js` knows which endings a table reached. `engine/analytics.js` is the join.

One field had to start being kept. Rolls now log `tags` and `why` — both were already on the request
and already printed in the feed line, and neither was ever stored anywhere a report could reach. Without
them the roll log records "Strength (Athletics)", which cannot tell two doors apart.

**Sessions are reduced to a digest at the ending screen** and stored on the campaign record, because
answering a question across six evenings cannot mean keeping six worlds. The digest is counts and
ids only — no prose, no player names, no typed sentences. The miss backlog stays in the session it
came from, because it is verbatim things humans said and a campaign file gets pasted into chat
windows.

**It reports and does not grade.** No score, no health, no traffic lights, no sentence containing
the word "should" — there is a test asserting that last one literally. A module where nobody found
the third ending is not a worse module; it may be a module with an ending that costs something to
reach, which is the point of having one.

**One measure is deliberately absent and the report says so.** "Which rooms stall" wants time in
room, and nothing in this engine records it — the feed stamps every line with the clock but not
with the room. Deriving it would mean attributing feed lines to rooms by inference, which is wrong
exactly when the party is split, which is when a Warden most wants the answer. What ships instead is
which rooms were never reached, and which were walked into and walked straight out of. Instrumenting
it properly is a small change to `doMove`; it is not in this release because a measurement added
late and never checked against a real table is how a report starts lying.

**It lives in Warden tools, not on the ending screen.** The ending screen belongs to the table. It is
read once, together, ninety seconds after somebody died, and "nobody has ever found the vent" is
addressed to the author rather than to the six people who just finished.

### 23 — Pluggable rulesets, half of it

**The seam ships. A second ruleset does not, and this is not done.**

`engine/rules.js` no longer holds a system; it reads one. Mothership 1e moved to
`engine/rulesets/mothership.js` — every number unchanged — and arrives through `activeRuleset()`.
The exports are identical, so none of the thirty-one files that import `CLASSES`, `STAT_KEYS` or
`PANIC_TABLE` needed touching and none was touched. What changed is that they are reads rather than
literals, which is what makes them swappable: change the stat list in a ruleset and the character
sheet, the roll prompt, the Warden deck and the printed blank sheet all follow.

`defineRuleset` validates like `defineModule` — problems on the object, not exceptions — and every
default is the *empty* one rather than Mothership's, so a ruleset that declares no classes gets none
rather than four smuggled in behind it. `docs/RULESETS.md` is the format.

**Two latent bugs surfaced while doing it.** `baseValue` compared the save name against the literal
string `"armor"`, so any system naming its protection differently would have silently returned the
unmodified save with no worn armour in it. And `Creator.jsx`'s "roll me a crew" button held a
hardcoded four-class array, so a fifth class — from a house ruleset or anything else — would have
been registered, rendered in the picker, and never once handed to anybody.

**Why no second ruleset.** A plugin interface with one implementation is a rename, and inventing a
second role-playing game is not this project's job. `tests/ruleset.test.js` defines a deliberately
different one — three stats, three saves, no classes, no panic table, a differently-named armour
save, a different health formula — and asserts the engine carries it. That is the honest proof, and
it is a test rather than a product because a test is what it is.

**What is left, in the order I would do it.** Character creation is still a Mothership *flow* —
the data is generic, the sequence of roll-class-points is not, and a ruleset would need to declare
its creation steps. Panic is wired into `useGame` by name. Modules declare `loadouts` in
Mothership's shape, so every module is bound to a ruleset without saying so, and `defineModule`
needs a `ruleset` field before a `.mship` file can be stopped from loading into a system it was
never written for.

## 2.19.0 — a way to write one, and a deck you can hold

The two oldest items on the backlog. #15 has been "next" in the README since portable modules
shipped; #20 has been open since the deck was written.

**You can write a module in the browser now.** `portableModule.js` made a scenario a file — JSON,
loaded at runtime, distributable by email, no build step. What it never did was give anybody a way
to *write* one. The honest state of authoring until this release is that you either edit JavaScript
in `src/modules/` and run a build, or you hand-write several hundred lines of JSON against a
nine-hundred-line format document. Both of those are a toolchain, and the toolchain is a rounding
error of the people who write Mothership scenarios.

`screens/Editor.jsx` is rooms, exits, endings and the library card. `engine/moduleDraft.js` is the
model underneath it, and the important decision is that **there is no editor format**. The
tempting design is a richer document — stable ids, ordering, undo history, back-references —
serialised down to a portable module on export. That shape would immediately become the real
format, the portable one would become its output, and the two would drift, because an exporter is
the last thing anybody updates. So a draft *is* a portable module, edited in place, and every
operation returns another one.

**The validation panel is the actual feature.** Not the forms; anyone could write the forms.
`defineModule` has resolved every cross-reference in a module since 2.0 — hooks, tables, tracks,
meters, handouts, item ids, room ids, threat ids, endings, dice expressions — and an author only
ever saw that output on a library card, after a save, after a reload, in a different part of the
app. It now runs on every keystroke, through the same call the shelf makes, rendered in the three
registers the engine actually distinguishes: **problems** (this will not load), **warnings** (this
loads and then silently does nothing), and the **coverage report** (this is the shape of your
module, and none of it is wrong). That third one renders last, in grey, under a heading that says
so — `coverage.js` argues at length that a room with no features is a corridor, corridors are good,
and software that nags about them is telling an author their module is broken when it is merely
quiet.

**Renaming a room follows every reference.** It is the one operation with teeth and the only one
worth writing even if the screen were thrown away. A room id is referenced from `start`, from every
exit leading to it, from any `moveTo` anywhere in the effect tree, from `npc.loc` and `threat.loc`
inside effects, from an NPC or threat's starting position, from `retreatTo`, from `restSpots` and
from the map's layout. An editor that renames the key and leaves the other eight breaks a module
the first time somebody tidies up a name — in a place they were not looking, discovered three rooms
into a session. That is precisely how an author learns not to trust an editor.

**What it deliberately does not do.** No forms for effects, gates, devices, tables or countdowns.
Those are the parts of the DSL where the shape genuinely matters, and a form that half-covers them
produces modules whose authors cannot tell what they have written. They stay typed, in a per-room
JSON panel, checked by the same compile as everything else — worse than a form, much better than a
text editor with no validation, which is the honest alternative it replaces. And nothing is
generated: there is no prose in an exported module that an author did not type. Same line the
Warden deck draws, drawn in the same place.

**The roadmap's "fork Ypsilon 14" promise turns out not to be true, and now says so.** Both shipped
modules carry `hooks` — Ypsilon has thirty-one — and a portable module cannot carry JavaScript.
Neither can be opened in the editor. `toPortable` already reported this through `lost` and nobody
was reading it; the editor now says it at the door, with the real reason, rather than letting
somebody go looking for a button that would have failed. The Edit button on the shelf appears for
loaded modules only, for the same reason.

**The Warden's deck fits in one hand.** `screens/WardenPhone.jsx`, and it is a second file rather
than a media query for exactly the reason `TableFar.jsx` gives about the sofa: reflowing a bar, a
drawer, seven tabs and ninety controls into 380 pixels produces nine screens of scroll, and a
control you have to scroll to is a control you do not reach for mid-sentence — which is the only
moment a Warden ever reaches for one.

The case it is actually for is not "run a session from a phone", although you can. It is the laptop
plugged into the television. The host tab is the authority *and* the shared screen, `HostBar`
toggles that one screen between the deck and the table view, and the consequence is that a Warden
who opens the drawer opens it in front of everybody. Every lever on the phone deck is one they
would otherwise have pulled while six people watched. The second case is smaller and commoner than
it sounds: a Warden who wants to stand up.

**It is the same authority, by construction.** This renders inside the host tab, off the same `g`,
calling the same `warden.*` functions. No new socket, no privileged client, no second copy of the
game — INV-1 is untouched because there was never an opportunity to touch it.

**Something has to choose what four things fit.** `engine/wardenNow.js` is that choice, in its own
file so it can be argued with and tested rather than buried in JSX. It reports and does not advise:
every entry answers "who is waiting, and how long have they been waiting", none answers "what
should you do about it", and none of them should ever start to. A Warden's phone that says "ask
Riley something" is an assistant director, and this project has one of those already — it lives in
`director.js`, it runs only when the chair is empty, and it is vetoable.

The ordering is roughly how many people are stuck behind each thing, which is why a forgotten hold
outranks whose go it is and an idle player is near the bottom. **The safety card returns alone
rather than first.** A pause somebody asked for, rendered as the top entry in a list of table
management, reads as one more thing to get through, and the whole value of the card is that
everything stops.

**Which deck you get is inferred, and this file argues with `App.jsx` on purpose.** The desk/couch
switch refuses to read the viewport, on the grounds that a 1080p television and a 1080p monitor are
the same pixels and two and a half metres apart. That reasoning is right and does not apply here: a
phone is distinguishable, `(max-width: 620px) and (pointer: coarse)` has no false positive with
consequences, and being wrong is visible in half a second and reversible in one tap. Each surface
carries the door to the other, because `wphone` is `position: fixed; inset: 0` and covers the bar
the swap would otherwise have lived on.

## 2.18.0 — what the table invented, kept; and what the module never answered

Continuity across sessions, and the one correction physical dice needed.

**A table's own facts now outlive the evening.** `ruling.js` makes an improvised fact durable
within a session and `tableRuling.js` (2.17) lets a wardenless table make them. But the world is
discarded when the session ends and the campaign ledger never saw one, so a table's inventions had
a lifetime of a single evening — exactly one evening shorter than the thing they are for. What a
returning group actually remembers is not who survived; it is that *the airlock on Ypsilon still
does not seal*.

`engine/continuity.js` harvests the keepable rulings at session end and `campaign.js` keeps them.
Keepable excludes two kinds: retired ones, which the table explicitly took back, and private ones,
which were the Warden telling one player something the others must not hear — and a campaign record
the whole table reads is the last place for that.

**Carrying them forward is offered and never automatic.** `campaign.js` states its own rule and
this gets no exemption: a campaign records what happened, it does not participate. At the top of a
session the table sees what they invented and ticks what still stands. Nothing is pre-ticked, and
that is the argument rather than an oversight — pre-ticking produces forty auto-applied facts and a
group who tap continue without reading, which is clutter with a ceremony attached rather than
continuity. Six deliberate facts beat forty automatic ones, "start fresh" is one tap, and skipping
the screen carries nothing. The safe direction is forgetting.

Room and thing facts come back only in the module they were invented in, because a fact about a
room that does not exist here cannot be about anything. World facts travel everywhere.

**Export your table's version of a module.** A group that has played Ypsilon three times has, by
the third, a version that is theirs. `toFragment` writes it out as module source — a `listeners`
array, deliberately, rather than patched rooms: patching a room's `look` means rewriting authored
prose, which is somebody else's work and not ours to edit. A listener adds a voice and leaves the
module exactly as its author wrote it. The output is read and edited by a person before use and is
deliberately not auto-loadable, because half of what gets typed at a table at eleven at night is a
joke and a fragment that installed itself would drag all of it into the next campaign unread.

**The misread.** Physical dice make one error the app cannot see: a d100 read tens-then-ones,
transposed. Somebody reads 47 off dice showing 74 and nothing knows, because nobody is checking
these by design. With a Warden this is solved by leaning over; wardenless there is nobody to lean,
and the only remedy was the `rewind` vote — stop the session, poll five people, roll the clock back.
A sledgehammer for a typo, and heavy enough that most players shrug and take the wrong result, which
is the habit that makes a table stop trusting the app. `DeclareDice` now offers a one-tap swap, and
only when the transposition would change the outcome: 31 and 13 both succeed against 55, and
offering to correct something that cannot be wrong is noise that teaches people to ignore the
control. Pre-confirmation only — once declared the roll has resolved and its effects have landed,
and unwinding that is what `rewind` is genuinely for.

**Nearly the sixth unreachable feature.** An early draft of the carry-forward wiring called
`g.commitW`, which is not on the game object; it would have thrown on the first session that
carried a fact, and no unit test would have seen it. Facts now apply through `warden.rule` — the
same door table rulings use, so one place appends a ruling rather than two that drift.
`tests/continuity-wired.test.jsx` asserts that by name, along with every other hop.

`DeclareDice` also gains its first component test. `engine/declared.js` was well covered; the
component that uses it was not.

**The listener backlog nobody has to write.** Every sentence that falls through to the oracle is a
sentence the module had no answer for. That record was already being kept and nobody was reading it.
`engine/misses.js` tallies them, grouped by what they were about, commonest first — a listener
backlog generated from real play. An author guesses badly at what players will try, because they
already know what is in the module and cannot un-know it; the playtesters are the ones who know.

It stays a report. It sits on a list of things players wanted to do, and turning those into listener
text automatically would be one small function away — and would be the engine writing the module's
content, which is the line this project is built not to cross. It says "four people tried something
with the vents and the module said nothing" and stops.

The first draft walked backwards through the feed looking for the player's echoed sentence. That
does not work: a typed sentence is never echoed. It resolves, and the feed records only the result.
The sentence now rides on the oracle marker line's `extra.miss`, written at the moment of the miss.

**While you were away.** Somebody goes to the kitchen, comes back, and asks the table what they
missed — which costs everybody the thing the person who left already lost. `buildRecap` has taken a
`sinceId` since 2.11 and has only ever been called with the Warden's mark, for the whole table at
once. `net/useAwayMark.js` gives a player their own.

It is not a button, because asking somebody to press "I am leaving" before they go to the kitchen is
asking them to plan an interruption and nobody does. The browser already knows: a phone that locks
or a tab that backgrounds fires `visibilitychange`, and all of those mean the same thing. Two
thresholds keep it quiet — under 45 seconds is a glance at a notification, and under four lines
means nothing happened while they were out. Both fail toward silence, because an offer that never
appears costs nothing and one that appears when the table was idle costs the trust that makes
somebody tap it the time it matters. The card is built from the client's own already-redacted feed,
so a catch-up can never show somebody something they were never told.

1445 tests, 60 files. Lint clean.

## 2.17.0 — the front door, the table's own facts, and a lint that found a real one

Closes the S and A tiers of the 2.16.0 review, plus three B-tier items. The largest change is
that a table with nobody behind the screen can now make a fact true.

**`main` could not deploy.** `src/ui/RollPrompt.jsx` called `useState` and imported it nowhere.
The call is unconditional, so the component threw on every render — and it is the surface a phone
shows every time anybody is asked to roll anything. A table would have got through character
creation, walked into the first room, hit the first save, and watched six phones hit the error
boundary at once. `npm run build` passed throughout: Vite does not resolve free identifiers, so a
component referencing an undefined binding compiles and ships. The only thing standing between
this and the published site was the test step in `pages.yml`, which did its job.

**Two guards, because one was not enough.** The obvious test — render every component bare and
catch the throw — was written first, ran green, and *did not catch the bug it was written for*:
`RollPrompt` destructures `g` on the line above the hook, so rendering it with no props throws a
TypeError from line 76 and line 85 is never evaluated. Rendering tests the wrong line. So
`tests/smoke.test.jsx` also greps every source file for hook calls whose names are absent from the
React import, which cannot pass by luck, and `npm run lint` runs `no-undef` in CI. The rendering
half stays, because it catches module-level throws, and the file says plainly which half catches
what.

**The lint found a second one on its first run.** `ShipSheet` called `useState` *after* an early
return on `!ship`. React tracks hooks by call order, so nothing was wrong while the answer stayed
the same — and the render where it changes is the render that throws. That render is "the crew
acquired a ship", which is the moment a campaign gets interesting and the worst available moment
to lose the screen. No fixture ever crossed it. The rule set is deliberately narrow: the errors
that can reach a table, and nothing about style. Two false positives (`useItem` and `useCounter`
are game verbs, not hooks) are listed by file with the reason beside them rather than scattered as
disable comments.

**THE TABLE CAN MAKE A FACT TRUE.** `ruling.js` shipped in 2.14 and closes the gap `director.js`
admits to in its own header — an improvised fact becomes durable, parseable, save-surviving and
visible to `answerLook`, so the room stops contradicting the table ten minutes later. Its only
entry point was `screens/warden/RulingBox.jsx`, on the Warden deck, which INV-9 forbids a
wardenless table from reaching. So the single mechanism that lets the fiction update in response to
an unanticipated idea was unavailable to the configuration whose defining weakness is that the
fiction does not update in response to an unanticipated idea. INVARIANTS.md predicted this in
writing — *"this has been the root cause of two shipped-but-unreachable features; check it before
adding a third"* — and this was the third.

`engine/tableRuling.js` is the route in. A player proposes a fact in their own words; one *other*
player agrees; it commits through `warden.rule` — the same say-then-store path RulingBox has always
used, so the append rule stays in one place. The second voice takes the same window and the same
quorum as `objection.js`, because two parallel mechanisms for "the table said yes" is the same
mistake as two for "the table said no". INV-1 and INV-6 are untouched: nothing composes a sentence,
and the only thing decided is *when* a human's sentence becomes true.

A proposer cannot second themselves, and that single line is the whole mechanism — without it one
player makes anything true by tapping twice. Proposals cannot be private: `told` is not a parameter
and does not survive being passed, because a fact two players agreed to and four do not know about
is not a secret, it is a faction, and it would be a secret the shared screen was keeping on behalf
of some of the people reading it.

The open proposal travels in the snapshot, and that nearly did not happen. It was held in a ref,
which the broadcast effect does not depend on — so the mechanism that needs two voices would have
been visible to exactly one of them. `tests/tableruling-wired.test.jsx` asserts that hop by name,
along with the relay cases, the host handlers and the button, because the sender is the hop this
repository has now forgotten four times.

**A third door.** Remote play shipped in 2.13, worked, and stayed invisible: the only way in was to
know `?mode=host` existed, add it by hand, and find a checkbox in the lobby. It is the
configuration most groups need — most tables that play at all play online — and it is the one this
engine can run with nothing running anywhere, on the published static build. `?mode=host&remote=1`
is now a button on the title screen, and it lands in the lobby rather than asking the question
twice.

**Twenty listeners nobody has to write.** `rungListen` is the only rung that reacts to what a
player *said*, and it fired from module-authored `listeners`: fifteen in Ypsilon 14, fourteen in
Another Bug Hunt, eight in Dead Weight. A live Warden makes north of two hundred reactive
judgements in the same three hours. But most of those listeners were never module-specific — every
table in every horror game says *we should split up*, *what's in the vents*, *is anyone hurt*. Those
move to `engine/listenerPack.js` and every module gets them, including ones nobody has written yet.
The editorial rule is stated once in the file and holds throughout: **a generic listener may
observe; it may never assert a fact about the room, the ship, the threat or the module.** Module
entries always win, and an author can silence a generic one by claiming its id.

The merge shipped broken once during development, and the reason is recorded in the file: treating
"no `effects`" as a silencer deleted every label-only listener, a form `rungListen` has always
supported. A silencer is an entry with no voice at all, not one with a different kind of voice.

**A Warden's reference for every module.** `npm run dossier` generates the half of a dossier that
is derivable — the map with every gate and what it takes, the clock in time order, every threat's
stats and the ways out that are not shooting it, every line each NPC is allowed to say. It
deliberately does not attempt the editorial half, which is what makes Ypsilon's hand-written
dossier good and what no generator can produce. The README linked to
`docs/ANOTHERBUGHUNT_WARDEN_DOSSIER.md` for two releases and the file was never there; there is now
a generated reference for all four modules, and a test that fails on a dead link in any markdown
file.

**Coverage notes, which are not warnings.** `defineModule` already reports `problems` (this cannot
work) and `warnings` (this will silently do nothing). Neither answers *is this finished*.
`engine/coverage.js` counts what is and is not there — rooms no exit reaches, rooms offering
nothing but their description, NPCs who run dry in three questions, endings nothing routes to — and
draws no conclusion, because a room with no features is a corridor and corridors are good. Its
first useful output found an unreachable room in Another Bug Hunt and six NPCs with three lines or
fewer. The first version of the endings check reported eight of Ypsilon's nine as unrouted, because
it stripped functions before searching and almost every ending here is reached by `endGame` inside
a hook; a report that flags correct work on its first run teaches the reader to skip the section.

**Housekeeping, with a test this time.** The 2.15.0 changelog records removing fifteen tracked
one-byte files named `test`, two applied `.patch` files and a duplicated `ROADMAP_2.9.md`. All of
them were back, and a second, *diverged* copy of `anotherbughunt.test.jsx` had joined them in the
root where vitest's glob does not reach — a test file that looked like coverage and ran never.
Cleaning it by hand twice and recording it twice is the definition of a thing that needs a test.
`tests/smoke.test.jsx` is that test.

**Also fixed.** `docs/MODULE_FORMAT.md` described `persona` and `note` as "fed to the LLM" — in the
document a module author reads first, in a repository whose first invariant is enforced as a build
failure. Replaced, along with a section stating what `knows` actually is: not a hint or a seed, but
the complete set of sentences a person can ever say, to be written as finished dialogue rather than
as facts to paraphrase. `docs/REMOTE_PLAY.md` said the Warden-facing screen was not built; it had
been for two releases.

1388 tests, 55 files. Lint clean.

## 2.16.0 — Another Bug Hunt

A second full module, and the one Ypsilon 14 was always pointing at. Ypsilon's crew are nine days
out from Samsa IV with orders to look at a colony that stopped answering; this is what is waiting
there.

**Four scenarios, 48 rooms, 17 named survivors, 9 threats.** Greta Base teaches the module's
central fact the expensive way — rifles do not work, fire does not work, hydrofluoric acid does,
and a marine died in a walk-in freezer making sure somebody would find the flask. Heron Station is
eleven frightened people split into three factions with three incompatible plans, none of which is
the right one. The mothership is three genuinely different routes into an alien ship. The fourth is
getting off the planet while the map is taken away an hour at a time.

**The storm is the module.** A 600-minute countdown started at minute zero, executing the
published hour-by-hour timeline: vehicles die at hour three, the dam closes, Greta Base floods at
five, the hangar at six, and the evacuation degrades from landed to hovering to impossible and back
again when the storm finally breaks at hour ten. `onTick` accumulates rather than assuming a fixed
step, so the pacing rung's fifteen-minute skips still fire every beat on the way through.

**The Signal is the biggest lever in the module and it is reachable in the first twenty minutes of
scenario two.** A carc surgically grafted into the tower transmitter is why no radio works on
Samsa VI and why using one is how you catch this. Cut it out and every carcinid on the planet stops
receiving orders in the same second, mills, and walks home. Nothing else about the situation
improves, which is the point.

**Three director ladders instead of one.** Weather, siege and people tighten independently, because
collapsing them into a single list would mean the storm waits behind the carcs until a player
happens to trigger a beat — which is not what writing three threads meant, and there is no way for
the author to find out it happened.

**The Shriek is a paranoia engine rather than a timer.** Five stages as published, and every stage
that can be seen from outside carries a `sayOthers`. Stage 1 is fine incisions the victim has not
looked at yet. Stage 2 is somebody going absent mid-sentence for a few minutes. By stage 3 the
table is having an argument about one of their own, and a bioscanner has started returning an
answer it did not return before.

**Also fixed:** `src/modules/ypsilon14/audio.js` imported its cassettes from `./assets/cassettes/`
while the directory on disk is `./assets/casettes/`. The typo failed the Vite import analysis, which
took down 11 tests across `boot`, `shelf` and `remoteapp` and broke `npm run build` outright. One
character, five releases, and it was never the module you would have suspected.

## 2.15.0 — the empty chair gets a clock, a save, and a front door

Closes the eight findings of the engine review. Three of them were the same shape: machinery this
repository had already built, left one wire short of connected.

**The empty chair can now spend time.** `w.clock` only ever moved inside a player action, so a
table that spent fifteen real minutes arguing in a corridor cost the fiction nothing — no `onTick`,
no countdown movement, nothing in the vents going anywhere. The one thing that moved time otherwise
was `warden.passTime`, which lives on a deck the wardenless mode deliberately cannot reach. So the
mode whose whole antagonist is a clock had no hand on it. `rungPacing` already measured the drift
and responded by reading the nearest countdown out loud; it now turns the clock instead. Bounded at
10–20 minutes a skip, never in combat, never while somebody has a prompt open, never twice inside
six minutes, and `safeMove` enforces the bound a second time because a rung is one refactor away
from forgetting its own. Routed through `passTime` specifically rather than `advance`, so the
module's own `onTick` still runs across the interval and every scheduled beat fires on the way
through.

**And ask somebody to roll.** A Warden's most frequent move by a wide margin is "roll Strength",
and the empty chair structurally could not make it: called rolls fire only from a module-authored
`rolls` list, `safeMove` rightly refuses a roll with no stated reason, and `autoDirector` rightly
refuses to write sentences. So "I force the hatch with the crowbar" fell through to a yes/no, the
world answered, and the character's Strength never participated. The way out does not touch INV-1,
because the reason does not have to be composed — the player already wrote it. A parse miss on a
risk verb now tests the character and quotes their own sentence back at them, and the result shifts
the oracle's odds rather than replacing it. Questions are excluded: "can I force the hatch" is
asking, "I force the hatch" is doing, and testing somebody for asking a question is the most
annoying thing a referee does.

**A front door that does not need a terminal.** `wardenless` required `HOSTING`, which means
`npm run host`. Three things followed and all three were bad: the published build could never
demonstrate the mode, because `main.jsx` probes `/net/info` and a static host 404s it, landing
every visitor in `solo`; a laptop on a table with five friends round it could build a crew and then
had no Warden at all; and so the thing this project is proudest of was reachable only by the people
least likely to need convincing. `?mode=wardenless` is that setup — one device, pass-and-play, the
ladder running locally, no socket. The lock it does *not* relax is the deck: `Play` takes a
`wardenless` prop and stops treating whoever holds the authoritative game as the Warden, because on
a shared screen an accidental Warden is worse, not better.

**Somebody reads it out.** `ui/useVoice.js`, the browser's own synthesiser, on the device, calling
nothing. The prose here is written to be heard — the atmosphere pools are paced for a speaking
voice — and with the chair empty nobody was reading it. Strips bracketed dice working before
speaking, and only ever reads forward, so a reconnect does not recite forty lines of backlog at a
table that already played them. Off by default except on a local wardenless table.

**The dice come off the seeded stream.** `check()` and `evalDice()` had accepted an `rng` since the
beginning and no caller ever passed one, so the atmosphere replayed identically from a save and the
dice did not. That made the `rewind` vote structurally dishonest and meant a bug report with a save
attached could not be replayed. Threaded through every roll in combat, initiative, escape, flight
and the module `pick` branch.

**Threats behave like creatures.** Target selection was one line — always the most wounded — which
is simultaneously the most lethal policy available and the least characterful. `tactics` picks
between `weakest` (the default, so nothing existing changes), `nearest`, `isolated`, `loudest` and
`random`, and `morale` lets a thing break off. Broken, not gone: it gives ground and stops swinging
rather than vanishing, because a wounded thing retreating into the dark is the interesting outcome.
A misspelled tactic is a validator *problem* rather than a silent fallback, since a silent fallback
looks like a design disagreement instead of a typo.

**Type scales.** 259 `font-size` declarations were px, so nothing in the interface responded to the
browser or OS text setting — the whole thing was pinned at whatever looked right on the machine it
was written on. Now rem at a 16px base, which renders identically and grows when somebody's browser
is set large, plus a `--type-scale` the table controls. First `prefers-contrast` and
`forced-colors` handling in the project: the art direction is deliberately low-contrast and there
was no way out of it.

**Housekeeping.** Fifteen tracked one-byte files named `test`, two applied patch files, a
byte-identical duplicate of `ROADMAP_2.9.md` in the root — the exact mistake the root changelog
stub exists to warn about — and `assets/casettes/` misspelled. The README claimed Ypsilon 14 was a
hundred and twenty rooms; it is twelve.

1070 tests, 44 files.

## 2.14.0 — the correction, the record, and a module you can finish

Closes the remaining findings of the party review. 2.13.0 took the first three; this takes the
rest, including the two the review scoped as real work and the one it did not find.

**The correction loop now reaches the whole ladder.** A dispute could only ever be attributed to a
Move addressed to a named character, which excludes `describe`, `atmosphere`, `npcSay`, `clock` and
`callback` — most of what a wardenless table hears. `engine/objection.js` adds the other half: a
"Not that" on the table bar, aimed at the last thing said to the room rather than at a person. It
takes a second, different player within forty-five seconds to carry, because a line said to
everybody can only be judged by everybody and one player is not the room. A carried objection is
worth one veto, so three retire a rung against a lone player's six.

**And the half that was already there had no button.** `C_DISPUTE` shipped in 2.7.0 with a relay
case, a host handler and a ledger waiting for it, and no screen in the application ever sent one.
The correction the wardenless design leans on hardest was, for three versions, a message nobody
could send. It now hangs off the spotlight card. This is the fourth feature in this repository to
pass its unit tests while being unreachable at a table; `tests/correction-wired.test.jsx` reads the
source for a sender, in the same crude spirit as `tests/offline.test.js` grepping for `fetch`.

**DEAD WEIGHT.** A second playable module, and the constraint came first: ninety minutes, nine
rooms, one threat, one countdown, three endings. A four-hour module is a thing a group SCHEDULES
and ninety minutes is a thing they DO, and the difference decides whether the engine gets played
twice. Two hulls ninety metres apart down an umbilical that costs eight minutes each way — built
to exercise the split-party director 2.13.0 shipped, rather than to tolerate it. It also fills in
the `attacks` array Ypsilon 14 deliberately leaves empty, so both halves of the unseen-threat rule
are now demonstrated in shipped content rather than only in tests.

**Campaigns.** `engine/campaign.js`, named in the lobby, written at the ending, and deliberately
inert: no rung consults it, no module can gate on it, and a session inside a campaign plays
identically to one outside. Three stores with three lifetimes and no overlap — `storage.js` holds
one session mid-flight, this holds the record between them, `locker.js` holds a character forever
on the player's own phone. Defaults to "just this session"; nothing is created until somebody types
a name.

**An NPC volunteers what is on their mind.** `rungNpc` used `findIndex` — correct, safe, and not
how a person talks. `pickKnown` weights the untold lines against the room, the flags and the clue
board. Ties break to the lowest index, so a module with no matching signal recites in exactly the
authored order it always did; INV-6 is untouched, because selecting an authored line is not
composing one.

**The validator no longer takes the application down with it.** An author writing `give: "torch"`
instead of `give: ["torch"]` threw a TypeError from inside `defineModule`, at import time. Turning
a bad module into a readable complaint is that function's entire job.

**`docs/INVARIANTS.md`.** INV-4, INV-6 and INV-7 were invoked by name in nine source files, four
test files and a dozen changelog entries, and the list they belonged to was never in the
repository. It is now, numbered to match every existing reference.

**Root tidy.** Ten apply/manifest documents, two loose `.patch` files and fourteen stray one-byte
files named `test` removed. `ROADMAP_2.9.md` moved to `docs/`. The root `CHANGELOG.md` no longer
duplicates a file that lives in `docs/`.

1049 tests across 43 files (was 1002 across 41). Build clean.

## 2.13.0 — the room, the clock, and the floor

Five things. Three of them are features that already existed, passed their tests, and had never
once run at a table.

That is the theme of this release and it is worth stating plainly, because it is a failure mode
this repo is unusually prone to: the discipline here is that the pure half is tested exhaustively,
and the pure half being green is precisely what stopped anyone noticing that nothing was calling
it. A rung with four passing assertions and no caller looks exactly like a working feature.

### The director could not see a split party

`party.js` exists because one `w.room` field is correct for one player and quietly wrong for six.
Its own header says so, and says that Ypsilon 14's best material — Giovanni on the Heracles, the
vents, somebody going back for the cat, the person who stayed in the washroom — is all people being
alone.

`director.js` was written before that file and never revisited. It did not import it. Every
room-aware rung read `w.room`, which is the *majority* room, and every line went out through
`warden.say`, which addresses the whole table. So with three in the ducting and three in the mess:
the mess was narrated to all six, the three in the ducting could not be attacked, could not be
tested, could not be spoken to by an NPC standing next to them, and got no answer when a roll went
wrong. `safeMove` passed all of it, because the room *had* been visited — by somebody else.

`focusRoom` rotates attention across occupied rooms, least-recently-served first. Deliberately not
random, for the same reason the ladder is not random: a referee nobody can learn to read is a
referee nobody can play against, and that applies to *where* it looks as much as to what it says.
Ties go to the majority room, so walking out of the room is not a way to seize the floor.

Delivery goes through `api.sayIn`, which has been the module layer's verb for this since per-PC
rooms landed and which the director simply never used. **The unsplit case is byte-identical** —
`audienceFor` returns null while everybody is together — and no existing test needed changing,
which was the signal being watched for.

### The session clock had never been connected to anything

`rungLastCall` shipped in 2.10.0 with a plan parameter, a hook parameter and four unit assertions.
`sessionEndsAt` appeared five times in `src/` and **all five were consumers.** Nothing set it,
nothing carried it, and `App.jsx` constructed `useDirector` without it — so the rung returned null
on every tick of every session anybody has ever played, for two releases, with green tests.

The table now agrees a length in the lobby (no limit / 2 / 3 / 4 hours), stamped to wall-clock at
the moment play begins rather than when the lobby opened, because half an hour of character
creation is not half an hour of the session. Absent by default and that stays the point: a table
that has not asked to be steered is never steered.

The new test that would have caught it reads `App.jsx` and asserts the argument is passed. Crude,
in the manner of `tests/offline.test.js` grepping for `fetch` — and guarding a defect every
sophisticated test in the repo was structurally blind to.

### The floor could not be switched on where it was needed

`floor.js` is off by default, on the argument that four friends who have played together for a
decade will resent it. That argument is right and is not overturned here. What it assumed was a
person sitting there who would notice two players had gone quiet and flip the switch — and the
switch was in `TempoTab`, inside `WardenDeck`, which wardenless mode locks away by design.

So the one configuration with nobody watching the airtime was the one configuration that could not
ask for the airtime to be watched.

It is now a vote topic, reachable from the phones, both ways round. A vote rather than a button
because rule 6 says everything stays inert until somebody asks for it, and a table asking itself is
the most literal available reading of that — it also preserves the thing that makes the floor
tolerable, which is that it arrives because the room agreed rather than because software decided
the room had a problem. Additionally armed once, automatically, for wardenless tables of five or
more, with a latch so a table that votes it off stays off. At four, airtime broadly self-corrects.
At six it does not.

### Ypsilon 14 is listening

`rungListen` was 2.10.0's answer to "it cannot hear the room — this is the last big one". It
shipped working. No module declared a single listener, so in the only playable module the director
still never once answered a sentence anybody said. Mechanism finished, content missing, which is
the worst way for a feature to be absent because it looks present.

Twelve listeners, module-authored, composing nothing. They are held to a harder standard than the
escalation ladder: a listener fires on the exact subject somebody just raised, so a table that
guesses correctly must not be rewarded with a confirmation. The vents listener answers about wing
bolts and cold air. The water listener answers about metering and the pump. Both are true, both are
useless, and a test asserts that no listener's spoken text contains the module's own answer.

### Smaller

- **`LADDER` had drifted from the code it documents.** It was a hand-written array of 16 names; the
  loop walked 17 functions; `lastCall` and `listen` ran and were on neither list. The file header
  still described nine rungs. Nothing caught it because the only assertions on `LADDER` were
  against `LADDER`. There is now one declaration, `RUNGS`, and `LADDER` is derived from it.
- **An undeclared `crewSize` capped the table at four.** Any module that did not state an opinion
  turned players five and six away with "the table is full", on a default nobody chose, in an
  engine whose stated configuration is four to six. Now six. An author who wants four says so.
- **`package.json` said 2.11.1 while 2.12.0's code was in the tree** and `docs/CHANGELOG.md` had no
  2.12.0 entry. See below.

### Tests

1002 across 41 files, up from 968 across 39. `tests/party-attention.test.js` (25) and
`tests/attention-wired.test.jsx` (9). The second file exists because the first could not have
caught either of the two disconnected-wire defects: a hook test cannot see an argument its own
caller forgot.

### Known

The dispute ledger still only reaches Moves addressed to a named character, so `describe`,
`atmosphere`, `npcSay`, `clock` and `callback` — the majority of what a wardenless table hears —
remain structurally undisputable. Flagged as C.4 in `ROADMAP_2.9.md`, half-fixed in 2.7.0, still
half-fixed. It wants a table-level "not that" at a higher threshold than a personal dispute.

`ROADMAP_2.8.md`, `WARDENLESS.md` and `EMPTY_CHAIR_NEXT.md` are still cited as normative and still
absent, and `INV-4` and `INV-6` are still invoked in comments across the codebase with no document
anywhere defining them. Recorded for the third time. It wants one `docs/INVARIANTS.md`.

## 2.12.0 — the remote invite is a QR code

Recorded late: this shipped as `UPDATE_2.12.0.md` and never reached this file, while
`package.json` stayed at 2.11.1. The offer code went from 708 characters to 110 by packing the
five parts of an SDP that actually vary and rebuilding the boilerplate, which is what makes a join
QR survive being looked at through a video call. `compact()` refuses rather than guesses, and both
formats decode in both directions. See `UPDATE_2.12.0.md` for the full account.

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
