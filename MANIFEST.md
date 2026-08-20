# MANIFEST — near-term brief: N1, N2, N3 complete; N4 partial

Engine 2.1.0 → 2.3.0. Copy these over your working tree, preserving paths.

**Verified before packaging:** `npm test` → **525 passed** (was 433), `npm run build` clean, all
four `pages.yml` build checks pass.

---

## New files

| Path | Workstream | What it is |
|---|---|---|
| `CONTRIBUTING.md` | N1 | The six invariants, content-licensing rules, both routes for adding a module. |
| `public/manifest.webmanifest` | N2 | PWA manifest, relative scope. |
| `public/sw.js` | N2 | Service worker. Network-first navigations, cache-first hashed assets, `/net/*` never cached. |
| `public/icon-192.png` · `icon-512.png` · `icon-maskable-512.png` | N2 | Home-screen icons, matching the favicon mark. |
| `src/pwa.js` | N2 | SW registration. Declines on dev, plain http, and live-table tabs. |
| `src/engine/portableModule.js` | N3 | The `.mship` format: envelope, validation, lossy export. |
| `src/engine/moduleStore.js` | N3 | Shelf persistence, separate key from saves. |
| `docs/PORTABLE_MODULES.md` | N3 | Format doc. Its worked example is machine-verified. |
| `docs/examples/silent-drift.mship` | N3 | A two-room module that loads with zero problems. |
| `src/net/rtcSignal.js` | N4 | Connection codes; the Signaller interface. |
| `src/net/rtcPeer.js` | N4 | One peer connection + ordered data channel, shaped like a socket. |
| `src/net/rtcRelay.js` | N4 | `server/host.mjs` ported into the host tab. Pure router, no React, no WebRTC. |
| `docs/REMOTE_PLAY.md` | N4 | Both transports, the handshake, and what does not survive it. |
| `tests/offline.test.js` | fix | The no-network test the 2.0 changelog claimed existed. 8 tests. |
| `tests/loadmodule.test.js` | N3 | Format + store. 33 tests, mostly hostile input. |
| `tests/shelf.test.jsx` | N3 | End to end: a loaded file reaches a playable session. 5 tests. |
| `tests/rtcrelay.test.js` | N4 | Keeps the ported router honest against the real relay. 33 tests. |
| `tests/rtcsignal.test.js` | N4 | The codec, mostly bad pastes. 13 tests. |
| `MANIFEST.md` | — | This file. Delete after applying. |

## Replaced files

| Path | What changed |
|---|---|
| `README.md` | N1. Rewritten from two lines. **Update the demo URL** — it currently guesses. |
| `index.html` | N2. Manifest link + iOS install metadata. Nothing else. |
| `src/main.jsx` | N2. Two lines: the `registerServiceWorker` import and its call. |
| `src/App.jsx` | N3. Merges the loaded shelf with `MODULES`; passes `broken` and `onShelfChange`. |
| `src/screens/Library.jsx` | N3. Load-a-module button and modal, per-module export/remove, broken-module reporting. Renames a local `broken` to `bad`. |
| `src/net/useSocket.js` | N4. Split into a transport selector plus the **untouched** relay path. |
| `docs/CHANGELOG.md` | 2.2.0 and 2.3.0 entries. |
| `package.json` | 2.0.0 → 2.3.0. The version was stale; the tree was at 2.1 per the changelog. No dependency changes. |

**Unchanged:** `package-lock.json`. No new dependencies anywhere in this work.

---

## Four things that need your judgement

**1. `dark` peer whispers cannot survive remote play.**

The most important finding in this session. On the LAN relay, `dark` was never a policy — it was
structural. `useHost.js` says so: filtering happens on the relay because "what never leaves the
relay cannot be displayed, logged or leaked by a bug upstream", and "this codebase does not do
promises". The words physically did not reach the Warden's machine.

Over a direct connection the Warden's browser **is** the router. Every whisper passes through it
by construction. I made `requestPeerMode("dark")` return `seen` and report the downgrade, rather
than keep the name and quietly weaken it — a table might agree to something on the strength of
that word.

If you want true `dark` over remote play it needs end-to-end encryption between players, with the
host passing ciphertext it cannot read. That is a real design, roughly ECDH plus AES-GCM over
WebCrypto, and it should be its own session rather than bolted on here.

**2. STUN is the engine's only third-party contact.**

WebRTC cannot discover a browser's public address without asking outside the network. It happens
only when a table chooses remote play, carries no game data, and comes from exactly one file —
`tests/offline.test.js` now asserts both of those. There is deliberately no TURN, because TURN
would relay the session through somebody's machine. The cost is that a table behind two symmetric
NATs may fail to connect, and must be told rather than left hanging.

**3. The no-network test did not exist.**

`CHANGELOG.md` claimed it did. The invariant held in fact, but nothing was checking — and runtime
module loading makes that matter much more, because a loaded module is somebody else's data.

**4. `Library.jsx` had a shadowing bug waiting to happen.** The per-module map declared
`const broken = …`; the new prop for unparseable stored modules is also `broken`. Left alone the
shelf would have silently stopped reporting them. The local is now `bad`.

---

## What is not done

**N4 is roughly two-thirds complete.** The transport seam, the codec and the router are built and
tested. Missing: the Warden-facing screen that walks a table through the code exchange, and the
`useHost` integration that drives it. Remote play is reachable from code, not from the interface.

**N5 (a second module) was not started.** It is several hundred lines of original scenario prose
that needs playtesting to be worth anything, and it wants a session of its own.

Both are best resumed with the near-term brief in front of you.

## After applying

```bash
npm test          # expect 525 passing
npm run build
```

Then, to make N2 true rather than merely built:

1. **Settings → Pages → Source: GitHub Actions**, and run the deploy workflow.
2. Open the deployed URL; confirm it is not the `ENGINE DID NOT BOOT` notice.
3. Load it once, switch the network off, reload. It should still play.
4. Put the real URL into `README.md`.

Service workers need https or localhost, so the offline install will not activate over the LAN
table server. That is intentional and documented in `src/pwa.js`.
