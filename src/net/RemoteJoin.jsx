/* ============================================================
   REMOTE JOIN — a phone arriving from outside the building.

   The other half of RemotePanel's exchange. The moment the
   answer exists, ClientShell is mounted underneath with the link
   — it sits at its own "connecting" state exactly as it does on
   a LAN while the relay comes up, and from there on nothing in
   the shell knows which transport it is standing on.

   Reached via ?mode=join, which is what makes the hosted static
   build a complete remote client: no table server, no install,
   just the page and a code.

   ------------------------------------------------------------
   ARRIVING BY SCAN

   If the address has an offer in its fragment — which is what
   the Warden's QR code contains — there is nothing to ask. The
   person pointed a camera at a screen and is now holding a
   phone; making them find and press a button called "Answer it"
   is a step that exists only because the code used to arrive by
   paste.

   So a scanned arrival answers immediately, and the first thing
   on screen is the line that has to go back. The paste box is
   still the whole interface for anyone who arrived by link or by
   chat message.

   The code is stripped out of the address bar once consumed.
   Reloading the page would otherwise re-answer an offer that has
   already been used, and the failure mode of that is a player
   staring at an answer the Warden's screen will never accept.
   ============================================================ */
import React, { useEffect, useRef, useState } from "react";
import { useRtcJoin } from "./useRtcJoin.js";
import { offerFromLocation, clearOfferFromLocation } from "./joinLink.js";
import ClientShell from "./ClientShell.jsx";
import QRCanvas from "../ui/QRCanvas.jsx";
import "./net.css";

export default function RemoteJoin() {
  const rtc = useRtcJoin();
  const [paste, setPaste] = useState("");
  const [copied, setCopied] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [showAnswerQR, setShowAnswerQR] = useState(false);
  const started = useRef(false);

  /* One shot, on arrival. `started` rather than a dependency list
     because rtc.begin is stable but the offer must not be answered
     twice if anything above re-renders. */
  useEffect(() => {
    if (started.current) return;
    const offer = offerFromLocation();
    if (!offer) return;
    started.current = true;
    setScanned(true);
    clearOfferFromLocation();
    rtc.begin(offer);
  }, [rtc]);

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

      {rtc.state === "answering" && scanned ? (
        <div className="stack">
          <p style={{ fontSize: 14 }}>Invite received. Building your answer…</p>
        </div>
      ) : rtc.state === "idle" || rtc.state === "answering" ? (
        <div className="stack">
          <p style={{ fontSize: 14 }}>
            The Warden's screen shows a QR code. Point your camera at it and
            this page opens by itself, already holding the invite.
          </p>
          <p style={{ fontSize: 14 }}>
            Can't scan it — joining from a laptop, or no call running? Paste
            the code or the link they sent you.
          </p>
          <textarea
            rows={3}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="RPG2… or the whole link"
            style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }}
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
            <strong>Send this line back to the Warden.</strong> When they paste
            it, you are in — this screen will change by itself.
          </p>
          <textarea
            readOnly
            rows={3}
            value={rtc.answerCode}
            onFocus={(e) => e.target.select()}
            style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }}
          />
          <button type="button" className="btn accent" onClick={copy}>
            {copied ? "Copied" : "Copy answer"}
          </button>

          {/* The answer cannot travel by QR to another city — nobody is
              there to look at this screen. It can when the two of you are
              in the same room and the Warden has a webcam or a phone, so
              it is here, folded away. */}
          <button
            type="button"
            className="btn ghost"
            onClick={() => setShowAnswerQR((v) => !v)}
          >
            {showAnswerQR ? "Hide QR" : "Show as a QR code"}
          </button>
          {showAnswerQR && (
            <>
              <QRCanvas text={rtc.answerCode} size={240} level="Q" alt="Answer code" />
              <p style={{ fontSize: 12, opacity: 0.75, textAlign: "center", margin: 0 }}>
                Only useful if the Warden is in the room and can point
                something at your screen.
              </p>
            </>
          )}

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
