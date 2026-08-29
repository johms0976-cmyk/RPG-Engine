# THE HAUNTING OF YPSILON 14 — WARDEN'S REFERENCE

> **Generated from the module. Do not edit by hand — run `npm run dossier`.**
>
> This is the *reference* half of a dossier: the things you look up mid-session
> with a player waiting. It is deliberately not the editorial half — what the
> module is about, where the squeeze is, what to never let happen — because that
> is written by somebody who has run it and cannot be derived from data.

*MOTHERSHIP · SCI-FI HORROR RPG · ONE SHOT · TUTORIAL*

Module by D. G. Chapman, Tuesday Knight Games. Rules: Mothership 1e.

A four-hour cargo stop on a mining base with ten crew, one cat, and one worker nobody can account for.

**Before you start.** Body horror, disappearance, isolation, and the deaths of people you have spoken to. One scene involves a corpse behaving as though it is not one; another involves a living person coming apart in front of you.

## At a glance

| | |
|---|---|
| **Rooms** | 11 |
| **Threats** | 2 |
| **NPCs** | 11 |
| **Endings** | 9 |
| **Starts in** | DOCKING BAY 2 |
| **Length** | One session · 3–4 hours |

## The clock

| When | What | | |
|---|---|---|---|
| 4h00 | shiftbell | then every 480 |  |
| +15 | infection stage 1 | INFECTED — yellow goo |  |
| +60 | infection stage 2 | INFECTED — yellow goo |  |
| +120+2d10*60 | infection stage 3 | INFECTED — yellow goo | then every 10 |

_Times are fiction minutes from session start. `onTick` accumulates, so a
pacing skip still fires every beat it passes through._

## Rooms and exits

| Room | Leads to | Mins | Locked behind |
|---|---|---|---|
| **DOCKING BAY 2** `db2` | WORKSPACE `work` | 5 |  |
|  | **ENDING: followed** | 5 |  |
| **WORKSPACE** `work` | DOCKING BAY 2 `db2` | 5 |  |
|  | QUARTERS `quarters` | 5 |  |
|  | MINE ENTRANCE `entrance` | 10 | needs `tag:vacc` |
|  | DOCKING BAY 1 — THE HERACLES `db1` | 5 | route: `flag:knows_code`; route: `tag:cuts`; roll intellect (Computers/Hacking) |
|  | THE VENTS `vents` | 5 |  |
| **QUARTERS** `quarters` | WORKSPACE `work` | 5 |  |
|  | MESS `mess` | 5 |  |
|  | WASHROOMS `wash` | 5 |  |
|  | THE VENTS `vents` | 5 |  |
| **MESS** `mess` | QUARTERS `quarters` | 5 |  |
|  | THE VENTS `vents` | 5 |  |
| **WASHROOMS** `wash` | QUARTERS `quarters` | 5 |  |
|  | THE VENTS `vents` | 5 |  |
| **MINE ENTRANCE** `entrance` | WORKSPACE `work` | 10 |  |
|  | MINE TUNNEL `tunnel` | 10 |  |
|  | MINE ANTECHAMBER `ante` | 10 | hidden until `ante_found` |
| **MINE TUNNEL** `tunnel` | MINE ENTRANCE `entrance` | 10 |  |
|  | MINE DEPTHS `depths` | 10 |  |
|  | MINE ANTECHAMBER `ante` | 10 | hidden until `ante_found` |
| **MINE DEPTHS** `depths` | MINE TUNNEL `tunnel` | 10 |  |
| **MINE ANTECHAMBER** `ante` | MINE TUNNEL `tunnel` | 10 |  |
|  | MINE ENTRANCE `entrance` | 10 |  |
| **DOCKING BAY 1 — THE HERACLES** `db1` | WORKSPACE `work` | 5 |  |
| **THE VENTS** `vents` | WORKSPACE `work` | 10 |  |
|  | QUARTERS `quarters` | 10 |  |
|  | MESS `mess` | 10 |  |
|  | WASHROOMS `wash` | 10 |  |

## Threats

### IT `it`

| Combat | Speed | Instinct | Hits | Max damage | Starts | Tactics | Morale |
|---|---|---|---|---|---|---|---|
| 70 | 50 | 35 | 3 | 40 | vents | weakest | — |

**Unseen.** Defends with Advantage unless somebody carries `ir`.
**Breaks off** the moment it takes a hit.
**Hears noise.** Draw chance 0.7.
- **Claws** 2d10 · crit 4d10
- **Devour** 4d10 · crit 

**Ways out other than shooting it:**
- Throw water at it — needs `tag:water`
- Make a deliberate racket — needs ``
- Burn it — needs `tag:burns`

### DR GIOVANNI `giovanni`

| Combat | Speed | Instinct | Hits | Max damage | Tactics | Morale |
|---|---|---|---|---|---|---|
| 55 | 30 | 35 | 2 | 999 | weakest | — |

- **Scalpel** 1d10


## People

_`knows` is everything they can say. Selection is allowed; invention is not._

### MIKE VOSS — Mining Engineer `mike`
*nowhere* · starts absent, cannot vanish · **0 lines**

Disappeared the night before last. No blood, no body, no airlock log.

### DR ETHAN GIOVANNI — Geologist, Company `giovanni`
*db1* · cannot vanish · **6 lines**

Arrived five weeks ago on Company business above the miners' pay grade. Has not left his ship since he came up out of the mine yesterday.

> This is not a person any more. Something is wearing him. Pleasant, delayed, and never quite an answer.
- He is enormously pleased to see you. He says so twice.
- He says the work is going well. He says it is incredible. He uses the word incredible more than once.
- He does not want to talk about water. When it comes up he stops smiling for slightly too long.
- He agrees that the missing worker is a tragedy. He agrees with everything you say about it.
- He wears infrared goggles on a cord around his neck and does not explain why.
- He would like to show you something in the lab. He would like that very much.

### SONYA — Team Leader `sonya`
*work* · **10 lines**

Runs Ypsilon 14. Wants your transfer done on schedule. Reported the yellow residue two months ago and got a research vessel instead of an answer.
- Mike Voss disappeared the night before last. No blood, no body, no airlock log. Just gone.
- Your pallets are staged in Bay 2. Six of them. She would like them gone and you gone by the end of the shift.
- She reported traces of a strange yellow substance in the deep workings about two months ago. Nothing came of the report except Giovanni.
- Mike had been odd since they found it. Quiet, and then quiet in a different way.
- Mike tore a shower out of the washroom wall two nights before he vanished and told her it was an accident. She believed him at the time.
- Dr Giovanni arrived five weeks ago from the Company, on business above her pay grade, and has been making trips into the mine with scanners.
- She hasn't seen Giovanni leave the Heracles since he came up yesterday. He was talking about samples and a discovery.
- Her keycard authorises the airlocks, the pump controls and — plugged into the workspace terminal — the base self-destruct.
- The Company has had this site under review for a year. She thinks she is about to lose ten people their jobs.
- There is no other ship. The next cargo run is in a fortnight. Yours is what there is.

### ROSA — Mining Engineer `rosa`
*work* · **6 lines**

Fit, laconic, domineering. Doing two jobs since Mike vanished and furious about it.
- Mike was the other mining engineer. Now she does both jobs and nobody has mentioned money.
- She thinks the Company sent Giovanni to shut the site down and she wants that in writing.
- She has been keeping her own notes on everything for a year, dated, in a book, for a tribunal.
- The garden rota has Mike's name last on it. Nobody has taken over. The plants are dying.
- The drill cycles have not been adjusted since before Mike went missing, which is sloppy and unlike him.
- She will believe anything you can prove and nothing you can't.

### DANA — Head Driller `dana`
*work* · **6 lines**

Stoic, professional, sullen. Answers questions with facts, not opinions.
- The drills have been running the same cycles since before Mike vanished.
- Kantaro has been off. Not sick. Off. She uses that word and does not elaborate.
- She hasn't been below the tunnel in three weeks.
- She heard something down there. It wasn't the pumps. She ran, and she is not proud of it.
- She is seeing Kantaro. She will not volunteer this and will be short with you if you raise it.
- Mike was the only one who ever went down to the depths alone by choice.

### KANTARO — Loader `kantaro`
*quarters* · **6 lines**

Muscular, quiet, hasn't bathed in a few days. Sits a long way from the water fountain.
- He hasn't showered in days. He'll say the water's been out. It hasn't.
- He feels great, actually. Better than he has in years. Ask anyone.
- That cut on his forearm from last month has gone. Completely gone. He'll show you if you push.
- He doesn't want you in his bunk and he won't say why.
- He was down in the depths on the same shift Mike was, nine days ago.
- He is not thirsty. He has not been thirsty for a week and it has stopped occurring to him that this is strange.

### JEROME — Assistant Driller `jerome`
*quarters* · **5 lines**

Tall, playful, on edge. The jokes have been getting faster and worse for three weeks.
- He's been sleeping badly. Something moves in the ceiling above his bunk at night.
- He thinks Mike ran off and got himself killed doing something stupid, and he says so too loudly.
- It's in the ceiling tiles, whatever it is. Rats, probably. There are no rats out here.
- He'd very much like an excuse to be armed, and he is not subtle about hinting at it.
- The night Mike vanished, the ceiling noise went on for about an hour and then stopped for two days.

### ASHRAF — Breaker `ashraf`
*mess* · **5 lines**

Short, accommodating, naive. Four months aboard and the newest here.
- He'll go anywhere you ask him to go. Anywhere. This is a problem and he does not think it is one.
- He thought Mike had been quiet lately, but Mike was always quiet.
- He heard the shower break. He thought someone had fallen and went to help. Mike shouted at him through the door.
- Kantaro smells, and Ashraf feels terrible for noticing, and has told three people.
- Rie keeps things in the ceiling. He probably shouldn't have said that.

### MORGAN — Loader `morgan`
*mess* · **5 lines**

Laid back, friendly, nervous. Brought the cat aboard against regulations and will defend that decision to anyone.
- He brought Prince aboard against regulations three years ago. Prince hates baths.
- Prince has been staring at empty corners for weeks and refusing to go into the workspace at all.
- He has snacks and a Stimpak hidden in his bunk and would rather you didn't mention it.
- The cat used to sleep in the vents. The cat does not go in the vents any more.
- He is not leaving this base without that cat, and he would like that understood now rather than later.

### RIE — Putter `rie`
*wash* · **6 lines**

Small, sarcastic, impish. Deflects with a joke and then tells you something genuinely useful.
- The vents move at night. She's decided it's the pumps. It is not the pumps and she knows it.
- She'll share the narcotics if you're interested. There's more behind the ceiling tiles.
- She saw Giovanni come up out of the mine yesterday carrying nothing — and he went down carrying a case.
- She was somewhere she shouldn't have been when she saw that, which is why she hasn't mentioned it.
- There's a cassette she threw into the ducting a while back. She'd rather not say why.
- She knows the crawlspaces better than anyone here, including where they go that the plans don't show.

### PRINCE — The base's cat `prince`
*mess* · silent, cannot vanish · **0 lines**

Brought aboard against regulations by Morgan. Hates baths. Watches things that are not there.


## How it can end

| | Good | |
|---|---|---|
| **IT IS DEAD** `win` | yes | You undock with a dead thing cooling on the deck behind you and a list of names to explain. The Company will want the specimen. You have opinions about that, and nine days to Sams… |
| **YOU GOT OFF THE ROCK** `escape` | yes | You clear the collar with minutes to spare. Behind you the asteroid opens like a struck match, and every reason anyone had to come back here goes with it — the pod, the goo, the t… |
| **YOU LEFT IT SEALED** `quarantine` | yes | Airlocks locked, base dark, a warning on every Company channel and a rock that answers nothing. It is still down there, in the quiet it always wanted. Somebody will come and open … |
| **IT CAME WITH YOU** `followed` | no | You seal up, undock, and put the rock behind you. Two hours into the burn your dust log records a mass it cannot account for, moving quietly between compartments, towards the cryo… |
| **YOU WERE NOT THE ONE WHO CAME BACK** `melted` | no | The goo finishes what it started somewhere over the ninth day. What arrives at Samsa IV is wearing your face and does not answer questions about water. |
| **YOU DIED** `dead` | no | You bleed out on the deck plate of a rock nobody will visit for a fortnight. |
| **YOU DID NOT WAKE UP** `coma` | no | You do not wake up. Not here, not on this rock, not in time. |
| **YOU ARE NOT COMING BACK** `insane` | no | Whatever is left of you will not be making any more decisions. The Warden has your sheet now. |
| **YOU WERE STILL INSIDE** `boom` | no | The sequence completes while you are still inside it. Ypsilon 14 becomes a very brief light, and then nothing at all. |

## What the table can say and be heard

12 written for this module, 20 from the common pack.

**This module's own:**

- `splitting_up` — "split up", "splitting up", "go alone", "on my own", "cover more ground", "separately"
- `the_vents` — "the vent", "vents", "ducting", "air duct", "crawlspace"
- `the_water` — "the water", "standing water", "the shower", "showers", "flood", "hose"
- `asking_after_mike` — "mike", "voss", "the missing", "who's missing", "whos missing"
- `the_cat` — "the cat", "prince", "kitty"
- `weapons` — "a weapon", "weapons", "gun", "rifle", "shoot it", "kill it", "armed"
- `calling_for_help` — "call for help", "radio", "distress", "mayday", "contact the company", "send a message"
- `just_leave` — "just leave", "get off this rock", "back to the ship", "leave them", "cut our losses"
- `not_trusting_them` — "don't trust", "dont trust", "lying to us", "hiding something", "one of them"
- `sealing_up` — "seal the", "lock the airlock", "quarantine", "shut it in", "trap it"
- `hiding` — "we hide", "hide in", "barricade", "lock ourselves", "stay put", "wait it out"
- `the_goo` — "the goo", "yellow stuff", "the slime", "residue"

_Anything else falls through to the oracle, which answers yes/no and does not
update the fiction. With nobody behind the screen, that is what **Make it true**
is for — see `engine/tableRuling.js`._

## Coverage notes

_Not errors. A count of what is and is not there._

- NPCs who run dry fast: mike (0 lines). `knows` is everything they can ever say.
- Endings nothing declares a route to: win, dead, coma, insane. Reached from a hook, this is fine.