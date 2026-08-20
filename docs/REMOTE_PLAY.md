# Remote play

The LAN relay assumes everyone is in one building. This is the other case.

## The two transports

| | **Relay** (LAN) | **Direct** (RTC) |
|---|---|---|
| Everyone on one wifi | Required | No |
| Something to run | `npm run host` | Nothing, after the handshake |
| Game state on a server | Never | Never |
| Third-party contact | None | STUN, during connection only |
| `dark` peer whispers | Yes | **No — see below** |
| Setup | Scan a QR code | Swap a code per player |

Neither puts game state on a server. The difference is who does the routing: the relay on a LAN,
and the Warden's own browser over a direct connection.

## How the handshake works

WebRTC needs both ends to swap a session description before a connection exists. That swap is the
one thing peer-to-peer cannot do peer-to-peer, which is why every "serverless" WebRTC demo still
has a server somewhere.

The manual exchange avoids one by making the table carry the codes themselves, in whatever they
already use to talk — a group chat, a voice call, an email:

1. The Warden generates an **offer code** for a player and sends it to them.
2. The player pastes it in, gets an **answer code** back, and sends that to the Warden.
3. The Warden pastes the answer. Connected.

Two pastes per player, so eight for a table of four. It is tedious and it needs nothing running,
which is the trade. An assisted path — one room code, a small stateless signalling service — is
defined as an interface in `rtcSignal.js` and not implemented, because implementing it means
running something.

### What a connection code contains

A session description, compressed. Candidate addresses, ports, and the fingerprint of the
certificate that will secure the channel.

It contains **no game state, no character, no name and no token**. It is not a password. It does
contain your local and public IP addresses, which is worth knowing before pasting one into a
public channel.

### STUN

A browser cannot discover its own public address without asking something outside the network.
Two public STUN servers are used for that, and only that: STUN is asked what an address looks like
from outside, carries no game data, and never sees traffic.

This is the **only** third-party contact anywhere in the engine, it happens only when a table
chooses remote play, and `tests/offline.test.js` asserts it comes from exactly one file.

There is deliberately **no TURN server**. TURN relays the actual session through a third party,
which is precisely what this transport exists to avoid. The cost is real: a table behind two
symmetric NATs may fail to connect, and will be told so rather than left hanging.

## The one thing that does not survive the move

The table can choose how much of a player-to-player whisper the Warden sees:

| | What it means | Relay | Direct |
|---|---|---|---|
| `open` | The Warden sees the text | Yes | Yes |
| `seen` | The Warden knows it happened, and between whom | Yes | Yes |
| `dark` | The Warden is told nothing at all | Yes | **No** |

**`dark` is refused over a direct connection, not quietly honoured.**

On the relay, `dark` was never a policy — it was structural. `useHost.js` puts it plainly: the
filtering happens on the relay because "what never leaves the relay cannot be displayed, logged or
leaked by a bug upstream", and "this codebase does not do promises". The words physically did not
reach the Warden's machine.

Over a direct connection the Warden's browser **is** the router. Every whisper passes through that
process by construction. Keeping the name while the text sits in the host tab's memory would
convert a structural guarantee into exactly the promise the original refuses to make — and a table
might agree to something on the strength of it.

So `requestPeerMode("dark")` returns `seen` and reports the downgrade, and the UI is expected to
tell the table before they rely on it. **A table that needs true `dark` needs the LAN relay.**

## Architecture

```
rtcSignal.js   codes in and out; the Signaller interface for a future assisted path
rtcPeer.js     one RTCPeerConnection and one ordered data channel, shaped like a socket
rtcRelay.js    server/host.mjs, ported into the host tab: ids, roster, routing, filtering
useSocket.js   picks a transport; both present { status, send } so callers never learn which
```

`rtcRelay.js` is a pure router — no React, no RTCPeerConnection, no timers. It takes ports,
anything with a `send()`. That is what makes it testable without WebRTC, and what would let it sit
on a different transport later without being rewritten.

It is a port of `server/host.mjs`, and the two must agree. `tests/rtcrelay.test.js` is what keeps
them honest: client ids assigned by the router rather than claimed, one character to one phone,
intents refused when they claim to be somebody else, the safety card arriving with no identity
attached, addressed messages dropped unless declared in `HOST_TO_CLIENT`.

## Status

The transport layer, the codec and the router are implemented and tested. What is **not** yet
built is the Warden-facing screen that walks a table through the exchange, and the `useHost`
integration that drives it. Until those land, remote play is reachable from code but not from the
interface.
