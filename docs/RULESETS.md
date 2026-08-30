# Rulesets

This engine was Mothership-only until 2.20.0, and not by decision. Four stats, four saves, four
classes, a Panic table and a d10 skill economy were written into `src/engine/rules.js` at 2.0 and
thirty-one files imported them directly. Nothing was ever *chosen* to be Mothership-specific — it
simply was, and the engine could not be anything else as a result.

2.20.0 puts a seam under it. **The seam is real and it is not the whole job.** Read "What is still
Mothership-shaped" before you plan anything on top of this.

---

## Where the numbers live now

`src/engine/rulesets/mothership.js` holds Mothership 1e — the classes, the skill tree, the Panic
table, the wake table, the trinkets and the patches. Every number in it was in `rules.js` until
2.20.0 and none of it changed.

`src/engine/rules.js` holds the functions the engine calls over whatever system is loaded:
`makeCharacter`, `armorSave`, `baseValue`, `resolveRest`, `applyAdvancement`. Its exports are
unchanged — `CLASSES`, `SKILL_TREE`, `PANIC_TABLE`, `STAT_KEYS` and the rest are still exported
with the same shapes, so no call site needed touching and none did. What changed is that they are
now reads rather than literals.

`src/engine/ruleset.js` holds the contract and the registry.

## Declaring one

```js
import { defineRuleset, registerRuleset } from "../ruleset.js";

export const mySystem = defineRuleset({
  id: "my-system",
  name: "A DIFFERENT GAME",
  blurb: "Three stats, three saves, no classes.",

  stats: ["grit", "wit", "reach"],
  saves: ["nerve", "flesh", "plating"],
  labels: { grit: "Grit", /* … */ },

  // Which save worn protection adds to, or null. Named rather than
  // assumed, so "armor" stops being a magic string in baseValue.
  armorSave: "plating",

  classes: {},                    // legitimate. You get none, not four.
  skills: {
    tree: { basic: { Climbing: [], Wiring: [] } },
    cost: { basic: 1 },
    bonus: { basic: 10 },
  },
  panic: { table: [], triggers: {} },

  rollStats: () => ({ grit: 40, wit: 40, reach: 40 }),
  health: (s) => s.grit + s.reach,
  startingStress: 0,
  maxWounds: 4,
  startingCredits: () => 0,
});

registerRuleset(mySystem);
```

Register it by importing the file. `rules.js` imports `rulesets/mothership.js` for exactly this
reason and a second one goes in beside it.

### Only four fields are required

`id`, `name`, `stats`, `saves`. **Every other default is the empty one, not Mothership's** — a
ruleset that forgets to declare classes gets no classes rather than four smuggled in behind it.

### What it refuses

`defineRuleset` reports on the object rather than throwing, the same way `defineModule` does.
Problems, not exceptions, because the thing being validated is somebody's work and an exception at
import time takes the whole app down rather than the one file that is wrong.

| Problem | Why |
|---|---|
| missing `stats` or `saves` | there is nothing to roll against |
| a key in both lists | `baseValue` switches on `kind`, so one name meaning two numbers surfaces only as a wrong target percentage |
| a class with an unknown save or stat | it would silently do nothing at creation |
| a skill needing a prerequisite that is not in the tree | `canTakeSkill` would refuse it forever |
| `armorSave` naming a save that does not exist | worn armour would quietly stop counting |

A ruleset with problems **is still registered**, with its problems attached. Refusing would make a
broken ruleset indistinguishable from a missing one, and "nothing happened" is the hardest failure
to find.

## Choosing one

```js
setActiveRuleset("my-system");   // → { ok: true, reload: true }
```

**The choice takes effect on reload, and the return value says so.** `rules.js` exports constants
and its consumers read them at module scope — `WardenDeck.jsx` builds its condition list out of
`PANIC_TABLE` the moment it is imported. Swapping mid-session would leave every one of those
holding the old set, silently, with no error anywhere. The ruleset is resolved once, at import,
exactly as `HOSTING` is in `main.jsx`.

---

## What is still Mothership-shaped

Three things, and none of them is small. This is the honest state of item 23 and the order I would
do the rest in.

**1. Character creation is a Mothership flow.** `Creator.jsx` and `CreatorPhone.jsx` roll six dice
per stat, pick a class, and spend skill points against a three-tier tree. The *data* is generic now
— the class list, the tree, the costs and the bonuses all come from the ruleset, and 2.20.0 fixed a
hardcoded four-class array in the crew roller that would have hidden any fifth class — but the
*sequence* is not. A ruleset would need to declare its creation steps as data before a system with
no classes could be made playable through that screen.

**2. Panic is wired in by name.** `useGame.js` calls `queuePanic`, tests a Stress threshold, and
knows about the Teamster's reroll. A system with no panic mechanic needs those to be no-ops rather
than absent.

**3. Modules declare `loadouts` in Mothership's shape,** so every module is currently bound to a
ruleset without saying so. `defineModule` would need a `ruleset` field and a compatibility check —
which is also the thing that would stop somebody loading a `.mship` file into a system it was never
written for and getting a character sheet full of `undefined`.

## Why no second ruleset ships

A plugin interface with one implementation is a rename, and inventing a second role-playing game is
not this project's job. A thin Mothership variant dressed up as a different system would prove
nothing except that a file can be copied.

The proof that the seam carries is in `tests/ruleset.test.js`, which defines a deliberately
different ruleset — three stats, three saves, no classes, no panic table, a differently-named
armour save and a different health formula — and asserts the engine runs it. That is a test rather
than a product because a test is what it is.
