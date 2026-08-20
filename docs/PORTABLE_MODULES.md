# Portable modules

A portable module is a scenario written as a JSON file. It loads in the browser, needs no build
step and no terminal, and is a single file you can email to somebody.

It is the same DSL as [`MODULE_FORMAT.md`](MODULE_FORMAT.md). Read that first — this document only
covers what is different about the file version.

## Loading one

Library → **Load a module** → choose a file or paste the JSON. It appears on the shelf marked
`LOADED` and stays there until you remove it.

Loaded modules live in your browser's local storage. They do not sync, and clearing site data
removes them — export anything you care about. Removing a module does **not** delete your saves
for it; load it again and the saves are still there.

## The envelope

```json
{
  "kind": "rpg-engine-module",
  "v": 1,
  "author": "your name, optional",
  "module": {
    "id": "silent-drift",
    "title": "SILENT DRIFT",
    "start": "airlock",
    "rooms": { }
  }
}
```

A bare module object without the wrapper also loads — the engine recognises `id` + `title` +
`rooms`. The wrapper is better because it carries the format version, which is what lets a future
engine migrate your file instead of refusing it.

`.mship` is the conventional extension. `.json` works identically.

## What JSON cannot carry

Three places in the DSL take a JavaScript function. A portable module can have none of them.

| Field | What happens |
|---|---|
| `hooks` | **Refused.** The module will not load. |
| `{ run: "name" }` effects | **Refused**, since there is no hook to run. |
| `devices.*.status` | Loads with a warning; the device shows no status lines. |
| `devices.*.actions[].label` | A plain string works. Only the function form is lost. |

The refusals are loud on purpose. An effect that says `{ run: "spawnTheThing" }` in a file that
cannot carry hooks would silently do nothing at that beat, and you would find out three rooms
into a session with players watching.

**If you need hooks, write a bundled module instead** — `src/modules/_template/` and a line in
`src/modules/index.js`. Ypsilon 14 is bundled precisely because its creature simulation is real
code.

Nearly everything else fits here. The effects language, predicates, gated exits, threats with
attacks and counters, NPCs, tracks, clocks, meters, handouts, tables, shops and endings are all
declarative already.

## Anything unrecognised is dropped

The loader keeps only the keys the engine reads and warns about the rest. A typo like `room`
instead of `rooms` will not sit there quietly doing nothing — you will see it listed as ignored
on the module's card.

## Validation

Loading runs the same deep validation as a bundled module. Every cross-reference is resolved:
room ids, item ids, threat ids, table names, track names, meter names, handout ids, endings, and
every dice expression.

A module with problems still appears on the shelf. It shows what is wrong and refuses to start,
which is the same behaviour bundled modules have had since 2.0 — one error path, not two.

## Starting from an existing module

Any module on the shelf has an **Export module** button. For a loaded module you get back exactly
the bytes you loaded. For a bundled one you get a portable conversion, and the app tells you what
could not travel.

Exporting Ypsilon 14 is a reasonable way to see a large module's shape, but the result is not a
playable module — its hooks are gone and it will say so.

## Is it safe to load a module somebody sent me?

Reasonably, yes, and the reason is structural rather than a matter of trust.

**A module is data. It is never executed.** There is no `eval`, no `new Function`, and no dynamic
import anywhere in the load path — `tests/offline.test.js` fails the build if any appears. Dice
expressions go through a recursive-descent parser that understands dice and nothing else. Unknown
keys are discarded rather than passed to the engine.

What a hostile module *could* do is what any module can do: show you unpleasant text. It cannot
reach the network, read your saves, or run code. Check the content warning on the card.

## A complete minimal example

```json
{
  "kind": "rpg-engine-module",
  "v": 1,
  "module": {
    "id": "silent-drift",
    "title": "SILENT DRIFT",
    "subtitle": "MOTHERSHIP · SCI-FI HORROR RPG",
    "blurb": "A hauler answering nobody, three days out from the relay.",
    "length": "One shot",
    "contentWarning": "Isolation, suffocation.",
    "start": "airlock",

    "intro": [
      "The Silent Drift stopped answering four days ago.",
      "Salvage rights say whoever boards her first owns what is left."
    ],

    "rooms": {
      "airlock": {
        "n": 1,
        "name": "AIRLOCK",
        "tags": ["VACC"],
        "look": "The inner door is standing open. That is the first wrong thing.",
        "exits": [{ "to": "galley", "label": "Forward to the galley [2]", "mins": 3 }],
        "features": {
          "panel": {
            "name": "Cycle panel",
            "d": "Dead, and warm to the touch.",
            "skills": ["Computers"],
            "mins": 10,
            "setsFlag": "knows_power"
          }
        }
      },
      "galley": {
        "n": 2,
        "name": "GALLEY",
        "look": "Six settings laid out. Nothing has been eaten.",
        "onFirstEnter": [
          { "say": "Six chairs. Five crew on the manifest.", "tone": "horror" },
          { "stress": 1, "why": "the arithmetic" }
        ],
        "exits": [
          { "to": "airlock", "label": "Back to the airlock [1]", "mins": 3 },
          { "to": "@away", "label": "Cut your losses and undock", "confirm": "Choose it again to confirm." }
        ]
      }
    },

    "endings": {
      "away": { "title": "AWAY", "text": "You undock and let her drift.", "good": true }
    }
  }
}
```

Save it as `silent-drift.mship` and load it.
