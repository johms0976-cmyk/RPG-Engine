# NOTICE

## The engine

The software in this repository — everything under `src/engine`, `src/ui`,
`src/screens`, and `tests` — is licensed under the Apache License, Version 2.0.
See `LICENSE`.

## Mothership

*Mothership* is a sci-fi horror roleplaying game published by **Tuesday Knight
Games**. This project is an unofficial, fan-made play aid. It is not affiliated
with, endorsed by, or sponsored by Tuesday Knight Games.

This engine implements game *mechanics* — dice resolution, Stress and Panic,
Saves, Skills, combat procedure, rest and recovery. Game mechanics are systems
rather than expression. The engine deliberately does **not** reproduce the
rulebook's prose, artwork, layout, or trade dress, and it is not a substitute
for owning the books. **You need the Player's Survival Guide and the Warden's
Operations Manual to actually play this game.** Buy them.

If you are Tuesday Knight Games and you would like something here changed or
removed, open an issue and it will be done.

### Third-party licence

This project is intended to be distributed under the terms of the Mothership
Third Party Licence. If you fork or redistribute it, include the required
Mothership Third Party Licence wording and logo per the current terms at
<https://www.tuesdayknightgames.com/pages/licensing>, and do not use Tuesday
Knight Games' logos or trade dress.

## Included module content

### The Haunting of Ypsilon 14

`src/modules/ypsilon14` is a playable adaptation of *The Haunting of Ypsilon 14*
by **D. G. Chapman**, published by Tuesday Knight Games.

All room descriptions, NPC dialogue, handout text, and flavour prose in that
module are **newly written for this engine**. The scenario's plot, characters,
locations, and creature belong to their authors. The module is a play aid for
people who own the scenario, not a replacement for it.

### Generator tables

`src/engine/generators.js` provides Horror, job, faction, and NPC-role
generators. The *structure* follows what the Warden's Operations Manual
teaches — a Horror described by its Transgression, Omens, Manifestation,
Banishment and Slumber; jobs described by sector, task, complication and pay.

**The entries in those tables are original to this engine.** The published d100
tables are Tuesday Knight Games' creative work and are not reproduced here. If
you own the book, a module can supply its own entries through the
`wardenTables` key and they will be used instead.

## Fonts

The interface requests Oswald and JetBrains Mono from Google Fonts, both under
the SIL Open Font License. If they are unavailable — including when you are
fully offline — the stylesheet falls back to system condensed and monospace
faces and the engine works normally.

## Network

The engine makes no network requests of its own. There is no telemetry, no
analytics, no account system, no API key, and no model call anywhere in the
codebase. The only external request the page makes is the optional webfont
stylesheet above, which you can delete from `index.html` if you want the build
to be genuinely request-free.
