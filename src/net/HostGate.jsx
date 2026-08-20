/* ============================================================
   HOST GATE — what the Warden's screen shows when the relay
   refused to let it be the Warden.

   §9.1 made `?role=host` an authenticated upgrade, and that was
   right: newest-wins on an unauthenticated claim meant anybody on
   the wifi could take the table. But the deck was never given a
   way to *say* it had been refused. useHost computed `needsToken`,
   `tokenLocked`, `hostToken` and `setHostToken`, and not one of
   them was rendered anywhere in the app.

   So the failure looked like this: the Warden opens the screen at
   the LAN address — which is what server/host.mjs prints and what
   `npm run doctor` recommends — the token is absent, because the
   token only goes to loopback, the socket is refused and closed,
   and the top bar says "no phones connected" in the same grey it
   uses when the table simply hasn't arrived yet. Meanwhile every
   phone connects to the relay perfectly, gets no snapshot because
   there is no host sending one, and sits on "Waiting for the
   Warden" indefinitely. Both halves of the table are convinced
   the other half is broken.

   Nothing here is new machinery. It is the missing screen for a
   state the code already knew it was in.
   ============================================================ */
import React, { useState } from "react";
import { Panel, Btn, Field } from "../ui/kit.jsx";
import { rememberHostToken, forgetHostToken, savedHostToken } from "./session.js";

/** `::1` arrives bracketed in a URL and bare from a socket. */
const LOOPBACK = /^(localhost|127(\.\d+){1,3}|\[?::1\]?)$/i;
export const onLoopback = (h) => LOOPBACK.test(String(h || ""));

/* The URL the Warden should have used, if they are on the machine
   running the relay and simply typed the wrong address. Built from
   the port we are actually on rather than assuming 8080, because
   PORT= is a documented override. */
const loopbackUrl = () =>
  `http://localhost:${location.port || 80}/?mode=host`;

/**
 * @param status  useSocket's status, straight off useHost
 * @param info    /net/info, or null if it never answered
 */
export default function HostGate({ status, info }) {
  const [typed, setTyped] = useState("");
  const here = location.hostname;
  const local = onLoopback(here);
  const saved = savedHostToken();
  const fromUrl = new URLSearchParams(location.search).get("token");

  // Anything other than a refusal is not this component's business.
  // A slow or dropped socket is already described by the top bar.
  if (status !== "unauthorised" && status !== "locked") return null;

  /* Put it in the URL as well as in storage. The URL is checked
     first by resolveHostToken, so this is the one placement that
     cannot be beaten by something stale — and it makes the address
     bar itself the thing you send to a tablet. */
  const apply = (t) => {
    const token = String(t || "").trim().toLowerCase();
    if (!token) return;
    rememberHostToken(token);
    const u = new URL(location.href);
    u.searchParams.set("mode", "host");
    u.searchParams.set("token", token);
    location.replace(u.toString());
  };

  /* The stale-bookmark escape hatch. A `?token=` from last week
     outranks the fresh one /net/info is offering, so a Warden on
     the right machine can be locked out by their own shortcut.
     Clearing both and reloading puts them back on the automatic
     path. */
  const clearAndRetry = () => {
    forgetHostToken();
    const u = new URL(location.href);
    u.searchParams.delete("token");
    u.searchParams.set("mode", "host");
    location.replace(u.toString());
  };

  if (status === "locked") {
    return (
      <div className="join" style={{ maxWidth: 640 }}>
        <Panel title="This device is locked out of the Warden role">
          <div className="stack">
            <p style={{ margin: 0 }}>
              The relay refused ten host connections from this address and has
              stopped answering them. That counter only resets when the server
              restarts.
            </p>
            <div className="note-box">
              Stop the server (Ctrl-C) and run <code>npm run host</code> again.
              It will print a fresh <strong>Warden token</strong>. Nobody has to
              rejoin — the phones reattach on their own.
            </div>
            <p className="clue-meta" style={{ margin: 0 }}>
              This is a lockout, not a network problem. The phones can still
              reach the server; there is just nothing for them to talk to.
            </p>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="join" style={{ maxWidth: 640 }}>
      <Panel title="This screen is not the Warden yet">
        <div className="stack">
          <p style={{ margin: 0 }}>
            The table server is running and phones can reach it — but it would
            not accept this tab as the Warden, so nothing is being sent to
            them. That is why the bar says no phones are connected and why
            every handset is waiting.
          </p>

          {!local && (
            <div className="note-box">
              <strong>The quickest fix:</strong> the Warden screen picks up its
              token by itself only on the machine running the server. On that
              machine, open{" "}
              <code>{loopbackUrl()}</code> instead of the address you are on
              now. Phones keep using{" "}
              <code>{info ? info.url : "the LAN address"}</code>.
            </div>
          )}

          {local && (fromUrl || saved) && (
            <div className="note-box">
              This tab is on the server&apos;s own machine, so it should have
              collected the token automatically — but it is using{" "}
              {fromUrl ? "a token from the address bar" : "a saved token"}{" "}
              instead, and that one is no longer current. The server generates a
              new token every time it starts.
              <div className="btn-row" style={{ marginTop: 8 }}>
                <button type="button" className="btn inline small accent"
                  onClick={clearAndRetry}>
                  Forget it and use this machine&apos;s token
                </button>
              </div>
            </div>
          )}

          <Field label="Or type the Warden token">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="k7m3qxrf"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={64}
              style={{ font: "700 16px var(--mono, monospace)", letterSpacing: ".12em" }}
              onKeyDown={(e) => { if (e.key === "Enter") apply(typed); }}
            />
          </Field>
          <p className="clue-meta" style={{ margin: 0 }}>
            It is the eight characters the terminal printed after{" "}
            <strong>Warden token :</strong> when the server started. Players
            never need it and never see it.
          </p>

          <Btn kind="primary" disabled={!typed.trim()} onClick={() => apply(typed)}>
            Take the Warden&apos;s chair
          </Btn>

          <p className="clue-meta" style={{ margin: 0 }}>
            Ten wrong attempts from one device locks that device out until the
            server is restarted, so check the characters rather than guessing.
          </p>
        </div>
      </Panel>
    </div>
  );
}
