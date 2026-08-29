# DEAD WEIGHT — WARDEN'S REFERENCE

> **Generated from the module. Do not edit by hand — run `npm run dossier`.**
>
> This is the *reference* half of a dossier: the things you look up mid-session
> with a player waiting. It is deliberately not the editorial half — what the
> module is about, where the squeeze is, what to never let happen — because that
> is written by somebody who has run it and cannot be derived from data.

*MOTHERSHIP · SCI-FI HORROR RPG*

A ninety-minute module for 3–6 players.

You are forty hours into a tow you should not have taken, and the thing on the end of the cable has started to move on its own.

**Before you start.** Confined spaces, suffocation, cold, and a body in a box. No harm to children and no sexual content.

## At a glance

| | |
|---|---|
| **Rooms** | 9 |
| **Threats** | 1 |
| **NPCs** | 2 |
| **Endings** | 4 |
| **Starts in** | CORVID — BRIDGE |
| **Length** | Ninety minutes · one sitting |

## The clock

_No scheduled beats. This module's pressure comes from play, not the clock._

## Rooms and exits

| Room | Leads to | Mins | Locked behind |
|---|---|---|---|
| **CORVID — BRIDGE** `bridge` | CORVID — GALLEY `galley` | 1 |  |
|  | CORVID — ENGINE BAY `enginebay` | 2 |  |
|  | CORVID — AIRLOCK `airlock` | 2 |  |
| **CORVID — GALLEY** `galley` | CORVID — BRIDGE `bridge` | 1 |  |
|  | CORVID — ENGINE BAY `enginebay` | 2 |  |
| **CORVID — ENGINE BAY** `enginebay` | CORVID — BRIDGE `bridge` | 2 |  |
|  | CORVID — GALLEY `galley` | 2 |  |
| **CORVID — AIRLOCK** `airlock` | CORVID — BRIDGE `bridge` | 2 |  |
|  | THE UMBILICAL `umbilical` | 2 |  |
| **THE UMBILICAL** `umbilical` | CORVID — AIRLOCK `airlock` | 8 |  |
|  | AMARANTH — LOCK `amaranthlock` | 8 |  |
| **AMARANTH — LOCK** `amaranthlock` | THE UMBILICAL `umbilical` | 2 |  |
|  | AMARANTH — HOPPER DECK `hopperdeck` | 2 |  |
|  | AMARANTH — BRIDGE `amaranthbridge` | 2 |  |
| **AMARANTH — HOPPER DECK** `hopperdeck` | AMARANTH — LOCK `amaranthlock` | 2 |  |
|  | AMARANTH — COLD HOLD `coldhold` | 2 | route: `has:keycard`; roll strength |
| **AMARANTH — COLD HOLD** `coldhold` | AMARANTH — HOPPER DECK `hopperdeck` | 2 |  |
| **AMARANTH — BRIDGE** `amaranthbridge` | AMARANTH — LOCK `amaranthlock` | 2 |  |

## Threats

### THE PASSENGER `sleeper`

| Combat | Speed | Hits | Tactics | Morale |
|---|---|---|---|---|
| 45 | 25 | 4 | weakest | — |

- **Take hold** 2d10
- **Cold** 1d10


## People

_`knows` is everything they can say. Selection is allowed; invention is not._

### SOLA PIKE — Corvid Engineer `pike`
*enginebay* · **6 lines**

Took the contract. Regrets it in a way she will not say out loud.
- We took this tow at Kepler because it paid on tonnage and nobody asked what the tonnage was.
- Once the drive lights for the burn we are committed. You cannot cut a cable under load, it will come back through the collar and take the stern off.
- The tow cable has changed note twice since yesterday. That means the load moved. Forty-one tonnes of ore does not move.
- There was a fourth suit on the rack when we docked at Kepler. I did not put it there and I have not asked.
- Hold one is a refrigerated hold on a ship carrying rock. I noticed. I decided not to have noticed.
- If you open that hatch, close it again before the burn. Whatever the yard finds is the yard's problem, and only if it is still cold.

### ESTHER HALLORAN — Amaranth, Master `halloran`
*amaranthbridge* · starts absent · **4 lines**

Eleven days into a four-day emergency bunk. Should not be alive and is.
- Kerrigan went down to hold one to reseat the coolant rods. I heard the hatch. I did not hear it again.
- The refrigeration failed on day fourteen and we ran warm for nine hours. That was the mistake. Everything after it is just the consequence.
- It is not ore. It was never all ore. There are forty-one tonnes on the manifest and there are thirty-eight tonnes of rock in that hold.
- Do not take it to Tarsis. Tarsis is a breaker's yard, they cut hulls open in an atmosphere, with people standing in it.


## How it can end

| | Good | |
|---|---|---|
| **YOU CUT IT LOOSE** `cut` | yes | The charge fires, the collar opens, and ninety metres of cable goes slack and then away. The Amaranth keeps the vector it had. In nine days you make Tarsis with an empty hook and … |
| **YOU BROUGHT IT IN** `burned` | no | Eleven days to Tarsis with forty-one tonnes on the hook, and the yard pays on tonnage, and they cut hulls open in an atmosphere with people standing in it. You were paid. It is a … |
| **YOU PUT IT BACK IN THE COLD** `frozen` | yes | Rods reseated, hatch closed, hold one back down through minus forty and still falling when you leave it. It is not dead. It is exactly as dead as it was at Kepler, and the differe… |
| **THE CORVID MADE TARSIS EMPTY** `lost` | no | The tug arrives on schedule. The umbilical is still attached at one end. |

## What the table can say and be heard

8 written for this module, 20 from the common pack.

**This module's own:**

- `cut_it` — "cut the cable", "cut it loose", "cut the tow", "drop the tow", "ditch the hopper", "release the cable"
- `whats_in_it` — "what is in the hold", "what's in the hold", "what is the cargo", "what are we carrying", "what's in it"
- `its_alive` — "it's alive", "it is alive", "something alive", "a creature", "a monster", "something in there"
- `split_up` — "split up", "splitting up", "you stay here", "i'll go alone", "cover more ground", "two teams"
- `the_burn` — "the burn", "how long have we got", "how much time", "when do we burn", "delay the burn"
- `the_fourth_suit` — "fourth suit", "extra suit", "whose suit", "spare suit"
- `call_it_in` — "call it in", "radio", "contact the company", "send a message", "报告", "mayday", "distress"
- `halloran` — "wake her", "the bunk", "cold bunk", "wake him up", "open the bunk"

_Anything else falls through to the oracle, which answers yes/no and does not
update the fiction. With nobody behind the screen, that is what **Make it true**
is for — see `engine/tableRuling.js`._

## Coverage notes

_Not errors. A count of what is and is not there._

- Endings nothing declares a route to: frozen, lost. Reached from a hook, this is fine.