# A COLD START — WARDEN'S REFERENCE

> **Generated from the module. Do not edit by hand — run `npm run dossier`.**
>
> This is the *reference* half of a dossier: the things you look up mid-session
> with a player waiting. It is deliberately not the editorial half — what the
> module is about, where the squeeze is, what to never let happen — because that
> is written by somebody who has run it and cannot be derived from data.

*MOTHERSHIP · SCI-FI HORROR RPG*

Template module — safe to delete.

Three rooms and something in the dark. A skeleton to build your own module on.

## At a glance

| | |
|---|---|
| **Rooms** | 3 |
| **Threats** | 1 |
| **NPCs** | 0 |
| **Endings** | 2 |
| **Starts in** | CARGO HOLD |
| **Length** | Demo |

## The clock

_No scheduled beats. This module's pressure comes from play, not the clock._

## Rooms and exits

| Room | Leads to | Mins | Locked behind |
|---|---|---|---|
| **CARGO HOLD** `hold` | CORRIDOR `corridor` | 5 |  |
|  | **ENDING: leave** |  |  |
| **CORRIDOR** `corridor` | CARGO HOLD `hold` | 5 |  |
|  | BRIDGE `bridge` | 5 | route: `has:fuse`; roll strength |
| **BRIDGE** `bridge` | CORRIDOR `corridor` | 5 |  |

## Threats

### THE PASSENGER `thing`

| Combat | Speed | Hits | Tactics | Morale |
|---|---|---|---|---|
| 55 | 45 | 2 | weakest | — |

- **Grip** 2d10


## People

_None._

## How it can end

| | Good | |
|---|---|---|
| **YOU LEFT** `leave` | yes | You undock. Whatever was aboard is somebody else's contract now. |
| **YOU DIED** `dead` | no | The recycler keeps running. |

## What the table can say and be heard

0 written for this module, 20 from the common pack.


_Anything else falls through to the oracle, which answers yes/no and does not
update the fiction. With nobody behind the screen, that is what **Make it true**
is for — see `engine/tableRuling.js`._

## Coverage notes

_Not errors. A count of what is and is not there._

- Endings nothing declares a route to: dead. Reached from a hook, this is fine.