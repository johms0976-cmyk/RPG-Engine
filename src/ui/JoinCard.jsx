/* ============================================================
   THE JOIN CARD — the first impression, and currently a URL read
   out loud.

   Six phones is six chances for onboarding to fail, and it does
   not only fail at the start: somebody arrives late, somebody's
   battery dies and comes back on a charger, somebody's browser
   discards the tab during act two. Every one of those needs the
   address again, and the recovery today is the person at the PC
   reading numbers across a room.

   So this is reachable from any phase, over the top of whatever
   is on screen, and it goes away on any key.

   THREE THINGS AND THEY ARE ALL SIZED FOR THE SOFA.

   The code, large. A QR read from three metres has to be
   physically large — the 240px default in QRCanvas is marginal at
   1.5m and hopeless at 3m — so it is a fraction of screen height
   rather than a pixel count, which is the same reasoning as the
   rest of tv.css.

   The address, larger. Someone's camera will not focus, and the
   fallback for a failed scan must not be a conversation.

   The count, so the room can see who is still not in without
   anybody having to ask "is everyone in?" — which is a question
   that gets a wrong answer roughly every time.
   ============================================================ */
import React, { useEffect, useState } from "react";
import "./tv.css";

export default function JoinCard({ peers = [], expected = 0, onClose }) {
  /* Fetched here rather than passed down. Only the machine running
     the relay answers this, and it is one request against localhost
     at the moment somebody asks for the card — not something worth
     threading through App for. */
  const [info, setInfo] = useState(null);
  useEffect(() => {
    let live = true;
    fetch("/net/info", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => live && setInfo(d))
      .catch(() => live && setInfo(null));
    return () => { live = false; };
  }, []);

  /* Any key, and a click. It is a card somebody put up on purpose,
     so getting rid of it should not require finding a target. */
  useEffect(() => {
    if (!onClose) return undefined;
    const key = () => onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  const url = info ? info.url.replace(/^https?:\/\//, "") : null;
  const inCount = peers.length;
  const others = info && info.addresses ? info.addresses.slice(1) : [];

  return (
    <div className="tv-join" role="dialog" aria-label="Join the table" onClick={onClose}>
      <div className="tv-join-code">
        {/* Served by host.mjs, so there is no encoder in this path and
            nothing to lazy-load in front of a room that is waiting. */}
        <img src="/net/qr.svg" alt="QR code for the join address" />
      </div>

      <div className="tv-join-url">{url || "starting…"}</div>

      <div className="tv-join-hint">
        Same wifi. Scan the code, or type that into a browser.
        No app, no account, and nothing to install.
      </div>

      {others.length > 0 && (
        <div className="tv-join-alt">
          also on {others.map((a) => a.address).join(" · ")}
        </div>
      )}

      <div className="tv-join-count">
        {inCount === 0
          ? "nobody in yet"
          : expected > 0
            ? `${inCount} of ${expected} in`
            : `${inCount} in`}
      </div>

      <div className="tv-join-dismiss">press any key</div>
    </div>
  );
}
