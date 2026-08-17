/* ============================================================
   HOST BAR — the strip across the top of the Warden's screen.
   Join address, who is connected, and the Warden/Table toggle.
   ============================================================ */
import React, { useEffect, useState } from "react";
import { Btn, Modal } from "../ui/kit.jsx";

export default function HostBar({ view, onView, status, peers, crew, pending = 0, distorted = 0, onWhisper }) {
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

      {whisperTo && (
        <Modal title={`Whisper to ${whisperTo.name}`} onClose={() => setWhisperTo(null)}>
          <p style={{ marginTop: 0 }}>
            Only this phone receives it. Nothing appears on the table screen or in
            anyone else's log.
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
