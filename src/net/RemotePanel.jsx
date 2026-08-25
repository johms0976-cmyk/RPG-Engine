/* ============================================================
   THE REMOTE TABLE — the Warden's side of the exchange.

   One card per invited player, walking the manual handshake:
   show a code, they scan it, paste their answer back, connected.
   The copy is written for the person carrying codes through a
   group chat, because that person is mid-conversation with four
   other people and will paste the wrong thing at least once.

   ------------------------------------------------------------
   WHY THE QR IS THE PRIMARY THING NOW

   The offer used to be seven hundred characters in a textarea,
   and the only way to move it was to copy it into a chat window
   and hope nothing wrapped it. That works, and it is miserable,
   and it is three minutes of the session gone per player.

   The realistic remote setup is a video call with the Warden's
   screen shared. In that setup a QR code is not a convenience,
   it is the shortest path there is: the player points a phone at
   their own monitor, the app opens with the offer already in it,
   and the only thing that has to come back is one short line.

   The code had to get smaller before that could work — a QR of
   the old seven-hundred-character offer is too dense to survive
   a video encoder. See rtcCompact.js.

   The text is still here, one click away, because a table
   without a video call still needs it and because "scan this"
   is useless to somebody joining from a laptop.

   ------------------------------------------------------------
   Two disclosures live here rather than in a doc nobody opens,
   because they are the two things a table would want to have
   been told:

     · a code contains your network addresses
     · `dark` whispers do not exist on this transport
   ============================================================ */
import React, { useState } from "react";
import { Panel, Btn, Label } from "../ui/kit.jsx";
import { RTC_CAPABILITIES } from "./rtcRelay.js";
import { joinLink } from "./joinLink.js";
import QRCanvas from "../ui/QRCanvas.jsx";

function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through */ }
  return false;
}

/** One invite, at whatever stage it has reached. */
function Slot({ slot, index, onAnswer, onDrop }) {
  const [paste, setPaste] = useState("");
  const [copied, setCopied] = useState(null);
  const [showText, setShowText] = useState(false);

  const link = slot.code ? joinLink(slot.code) : "";

  const doCopy = (what, text) => {
    if (copyText(text)) {
      setCopied(what);
      setTimeout(() => setCopied(null), 1600);
    }
  };

  return (
    <div className="clue" style={{ display: "block" }}>
      <span className="clue-kind">
        player {index + 1} · {
          { making: "building the code…", offered: "waiting for their answer",
            connecting: "connecting…", connected: "at the table",
            gone: "dropped", failed: "failed" }[slot.state]
        }
      </span>

      {slot.state === "offered" && (
        <div className="stack" style={{ marginTop: 8 }}>
          <Label>1 · THEY POINT A PHONE AT THIS</Label>

          {/* Level Q, because this is very often being read off a
              shared screen through a video call, and a video encoder
              treats fine chequered detail as noise. */}
          <QRCanvas
            text={link}
            size={280}
            level="Q"
            alt={`Join code for player ${index + 1}`}
          />

          <p className="clue-meta" style={{ margin: 0, textAlign: "center" }}>
            Sharing your screen on a call? They can scan it straight off
            their own monitor. It opens the game with this invite already
            loaded.
          </p>

          <div className="btn-row">
            <Btn kind="accent" className="inline small" onClick={() => doCopy("link", link)}>
              {copied === "link" ? "Copied" : "Copy link instead"}
            </Btn>
            <Btn kind="ghost" className="inline small" onClick={() => setShowText((v) => !v)}>
              {showText ? "Hide code" : "Show code"}
            </Btn>
          </div>

          {showText && (
            <>
              <Label>OR SEND THEM THIS CODE</Label>
              <textarea
                readOnly
                rows={2}
                value={slot.code}
                onFocus={(e) => e.target.select()}
                style={{ fontFamily: "var(--mono)", fontSize: 11 }}
              />
              <div className="btn-row">
                <Btn kind="ghost" className="inline small" onClick={() => doCopy("code", slot.code)}>
                  {copied === "code" ? "Copied" : "Copy code"}
                </Btn>
              </div>
              <p className="clue-meta" style={{ margin: 0 }}>
                For a player joining on a laptop, or a table with no call
                running. They paste it into the join screen at the link above.
              </p>
            </>
          )}

          <Label>2 · PASTE THE ANSWER THEY SEND BACK</Label>
          <textarea
            rows={2}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="RPG2…"
            style={{ fontFamily: "var(--mono)", fontSize: 11 }}
          />
          <p className="clue-meta" style={{ margin: 0 }}>
            One short line, from their screen into your chat and then into
            this box. This is the half that cannot be a QR code — they are
            not in the room to hold it up.
          </p>
          <div className="btn-row">
            <Btn kind="solid" className="inline small" disabled={!paste.trim()}
              onClick={() => onAnswer(slot.id, paste)}>
              Connect
            </Btn>
            <Btn kind="ghost" className="inline small" onClick={() => onDrop(slot.id)}>
              Withdraw
            </Btn>
          </div>
        </div>
      )}

      {slot.state === "connecting" && (
        <p className="clue-meta" style={{ margin: "6px 0 0" }}>
          Shaking hands. This takes a few seconds; if it sits here past
          half a minute, one of you is behind a network that will not
          allow a direct connection.
        </p>
      )}

      {slot.state === "connected" && (
        <p className="clue-meta" style={{ margin: "6px 0 0" }}>
          Connected. They appear in the phones list like anybody on the wifi.
        </p>
      )}

      {(slot.state === "gone" || slot.state === "failed") && (
        <div style={{ marginTop: 6 }}>
          {slot.error && <p className="clue-meta" style={{ margin: "0 0 6px" }}>{slot.error}</p>}
          {slot.state === "gone" && (
            <p className="clue-meta" style={{ margin: "0 0 6px" }}>
              Their connection dropped and their character is free again. A
              dropped direct connection cannot redial itself — there is no
              address to redial. Invite them again with a fresh code.
            </p>
          )}
          <Btn kind="ghost" className="inline small" onClick={() => onDrop(slot.id)}>Clear</Btn>
        </div>
      )}

      {slot.error && slot.state === "offered" && (
        <div className="warn-box" style={{ marginTop: 6 }}>{slot.error}</div>
      )}
    </div>
  );
}

export default function RemotePanel({ rtc }) {
  if (!rtc.supported) {
    return (
      <Panel title="Remote table" dark>
        <p style={{ margin: 0, fontSize: 13.5 }}>
          This browser has no WebRTC, so it cannot make direct connections.
          Anything from the last several years can.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Remote table" dark>
      <div className="stack">
        <p style={{ margin: 0, fontSize: 13.5 }}>
          For players who are not in the building. Show them a code, they
          send one line back, and then their phone is at the table like any
          other. No server carries the game.
        </p>

        {rtc.slots.map((s, i) => (
          <Slot key={s.id} slot={s} index={i} onAnswer={rtc.acceptAnswer} onDrop={rtc.drop} />
        ))}

        <Btn kind="accent" onClick={rtc.invite}>Invite a player</Btn>

        <details>
          <summary style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--graphite)", cursor: "pointer" }}>
            What travels, and what changes
          </summary>
          <div className="stack" style={{ marginTop: 6, fontSize: 12.5 }}>
            <p style={{ margin: 0 }}>
              A code describes how to reach your browser: network addresses and a
              certificate fingerprint. No game state, no names, no token — but it
              does contain your IP address, so carry it in a private channel,
              not a public one. It is in the part of the link after the{" "}
              <code>#</code>, which browsers never send to a web server, so
              nothing is logged by whoever is hosting the page.
            </p>
            <p style={{ margin: 0 }}>
              Connecting asks a public STUN server what your address looks like
              from outside. That is the only outside contact; it carries no game
              data, and afterwards everything moves directly between browsers.
            </p>
            <p style={{ margin: 0 }}>
              An invite is good until you withdraw it or reload. Anyone who can
              read the QR can take that seat, so do not put it on a stream.
            </p>
            <p style={{ margin: 0 }}>
              <strong>One thing the LAN can do that this cannot:</strong>{" "}
              {RTC_CAPABILITIES.darkReason} If the table sets whispers to
              "I see nothing", a remote table runs it as "I see that it
              happened" — agree that out loud before you start.
            </p>
          </div>
        </details>
      </div>
    </Panel>
  );
}
