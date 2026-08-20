# The player's phone, played through

**Brief:** if the Warden's screen were invisible and a phone were the only way a player could see anything, what would an experienced Mothership player want on it — and what would a new one need?

I played the thing through in that posture, twice: once as somebody who has run Mothership a dozen times and knows what a Fear Save costs, once as somebody who has never rolled percentile dice. The two passes disagree far less than expected. Almost every gap hurts both players, for different reasons.

---

## The governing observation

The client is already unusually good at the *emotional* half of this problem. The Panic takeover, the hold-to-roll, the tap acknowledgement, the dread filter, the connection strip that distinguishes a blip from an outage — these are better than anything else I have used, and they are better because somebody clearly sat at a table and noticed what was going wrong.

The gap is not atmosphere. **It is the character sheet.**

Mothership is a game about making decisions with a known number under unknown pressure. The number is on the sheet. On the phone, the numbers that decide things were either computed host-side and revealed after the fact, or present in the snapshot and never drawn, or written into a `title` attribute that no touchscreen can display. In every case the player was being asked to play the game without the piece of paper.

Three patterns account for nearly all of it:

1. **The information was computed, applied, and then shown as history.** The roll target is the flagship case. The player pressed a button labelled with a stat name and learned what they had been rolling against once it no longer mattered.
2. **The information was in the snapshot and rendered nowhere.** `combat.order`, `crew[].items`, `w.clues` — all shipped to every phone since the protocol was written, all drawn only on the Warden's screen or not at all.
3. **The information was written into a tooltip.** `title=` renders on hover. Phones do not hover. On a touch device that attribute is `display: none` with extra steps, and it was carrying item descriptions, the Panic rule, and the room conditions.

---

## The ranked list

Scores are out of 100 and are **value to the table per unit of work**, judged specifically against the invisible-Warden brief. A high score is not "big feature" — it is "the absence of this is actively making the game worse right now".

Items 1–6 are **built and shipped in this patch**. Everything from 7 down is assessed, not implemented.

| # | Enhancement | Score | Status |
|---:|---|---:|:--|
| 1 | The roll target and its modifier breakdown, **before** the roll | **98** | ✅ built |
| 2 | Conditions with their actual rules text | **94** | ✅ built |
| 3 | Kill `title=`: tap-to-reveal explanations | **88** | ✅ built |
| 4 | Party kit — who is carrying the one of the thing | **86** | ✅ built |
| 5 | Visible initiative order, and how many act before you | **82** | ✅ built |
| 6 | Your own roll history, kept on your own phone | **80** | ✅ built |
| 7 | The Panic Effect table, readable in advance | **78** | ✅ built (rides on #2) |
| 8 | What you can actually do about Stress | **76** | ✅ built (rides on #2) |
| 9 | Weapon and gear reference outside combat | 74 | assessed |
| 10 | Enemy range bands and what is actually reachable | 72 | assessed |
| 11 | Wound and injury state as a persistent fact | 70 | assessed |
| 12 | The objective, live, not just the opening blurb | 66 | assessed |
| 13 | Out-of-combat action reference for new players | 62 | assessed |
| 14 | Player-written map marks | 58 | assessed |
| 15 | Automatic recap on reconnect | 54 | assessed |
| 16 | A "what happened while I was gone" for a split party | 52 | assessed |
| 17 | Credits, contract terms and next-of-kin | 44 | assessed |
| 18 | Per-phone accessibility: text size, one-handed reach | 42 | assessed |
| 19 | Character sheet export as a printable card | 36 | assessed |
| 20 | Ambient audio per player rather than per room | 28 | assessed |

---

## 1 · The roll target and its breakdown — 98

**The single worst thing on the phone, and it is not close.**

The old prompt said this and only this:

> A roll is called for
> *It is looking at you.*
> `[press and hold — Roll Fear]`

A player at a table, asked for a Fear Save, looks at their sheet. The number is the first thing they see, and it is the basis of every decision that follows: spend the assist or save it, swallow a stim first or not, argue that this should not be a roll at all. **The number is not flavour. It is the game.**

On the phone that number was computed host-side, applied host-side, and shown afterwards in a feed line as part of a result that had already happened. That is strictly worse than paper, and worse in the way that hurts an experienced player most: it removes the decision and leaves the ceremony.

What is now on the prompt:

- **The target, large**, with the words *roll under* next to it, every single time. Four characters that permanently answer the most-asked question at a first Mothership table.
- **The full modifier breakdown** — `55 your sheet · +15 Hacking · +10 Lockpick Set · [−] Vaccsuit`. `collectModifiers` already assembled this and already handed it to the feed *after the fact*. The same list before the roll is a different feature: it is the player learning that taking the suit off is a decision they are allowed to make. Modifiers arriving from *other people* matter even more — a Marine standing near you is +5 Fear, an Android standing near you is Disadvantage on it, and neither will ever appear on your own sheet.
- **Two odds.** Success, because Advantage moves it by more than anyone's intuition says (35% becomes 58%, and nobody computes `1−(1−p)²` at a table). And **critical failure**, flagged loudly on Saves, because a Critical Failure on a Save is a Panic Check and Panic is what actually kills Mothership characters. On a target of 20 there are eight critical failures on the dice; on a target of 80 there is one. That is the difference between a routine roll and a dangerous one and it was invisible.
- **The assist, next to the number it changes**, with the comparison spelled out. It used to be a dropdown above a button with no stated effect.

The same treatment went on the opt-in Stress prompt, which was asking a real question — "take 2 Stress?" — without the figure that decides it. Stress 7 → 9 is a Panic chance of 21% → 36%.

**Why this is safe.** The preview is computed on the phone from `collectModifiers`, `baseValue` and `clampTarget`, all of which are pure and all of which the client already has. It is never authoritative: the host recomputes from unredacted state when the roll runs. If the phone was redacted out of a modifier it should not know about, the host's number wins and the player learns something. A preview that is occasionally an underestimate is fine; a preview that replaced the host's arithmetic would be a security hole. The panel says so, once, in small text.

**What is deliberately absent:** advice. It never says "you should take the assist" and never colours the number red at 30%. Telling a player the odds is giving them the sheet. Telling them what to do about the odds is playing their character for them, and this game is about people making bad decisions under pressure on purpose.

---

## 2 · Conditions with their rules text — 94

`pc.conditions` was rendered as an array of grey tags: `Cowardice`, `Rattled — Disadvantage`, `Descent into Madness`.

Every one of those is a Panic Effect. Panic Effects are the most consequential thing that happens to a Mothership character — they are the reason the game is about Stress and not about Health — and they were arriving as **a single word with no rule attached**, on the only screen the player has.

At a table this is fine: the effect was read aloud off page 27 thirty seconds earlier, and the player wrote it in the margin. With the Warden's screen invisible, nobody read it aloud, there is no margin, and *Cowardice* is a word.

Now each condition is a tap-to-open row with what it actually does. The text is pulled **from `PANIC_TABLE` rather than retyped**, so there is exactly one authority for what Cowardice does; a second copy would be wrong within a year. Engine conditions with no table row — `Held`, `Comatose`, `Injured`, `Dazed`, `Withdrawal risk` — are written out once with the rule they actually implement. Module conditions like Ypsilon 14's `INFECTED — yellow goo` get the honest answer: this came from the situation rather than the rulebook, the Warden knows what it does, asking is allowed.

**The nicest detail:** `secrets.js` already hides Hallucinating, Paranoid, DeathDrive and Broken from the person who has them. So those four only ever render when you are reading *somebody else's* sheet — and they are therefore written in the third person, ending "*They have not been told this.*" Watching a crewmate be Paranoid without them knowing it is the entire point of the mechanic, and now the phone supports it rather than merely not breaking it.

Conditions also now appear as short tags on the permanent status strip, so there is a reminder that there is something to read.

---

## 3 · Killing `title=` — 88

A quiet, systematic information loss caused by one HTML attribute.

`title="..."` renders as a hover tooltip. Phones and tablets do not hover. On the device this client was built for, the attribute is functionally invisible. It was carrying:

- **the entire description of every item you are holding** (`<Btn title={it.d}>`)
- the Panic odds sentence, which is the only thing telling a new player *which way is bad*
- why a room is marked `LOUD` or `WET` — one is the room advertising you to something that hunts by sound, the other is your best defence against it
- the rule that makes the scene-cost figure legible instead of frightening (a player who reads "25m" as "I have cost the table 25 minutes" hangs back for no reason; the round costs whatever the slowest of them spends, so their 25 may well be free)

Every one of those was written by somebody who thought hard about what a player needs, and none of them could be read.

The fix is a disclosure, not a tooltip library. Hover-emulating tooltips on touch are their own disaster — they fire on scroll, clip at the viewport edge, and close when you try to read them. So: a real button with a real hit target (18px visible, 36px tappable), opening the text in place, staying open until closed. `title` is kept alongside, so a Warden with a mouse still gets the fast path.

---

## 4 · Party kit — 86

Mothership parties do not have inventories. They have a flashlight, two stimpaks and one cutting torch spread across four people who cannot see each other's sheets.

At a table this is solved by shouting. On phones it was solved by nothing: the Crew panel showed Health and Stress, `crew[].items` travelled in every snapshot and was read by nobody, and "does anyone have a pry bar" had no answer short of four people opening four inventories.

Now: a **Between us** panel, grouped **by item rather than by person**. The question is almost never "what is Riley carrying" — it is "who has the torch", and a list keyed by person makes you scan every entry to answer it. Each row opens to the item's description and how many of them exist between you.

Once the party splits it also shows *where* the holder is standing, because a stimpak two decks away is not a stimpak you have.

Nothing new is exposed: `redactPc` already ships other people's item lists, because carried gear is visible in the fiction.

---

## 5 · Visible initiative order — 82

`combat.order` and `combat.turnIndex` are in every snapshot. The phone drew one derived fact from them: the name of whoever is up. That answers "is it me" and nothing else.

The question an experienced player is actually asking in a Mothership fight is **"does the thing act before I do"**, because that decides whether you shoot or run. In this system it is not a guess — initiative was rolled, the order is fixed for the round, the information exists — and it was never drawn.

Now the whole order is visible, with your slot marked, the current slot marked, spent slots dimmed, and a count of **how many act before you**. Fled actors are struck through.

Unseen threats keep their redaction: `secrets.js` has already stripped the name and hit tally, so the thing nobody can see sits in the order *as* the thing nobody can see. You know something is going to move, and not what. That is the correct amount of information and it comes free.

---

## 6 · Your own roll history — 80

`lastRoll` is a single slot on the host, so the phone's dice theatre shows whatever rolled most recently *anywhere at the table*. In practice: you finish your own reveal, look up to say something, look back, and the panel is showing somebody else's Body Save. Your own margin — the number the Warden is about to narrate from — is gone.

The world does carry a `rollLog`, and `secrets.js` strips it from player snapshots, correctly: it contains every roll made at the table including ones no player should see.

So the history is kept **locally instead**. This phone watches its own character's rolls go past and remembers the last twelve. No protocol change, nothing new is sent, and by construction it can only contain rolls this phone was already shown. It clears when the tab closes, which is the right lifetime for it.

*(Implementation note worth recording: the first version kept the log in a `useRef`. A ref mutated inside an effect does not schedule a render, so the panel sat empty on a quiet phone and filled in correctly on the Warden's busy screen — a bug that would have shipped, because only a full render test catches it. It is `useState` now, and that test is in the suite.)*

---

## 7 · The Panic Effect table, readable in advance — 78

*Shipped as part of #2.*

Mothership's Panic Effect table is the mechanism that gives Stress its meaning, and the only way a player could see any of it was to land on a row.

That is a strange thing to hide. It is printed in the players' book. Every experienced player at the table already knows the shape of it — and the dread comes precisely *from* knowing Heart Attack is on there, not from being surprised by it. **Withheld information that only the new players lack is not tension. It is an unequal table.**

It is now on the Notes tab, read straight off `PANIC_TABLE` so it cannot drift, folded shut because nineteen rows is not something anyone wants open.

## 8 · What you can do about Stress — 76

*Shipped as part of #2.*

The Panic percentage on the status strip is the best single thing on the phone, and it created a problem it did not solve: a player watching a number climb with no idea what the moves against it are.

There are four. Three are easy to forget. One — **that passing a Panic Check sheds a point of Stress** — is the most commonly missed rule in the game, and it is the only relief available mid-scene. It means a Panic Check is not purely a thing to be dreaded, which changes how a player plays the whole back half of a session.

A folded panel appears on the Sheet tab once Stress reaches 5. It also names who on the crew has Psychology or Theology — or says plainly that nobody does, which is worth knowing at Stress 5 rather than at Stress 14.

---

## Assessed, not built

### 9 · Gear reference outside combat — 74
Damage dice, range bands and special properties are reachable only as `hint` strings on combat buttons. A player deciding whether to take the shotgun into a corridor cannot see what the shotgun does until they are already in the fight. #3 partly fixes this (descriptions now open), but the *stat block* still isn't drawn.

### 10 · Enemy range bands — 72
The target group shows `12m`. It does not show that 12m is Long for your pistol and Adjacent for its claws. `rangeBand()` computes exactly this and it is applied silently.

### 11 · Wound state as a persistent fact — 70
Damage arrives as a feed line and an outcome card, both of which scroll away. Below a third Health, Body Saves start mattering enormously and nothing says so. `duressOf` covers the acute end; the chronic end is unmarked.

### 12 · The live objective — 66
"The job" panel is the module's static blurb. Two hours in, the question is "what are we still trying to do", and only the clue board partially answers it. A short Warden-editable objective line in the snapshot would carry it.

### 13 · Out-of-combat action reference — 62
`TurnActions` is excellent and renders in combat only. A new player out of combat has a wall of context-specific buttons and no statement of what the verbs *are*.

### 14 · Player map marks — 58
`w.marks` renders read-only. Letting a player pin "door jammed, don't come this way" is a small change with real table value, and the write path (`clues`) already exists and is already a player right.

### 15 · Recap on reconnect — 54
`RecapCard` is Warden-pushed. A phone that has been asleep for ten minutes rejoins into a scrolling log with no summary.

### 16 · What happened elsewhere — 52
Split-party addressing works correctly and is the right design. When the party rejoins there is no mechanism for the two halves to exchange what they saw except talking, which is arguably correct — but a "they will have to tell you" prompt would make the silence intentional rather than accidental.

### 17 · Contract terms — 44
Credits are on the sheet. Shares, hazard pay and next-of-kin are real Mothership fiction with real mechanical weight and appear nowhere.

### 18 · Per-phone accessibility — 42
The dim control and haptics toggle are good. Text size is not adjustable, and the tab bar is at the bottom while the status strip is at the top — a phone is used one-handed at a table.

### 19 · Printable sheet — 36
Transcript export exists. A per-character card does not.

### 20 · Per-player ambience — 28
Audio follows the room, which is right. Per-player audio would mostly be a novelty, and the whisper-sound channel already covers the case that matters.

---

## Summary of the shipped patch

| | |
|---|---|
| New files | 6 (2 engine, 3 UI, 1 CSS) + 1 test file |
| Replaced files | 3 |
| Protocol changes | **none** |
| Host changes | **none** |
| New trust boundaries | **none** |
| Tests | 433 pass (28 new, including a full phone render) |
| Build | clean |

Everything added is computed from state the phone already held. That is not a coincidence — it is the finding. The client's problem was never that it lacked information. It was that the information was on the Warden's screen, in a tooltip, or in a variable nobody drew.
