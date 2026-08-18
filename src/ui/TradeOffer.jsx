/* ============================================================
   TRADE OFFER — somebody is holding something out to you.

   `giveItem` was one tap and done, resolved instantly against
   whoever the sender picked from a list of similar names. In a
   firefight, at speed, that is how the vibe check ends up in the
   wrong hands and nobody notices for an hour.

   So an offer is now a thing with two ends. The receiver sees a
   card naming what and from whom, and takes it or does not.

   The ten-second auto-accept is the important compromise. Combat
   is exactly when passing something matters most and exactly
   when a second tap is a second nobody has — so the confirmation
   exists to catch mistakes, not to add ceremony, and it gets out
   of the way on its own if nobody objects. Declining is always
   available and always instant.
   ============================================================ */
import React, { useEffect, useState } from "react";
import { Btn } from "./kit.jsx";

export const AUTO_ACCEPT_MS = 10000;

export default function TradeOffer({ trade, items, crew, onAccept, onDecline, autoAccept = true }) {
  const [left, setLeft] = useState(Math.ceil(AUTO_ACCEPT_MS / 1000));

  useEffect(() => {
    if (!trade || !autoAccept) return undefined;
    setLeft(Math.ceil(AUTO_ACCEPT_MS / 1000));
    const tick = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    const done = setTimeout(() => onAccept && onAccept(trade.id), AUTO_ACCEPT_MS);
    return () => { clearInterval(tick); clearTimeout(done); };
  }, [trade, autoAccept, onAccept]);

  if (!trade) return null;
  const it = items[trade.itemId];
  const from = (crew || []).find((c) => c.id === trade.from);
  if (!it) return null;

  return (
    <div className="trade-scrim">
      <div className="trade-card" role="alertdialog" aria-modal="true"
        aria-label={`${from ? from.name : "Someone"} is handing you ${it.n}`}>
        <span className="trade-kicker">Held out to you</span>
        <strong className="trade-what">{it.n}</strong>
        <span className="trade-from">from {from ? from.name : "somebody"}</span>
        {it.d && <p className="trade-blurb">{it.d}</p>}

        <div className="btn-row">
          <Btn kind="primary" className="inline" onClick={() => onAccept && onAccept(trade.id)}>
            Take it
          </Btn>
          <Btn kind="ghost" className="inline" onClick={() => onDecline && onDecline(trade.id)}>
            Leave it
          </Btn>
        </div>

        {autoAccept && (
          <p className="trade-auto" aria-live="off">
            You take it in {left}s if you do nothing.
          </p>
        )}
      </div>
    </div>
  );
}
