/* ============================================================
   HOST BAR — the strip across the top of the Warden's screen.
   Join address, who is connected, what they just did, and the
   Warden/Table toggle.

   The activity ticker is new and is the desk-side half of the
   "nothing seems to be happening" problem. Player actions do land
   in the feed, but during play the Warden is reading the room,
   not the log, and four people acting at once produces a wall of
   text with no sense of who is waiting on a response. Six words
   per action, newest first, is enough to look up and say "right,
   Riley, the showers."
   ============================================================ */
import React, { useEffect, useState } from "react";
import { Btn, Modal } from "../ui/kit.jsx";
// The Warden's screen needs the ticker styles too. CSS imports are global,
// so this also gives the desktop the nested-scroller fix in phone.css.
import "../ui/phone.css";

/** An entry younger than this is highlighted. Long enough to catch
    your eye if you glanced away, short enough that the bar isn't
    permanently shouting. */
const FRESH_MS = 4000;

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
    fetch("/net/info").then((r) => r.json()).then(setInfo).catch(() => setInfo(null));
  }, []);

  const named = (peers || []).map((p) => {
    const pc = p.pcId && (crew || []).find((c) => c.id === p.pcId);
    return { ...p, label: pc ? pc.name : "choosing…" };
  });

  return (
    <>
      <div className="host-bar">
        <span className="host-bar-url">{info ? info.url.replace(/^https?:\/\//, "") : "…"}</span>
        <Btn onClick={() => setShowQr(true)}>Show QR</Btn>
        <span className="host-bar-peers">
          {named.length === 0
            ? "no phones connected"
            : named.map((p) => (
                <button key={p.clientId} className="host-peer"
                  title={`Whisper to ${p.name}`}
                  onClick={() => { setWhisperTo(p); setText(""); }}>
                  {p.name} → {p.label}
                </button>
              ))}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Btn kind={view === "warden" ? "primary" : "default"} onClick={() => onView("warden")}>Warden</Btn>
          <Btn kind={view === "table" ? "primary" : "default"} onClick={() => onView("table")}>Table</Btn>
          <Btn kind={view === "board" ? "primary" : "default"} onClick={() => onView("board")}>
            Board{pending ? ` · ${pending}` : ""}
          </Btn>
        </span>
        {distorted > 0 && (
          <span className="sig sig-secret" title="Players receiving a false picture">
            {distorted} being lied to
          </span>
        )}
        {status !== "open" && <span className="host-bar-url">relay: {status}</span>}
      </div>

      {/* Second row, so a busy table doesn't push the QR button off screen. */}
      {named.length > 0 && (
        <div className="host-bar" style={{ paddingTop: 6, paddingBottom: 6, borderBottomWidth: 1 }}>
          <Activity activity={activity} />
        </div>
      )}

      {whisperTo && (
        <Modal title={`Whisper to ${whisperTo.name}`} onClose={() => setWhisperTo(null)}>
          <p style={{ marginTop: 0 }}>
            Only this phone receives it. It arrives as a card they have to
            dismiss, so it will not scroll past unread. Nothing appears on the
            table screen or in anyone else's log.
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
                  If that doesn't load, this machine also answers on{" "}
                  {info.addresses.slice(1).map((a) => a.address).join(", ")}.
                </p>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
