/* ============================================================
   THE POCKET — what you know and nobody else does.

   The card that told you is gone in four seconds. The decision
   it created is not, and that asymmetry was the whole problem:
   offering "share this?" while the card is still up produces a
   reflex, and the interesting version of this choice is one
   somebody sits on for twenty minutes and then makes at the
   worst possible moment.

   So a private line goes in a pocket. The pocket is quiet — a
   count, in the corner, on one phone — and it stays until it is
   spoken about or the session ends.

   FOUR ANSWERS, and the fourth is the reason this exists:

     say nothing   the default. It costs nothing, it is never
                   prompted, and the table is never told a choice
                   was made. A screen that announced "Riley
                   received something" would convert a secret into
                   a visible token and the table would simply ask.
     tell them     the line, on the shared screen, attributed.
     show them     the same, plus the artefact. A photograph
                   paraphrased is not a photograph.
     say something else
                   whatever you like, attributed identically.

   The fourth is not a cheat and is not treated as one. Paranoia
   is the game's engine — protocol.js says so, defending peer
   whispers — and at a physical table lying is free and constant.
   What keeps it honest is the attribution: the shared screen says
   the character *said* this, never that the log reads it.

   Nothing here is undoable, and the button says so once, quietly,
   rather than in a modal that turns a beat into paperwork.
   ============================================================ */
import React, { useState } from "react";

export default function SecretPocket({ secrets = [], onShare }) {
  const [open, setOpen] = useState(false);
  const [writing, setWriting] = useState(null);   // line id being claimed about
  const [claim, setClaim] = useState("");

  if (!secrets.length) return null;

  const share = (id, mode, text) => {
    if (onShare) onShare(id, mode, text);
    setWriting(null);
    setClaim("");
    // Closing on the way out: the pocket re-renders without this one,
    // and a list that empties under your thumb is disorienting.
    if (secrets.length <= 1) setOpen(false);
  };

  return (
    <div className={`pocket${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="pocket-tab"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="pocket-eye" aria-hidden="true" />
        {secrets.length === 1 ? "Something only you know" : `${secrets.length} things only you know`}
      </button>

      {open && (
        <div className="pocket-body">
          {secrets.map((s) => (
            <div key={s.id} className="pocket-item">
              <p className="pocket-text">{s.text}</p>

              {writing === s.id ? (
                <>
                  <textarea
                    className="pocket-claim"
                    value={claim}
                    maxLength={400}
                    placeholder="What you tell them instead…"
                    onChange={(e) => setClaim(e.target.value)}
                  />
                  <div className="pocket-row">
                    <button type="button" className="btn inline small accent"
                      disabled={!claim.trim()}
                      onClick={() => share(s.id, "claim", claim)}>
                      Say that
                    </button>
                    <button type="button" className="btn inline small ghost"
                      onClick={() => { setWriting(null); setClaim(""); }}>
                      Back
                    </button>
                  </div>
                </>
              ) : (
                <div className="pocket-row">
                  <button type="button" className="btn inline small solid"
                    onClick={() => share(s.id, "tell")}>
                    Tell them
                  </button>
                  {s.handout && (
                    <button type="button" className="btn inline small solid"
                      onClick={() => share(s.id, "show")}>
                      Show them
                    </button>
                  )}
                  <button type="button" className="btn inline small ghost"
                    onClick={() => { setWriting(s.id); setClaim(""); }}>
                    Say something else
                  </button>
                </div>
              )}
            </div>
          ))}
          <p className="pocket-meta">
            Saying nothing is a choice and nobody is told you made it.
            Anything you do say cannot be taken back.
          </p>
        </div>
      )}
    </div>
  );
}
