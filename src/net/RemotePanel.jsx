/* ============================================================
   THE REMOTE TABLE — the Warden's side of the exchange.

   One card per invited player, walking the manual handshake:
   make a code, carry it, paste theirs back, connected. The copy
   is written for the person carrying codes through a group chat,
   because that person is mid-conversation with four other people
   and will paste the wrong thing at least once.

   Two disclosures live here rather than in a doc nobody opens,
   because they are the two things a table would want to have
   been told:

     · a code contains your network addresses
     · `dark` whispers do not exist on this transport
   ============================================================ */
import React, { useState } from "react";
import { Panel, Btn, Label } from "../ui/kit.jsx";
import { RTC_CAPABILITIES } from "./rtcRelay.js";

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
  const [copied, setCopied] = useState(false);

  const doCopy = () => {
    setCopied(copyText(slot.code));
    setTimeout(() => setCopied(false), 1600);
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
          <Label>1 · SEND THEM THIS CODE</Label>
          <textarea
            readOnly
            rows={3}
            value={slot.code}
            onFocus={(e) => e.target.select()}
            style={{ fontFamily: "var(--mono)", fontSize: 10 }}
          />
          <div className="btn-row">
            <Btn kind="accent" className="inline small" onClick={doCopy}>
              {copied ? "Copied" : "Copy code"}
            </Btn>
          </div>

          <Label>2 · PASTE THE ANSWER THEY SEND BACK</Label>
          <textarea
            rows={3}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="RPG1.a…"
            style={{ fontFamily: "var(--mono)", fontSize: 10 }}
          />
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
          For players who are not in the building. You and the player swap two
          codes through anything you already use to talk — a group chat, a
          call — and then their phone is at the table like any other. No
          server carries the game.
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
              does contain your IP addresses, so carry it in a private channel,
              not a public one.
            </p>
            <p style={{ margin: 0 }}>
              Connecting asks a public STUN server what your address looks like
              from outside. That is the only outside contact; it carries no game
              data, and afterwards everything moves directly between browsers.
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
