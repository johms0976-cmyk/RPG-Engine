/* ============================================================
   REMOTE JOIN — a phone arriving from outside the building.

   The other half of RemotePanel's exchange: paste the Warden's
   offer, carry the answer back, wait for the door to open. The
   moment the answer exists, ClientShell is mounted underneath
   with the link — it sits at its own "connecting" state exactly
   as it does on a LAN while the relay comes up, and from there on
   nothing in the shell knows which transport it is standing on.

   Reached via ?mode=join, which is what makes the hosted static
   build a complete remote client: no table server, no install,
   just the page and a code.
   ============================================================ */
import React, { useState } from "react";
import { useRtcJoin } from "./useRtcJoin.js";
import ClientShell from "./ClientShell.jsx";
import "./net.css";

export default function RemoteJoin() {
  const rtc = useRtcJoin();
  const [paste, setPaste] = useState("");
  const [copied, setCopied] = useState(false);

  /* Connected: the shell owns the screen from here. The link is
     already carrying the relay's welcome — the shell drains it the
     moment it binds. */
  if (rtc.state === "open" || (rtc.link && rtc.state !== "closed" && rtc.state !== "ready")) {
    return <ClientShell rtcLink={rtc.link} />;
  }

  const copy = () => {
    try { navigator.clipboard && navigator.clipboard.writeText(rtc.answerCode); setCopied(true); }
    catch { /* select-and-copy still works */ }
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="join" style={{ maxWidth: 560, margin: "24px auto", padding: "0 12px" }}>
      <h1 style={{ fontFamily: "var(--display, sans-serif)", letterSpacing: "0.06em" }}>
        JOIN A REMOTE TABLE
      </h1>

      {!rtc.supported && (
        <div className="warn-box">
          This browser has no WebRTC, so it cannot make a direct connection.
        </div>
      )}

      {rtc.state === "idle" || rtc.state === "answering" ? (
        <div className="stack">
          <p style={{ fontSize: 14 }}>
            The Warden sends you an offer code. Paste it here.
          </p>
          <textarea
            rows={4}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="RPG1.o…"
            style={{ width: "100%", fontFamily: "monospace", fontSize: 11 }}
          />
          {rtc.error && <div className="warn-box">{rtc.error}</div>}
          <button
            type="button"
            className="btn accent"
            disabled={!paste.trim() || rtc.state === "answering" || !rtc.supported}
            onClick={() => rtc.begin(paste)}
          >
            {rtc.state === "answering" ? "Building your answer…" : "Answer it"}
          </button>
        </div>
      ) : rtc.state === "ready" ? (
        <div className="stack">
          <p style={{ fontSize: 14 }}>
            <strong>Send this answer code back to the Warden.</strong> When they
            paste it, you are in — this screen will change by itself.
          </p>
          <textarea
            readOnly
            rows={4}
            value={rtc.answerCode}
            onFocus={(e) => e.target.select()}
            style={{ width: "100%", fontFamily: "monospace", fontSize: 11 }}
          />
          <button type="button" className="btn accent" onClick={copy}>
            {copied ? "Copied" : "Copy answer code"}
          </button>
          <p style={{ fontSize: 12, opacity: 0.8 }}>
            Waiting for the Warden… if this sits for more than half a minute
            after they have pasted it, one of your networks is refusing a
            direct connection, and the honest fix is the same wifi.
          </p>
        </div>
      ) : (
        <div className="stack">
          <div className="warn-box">
            The connection dropped. A direct connection has no address to
            redial — ask the Warden for a fresh code and start again.
          </div>
          <button type="button" className="btn" onClick={() => location.reload()}>
            Start again
          </button>
        </div>
      )}

      <p style={{ fontSize: 11.5, opacity: 0.7, marginTop: 18 }}>
        Codes describe how to reach a browser — addresses and a certificate
        fingerprint, no game data. After the handshake, everything moves
        directly between your browser and the Warden's.
      </p>
    </div>
  );
}
