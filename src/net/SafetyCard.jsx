/* ============================================================
   THE CARD — the one button on the phone that is not about the
   game.

   Mothership ships safety tools in its own rulebook and this
   engine is for running horror at a table where everyone is
   looking at a separate screen. That combination is exactly the
   one where the physical version fails: an X-card in the middle
   of a table works because anyone can touch it without a speech,
   and there is no middle of the table here.

   Three things make this version work, and all three are
   constraints rather than features:

     1. IT IS ANONYMOUS, STRUCTURALLY. The relay strips the
        sender before the message reaches the Warden's screen —
        see server/host.mjs. Not "the host promises not to look":
        the identity does not exist by the time anything could
        display it. A safety tool that can be traced is a safety
        tool that a polite person will not press, and polite
        people are precisely who it is for.

     2. IT IS ALWAYS REACHABLE. It sits in the corner through
        every screen and every modal, including the pending-roll
        modal, because the moment you most need it is the moment
        the game is most insistently asking you for something.

     3. IT ASKS FOR THREE DIFFERENT THINGS. "Stop" is a big ask
        and a table that only has a big ask will use it never.
        Most of the time what someone wants is a breather or for
        this to happen off-screen, and naming those makes the
        loud one usable by making it rarer.

   The lines and veils agreed in the lobby live behind the same
   button, because a contract nobody can re-read is not one.
   ============================================================ */
import React, { useState } from "react";
import { Btn, Modal } from "../ui/kit.jsx";
import { SAFETY_LEVELS } from "./protocol.js";

export default function SafetyCard({ safety, onCall }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(null);

  const lines = (safety && safety.lines) || [];
  const veils = (safety && safety.veils) || [];

  const call = (level) => {
    onCall(level);
    setSent(level);
    setOpen(false);
    if (navigator.vibrate) navigator.vibrate(30);
    // A confirmation that leaves. Anything permanent on screen is
    // something a neighbour can lean over and read.
    setTimeout(() => setSent(null), 4000);
  };

  return (
    <>
      <button type="button" className="safety-tab" onClick={() => setOpen(true)}
        aria-label="Safety card — pause, veil or stop the scene">
        <span aria-hidden="true">✕</span>
      </button>

      {sent && (
        <div className="safety-sent" role="status">
          Sent. The Warden knows someone asked — not who.
        </div>
      )}

      {open && (
        <Modal title="The card" onClose={() => setOpen(false)}>
          <div className="stack">
            <p style={{ margin: 0 }}>
              Nobody is told it was you. The Warden's screen says only that
              someone at the table asked.
            </p>

            <div className="stack">
              {Object.entries(SAFETY_LEVELS).map(([k, v]) => (
                <Btn key={k} kind={k === "stop" ? "danger" : k === "veil" ? "solid" : "ghost"}
                  onClick={() => call(k)} hint={v.blurb}>
                  {v.label}
                </Btn>
              ))}
            </div>

            {(lines.length > 0 || veils.length > 0) && (
              <>
                <hr className="rule" />
                {lines.length > 0 && (
                  <div>
                    <div className="safety-head">LINES — not in this game at all</div>
                    <ul className="safety-list">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
                  </div>
                )}
                {veils.length > 0 && (
                  <div>
                    <div className="safety-head">VEILS — happens, but off-screen</div>
                    <ul className="safety-list">{veils.map((l) => <li key={l}>{l}</li>)}</ul>
                  </div>
                )}
              </>
            )}

            <Btn kind="ghost" onClick={() => setOpen(false)}>Back to the game</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ============================================================
   The Warden's half. A card, dismissed by hand, with nothing on
   it that could identify anybody — because nothing that could
   ever reached this screen.
   ============================================================ */
export function SafetyAlert({ call, onClear }) {
  if (!call) return null;
  const level = SAFETY_LEVELS[call.level] || SAFETY_LEVELS.check;

  return (
    <Modal title="Someone at the table" onClose={onClear}>
      <div className="stack safety-alert">
        <div className="safety-alert-level">{level.label.toUpperCase()}</div>
        <p style={{ margin: 0 }}>{level.blurb}</p>
        <p className="clue-meta" style={{ margin: 0 }}>
          You are not told who, and there is no way to find out. Take the
          pause, don't ask the table who pressed it, and pick the game back
          up wherever they'd like it picked up.
        </p>
        <Btn kind="primary" onClick={onClear}>Understood</Btn>
      </div>
    </Modal>
  );
}
