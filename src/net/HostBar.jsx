/* ============================================================
   HOST BAR — the strip across the top of the Warden's screen.
   Join address, who is connected, what they just did, and the
   Warden/Table toggle.

   The activity ticker is the desk-side half of the "nothing seems
   to be happening" problem. Player actions do land in the feed,
   but during play the Warden is reading the room, not the log, and
   four people acting at once produces a wall of text with no sense
   of who is waiting on a response. Six words per action, newest
   first, is enough to look up and say "right, Riley, the showers."

   ------------------------------------------------------------
   WHY THE BAR USED TO SAY THE WRONG THING

   "no phones connected" was rendered whenever `peers` was empty,
   and `peers` is empty for two completely different reasons: the
   table has not arrived yet, or this tab never got a socket at
   all. The second is the one that ruins an evening, and it was
   being reported in the same grey as the first, with the real
   answer — `relay: unauthorised` — in 12px at the far end of the
   bar past the QR button.

   The bar now distinguishes them, and HostGate below it says what
   to do about it. Same information the code already had; it just
   was not on the screen anybody was looking at.
   ============================================================ */
import React, { useEffect, useState } from "react";
import { Btn, Modal } from "../ui/kit.jsx";
import HostGate from "./HostGate.jsx";
// The Warden's screen needs the ticker styles too. CSS imports are global,
// so this also gives the desktop the nested-scroller fix in phone.css.
import "../ui/phone.css";

/** An entry younger than this is highlighted. Long enough to catch
    your eye if you glanced away, short enough that the bar isn't
    permanently shouting. */
const FRESH_MS = 4000;

/** What each socket state means to a person, rather than to a socket. */
const RELAY_TEXT = {
  connecting: "connecting to the relay…",
  reconnecting: "reconnecting to the relay…",
  closed: "not connected to the relay",
  unauthorised: "NOT THE WARDEN — see below",
  locked: "LOCKED OUT — see below",
};

function Activity({ activity }) {
  // Re-render on a slow tick so entries stop being "new" on their own.
  const [, setNow] = useState(0);
  useEffect(() => {
    if (!activity || !activity.length) return undefined;
    const t = setInterval(() => setNow((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [activity && activity.length]);

  if (!activity || !activity.length) {
    return <span className="host-activity-empty">nothing from the phones yet</span>;
  }

  return (
    <span className="host-activity" aria-live="polite" aria-label="Recent player actions">
      {activity.slice(0, 4).map((a) => (
        <span key={a.id} className={`act ${Date.now() - a.at < FRESH_MS ? "is-new" : ""}`}>
          <b>{a.who}</b> · {a.what.toLowerCase()}
        </span>
      ))}
    </span>
  );
}

export default function HostBar({
  view, onView, status, peers, crew,
  pending = 0, distorted = 0, activity = [], onWhisper,
}) {
  const [info, setInfo] = useState(null);
  const [showQr, setShowQr] = useState(false);
  const [whisperTo, setWhisperTo] = useState(null);
  const [text, setText] = useState("");

  useEffect(() => {
    fetch("/net/info", { cache: "no-store" })
      .then((r) => r.json()).then(setInfo).catch(() => setInfo(null));
  }, []);

  const named = (peers || []).map((p) => {
    const pc = p.pcId && (crew || []).find((c) => c.id === p.pcId);
    return { ...p, label: pc ? pc.name : "choosing…" };
  });

  const attached = status === "open";
  /* Only ever non-empty on the machine running the relay, because
     that is the only place /net/info parts with the token. It is
     exactly what a Warden needs to move the deck to a tablet, and
     it was previously only obtainable by reading the terminal. */
  const deckUrl = info && info.token
    ? `${info.url}/?mode=host&token=${info.token}`
    : null;

  return (
    <>
      <div className="host-bar">
        <span className="host-bar-url">{info ? info.url.replace(/^https?:\/\//, "") : "…"}</span>
        <Btn onClick={() => setShowQr(true)}>Show QR</Btn>
        <span className="host-bar-peers">
          {!attached
            ? <strong style={{ color: "#F0997B" }}>{RELAY_TEXT[status] || status}</strong>
            : named.length === 0
              ? "no phones connected"
              : named.map((p) => (
                  <button key={p.clientId} className="host-peer"
                    title={`Whisper to ${p.name}`}
                    onClick={() => { setWhisperTo(p); setText(""); }}>
                    {p.name} → {p.label}
                  </button>
                ))}
        </span>
        {/* NO ROUTE TO THE DECK WHEN NOBODY IS THE WARDEN.

            `onView` is null in that mode and the switcher does not
            render — not disabled, not hidden by CSS, absent. The
            person whose iPad this is must not be one tap from
            knowing where the creature is while they are also
            playing. See the comment on `tableMode` in App.jsx. */}
        {onView && (
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Btn kind={view === "warden" ? "primary" : "default"} onClick={() => onView("warden")}>Warden</Btn>
            <Btn kind={view === "table" ? "primary" : "default"} onClick={() => onView("table")}>Table</Btn>
            <Btn kind={view === "board" ? "primary" : "default"} onClick={() => onView("board")}>
              Board{pending ? ` · ${pending}` : ""}
            </Btn>
          </span>
        )}
        {distorted > 0 && (
          <span className="sig sig-secret" title="Players receiving a false picture">
            {distorted} being lied to
          </span>
        )}
      </div>

      {/* Second row, so a busy table doesn't push the QR button off screen. */}
      {attached && named.length > 0 && (
        <div className="host-bar" style={{ paddingTop: 6, paddingBottom: 6, borderBottomWidth: 1 }}>
          <Activity activity={activity} />
        </div>
      )}

      {/* THE MISSING SCREEN. Renders itself only when the relay has
          actually refused this tab — see HostGate.jsx. */}
      <HostGate status={status} info={info} />

      {/* A Warden whose deck is attached but whose table has not
          arrived gets the one instruction that matters, rather than
          having to guess whether "no phones connected" is a problem. */}
      {attached && named.length === 0 && (
        <div className="join" style={{ maxWidth: 640 }}>
          <div className="note-box">
            <strong>Connected as the Warden. Waiting for phones.</strong>
            <div style={{ margin: "6px 0" }}>
              Same wifi, then <code>{info ? info.url : "…"}</code> — no{" "}
              <code>?mode=host</code> on a phone, that is this screen&apos;s
              address only.
            </div>
          </div>
        </div>
      )}

      {whisperTo && (
        <Modal title={`Whisper to ${whisperTo.name}`} onClose={() => setWhisperTo(null)}>
          <p style={{ marginTop: 0 }}>
            Only this phone receives it. It arrives as a card they have to
            dismiss, so it will not scroll past unread. Nothing appears on the
            table screen or in anyone else&apos;s log.
          </p>
          <input
            autoFocus value={text} onChange={(e) => setText(e.target.value)}
            style={{ width: "100%", padding: 10, font: "inherit" }}
            placeholder="You notice the locker was already open."
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim()) {
                onWhisper(whisperTo.clientId, text.trim());
                setWhisperTo(null);
              }
            }}
          />
          <Btn kind="primary" disabled={!text.trim()} onClick={() => {
            onWhisper(whisperTo.clientId, text.trim());
            setWhisperTo(null);
          }}>Send</Btn>
        </Modal>
      )}

      {showQr && (
        <Modal title="Join the table" onClose={() => setShowQr(false)}>
          <div className="host-qr">
            <img src="/net/qr.svg" alt="QR code linking to the join address" />
            <div>
              <p style={{ marginTop: 0 }}>Same wifi, then scan this or type:</p>
              <p className="host-bar-url">{info ? info.url : "…"}</p>
              {info && info.addresses && info.addresses.length > 1 && (
                <p style={{ fontSize: 12, opacity: 0.75 }}>
                  If that doesn&apos;t load, this machine also answers on{" "}
                  {info.addresses.slice(1).map((a) => a.address).join(", ")}.
                </p>
              )}
            </div>
          </div>

          {/* MOVING THE DECK, WITHOUT READING THE TERMINAL.

              `?mode=host` on its own cannot authenticate from anywhere
              but this machine, and a Warden who pastes the plain LAN
              address into a tablet gets a silently refused socket. The
              token has to travel with it. */}
          {deckUrl && (
            <div className="note-box" style={{ marginTop: 12 }}>
              <strong>Running the Warden screen on another device?</strong>
              <p className="host-bar-url" style={{ wordBreak: "break-all", margin: "6px 0" }}>
                {deckUrl}
              </p>
              <div className="btn-row">
                <button type="button" className="btn inline small ghost"
                  onClick={() => { try { navigator.clipboard.writeText(deckUrl); } catch { /* no clipboard */ } }}>
                  Copy
                </button>
              </div>
              <p className="clue-meta" style={{ margin: "6px 0 0" }}>
                That link carries the Warden token. Do not hand it to a player,
                and do not bookmark it — the token changes every time the server
                restarts.
              </p>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
