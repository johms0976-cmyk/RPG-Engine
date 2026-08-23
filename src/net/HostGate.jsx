/* ============================================================
   HOST GATE — the screen for the tab the relay refused.

   Two of `useSocket`'s statuses are not connection problems, they
   are answers: `unauthorised` means this tab asked to be the
   Warden without the token, and `locked` means somebody else
   already is. Both used to be reported as twelve grey pixels at
   the far end of HostBar, next to four other pieces of numeric
   trivia, and both mean the evening does not start.

   So they get a screen. It renders only for those two statuses —
   `connecting`, `reconnecting` and `closed` are transient and a
   full-width red box for a socket that is about to come back is
   how you teach somebody to ignore a full-width red box.

   The instruction is the load-bearing part. "unauthorised" is not
   an instruction; "open this address on this machine, the one
   running the relay" is.
   ============================================================ */
import React from "react";

/** The token only ever leaves `/net/info` on the machine running the
    relay, so its presence here is itself the diagnosis: if we have
    one, this tab can fix itself with a link. */
const deckLink = (info) =>
  (info && info.token ? `${info.url}/?mode=host&token=${info.token}` : null);

export default function HostGate({ status, info }) {
  if (status !== "unauthorised" && status !== "locked") return null;

  const url = deckLink(info);

  return (
    <div className="join" style={{ maxWidth: 640 }} role="alert">
      <div className="note-box note-bad">
        {status === "locked" ? (
          <>
            <strong>Another tab is already the Warden.</strong>
            <p style={{ margin: "6px 0" }}>
              Only one deck can hold the table at a time — that is the
              invariant the whole engine rests on, not a limitation, so
              this tab will not take it from the other one.
            </p>
            <p style={{ margin: "6px 0" }}>
              Find the tab or device that already has the deck and use
              that. If it is gone for good, close it properly (or restart
              the relay) and reload here.
            </p>
          </>
        ) : (
          <>
            <strong>This tab is not the Warden.</strong>
            <p style={{ margin: "6px 0" }}>
              It asked for the deck without the token, so the relay refused
              it. Nothing is broken and nobody has lost anything — this
              screen simply is not allowed to see where the creature is.
            </p>
            <p style={{ margin: "6px 0" }}>
              {url ? (
                <>
                  The deck is at <code>{url}</code> — open that. This link
                  only appears on the machine actually running the relay.
                </>
              ) : (
                <>
                  Open the deck on the machine running the relay: it prints
                  the address, with the token on it, when it starts. A phone
                  cannot become the Warden by adding{" "}
                  <code>?mode=host</code> to the join address, which is the
                  point.
                </>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
