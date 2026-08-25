# UPDATE 2.12.0 — the remote invite is a QR code

## What changed

The offer code went from **708 characters to 110**, and the Warden's
screen now shows it as a QR code containing a link. A player across the
city scans it off the shared screen, the app opens with the invite
already loaded, and the only thing that has to travel back is one short
line.

```
before   RPG1.oz.pZPJbhsxDIbv8xR6ATmidhGYg7cAadMgbRx0ucmSxhlkts7IsdunL5w6QH1se_0l8Pt…
                 …708 characters, and a QR of it is 117×117 modules

after    RPG2.AARYazlRGGwwSmQzS3g4dlRxUjJtTjdwWWJBNHdac3tMGp8i4w1YarHMR5Av2DVhrnQZ…
                 …110 characters, and the whole join link is 61×61 at error correction Q
```

That density difference is the entire point. 117×117 does not survive
being looked at through a video call — screen capture and a video
encoder smear fine chequered detail, because to an encoder that is
noise not worth spending bits on. 61×61 with a quarter of its capacity
spent on error correction reads first time.

## How the code got that small

An SDP for a data-channel connection is almost entirely boilerplate.
The only parts that vary are the ICE username fragment, the ICE
password, the DTLS fingerprint, the setup role, and the candidates —
an address and a port each. Deflate cannot exploit that, because it has
never seen an SDP before and has to learn the boilerplate from the 900
bytes in front of it.

So the new format sends those five things as packed binary and rebuilds
the rest. It also drops the mDNS host candidates — the UUID-and-`.local`
ones every browser now uses to hide your LAN addresses. They cost about
40 characters each to describe a route that cannot possibly exist
between two cities, and dropping them stops a code advertising how many
network adapters you have.

**Retained exactly as sent:** the fingerprint, the setup role, the SCTP
port, and max-message-size. Those are where browsers genuinely differ —
Chrome says 262144, Firefox says 1073741823 — and a wrong guess there
is a connection that fails an hour into a session.

## Why this is safe to take

Two things, and the second is the one that matters.

**It refuses rather than guesses.** `compact()` returns null on any SDP
shape it does not recognise — audio or video present, a fingerprint that
is not sha-256, no routable candidate gathered — and the caller emits
the old long code instead. The long form has no assumptions in it. A
code that is longer than it needed to be is a nuisance; a code that does
not work is the end of the evening. Four tests assert the refusal,
because a decline is silent by design and a regression that made it
guess would look exactly like success.

**Both formats decode, in both directions.** A Warden who has updated
can invite a player who has not, and the reverse. The two ends of a
handshake do not have to be the same version, which matters when they
are in different cities and only one of them has pulled.

I also verified it end to end rather than by inspection: built real
offers and answers with `node-datachannel` (a production WebRTC stack,
same libdatachannel core), compacted them, expanded them, fed the
rebuilt descriptions into the far peer, and confirmed the data channel
actually opened. It does.

**968 tests pass**, up from 944. Production build clean.

---

## Files

### New — 4 files

| Path | What it is |
|---|---|
| `src/net/rtcCompact.js` | The codec. Packs an SDP to ~70 bytes, rebuilds it, and declines when it should. |
| `src/net/joinLink.js` | Builds the scannable link and works out which base URL a remote player can actually reach. |
| `tests/rtccompact.test.js` | 24 tests. Round trips, browser variations, IPv6, mangled paste, and the refusals. |
| `UPDATE_2.12.0.md` | This file. |

### Replace — 5 files

| Path | Change |
|---|---|
| `src/net/rtcSignal.js` | Tries compact first, falls back to the old long form. Decodes both. Also accepts a pasted URL or a chat-wrapped code. |
| `src/net/RemotePanel.jsx` | The QR is the primary thing; the text code is one click away. |
| `src/net/RemoteJoin.jsx` | A scanned arrival answers immediately — no button to find. Can show its answer as a QR too. |
| `src/ui/QRCanvas.jsx` | Error correction is now a prop. Character handoff stays at `L`; remote invites use `Q`. |
| `tests/remoteapp.test.jsx` | The offer textarea moved behind a disclosure, so the test opens it. Matches either prefix now. |

### Untouched

`src/net/rtcPeer.js`, `useRtcJoin.js`, `useRtcHost.js`, `rtcRelay.js`,
`useSocket.js`. The transport, the handshake sequence and the protocol
are unchanged — this only alters how a description is written down.

No new dependencies. `qrcode` was already in `package.json` and already
in the bundle. **No `npm install` needed.**

---

## Where the QR points

`https://johms0976-cmyk.github.io/RPG-Engine/?mode=join#RPG2.…`

Two decisions worth knowing about.

**The base URL.** The Warden is usually on `http://localhost:8080`,
which means nothing to someone in another city, so their own address is
often exactly the wrong thing to put in a QR. `joinLink.js` picks, in
order: an override the Warden set, this page's own address if it is
publicly reachable, otherwise your GitHub Pages build. That middle case
matters — a Warden running `npm run tunnel` from the last update gets an
https address that works from anywhere, and their players will land on
the Warden's own copy rather than a public one that might be a version
ahead.

If you fork the repo, change `PUBLIC_APP_URL` at the top of
`src/net/joinLink.js`.

**The code is in the fragment, not the query string.** Everything after
`#` is never sent to a web server. GitHub Pages sees a request for the
page and nothing else — the code is not in an access log, not in a
referrer header, not in anything a CDN caches. Given it contains your
public IP address, that is worth the zero effort it costs.

---

## The half that is still a paste

The answer cannot be a QR code when the player is in another city —
there is nobody at their end to hold the phone up to. So it comes back
as text, through whatever chat you are already using.

That was the real argument for shrinking the codes rather than only
adding a QR: 110 characters pastes into a chat window without wrapping
and without anybody losing their place. 708 did not.

The join screen does offer an answer QR behind a toggle, for the case
where the Warden is in the room and can point something at the player's
screen.

## Try it

1. Drop the files in, keeping paths.
2. `npm run build`
3. Warden screen → **Someone is not in the building** → **Invite a player**.
4. Point a phone at the QR. It should open the join screen with the
   answer already being built.
5. Send that one line back, paste it into the Warden's box, connect.

The whole exchange should now be under thirty seconds per player,
against about three minutes before.
