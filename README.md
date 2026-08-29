# RPG-Engine

**A tabletop RPG engine that runs entirely in your browser. No account, no server, no API key, no tokens.**

One person opens the Warden's deck on a laptop. Everyone else scans a QR code and their phone
becomes a character sheet that panics, bleeds, and keeps secrets from the other phones. The rules
are enforced, the clock runs, the monster has somewhere to be — and none of it touches the
network.

Currently ships with a full implementation of **Mothership 1e** and three modules: *The Haunting of
Ypsilon 14* (one session, 3–4 hours), *Dead Weight* (ninety minutes, one sitting), and *Another Bug
Hunt* (a four-scenario campaign across forty-eight rooms).

Running one? Every module has a generated Warden's reference in [`docs/`](docs/) — the map, the
gates, the clock, every threat's stats and every line each NPC is allowed to say. Ypsilon 14 also
has a hand-written [dossier](docs/YPSILON14_WARDEN_DOSSIER.md), which is the part no generator can
produce: what the module is *about*.

> **You still need the books.** This is a play aid, not a replacement for the *Player's Survival
> Guide* and the *Warden's Operations Manual*. See [`NOTICE.md`](NOTICE.md).

---

## Try it

**[Play in your browser](https://johms0976-cmyk.github.io/RPG-Engine/)** — no install, no account,
nothing to run. Roll a character, walk into the mine, find out what is living in the ducting.

Add it to your home screen and it works with the aircraft mode on.

### Which kind of evening is it?

Three doors on the title screen, and none of them need a terminal:

| | Who it is for | What you need |
|---|---|---|
| **NOBODY IS THE WARDEN** | Four to six friends, one screen, pass it round | The link above |
| **SOMEBODY IS NOT IN THE BUILDING** | A table that plays online | The link above, and one code swapped per player |
| **GATHER THE TABLE** | Everyone in one room, everyone on their own phone | `npm run host` — see below |

Only the third needs anything installed, and only because the phones have to fetch the app from
somewhere. The first two run entirely in the browser tab you already have open.

---

## What it is

- **A rules engine, not a dice roller.** d%, criticals, advantage and disadvantage ranked by
  outcome band, the full Panic trigger set, Saves, wounds, rest and recovery, XP and levelling,
  priced gear and requisition.
- **Real combat.** Speed-check initiative, two actions a round, range bands with damage falloff,
  ammunition that gates the trigger, automatic-fire burst rules, per-weapon critical effects,
  multiple enemies with distance and pace, and grappling.
- **A Warden that works offline.** A command parser that matches free text against the room's
  exits, features, items and people. An oracle that answers the unparseable with a weighted
  yes/no and a chance of a complication. Atmosphere assembled from pools keyed to room tags.
  NPC dialogue constrained to a `knows` list, so **NPCs cannot invent facts**.
- **A world that runs itself.** Modules get `onTick`, `onEnterRoom` and `onVanish` hooks. In
  Ypsilon 14 the creature has drives — mend, feed, dry, quiet — a position, a patrol route, a
  preference for isolated prey, and it will not cross standing water.
- **Phones that keep secrets.** Every player's snapshot is redacted host-side before it goes on
  the wire. A player who has been lied to by the fiction sees the lie, not the truth plus a
  request not to look.
- **A module format anyone can write in.** Rooms, gated exits, features, a predicate language, an
  effects mini-language, threats, NPCs, tracks, clocks, meters, devices, handouts and endings —
  all declarative. See [`docs/MODULE_FORMAT.md`](docs/MODULE_FORMAT.md).

## What it is not

- **Not a virtual tabletop.** No battle maps, no tokens, no grid. The map is a schematic, because
  Mothership is played in the dark.
- **Not an AI Warden.** There is no model call anywhere in `src/`, and a test fails the build if
  one appears. That was a deliberate removal in 2.0, and it is enforced rather than promised.
- **Not a rules reference.** The engine implements mechanics. It deliberately does not reproduce
  the rulebook's prose, artwork or tables.
- **Not a hosted service.** Remote play works by direct connection between browsers — you and
  each player swap two codes, and no server ever carries the game. The trade is honest: no
  accounts and nothing to trust, but also no room codes, and tables behind strict NAT may need
  the same wifi after all.

---

## Quick start

### Play right now
Open the [hosted demo](https://johms0976-cmyk.github.io/RPG-Engine/) and pick a door. Nothing to
install.

### Run it locally
```bash
npm install
npm run dev
```

### Play with nobody running it

Four to six friends, one screen, no Warden and no terminal. Open the app and choose
**NOBODY IS THE WARDEN** — or go straight there with `?mode=wardenless`.

The empty chair runs the module: it describes rooms, plays the NPCs from what they know, calls for
saves when somebody tries something risky, escalates on the module's own schedule, spends fiction
time when the table stalls, and shares the floor out so the quiet player is not talked over. There
is no Warden deck on that device and no way to reach one — the whole table is reading the same
screen and a deck would show them where the creature is.

Pass the laptop round, or give everyone a phone with `npm run host` below.

### Host a table
Everyone needs to be on the same wifi.

```bash
npm run host
```

The terminal prints an address, a QR code, and the Warden's session token. Open the address with
`?mode=host` on your own machine; everyone else just scans the code.

On Windows, `Play.bat` does this for you and `Update.bat` pulls the latest version.

### Other scripts

| Command | Does |
|---|---|
| `npm test` | The full suite |
| `npm run check` | Tests, then a production build |
| `npm run doctor` | Diagnose a broken install |
| `npm run dossier` | Regenerate every module's Warden reference |
| `npm run dev:lan` | Dev server, visible to the network |

Node >= 20 required.

---

## Writing a module

A module is one object passed to `defineModule()`. Only `id`, `title`, `rooms` and `start` are
required. Everything is cross-referenced at load, so a typo shows up on the module's card in the
library instead of crashing the table three hours in.

```js
export default defineModule({
  id: "my-module",
  title: "THE THING IN THE HOLD",
  start: "hold",
  rooms: { hold: { name: "CARGO HOLD", look: "...", exits: [], features: {} } },
});
```

Two ways in:

- **[`docs/MODULE_FORMAT.md`](docs/MODULE_FORMAT.md)** — the full DSL. Start at "What the engine
  owns vs. what you own".
- **[`docs/PORTABLE_MODULES.md`](docs/PORTABLE_MODULES.md)** — write a module as a `.mship` JSON
  file and load it in the browser with no build step and no terminal.

`src/modules/_template/index.js` is a working skeleton to copy. `src/modules/deadweight/` is the
shorter of the two shipped modules and is the better one to read end to end — it is nine rooms and
two files, where Ypsilon 14 is twelve rooms across eleven.

---

## Roadmap

**Now** — a front door, a hosted demo, modules you can load without a build step, and remote
play over direct connections (see [`docs/REMOTE_PLAY.md`](docs/REMOTE_PLAY.md)).

**Next** — a browser module editor.

**Later** — pluggable rulesets so this stops being Mothership-only, campaign persistence across
modules, and solo play driven by the oracle.

---

## Architecture, briefly

```
src/engine/    rules, dice, combat, effects, the module loader, the offline Warden
src/core/      headless state - ship, contractors, downtime. Never imports React.
src/net/       protocol, host bridge, per-player redaction
src/screens/   Warden deck, play, creator, library
src/ui/        components and the stylesheets
src/modules/   the shelf
server/        static files + a WebSocket relay that holds no game state
```

Two invariants worth knowing before you open a pull request:

1. **The host tab is the only authority.** Phones send intents and render snapshots. Client-side
   roll previews are advisory; the host recomputes from unredacted state.
2. **No network calls in `src/`** beyond same-origin LAN discovery. `tests/offline.test.js`
   enforces this.

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## Licence

The engine is Apache-2.0. See [`LICENSE`](LICENSE).

*Mothership* is published by Tuesday Knight Games. This is an unofficial fan-made play aid, not
affiliated with or endorsed by them. Module content, generator tables and all flavour prose in
this repository are newly written. See [`NOTICE.md`](NOTICE.md) for the full position.
