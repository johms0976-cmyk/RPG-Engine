# Contributing

## The invariants

These are not style preferences. A change that breaks one of them will be reverted even if it
works, because each of them is load-bearing for something the project promises out loud.

**1. No network calls in `src/`.**
No `fetch`, no `XMLHttpRequest`, no `WebSocket` to anywhere but the table server, and no model
calls. The offline promise is in the README and on the library screen, and it is the main thing
that distinguishes this engine from everything else in the category.

`tests/offline.test.js` greps the source and fails the build. It carries a short allowlist of
same-origin LAN-discovery calls (`/net/info`) and bundled-asset prefetches. If you need to add to
that allowlist, you almost certainly need to not do the thing instead.

**2. The host tab is the only authority.**
Phones send intents and render snapshots. They compute nothing that matters. Client-side roll
previews exist and are useful, but they are advisory — the host recomputes from unredacted state
and the host's number wins. A preview that is occasionally an underestimate is fine. A preview
that replaced the host's arithmetic would be a security hole.

**3. `src/core/` never imports React.**
It is the headless half. A test, a CLI, a bot or a second renderer must all be able to drive it.
The moment it imports React that stops being true.

**4. Every host-to-client message must be declared in `src/net/protocol.js`** and listed in
`HOST_TO_CLIENT`. The relay forwards what is named there and silently drops everything else, so
an undeclared message is a message that does not arrive.

**5. Never `eval` module content.**
No `new Function`, no `eval`, no dynamic `import()` of user data. The recursive-descent dice
parser in `src/engine/diceParser.js` exists precisely because the dice expressions used to go
through `new Function`, and it is the precedent to follow for anything similar.

**6. Tests gate the build.**
`.github/workflows/pages.yml` will not deploy unless `npm test` passes. Do not lower
`chunkSizeWarningLimit` in `vite.config.js` to silence a bundle-size warning — that is how a
build gets back to 661KB in one chunk.

## Content and licensing

*Mothership* is Tuesday Knight Games' game. This project implements **mechanics**, which are
systems rather than expression, and deliberately reproduces none of the rulebook's prose,
artwork, layout or published tables.

If you contribute content:

- **Write it yourself.** Room descriptions, NPC dialogue, handout text and flavour must be
  original. Ypsilon 14's prose is newly written for this engine and yours must be too.
- **Do not paste published d100 tables.** `src/engine/generators.js` follows the *structure* the
  Warden's Operations Manual teaches, with entries original to this engine. A module that owns
  the book can supply real entries through the `wardenTables` key at runtime.
- **Adaptations are play aids, not replacements.** A scenario's plot, characters and locations
  belong to their authors.
- **Update `NOTICE.md`** with an attribution block for anything new.

## Working on it

```bash
npm install
npm run dev          # dev server
npm test             # the suite
npm run test:watch   # while you work
npm run check        # tests then a production build - run this before a PR
npm run doctor       # when something is broken and you do not know what
```

Node >= 20.

## Adding a module

Two routes, and the right one depends on whether you need JavaScript.

**Portable JSON** — no build step, loads in the browser, distributable as a file. This is the
right default. See [`docs/PORTABLE_MODULES.md`](docs/PORTABLE_MODULES.md).

**Bundled** — for modules that need real `hooks`, like Ypsilon 14's creature simulation:

1. Copy `src/modules/_template/` to `src/modules/your-module/`.
2. Write it against [`docs/MODULE_FORMAT.md`](docs/MODULE_FORMAT.md).
3. Add one line to `src/modules/index.js`.
4. `npm test` — `defineModule` resolves every cross-reference at load and the suite fails on a
   dangling room id, an unknown item, or a bad dice expression.

Vite gives each module its own chunk automatically, so a table playing something else never
downloads yours.

## Pull requests

- One thing per PR.
- Tests with behaviour changes. The suite is the reason it is safe to refactor a 2,700-line hook.
- If you find a bug, a failing test first, then the fix, in that order.
- Comments in this codebase explain *why*, not *what*. Match that. The existing headers are a
  good model: they tend to record the bug that motivated the code, which is the thing nobody can
  reconstruct later.
- Note anything that changes the module DSL in `docs/MODULE_FORMAT.md` in the same PR. The format
  is a contract with people writing modules, and undocumented drift breaks their work.
