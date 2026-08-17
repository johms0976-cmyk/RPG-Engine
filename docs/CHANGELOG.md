# Changelog

## 2.1.0 — a base that runs itself

### Engine
- **Simulation hooks.** `onTick`, `onEnterRoom` and `onVanish` let a module
  run its own world between player actions. `onTick` is re-entrancy guarded.
- **Threats have a body and an address.** `start` now places a threat;
  `setThreat` patches `dmg`, `hits`, `heal` and `state`. A threat standing in
  the room you walk into ambushes you instead of waiting for a percentage.
- **Grappling.** An attack can take hold of its victim. While it does, it
  attacks nobody else, the victim saves every round, cannot Run, and gets a
  Strength contest to tear free. Grapples release when combat ends.
- **NPCs can be moved.** New `{ npc: {...} }` and `{ npcSay: {...} }` effects,
  and `api.setNpc` / `api.npcSay`.
- **`vanish` can be aimed.** Take a named person, or anyone in a named room,
  with separate text for the times the players are standing right there.
- **New predicates:** `taken:`, `npcAt:npc@room`, `threatAt:threat@room`.
- **`api.rng`.** Hooks get the world's seeded stream, so simulation is
  reproducible from a seed and survives a save/resume.

### Fixed
- `defineModule` silently dropped every module's `warden` block. It no longer
  does, and also passes through `lore` and `tutorial`.
- Devices were unreachable in play: `Play.jsx` looked for `room.devices`, which
  no module sets, and ignored features carrying `device:`. Both work now.
- The `when` filter on room and module actions was `!a.when || ctx && true`,
  which is always true. Conditional actions were never conditional.
- Combat counters ignored their `when` entirely, in the UI and on use.
- Validation now checks `npc` / `npcSay` / `vanish` targets, `retreatTo`,
  counter ids and grapple damage expressions.

### Ypsilon 14 — rewritten as the campaign's tutorial module
- **The thing has drives**: mend, feed, dry, quiet — checked in that order. It
  has a position, patrols the ducting, prefers isolated prey, will not cross
  standing water, follows noise, and goes to the pod to heal when hurt.
- **Devour** is implemented: the attack that explains the empty vaccsuit.
- **The pod can be destroyed** — burned with the cutter, or flooded by reversing
  the slurry pump from two decks away. After that it cannot mend, and it stops
  being careful.
- **The crew are people.** Posts, haunts, bonds, nerve. They work, drift, and
  when frightened they stop being alone — which makes the players the loneliest
  warm things on the base.
- **Kantaro's infection runs on its own clock** and ends in front of whoever is
  standing there.
- **The infection is tempting**: real healing and a real Strength buff, and then
  the bill.
- Water toolkit (fill the bottle, the jerrycan, the extractor, the showers),
  decoy recordings, Prince as a monster detector, suit air in the mine, a cargo
  objective that costs two hours, and the Company's actual orders in a sealed case.
- Tutorial beats fire once each, when the thing they teach happens.

## 2.0.0 — offline engine, crew play, full combat

### Removed
- **The LLM Warden is gone.** `src/engine/warden.js` is deleted. There is no
  `fetch`, no `XMLHttpRequest`, no API key, and no model call anywhere in the
  codebase — enforced by a test that greps the source and fails the build if
  any reappears. The engine costs nothing to run and works with no network.

### Added — the offline Warden
- **Command parser** (`oracle.js`) matches free text against the room's exits,
  features, items, and people, and routes to the same code the buttons use.
- **Oracle** answers unparseable questions with a weighted yes/no plus a chance
  of a complication.
- **Atmosphere engine** builds sensory lines from pools keyed to room tags.
- **Offline NPC dialogue** keyword-matches against each NPC's `knows` list and
  tracks what has already been said. NPCs cannot invent.
- **Seeded PRNG** in world state, so a resumed save continues its own stream.

### Added — Tier A
- **#4 Rest, healing and stress relief.** Body Save heals by margin, Fear Save
  sheds 1 Stress per 10 points of margin, crits double, critical failure
  reopens the wound. Once a day. Environment, drugs, cryosleep and a crewmate
  with Psychology all modify it.
- **#5 Party play.** Up to four characters. Scientist contagion, Marine panic
  contagion, Android dread, Marine proximity bonus, Teamster Panic re-roll,
  crew assistance as Advantage, death cascades, and the `nearby` panic field —
  all now actually fire.
- **#6 Combat overhaul.** Initiative by Speed Check, two actions a round, range
  bands, aiming, reloading (free if trained), automatic-fire burst rules,
  ammunition that gates the trigger, multiple enemies, distance and movement.
- **#7 Modifier system.** One pipeline for skills, gear, drugs, conditions,
  class abilities, assistance and situational calls, with a visible breakdown
  on every roll.
- **#8 `rollStats()` is 6d10 per Stat**, not 2d10+25.
- **#9 Advantage/Disadvantage rank by outcome band**, so a critical beats a
  plain success. Same-band ties are a house rule.
- **#10 230 tests and real CI.** The 1-byte `workflows/test` is gone; Pages no
  longer deploys unless the tests pass.
- **#11 Per-weapon critical effects** and `vsArmor` modifiers in gear data.
- **#12 Wake-table stat penalties are applied**, not just printed.

### Added — Tier B
- **#13 Progression.** XP, levels, +5 Stat/Save, Resolve to 5, new skills.
- **#14 Accessibility.** `aria-live` log, modal focus trap and Escape,
  `:focus-visible`, keyboard-navigable map, 44px targets, reduced motion,
  skip link.
- **#15 Warden tools.** Horror builder, job and faction generators, dice tray,
  markdown export. Entries are original; the published tables are not copied.
- **#16 Responsive layout.** Styles moved to a token stylesheet. Three columns,
  two, then feed-first with drawers on a phone.
- **#17 Save system v2.** Named slots, schema versions, v1→v2 migration,
  JSON export/import, and the save survives the ending.
- **#18 Deep module validation.** Every hook, table, track, meter, handout,
  item, room, threat, ending and dice expression resolved at load.
- **#19 Nine house rules** from the Warden's Operations Manual.
- **#20 Panic completeness.** The `Math.max(2, …)` floor is gone, so Resolve
  can produce no effect at all. Full RAW trigger set.
- **#21 `NOTICE.md`** with the Mothership third-party licensing position.
- **#22 Economy.** Priced gear, requisition screen, resale.
- **#23 Error boundary** with module problem reporting and eject.
- **#24 Recursive-descent dice parser** replaces `new Function()`.
- **#25 Session transcript export** as markdown, with a roll table.
- **#26 Typed module contract** via JSDoc and the effect-key registry.

### Fixed
- The five missing screen components are present; the build works.
- Opposed Checks re-roll ties and report both-fail instead of silently
  awarding the defender.
- Ammunition blocks firing instead of printing "Empty" and continuing.
- Byline corrected from "Mothership 0e" to 1e.
