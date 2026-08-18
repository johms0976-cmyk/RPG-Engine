# Module format

A module is one object passed to `defineModule()`. Only `id`, `title`, `rooms` and `start` are required — everything else has a default. `defineModule` validates on load; anything wrong shows on the module's card in the library instead of crashing the player.

```js
import { defineModule } from "../../engine/defineModule.js";

export default defineModule({
  id: "my-module",
  title: "THE THING IN THE HOLD",
  start: "hold",
  rooms: { hold: { name: "CARGO HOLD", look: "…", exits: [], features: {} } },
});
```

## What the engine owns vs. what you own

| Engine | Module |
|---|---|
| d%, criticals, advantage/disadvantage | which rolls happen and when |
| the four classes, skill tree, panic table, wake table | nothing — don't touch these |
| standard PSG gear and loadouts | extra items, extra loadouts |
| character creation, the sheet, the map renderer | map geometry, theme, room data |
| combat resolution, clock, save/resume | threats, flavour text, endings |

## Manifest keys

```
id, title, subtitle, byline, blurb, pitch[], length, contentWarning
theme          { accent, ink, bone, void, blood, graphite, display, mono }
feedStyles     override any log line style
items          merged over the core GEAR table
loadouts       merged over the core loadouts
rooms, start
npcs, npcOrder
threats
handouts       tapes, notes, logs — long text with effects attached
devices        terminals and consoles
itemUse        itemId -> effects, overrides an item's default behaviour
actions        actions offered in every room (subject to `when`)
tables         rollable tables
meters         extra Stress-like tracks (e.g. Gradient Descent's Bends)
tracks         timed conditions (infection, radiation, air)
clocks         scheduled world events
endings        { id: { title, text, good } }
intro, talkPrompts
warden         { setting, voice, constraints[], npcNote }
debrief, xp
map            { pos, links, extras, width, height } — omit for auto-layout
hooks          named JS functions, for the last 5%
```

## Rooms

```js
work: {
  n: 2,                                   // number shown on the map
  name: "WORKSPACE",
  tags: ["VENT", "TERMINAL"],
  look: "…",                              // full description on first entry
  onMap: false,                           // hide from the map (vents, crawlspaces)
  onFirstEnter: [ …effects ],
  onEnter: [ …effects ],
  exits: [ … ],
  features: { … },
  actions: [ { id, label, when, kind, effects } ],
}
```

### Exits

```js
{ to: "quarters", label: "Corridor → Quarters [3]", mins: 5 }

{ to: "entrance", mins: 10,
  needs: "tag:vacc",                      // predicate
  needsHint: "vaccsuit required",         // appended to the button
  needsText: "There is no atmosphere beyond this point." }

{ to: "@followed", label: "Undock and leave",
  confirm: "Choose it again to confirm.",
  effects: [ { when: "slain:it", then: [{ end: "win" }] } ] }   // "@id" = an ending

{ to: "db1", hidden: "ante_found",        // invisible until the flag is set
  gate: {                                 // a locked door with several ways through
    flag: "db1_open",
    routes: [                             // first matching route wins, no roll
      { when: "flag:knows_code", text: "You key in the code." },
      { when: "tag:cuts", time: 20, noise: "cutting", text: "You cut the lock out." },
    ],
    roll: { label: "KEYPAD", stat: "intellect", skills: ["Computers"], time: 15,
            bonusIf: [{ when: "has:lockpicks", bonus: 10 }],
            passText: "…", failText: "…" },
  } }
```

### Features (the "Look at" list)

```js
b9: {
  name: "Mike's old bunk",
  d: "Cleaned out. A thorough search finds a cache…",
  deep: true,                   // needs an Intellect check; a second attempt always works
  skills: ["Scavenging"],       // best of these adds to the search check
  mins: 10,
  gives: ["revolver", "ammo"],  // each item can only be taken once per session
  setsFlag: "ante_found",
  device: "terminal",           // makes the room's device usable
  when: "!dead:giovanni",       // hide the feature entirely
  effects: [ …effects ],
}
```

## Predicates (`when`, `needs`)

A string of clauses joined by ` and `, or a `(ctx) => boolean` function.

```
has:keycard      carrying an item
tag:water        carrying anything with that item property
flag:knows_water world flag set
room:db1         current room
visited:ante
npc:sonya        alive and not taken
here:prince      in this room right now
threat:it        threat is in this room and not retreating
dead:it          threat killed
slain:it         same, via the auto-set flag
skill:Computers
condition:INFECTED
clock>120  stress>=5  meter:bends>=7
!anything        negation
```

## Effects

The little language everything else is written in. Applied in order.

```js
{ say: "text", tone: "horror" }          // tones: room warden you npc system item search
                                         //        move horror dmg good stress roll
                                         //        rollgood rollbad panic alarm handout
{ time: 15 }                             // minutes; drives clocks, tracks, countdowns
{ stress: 1, why: "…" }                  // negative to calm
{ damage: "2d10", why: "claws" }
{ heal: "1d10" }
{ give: ["keycard"] } / { take: ["keycard"] }
{ flag: "knows_water" } / { flag: { showers: true } }
{ condition: "INFECTED" }
{ meter: { bends: 1 } }
{ track: "infection" }                   // start a timed condition
{ noise: "a deliberate racket" }         // draws every threat with hearsNoise
{ threat: { id: "it", loc: "ante", retreat: 60, distract: 2, dead: true } }
{ fight: "it", surprise: true }
{ moveTo: "work" }
{ vanish: { text: "{name} is not where {name} should be.", stress: 1 } }
{ table: "artifacts" }
{ countdown: { id: "selfdestruct", minutes: 30, tick: "… {left} minutes",
               onZero: [{ end: "boom" }] } }
{ stopCountdown: "selfdestruct" }
{ end: "win" }
{ panic: true }
{ run: "giovanniEncounter" }             // drop to module JS

// rolled by the engine, immediately
{ save: "sanity", why: "…", skill: "…", mode: "advantage",
  onPass: [...], onFail: [...], onCritHit: [...], onCritFail: [...] }
{ test: "intellect", skill: ["Scavenging", "Rimwise"], onPass: [...], onFail: [...] }

// rolled by the player, on a button
{ ask: { kind: "save", name: "body", reason: "the hatch is closing" } }

// control flow
{ when: "has:keycard", then: [...], else: [...] }
{ once: "sawTheCat", then: [...] }
{ pick: [[3, [...]], [1, [...]]] }       // weighted
```

Dice expressions are accepted anywhere a number is: `12`, `"2d10"`, `"d%"`, `"60+1d6*10"`.
Text supports `{name}`-style placeholders.

## Threats

```js
it: {
  name: "IT",
  combatLabel: "SOMETHING YOU CANNOT SEE",   // shown during combat
  combat: 70, speed: 50, instinct: 35,
  maxHits: 3, maxDmg: 40,                    // dies at either
  unseen: true, seenWith: "ir",              // defends with Advantage unless the
                                             // player carries an item with that property
  hearsNoise: true, noiseDraw: 0.55,
  breaksOff: true,                           // combat ends when it takes a hit
  start: "vents",
  hunts: { chance: 0.1, text: "…" },         // rolled on entering any room
  onSighted: "…", onFirstContact: [ …effects ],
  attacks: [{ name: "Claws", dmg: "2d10", weight: 4, text: "…",
              crit: { dmg: "4d10", text: "…", save: "body",
                      onFailDmg: "2d10", onPassText: "…", onFailText: "…" } }],
  onHit: [ …effects ],                       // player landed a hit, it lives; {hits} {max}
  onSlain: [ …effects ],
  counters: [{ id: "water", label: "Throw water at it", when: "tag:water",
               roll: "instinct",             // rolled against that stat on the threat
               onBreak: [ …effects ], onHold: [ …effects ], endsCombat: true }],
  missText, dodgeText, fleeText, blockText, searchingText, note,
}
```

## NPCs

```js
sonya: {
  name: "SONYA", role: "Team Leader", start: "work",
  brief: "…",                  // shown above the dialogue buttons
  persona: "…",                // fed to the LLM
  knows: ["…", "…"],           // the ONLY facts they may reveal; also the offline script
  note: "…",                   // extra instruction to the LLM for this character
  gone: true,                  // starts absent
  vanishable: false,           // exempt from the disappearance clock
  silent: true,                // can't be talked to (animals, corpses)
}
```

## Tracks, clocks, meters

```js
tracks: {
  infection: {
    condition: "INFECTED — yellow goo",
    stages: [
      { after: 60, effects: [ … ] },
      { after: "2d10*60", effects: [ … ],
        repeat: { every: 10, effects: [{ damage: "1d10" }] } },
    ],
  },
},

clocks: [
  { id: "disappearances", start: 90, every: "60+1d6*10", when: "!flag:evacuated",
    effects: [{ vanish: { text: "…" } }] },
],

meters: { bends: { name: "The Bends", start: 0, danger: 7 } },
```

## Devices

```js
devices: {
  terminal: {
    title: "Workspace Computer Terminal", icons: "BASE OPS", label: "Use the terminal",
    status: (w, pc) => ["SHOWERS: …", "AUTH: …"],
    actions: [{
      id: "selfdestruct",
      label: (w) => (w.flags.destruct_armed ? "Abort" : "Initiate"),
      needs: "has:keycard", needsText: "Authorisation required.",
      kind: "accent", mins: 5,
      effects: [ … ],
    }],
  },
}
```

A room feature with `device: "terminal"` makes it usable in that room. Two rooms can point at the same device (Ypsilon's workspace terminal and its twin in the vents).

## Hooks

For the handful of things that are shorter in code. A hook receives the engine `api`:

```js
hooks: {
  examineGoo(api) {
    const pc = api.pc();
    const r = check(Math.min(99, pc.stats.intellect + bestSkillBonus(pc, ["Xenobiology"])));
    if (!r.success) return api.say("system", "The slide is opaque to you.");
    api.flag("knows_goo");
    api.say("good", "You get it, more or less. …");
  },
  onUnconscious(api) { … },   // called by the engine when the player is knocked out
}
```

`api` exposes: `mod items world() pc() ctx() ended() say flag give take stress meter heal hurt panic addCondition advance noise vanish rollTable run setThreat startTrack countdown stopCountdown rollNow ask startCombat endGame moveTo effects`.

If you find yourself writing a hook the same way in two modules, that's a sign it should become an effect in `src/engine/effects.js`.

---

# Engine 2.0 additions

## Crew, not a character

`ctx.pc` is the active character; `ctx.crew` is everyone. Effects take an
optional `target: pcId` to hit someone specific, and `{ stressCrew: 1 }` hits
everyone nearby except the active character.

New predicates: `crew:marine`, `crewHas:keycard`, `crewTag:water`,
`crewSkill:Hacking`, and `crewAlive>2`.

## Rolls go through the modifier pipeline

A `save` or `test` effect can now carry `tags`, which is how items grant real
bonuses:

```js
{ test: "intellect", skill: ["Hacking"], tags: ["door", "electronic"],
  onPass: [...], onFail: [...] }
```

Any carried item whose `grants` entry matches those tags contributes. Declare
tags on every roll; they cost nothing and they are what makes gear mean
something.

## Items grant modifiers

```js
lockpicks: {
  n: "Lockpick Set", cost: 400,
  d: "+10% on rolls to open airlock and electronic door systems.",
  grants: [{ tags: ["lockpick", "door", "electronic"], bonus: 10 }],
}
```

A grant may specify `kind` (`stat`/`save`/`any`), `name` (a specific Stat or
Save), `tags`, `bonus`, `adv`, `dis`, and `needsItem`.

## Weapons

```js
revolver: {
  dmg: "3d10", tag: "WPN", shots: 8, spare: 2,
  range: { s: 20, m: 30, l: 125 },     // short / medium / long, metres
  vsArmor: -5,                          // defender subtracts this
  crit: { mult: 2, knockdown: true },   // per-weapon critical effect
  loud: true,
}
```

`auto: true` plus `burst: n` gives the automatic-fire rule: the whole magazine
goes unless the shooter has Firearms or Military Training, who get `burst`
rounds. `falloff: true` halves damage at medium range and quarters it at long.
Crit options: `mult`, `bonus`, `limb`, `bleed`, `knockdown`, `knockback`,
`impale`.

## Threats

```js
threats: {
  goon: {
    name: "GOON", combat: 50, instinct: 40, speed: 40,
    maxHits: 3, maxDmg: 40,
    count: 3,              // spawn three of them
    startDistance: 20,     // metres at the start of combat
    pace: 8,               // metres it closes per turn
    retreatTo: "vents",    // where it goes if it breaks off
    attacks: [{ name: "Claws", dmg: "2d10", crit: { dmg: "4d10", save: "body" } }],
  },
}
```

`{ fight: "goon", count: 3, distance: 25, surprise: true }` starts it.

## New effects

| Effect | Does |
|---|---|
| `{ stressCrew: 1 }` | Stress everyone nearby |
| `{ xp: 2 }` | Award experience to the living crew |
| `{ buff: {...} }` | Timed modifier grant (drugs, adrenaline) |
| `{ rest: { quality: "MEDBAY" } }` | Open the rest screen |
| `{ target: pcId }` | Aim any effect at a specific crew member |

## Atmosphere

The offline Warden assembles sensory lines from pools keyed to room tags:

```js
flavour: {
  any: ["The base breathes through its ducting."],
  VENT: ["The grille above you is warm."],
  MINE: ["The rock here is the temperature of a hand."],
}
```

## Shops

```js
shops: {
  cargo: {
    name: "YOUR SHIP'S HOLD", markup: 1,
    stock: ["firstaid", "painpills", "stimpak"],   // omit for everything priced
  },
}
```

## Warden generator tables

If you own the Warden's Operations Manual, put its entries in `wardenTables`
and the generators will use them in place of the engine's originals:

```js
wardenTables: {
  horror: { transgression: [...], omens: [...], manifestation: [...] },
  jobs: { sector: [...], task: [...] },
}
```

## Validation

`defineModule` now resolves every cross-reference at load: `run` hooks,
`table`, `track`, `meter`, `handout`, item ids, room ids, threat ids, endings,
and every dice expression. Unknown effect keys become warnings. Anything wrong
shows on the module's card in the library, and `npm test` fails the build.

---

# Engine 2.1 additions — a world that runs itself

Everything below exists so a module can have a cast with legs and a
threat with appetites, without the engine knowing what a cat is.

## The simulation hooks

Three optional hooks turn a module from a map into a place.

```js
hooks: {
  onTick(api, { mins, clock, from }) { … },   // every time the clock moves
  onEnterRoom(api, { room, first }) { … },    // before the ambush check
  onVanish(api, { id, name, where, witnessed }) { … },
}
```

`onTick` fires after clocks, tracks and countdowns have been resolved.
It is re-entrancy guarded: anything it does that advances the clock
again will not recurse. Accumulate `mins` and act on your own heartbeat
rather than assuming a fixed step:

```js
const acc = flags.sim_acc + mins;
const steps = Math.floor(acc / 10);
```

`onEnterRoom` runs *before* the engine's `hunts` roll, and gets first
refusal on the encounter. A threat that knows where it is should decide
for itself; the percentage is a fallback for modules that don't
simulate.

## Threats have a location and a body that remembers

`start` now actually places a threat, and `setThreat` patches its
condition as well as its position:

```js
{ threat: { id: "it", loc: "ante", retreat: 60, distract: 2,
            dmg: 0, hits: 1, heal: 10, dead: true } }
```

`heal` subtracts from accumulated damage. `hits` are separate and
deliberately harder to undo — a thing can mend its wounds at the pod
and still be two hits from dead.

A threat standing in the room you walk into will ambush you, with no
roll. Set `ambushes: false` for threats that wait to be approached.

## Grappling

An attack may take hold of its victim instead of merely damaging them:

```js
attacks: [{ name: "Devour", dmg: "4d10", grapple: true, grappleText: "…" }],

grapple: {
  condition: "BEING DEVOURED",     // added to the victim's sheet
  holdText: "It has not let go.",
  save: "body", dmg: "2d10",       // rolled every round it keeps hold
  onPassText, onFailText,
  escapeText, failEscapeText,      // the Strength contest to get out
  onEscape: [ …effects ], onFailEscape: [ …effects ],
}
```

While an enemy has hold of somebody it attacks nobody else. The victim
gets a **Tear free** button (whole turn, Strength against the thing's
Combat, Close-Quarters Combat helps) and cannot Run. Every grapple is
released when the encounter ends.

## NPCs can be moved

```js
{ npc: { id: "sonya", loc: "mess", mood: 3, say: "Everyone. Now." } }
{ npcSay: { id: "rosa", text: "\"Show me.\"" } }
```

and from a hook, `api.setNpc(id, patch)` / `api.npcSay(id, text, tone)`.
Patchable: `loc alive taken met mood state knows told`.

## Vanishing somebody specific

```js
{ vanish: {
    id: "rie",                 // optional; otherwise a random eligible NPC
    in: "wash",                // optional; only take from this room
    exclude: ["sonya"],
    text: "…",                 // when it happens off-screen
    witnessText: "…",          // when it happens in the players' room
    stress: 1, witnessStress: 2,
} }
```

`vanish` returns the victim's id and fires `hooks.onVanish`.

## New predicates

```
taken:mike            an NPC who has been taken
npcAt:sonya@work      alive, present, and in that specific room
threatAt:it@vents     where the threat actually is
```

## Counters can be conditional

```js
counters: [{ id: "water", label: "Throw water at it", when: "tag:water",
             hint: "you are carrying water", whenText: "Not with what you have." }]
```

The button now hides itself when its `when` fails, and the engine
re-checks on use. Room and module `actions` are filtered the same way —
previously the filter was a no-op and every action always showed.

## Devices are reachable

A device appears as a button in any room that lists it in
`devices: ["terminal"]` **or** in any room with a feature carrying
`device: "terminal"`. Both work; use whichever reads better.

## The Warden's own material survives the load

`warden`, `lore` and `tutorial` are passed through to the module object
instead of being dropped. Put the long-form background a table will ask
about in `lore` and it is available to the Warden screen without
bloating the play data.

## api additions

`setNpc npcSay rng` join the api handed to effects and hooks. Use
`api.rng()` rather than `Math.random()` inside hooks: it is the world's
seeded stream, so a resumed save continues the same sequence and a
session can be replayed exactly from its seed.


## Handouts with pictures

A handout may carry an `img` alongside its `text`. Mothership lives on
greasy printouts — station schematics, crew manifests, the frame the
camera caught — and a handout that can only be text has to be described
rather than shown.

```js
handouts: {
  schematic: {
    style: "corporate",
    label: "YPSILON 14 — DECK PLAN",
    img: "/handouts/deck-plan.png",   // or a data: URI
    text: "Stamped, three years out of date, and wrong about the vents.",
  },
}
```

Both fields are optional independently: a handout may be a picture with
no text, text with no picture, or both. The picture is drawn inside the
same paper frame as the text, so a schematic still reads as a document
somebody is holding rather than as an image in a web page.

Anything referenced with a `data:` URI keeps the offline promise intact.
A URL pointing outside the bundle does not — if your module must work
with no network, inline it.

The Warden can also drop a picture onto any handout at the table
(Levers → Props → *Add a picture*). That copy lives in memory for the
session only: it is never written into the module and never saved with
the game.

## What the Warden's dossier reads

Nothing new is required, but the in-app dossier (Levers → Dossier) is
assembled from fields modules already declare, so filling them in is
what makes it useful:

| Field | What the dossier does with it |
|---|---|
| `warden.setting` | The "what is actually going on" panel |
| `warden.voice` | How to run it |
| `warden.constraints` | The rules that keep the module honest |
| `npcs[].knows` | Ticked off line by line as each is said |
| `npcs[].note` | Shown above that NPC's script |
| `clocks` | Listed as triggers, with whether they are running |
| `endings` | Where this can still end |

Flags are discovered automatically by walking every `effects` array in
the module, so the "secrets" list needs no declaration — but it is only
as readable as your flag names, since `knows_water` is displayed as
"knows water".
