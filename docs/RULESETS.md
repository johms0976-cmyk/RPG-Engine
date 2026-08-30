# Rulesets

This engine was Mothership-only until 2.20.0, and not by decision. Four stats, four saves, four
classes, a Panic table and a d10 skill economy were written into `src/engine/rules.js` at 2.0 and
thirty-one files imported them directly. Nothing was ever *chosen* to be Mothership-specific — it
simply was, and the engine could not be anything else as a result.

2.20.0 put a seam under it. 2.21.0 finished it: character creation, panic and module compatibility
are all ruleset-driven now, and a system with three stats, no classes and no panic table runs
end to end.

**What still does not exist is a second ruleset.** That is a game-design job, not an engineering
one — see "Why no second ruleset ships" at the end.

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

  // Which parts of character creation this system has. Omit the
  // field and you get all six. Declare a "class" step with no
  // classes and it is a validation error, not a broken screen.
  create: {
    steps: ["name", "stats", "skills", "loadout"],
    statNote: "Roll 3d6 and keep the order.",   // your sentence, shown on the creator
  },

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
| a `class` creation step with no classes | the creator would render an empty picker and never let anybody finish |
| a `skills` creation step with no tree | same, one screen along |
| a creation step nothing knows how to draw | a step nothing renders is a step that silently does nothing |

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

## Panic is optional

An empty `panic.table` means the system has no panic mechanic. `queuePanic` — which seventeen call
sites reach, from a critical failure to a crew death to first contact — refuses once, at the top, so
every trigger keeps firing harmlessly rather than needing seventeen guards that somebody eventually
forgets one of.

The one class ability that touches panic is found by its `ability: "panicReroll"` key rather than by
the class being called Teamster. That field has been in the class data since 2.0 and nothing read
it.

## Modules say what they were written for

```js
defineModule({
  id: "my-module",
  ruleset: "mothership1e",
  // …
});
```

**Stated and wrong is a problem** — the library card already refuses to start anything with
problems. The failure this prevents is bad and silent: load a `.mship` written for Mothership into a
system with different stats and you get a playable-looking session where every check reads
`undefined`, no error anywhere, and the first sign of trouble is a roll target of `NaN`.

**Unstated is a warning, not a refusal.** Every module written before the field existed omits it;
refusing would empty the library on upgrade. The field stays `null` rather than being filled in with
whatever is loaded, because exporting a module must not put words in its author's mouth. Anything
written in the browser editor states it, because the editor knows.

---

## What is still Mothership-shaped

Two things, and both are smaller than what came before them.

**Modules ship Mothership content.** The `ruleset` field stops one loading into the wrong system; it
does not make a Mothership module playable under another one. There is no translation layer and
there should not be — a scenario written around Fear Saves is a scenario about fear saves.

**`gear.js` is Mothership's kit,** merged into every module's item list by `defineModule`. A ruleset
cannot yet supply its own standard equipment, so a non-Mothership system inherits pulse rifles and
vaccsuits unless every module overrides them. This is the next thing I would move, and it is
roughly the size of the `rules.js` split.

## Why no second ruleset ships

A plugin interface with one implementation is a rename. That was the honest caveat at 2.20.0, and
the seam has since been finished, so the caveat has changed rather than gone away: **the engine can
now carry a second system, and writing one is a game-design job rather than an engineering one.**
Inventing a role-playing game to prove a refactor is not something this project should do.

`tests/ruleset.test.js` and `tests/ruleset-wired.test.js` between them define a deliberately
different system — three stats, three saves, no classes, no panic table, a differently-named armour
save, a different health formula, four creation steps instead of six — and assert the engine runs
it. If you want to write a real one, those two files are the specification.

## Why no second ruleset ships

A plugin interface with one implementation is a rename, and inventing a second role-playing game is
not this project's job. A thin Mothership variant dressed up as a different system would prove
nothing except that a file can be copied.

The proof that the seam carries is in `tests/ruleset.test.js`, which defines a deliberately
different ruleset — three stats, three saves, no classes, no panic table, a differently-named
armour save and a different health formula — and asserts the engine runs it. That is a test rather
than a product because a test is what it is.
