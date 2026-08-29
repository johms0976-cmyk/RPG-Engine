# ANOTHER BUG HUNT — WARDEN'S REFERENCE

> **Generated from the module. Do not edit by hand — run `npm run dossier`.**
>
> This is the *reference* half of a dossier: the things you look up mid-session
> with a player waiting. It is deliberately not the editorial half — what the
> module is about, where the squeeze is, what to never let happen — because that
> is written by somebody who has run it and cannot be derived from data.

*MOTHERSHIP · SCI-FI HORROR RPG · CAMPAIGN · FOUR SCENARIOS*

Module by D. G. Chapman, Luke Gearing, Alan Gerding, Tyler Kimball & Sean McCoy — Tuesday Knight Games. Rules: Mothership 1e.

A terraforming colony went quiet six months ago. The Company would like somebody to go and look, and has been careful to specify which two things are worth bringing back.

**Before you start.** Arachnophobia — the carcinids draw on insects, spiders and crabs. Body horror: amputation, rot, organ removal, and things erupting from inside people. Mind control and loss of agency, including psychic intrusion written to resemble real psychiatric experience. Violence, corpses, and one suicide by firearm discovered in situ. Claustrophobia, drowning, and confinement.

## At a glance

| | |
|---|---|
| **Rooms** | 48 |
| **Threats** | 9 |
| **NPCs** | 17 |
| **Endings** | 8 |
| **Starts in** | LANDING ZONE |
| **Length** | Four sessions · 3–6 hours each |

## The clock

| When | What | | |
|---|---|---|---|
| 2h00 | colonists | then every 180 | if `flag:reached_heron and !flag:endgame and !flag:signal_down` |
| +1d10*60 | shriek stage 1 | INFECTED — Stage 1 |  |
| +2d10*60 | shriek stage 2 | INFECTED — Stage 1 |  |
| +1d10*60 | shriek stage 3 | INFECTED — Stage 1 | then every 60 |
| +1d10*60 | shriek stage 4 | INFECTED — Stage 1 |  |
| +2d10*60 | shriek stage 5 | INFECTED — Stage 1 |  |

_Times are fiction minutes from session start. `onTick` accumulates, so a
pacing skip still fires every beat it passes through._

## Rooms and exits

| Room | Leads to | Mins | Locked behind |
|---|---|---|---|
| **LANDING ZONE** `lz` | AIRLOCK `airlock` | 10 |  |
|  | GARAGE AND UTILITIES `garage` | 15 |  |
|  | THE HANGAR `hangar` | 60 | hidden until `knows_heron` |
|  | THE HANGAR `hangar` | 20 | needs `flag:apc`; hidden until `knows_heron` |
|  | [A] THE MAIN THRUSTERS `thrusters` | 360 | hidden until `knows_mountain` |
|  | [A] THE MAIN THRUSTERS `thrusters` | 45 | needs `flag:apc`; hidden until `knows_mountain` |
| **AIRLOCK** `airlock` | LANDING ZONE `lz` | 5 |  |
|  | COMMISSARY `commissary` | 5 | route: `has:crowbar`; route: `tag:cuts`; roll intellect (Computers/Hacking) |
| **COMMISSARY** `commissary` | AIRLOCK `airlock` | 5 |  |
|  | PANTRY `pantry` | 5 |  |
|  | CREW HABITAT `habitat` | 10 |  |
|  | COMMAND CENTER `command` | 5 |  |
| **PANTRY** `pantry` | COMMISSARY `commissary` | 5 |  |
|  | WALK-IN FREEZER `freezer` | 5 | route: `has:crowbar`; route: `tag:cuts`; roll strength |
| **WALK-IN FREEZER** `freezer` | PANTRY `pantry` | 5 |  |
|  | THE DUCTING `ducts` | 10 |  |
| **CREW HABITAT** `habitat` | COMMISSARY `commissary` | 5 |  |
|  | ARMORY `armory` | 5 |  |
|  | COMMAND CENTER `command` | 5 |  |
| **ARMORY** `armory` | CREW HABITAT `habitat` | 5 |  |
| **MEDBAY — OBSERVATION LAB** `medbay` | COMMAND CENTER `command` | 5 |  |
|  | CREW HABITAT `habitat` | 5 |  |
|  | THE DUCTING `ducts` | 10 |  |
|  | OPERATING THEATRE `theatre` | 5 | route: `has:edemcard`; route: `tag:cuts`; roll intellect (Hacking/Computers) |
| **OPERATING THEATRE** `theatre` | MEDBAY — OBSERVATION LAB `medbay` | 5 |  |
|  | THE DUCTING `ducts` | 10 |  |
| **COMMAND CENTER** `command` | COMMISSARY `commissary` | 5 |  |
|  | CREW HABITAT `habitat` | 5 |  |
|  | MEDBAY — OBSERVATION LAB `medbay` | 5 |  |
| **GARAGE AND UTILITIES** `garage` | LANDING ZONE `lz` | 10 |  |
|  | INSIDE THE APC `apc` | 5 |  |
|  | THE DUCTING `ducts` | 10 |  |
| **INSIDE THE APC** `apc` | GARAGE AND UTILITIES `garage` | 5 |  |
| **THE DUCTING** `ducts` | WALK-IN FREEZER `freezer` | 10 |  |
|  | MEDBAY — OBSERVATION LAB `medbay` | 10 |  |
|  | OPERATING THEATRE `theatre` | 10 | hidden until `theatre_open` |
|  | GARAGE AND UTILITIES `garage` | 10 |  |
| **THE HANGAR** `hangar` | LANDING ZONE `lz` | 60 |  |
|  | LANDING ZONE `lz` | 20 | needs `flag:atv` |
|  | THE DAM WALL `dam` | 10 |  |
|  | THE LAB `lab` | 5 |  |
|  | THE CHIMNEY `chimney` | 15 | needs `flag:ropes` |
|  | THE DAM WALL `dam` | 15 | needs `has:raft`; hidden until `flooded_hangar` |
| **THE DAM WALL** `dam` | THE HANGAR `hangar` | 10 |  |
|  | THE LIFT `lift` | 7 |  |
|  | THE LIFT `lift` | 2 | needs `flag:atv` |
|  | THE LIFT `lift` | 15 | hidden until `seen_catwalk` |
| **THE LIFT** `lift` | THE DAM WALL `dam` | 7 |  |
|  | THE CONTROL ROOM `control` | 20 |  |
|  | THE CONTROL ROOM `control` | 3 | needs `flag:lift_fixed` |
| **THE CONTROL ROOM** `control` | THE LIFT `lift` | 20 |  |
|  | THE ORBITAL RELAY `relay` | 5 |  |
| **THE ORBITAL RELAY** `relay` | THE CONTROL ROOM `control` | 5 |  |
| **THE LAB** `lab` | THE HANGAR `hangar` | 5 |  |
|  | THE STAIRS `stairs` | 10 |  |
|  | THE CLEAN ROOM `clean` | 5 | route: `has:edemcard`; route: `npc:edem`; roll strength |
| **THE CLEAN ROOM** `clean` | THE LAB `lab` | 5 |  |
|  | THE TUMBLERS `tumblers` | 10 |  |
|  | THE CRYOVAULT `cryo` | 5 | route: `has:edemcard`; route: `npc:edem`; roll intellect (Hacking) |
| **THE CRYOVAULT** `cryo` | THE CLEAN ROOM `clean` | 5 |  |
|  | THE TUMBLERS `tumblers` | 10 |  |
| **THE TUMBLERS** `tumblers` | THE CLEAN ROOM `clean` | 10 |  |
|  | THE CRYOVAULT `cryo` | 10 |  |
|  | THE WALKWAY `walkway` | 10 |  |
| **THE WALKWAY** `walkway` | THE TUMBLERS `tumblers` | 10 |  |
|  | THE STAIRS `stairs` | 10 |  |
| **THE CHIMNEY** `chimney` | THE HANGAR `hangar` | 30 |  |
|  | THE HYDROREACTOR `reactor` | 10 |  |
| **THE SPILLWAYS** `spillways` | THE STAIRS `stairs` | 10 |  |
|  | THE TUNNELS `tunnels` | 10 |  |
|  | THE TUNNELS `tunnels` | 5 | needs `has:raft` |
| **THE STAIRS** `stairs` | THE SPILLWAYS `spillways` | 10 |  |
|  | THE LAB `lab` | 10 |  |
|  | THE WALKWAY `walkway` | 10 |  |
|  | THE HYDROREACTOR `reactor` | 10 |  |
| **THE HYDROREACTOR** `reactor` | THE CHIMNEY `chimney` | 10 |  |
|  | THE STAIRS `stairs` | 10 |  |
|  | THE TUNNELS `tunnels` | 20 | hidden until `seen_gash` |
|  | THE TUNNELS `tunnels` | 10 | needs `has:raft`; hidden until `seen_gash` |
| **THE TUNNELS** `tunnels` | THE HYDROREACTOR `reactor` | 20 |  |
|  | THE SPILLWAYS `spillways` | 10 |  |
|  | [D] THE COURT `court` | 60 |  |
| **[A] THE MAIN THRUSTERS** `thrusters` | LANDING ZONE `lz` | 360 |  |
|  | LANDING ZONE `lz` | 45 | needs `flag:apc` |
|  | [A1] THE ORRERY `a1` | 20 |  |
|  | [B] THE AIRLOCK `mothairlock` | 30 | hidden until `seen_hull` |
|  | [C] THE DORSAL CRACK `crack` | 40 | hidden until `seen_hull` |
| **[B] THE AIRLOCK** `mothairlock` | [A] THE MAIN THRUSTERS `thrusters` | 30 |  |
|  | [B1] DIM CORRIDOR `b1` | 10 | route: `tag:carc`; roll strength |
| **[C] THE DORSAL CRACK** `crack` | [A] THE MAIN THRUSTERS `thrusters` | 40 |  |
|  | [C1] THE WOUND `c1` | 15 |  |
| **[A1] THE ORRERY** `a1` | [A] THE MAIN THRUSTERS `thrusters` | 20 |  |
|  | [A2] THE CHASM `a2` | 15 | needs `flag:a1_hatch` |
| **[A2] THE CHASM** `a2` | [A1] THE ORRERY `a1` | 15 |  |
|  | [A3] THE GAS CHAMBER `a3` | 10 | needs `flag:bridge_up` |
| **[A3] THE GAS CHAMBER** `a3` | [A2] THE CHASM `a2` | 10 |  |
|  | [A4] THE GALLERY `a4` | 15 |  |
| **[A4] THE GALLERY** `a4` | [A3] THE GAS CHAMBER `a3` | 15 |  |
|  | [A5] THE POLYP TOWER `a5` | 20 |  |
|  | THE TUNNELS `tunnels` | 60 | hidden until `seen_web` |
| **[A5] THE POLYP TOWER** `a5` | [A4] THE GALLERY `a4` | 20 |  |
|  | [D] THE COURT `court` | 30 | hidden until `a5_open` |
| **[B1] DIM CORRIDOR** `b1` | [B] THE AIRLOCK `mothairlock` | 10 |  |
|  | [B2] THE ARMOURY `b2` | 10 |  |
|  | [B3] THE NARROW WALKWAY `b3` | 10 |  |
| **[B2] THE ARMOURY** `b2` | [B1] DIM CORRIDOR `b1` | 10 |  |
|  | [B3] THE NARROW WALKWAY `b3` | 10 |  |
| **[B3] THE NARROW WALKWAY** `b3` | [B1] DIM CORRIDOR `b1` | 10 |  |
|  | [B4] THE PIT `b4` | 10 |  |
|  | [D] THE COURT `court` | 20 |  |
| **[B4] THE PIT** `b4` | [B3] THE NARROW WALKWAY `b3` | 10 |  |
|  | [B5] THE TRIPLE AIRLOCK `b5` | 10 |  |
| **[B5] THE TRIPLE AIRLOCK** `b5` | [B4] THE PIT `b4` | 10 |  |
|  | [D] THE COURT `court` | 10 |  |
| **[C1] THE WOUND** `c1` | [C] THE DORSAL CRACK `crack` | 15 |  |
|  | [C2] THE BELLOWS `c2` | 15 | needs `flag:c1_cut` |
| **[C2] THE BELLOWS** `c2` | [C1] THE WOUND `c1` | 15 |  |
|  | [C3] THE GULLET `c3` | 15 |  |
| **[C3] THE GULLET** `c3` | [C2] THE BELLOWS `c2` | 15 |  |
|  | [C4] THE FOG CAVITY `c4` | 10 | hidden until `c3_side` |
|  | [C5] THE RAMP `c5` | 10 | needs `flag:c3_open` |
| **[C4] THE FOG CAVITY** `c4` | [C3] THE GULLET `c3` | 10 |  |
| **[C5] THE RAMP** `c5` | [C3] THE GULLET `c3` | 10 |  |
|  | [D] THE COURT `court` | 10 |  |
| **[D] THE COURT** `court` | [B5] THE TRIPLE AIRLOCK `b5` | 10 |  |
|  | THE TUNNELS `tunnels` | 60 |  |
| **THE METAMORPHOSIS** `metamorphosis` | _no exits_ | | |

## Threats

### CARCINID `carc`

| Combat | Speed | Instinct | Hits | Max damage | Tactics | Morale |
|---|---|---|---|---|---|---|
| 75 | 60 | 75 | 2 | 20 | isolated | 0.5 |

**Breaks off** the moment it takes a hit.
**Hears noise.** Draw chance 0.5.
- **Claw** 4d10 · crit 6d10
- **Shriek** 0

**Ways out other than shooting it:**
- Throw the acid at it — needs `tag:acid`
- Put the coated rounds into it — needs `has:coatedammo`

### CARCINID HATCHLING `hatchling`

| Combat | Speed | Instinct | Hits | Max damage | Tactics | Morale |
|---|---|---|---|---|---|---|
| 35 | 45 | 35 | 2 | 20 | nearest | 0.5 |

- **Claw** 2d10
- **Shriek** 0

**Ways out other than shooting it:**
- Throw the acid at it — needs `tag:acid`
- Put the coated rounds into it — needs `has:coatedammo`

### WHAT IS LEFT OF SGT ABARA `abara`

| Combat | Speed | Instinct | Hits | Max damage | Starts | Tactics | Morale |
|---|---|---|---|---|---|---|---|
| 75 | 60 | 75 | 2 | 20 | garage | nearest | 0.5 |

**Breaks off** the moment it takes a hit.
- **Claw** 4d10
- **Shriek** 0

**Ways out other than shooting it:**
- Throw the acid at it — needs `tag:acid`
- Put the coated rounds into it — needs `has:coatedammo`
- Shoot the grenades on its chest — needs `(ctx) => !!ctx.pc && ctx.pc.items.some((i) => ctx.items[i] && ctx.items[i].tag === "WPN")` · ends combat
- Drop the power line into the water — needs `flag:generator_on` · ends combat

### WHAT IS LEFT OF DR ZIEGLER `ziegler`

| Combat | Speed | Instinct | Hits | Max damage | Starts | Tactics | Morale |
|---|---|---|---|---|---|---|---|
| 75 | 60 | 75 | 2 | 20 | clean | weakest | 0.5 |

**Breaks off** the moment it takes a hit.
- **Claw** 4d10
- **Shriek** 0

**Ways out other than shooting it:**
- Throw the acid at it — needs `tag:acid`
- Put the coated rounds into it — needs `has:coatedammo`

### HINTON `hinton`

| Combat | Speed | Instinct | Hits | Max damage | Starts | Tactics | Morale |
|---|---|---|---|---|---|---|---|
| 75 | 70 | 85 | 3 | 20 | court | loudest | 0.2 |

- **Pulse Rifle** 3d10

### HINTON'S RETINUE `retinue`

| Combat | Speed | Instinct | Hits | Max damage | Starts | Tactics | Morale |
|---|---|---|---|---|---|---|---|
| 85 | 65 | 75 | 3 | 30 | court | nearest | — |

- **Claw** 5d10
- **Shriek** 0

**Ways out other than shooting it:**
- Throw the acid at it — needs `tag:acid`
- Put the coated rounds into it — needs `has:coatedammo`

### CARCINID NOBLE `noble`

| Combat | Speed | Instinct | Hits | Max damage | Tactics | Morale |
|---|---|---|---|---|---|---|
| 95 | 40 | 95 | 10 | 100 | random | — |

- **Claw** 0
- **Assimilation** 0

### WHAT IS LEFT OF MAAS `maascarc`

| Combat | Speed | Instinct | Hits | Max damage | Tactics | Morale |
|---|---|---|---|---|---|---|
| 55 | 55 | 55 | 2 | 20 | nearest | 0.5 |

- **Claw** 4d10
- **Shriek** 0

**Ways out other than shooting it:**
- Throw the acid at it — needs `tag:acid`
- Put the coated rounds into it — needs `has:coatedammo`

### ASSIMILATED MARINE `grunt`

| Combat | Speed | Instinct | Hits | Max damage | Tactics | Morale |
|---|---|---|---|---|---|---|
| 30 | 40 | 25 | 1 | 10 | nearest | 0.3 |

- **Pulse Rifle** 3d10


## People

_`knows` is everything they can say. Selection is allowed; invention is not._

### DEMAR — Base Mechanic `demar`
*apc* · cannot vanish · **5 lines**

Sitting in the dark of the APC cab in a hand-folded foil cap, thin, hugging his knees. He is holding a frag grenade and the pin is already out.

> Stage 3. Do not play him as a monster — play him as somebody who has been given the one thing he wanted, which is to be part of something. The grenade is not a threat he is making. He has simply forgotten he is holding it.
- He would like to go back. He says it twice, without urgency, the way you mention a train.
- He can hear them calling. He says it is not unpleasant. He says he would like to contribute.
- They are waking up, he says. He is pleased about it.
- If asked gently, and only gently, he will point out the route through the foothills to the ship.
- He does not know what a grenade is any more. If startled, he will remember he is holding something, and let go.

### HM3 BROOKMAN — Platoon Medic `brookman`
*hangar* · **5 lines**

The medic. Has given up on the mission entirely and wants everyone on a dropship within the hour.

> His plan is the one your players will already have thought of, so play him as a coward rather than as a strategist. If he sounds brave, the table follows him instead of leading. He gives the control room keycard to literally anybody who asks.
- The tower across the dam is the only working comms on this planet. Retake it and you can call the dropship.
- He has the only keycard left for the tower control room. He will hand it over the moment anyone asks.
- He has scouted the dam. There are already carcs on it. He would rather not talk about how he knows.
- Every hour they wait, more of them arrive. He is right about this and nobody wants to hear it.
- He was Siege Squad's medic. He does not want to discuss where Siege Squad is.

### CPL IVANOVIC — APC Driver, Siege Squad `ivanovic`
*hangar* · **3 lines**

Sticks to Brookman's shoulder and agrees with him before he has finished the sentence.
- Whatever Brookman thinks is the right plan. She will say so before you have finished asking.
- She can drive anything in the hangar and says so more often than is necessary.
- There is a journal under a bunk at Greta Base that she would very much like back.

### PFC TANAKA — APC Tech, Zigzag Squad `tanaka`
*hangar* · **3 lines**

Injured, nineteen, and holding it together by not being asked any direct questions.
- He was at the birthday party. He will not describe it and should not be pushed.
- The broken ATV is a two-hour job if somebody who knows engines helps him.
- He wants to know whether anybody is coming. He asks this repeatedly.

### DR KAWAGUCHI — Planetologist `kawaguchi`
*hangar* · **3 lines**

Edem's rival, and enjoying the current situation more than is decent.
- The storm has ten hours left in it and the station's flood modelling is optimistic.
- Dr Edem's research is not, in her professional assessment, as far along as Dr Edem says it is.
- Edem and Olsson were together. She mentions it as a data point and watches to see what you do with it.

### DR EDEM — Mission Specialist, Xenobiology `edem`
*hangar* · cannot vanish · **7 lines**

The Company's named priority and the only person here the contract obliges you to bring home. Wants an escort down to the lab to recover four months of sequencing work.

> Edem is lying, but not about the science. Their family is inside a Company debtor's facility and the release condition is a viable genome. Everything they do that looks like recklessness is somebody buying three people out. They will take insane risks to get into the Cryovault and will invent a reason each time.
- Their research is on a portable terminal in the lab on level minus one. Without it they cannot go home.
- They and Dr Ziegler were sequencing the carcs' genome. Ziegler went down to fetch the data and did not come back.
- Given a few hours and the research, they can compound something that coats a bullet and gets through carapace.
- There is an unfinished calculation on a bench downstairs. It is a chemotherapy dose. They will not say who it was for, and the honest answer is that they had not decided.
- The animals make a sound to reproduce. They named it. They will tell you the name unprompted.
- They will not discuss the Cryovault, except to say that they need samples from it and that nobody should follow them in.
- Olsson's birthday card is still in their quarters at Greta Base, unopened. They will not discuss this at all.

### SGT YANG — Squad Leader, Zigzag Squad `yang`
*hangar* · **4 lines**

The oldest person left standing and the only one making tactical sense.
- Rifles do not work on them. He has watched a full magazine go into one and change nothing.
- The lab can be reached by the hangar lift or by the maintenance stairs. He would take the stairs.
- He thinks Valdez is out of her depth and has decided that saying so out loud would cost more than it is worth.
- He will come with you if asked directly. Nobody has asked him.

### SOBOL — Engineering `sobol`
*hangar* · **4 lines**

Convinced this is all somehow the android's doing, and correct for entirely the wrong reasons.

> Sobol is the module's one honest gift to a suspicious table. He is a crank. He is also correct. Do not let him produce evidence — let him produce theories, and let the players decide.
- Hinton was in every part of this before it went wrong. He cannot say how he knows and gets louder about it.
- The comms failed before the carcs came, not after. He is certain of the order and he is right.
- There is a generator in the lift housing with six hours in it, if anybody ever needs the tower lit.
- He does not believe the science officer is missing. He believes he left.

### SGT VALDEZ — Platoon Tech, Acting Commander `valdez`
*hangar* · cannot vanish · **5 lines**

A technician who was fourth in line for command and got it anyway. Sent Siege Squad down to the reactor six hours ago and has heard nothing since.

> She is not a bully, she is nineteen days into a job she was never trained for. Let her be wrong in front of the players and let her take it well. If the crew treat her as a commander she becomes one.
- The reactor's flood controls have to be thrown by hand or the station goes dark within the hour.
- She sent Siege Squad down to do it, with Hinton and Dr Jensen. Their locators went dark six hours ago.
- She can issue rifles, hazard suits and lamps. The reactor levels are hot and the suits are not optional.
- The reactor is reached by rappelling down the chimney, or the long way round through the spillways.
- She will go herself if nobody else will, and she knows what that would mean.

### PFC PEDRO — Fireteam 1, Zigzag Squad `pedro`
*hangar* · **2 lines**

In love with Sgt Valdez and agrees with everything she says on principle.
- Whatever Sgt Valdez just said, with more enthusiasm.
- He has never fired at anything that fired back and it shows.

### CPL NOVIKOV — Fireteam 2, Zigzag Squad `novikov`
*hangar* · **2 lines**

Wants to blow something up and has stopped being fussy about what.
- The stockpile has two explosive devices and a flamethrower with two tanks. She has counted them repeatedly.
- Fire does not work on them either. She has tested this and would like to test it again.

### SSGT UNDERHILL — Platoon Sergeant `underhill`
*relay* · cannot vanish · **5 lines**

Prone on the relay platform behind an anti-material rifle, killing one carc per round and down to twelve rounds. His body is criss-crossed with fine incisions.

> Stage 3, and holding it off by force of habit and a dog with good teeth. His orders are the last real orders anybody on this planet has received: get off this rock. If the crew tell him about a plan that is not evacuation, he will hear them out and then repeat the orders.
- Comms are dead planet-wide and the source is in the control room below him. He has not been able to get in.
- Twelve rounds left. He can hold the platform. He cannot hold it and go anywhere.
- His orders are to evacuate. He will repeat this whenever a conversation drifts.
- The dog bites him when he goes away. He is grateful for it and says so like it is a supply issue.
- If asked directly what is wrong with him, he will tell you, in about six words.

### MARLOW — Synthetic Bloodhound `marlow`
*relay* · silent, cannot vanish · **0 lines**

A working synthetic dog, soaked through, lying against Underhill's flank. It can smell the infection and it bites him whenever he stops being there.

> Marlow is a diagnostic instrument that loves somebody. Point it at a person and it will tell you whether they are infected. This is the only reliable test the crew will find, and it is attached to a man who will not leave his firing position.

### LCPL FRANCO — Fireteam 1, Siege Squad `franco`
*reactor* · cannot vanish · **6 lines**

Standing on the crown of a flooded turbine with a machine gun and six rounds, keeping watch over Weaver.
- The water is full of them. He has six rounds. He has been counting them out loud for an hour.
- It was Hinton. Hinton killed Glöckner in front of him and then broke the reactor controls by hand.
- The reactor goes down within the hour and there is nothing left to throw. He watched the controls come apart.
- Hinton took Dr Jensen with him. Jensen was walking on her own and did not appear to object.
- Qadir went missing before any of it. Nobody has seen him since.
- Weaver needs help. Weaver has the paper cuts. He says this last and quietly.

### PFC WEAVER — Fireteam 2, Siege Squad `weaver`
*reactor* · cannot vanish · **3 lines**

Clinging to Franco, soaked, and covered from throat to wrist in fine incisions like paper cuts.

> Stage 1. He does not know. Franco does. Whether the players tell him is theirs.
- He has been in the water for six hours and would like that noted by somebody with authority.
- He keeps hearing someone suggesting things to him. He puts it down to the cold.
- He does not know where the cuts came from. He noticed them this morning.

### DR JENSEN — Geologist `jensen`
*court* · cannot vanish · **4 lines**

Standing at Hinton's shoulder in the Court, unrestrained, taking notes.

> Stage 4. She is entirely herself, in the sense that there is no longer anyone else in there.
- She is assisting. She uses that word and does not elaborate on it.
- The three sleepers in the chamber are old — older than the colony, older than the ship they are in.
- She will describe Hinton's work clearly, competently, and with obvious professional respect.
- If asked whether she wants to leave, she looks puzzled by the question and then answers something else.

### MAAS — Corporate Liaison `maas`
*nowhere* · starts absent, cannot vanish · **4 lines**

Your liaison, nominally in charge, still aboard The Metamorphosis in orbit and entirely comfortable.

> Maas is infected and you should not work hard to hide it. He caught it over the radio on day one and has been filling in reports ever since. When the players get suspicious, let them be right.
- The contract names two retrievals: Dr Edem, and Hinton's logic core. The core is the one he mentions twice.
- The colonists are not on the contract. He will say this in a tone that suggests he considers it settled.
- He tried to raise the crew on the surface, got noise, and stopped trying after the first day.
- He has been in his quarters. He has a great deal of paperwork and is behind on it.


## How it can end

| | Good | |
|---|---|---|
| **YOU GOT OFF SAMSA VI** `evacuated` | yes | The dropship claws its way up out of the weather with your crew aboard and whatever else you managed to fit. Below, the storm closes over a continent that is not going to belong t… |
| **YOU BROUGHT BACK THE CORE** `cure` | yes | Hinton's logic core comes off the dropship in a lead case and goes into a Company lab, and eleven months later there is a treatment for the cancer pattern. Your names are not on t… |
| **YOU LEFT IT ALONE** `quiet` | yes | You break orbit with no samples, no core, and a full crew. The Company will take the ship, the fee and most of a year off you for it. Samsa VI goes back to doing what it has been … |
| **THE WATER GOT THERE FIRST** `drowned` | no | The storm does what the modelling said it would and the station goes under with everybody still arguing about which mission to run. The dropship makes three passes over open water… |
| **YOU CONTRIBUTED** `hive` | no | The suggestions stop being suggestions somewhere around the seventh hour. What walks out of the tunnels on Samsa VI is wearing your crew and is very pleased to have been included. |
| **YOU WALKED OUT OF THE COURT** `escape` | yes | Nobody stops you. That is the part that stays with the table afterwards — not the three shrouded shapes, not the android being reasonable, but the fact that you were allowed to le… |
| **BREAKING ORBIT** `debrief` | yes | Samsa VI drops away behind you. Somewhere in the hold is whatever you decided was worth the people it cost. The pilots want to know where to. Nobody has an answer yet, and there i… |
| **ANOTHER BUG HUNT** `dead` | no | The rain keeps coming down on Samsa VI, the way it has for a hundred years, and the terraform continues on schedule. In about ten years, something answers a call. |

## What the table can say and be heard

7 written for this module, 20 from the common pack.

**This module's own:**

- `shootit` — "shoot it", "open fire", "light it up", "empty the mag"
- `radio` — "radio", "call for help", "hail them", "comms"
- `foil` — "tin foil", "tinfoil", "foil hat", "foil cap", "the hat"
- `papercuts` — "paper cut", "papercut", "the cuts", "incisions"
- `android` — "hinton", "the android", "science officer"
- `leave` — "let's leave", "get off this rock", "just go", "call the dropship"
- `leave_open` — "let's leave", "get off this rock", "just go", "call the dropship"

_Anything else falls through to the oracle, which answers yes/no and does not
update the fiction. With nobody behind the screen, that is what **Make it true**
is for — see `engine/tableRuling.js`._

## Coverage notes

_Not errors. A count of what is and is not there._

- 1 room no exit reaches: metamorphosis. If a hook moves the crew there, this is fine and expected.
- 1 of 48 rooms offer nothing but their description: b5. Corridors are good; this is only a count.
- NPCs who run dry fast: ivanovic (3 lines), tanaka (3 lines), kawaguchi (3 lines), pedro (2 lines), novikov (2 lines), weaver (3 lines). `knows` is everything they can ever say.