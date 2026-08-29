/* ============================================================
   MAKE IT TRUE — the table's half of ruling.js.

   With a Warden, an invented fact goes in through RulingBox on
   the deck. INV-9 says a wardenless table cannot reach the deck,
   so without this the one mechanism that lets the fiction update
   in response to an unanticipated idea is unavailable to the
   configuration that most needs it. See engine/tableRuling.js
   for the full argument.

   ------------------------------------------------------------
   WHY IT IS A DRAWER AND NOT A BUTTON

   Everything else in the table bar is one tap, because everything
   else is a signal — take five, not that, share the floor. This
   one needs a sentence, and a sentence needs somewhere to type.

   It stays shut by default and it stays at the bottom with the
   rest of the fire exits, because a table playing well should be
   able to forget it exists. A text box permanently open on a
   phone is an invitation to write, and a table that is writing
   is a table that is not talking to each other.

   ------------------------------------------------------------
   WHY THE SECOND PERSON GETS A DIFFERENT SCREEN

   The proposer types. Everybody else sees a line in the feed and
   a single AGREE button — no text, nothing to edit, nothing to
   negotiate. That asymmetry is deliberate: a second voice that
   can amend the sentence is not agreement, it is co-authorship,
   and two people drafting a sentence at a table of six is the
   slowest possible way to spend a minute.

   Agreeing is one tap because it must be cheaper than staying
   quiet. If seconding costs more than shrugging, nothing ever
   carries and the whole mechanism is decoration.
   ============================================================ */
import React, { useState } from "react";
import { Btn } from "../ui/kit.jsx";
import { MAX_RULING } from "../engine/ruling.js";

export default function MakeItTrue({ onPropose, onSecond, open, disabled }) {
  const [drawer, setDrawer] = useState(false);
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");

  /* SOMEBODY ELSE'S PROPOSAL IS ON THE TABLE.

     This takes over the control entirely rather than sitting
     beside it. Two open proposals is a table agreeing to one
     sentence while reading another, and the engine allows only
     one at a time — so the interface should not imply otherwise. */
  if (open) {
    return (
      <div className="maketrue is-open">
        <div className="maketrue-said">{open.text}</div>
        <div className="maketrue-row">
          <Btn kind="accent" onClick={onSecond} disabled={disabled}>
            Agree — make it true
          </Btn>
        </div>
        <p className="maketrue-hint">
          One more voice and this is part of the ship. If it was you who said it,
          somebody else has to.
        </p>
      </div>
    );
  }

  if (!drawer) {
    return (
      <Btn kind="default" onClick={() => setDrawer(true)} disabled={disabled}>
        Make it true
      </Btn>
    );
  }

  const send = () => {
    if (!text.trim()) return;
    onPropose({
      text: text.trim(),
      /* A named thing becomes a noun the parser can match, so the
         table can act on what they just invented. Without a name
         it is an addendum to the room, which is still durable and
         still shows up in `answerLook`. */
      scope: subject.trim() ? "thing" : "room",
      subject: subject.trim() || undefined,
    });
    setText("");
    setSubject("");
    setDrawer(false);
  };

  return (
    <div className="maketrue">
      <label className="maketrue-label" htmlFor="maketrue-text">
        Something the module never said, that is true from now on.
      </label>
      <textarea
        id="maketrue-text"
        className="maketrue-text"
        value={text}
        maxLength={MAX_RULING}
        rows={3}
        placeholder="The ceiling panel comes down on four wing-nuts. One is missing."
        onChange={(e) => setText(e.target.value)}
      />
      <input
        className="maketrue-subject"
        value={subject}
        maxLength={80}
        placeholder="Naming a thing? e.g. ceiling panel — optional"
        onChange={(e) => setSubject(e.target.value)}
        aria-label="The name of the thing, if this is about one thing"
      />
      <div className="maketrue-row">
        <Btn kind="accent" onClick={send} disabled={disabled || !text.trim()}>
          Put it to the table
        </Btn>
        <Btn kind="default" onClick={() => { setDrawer(false); setText(""); setSubject(""); }}>
          Never mind
        </Btn>
      </div>
      <p className="maketrue-hint">
        Somebody else has to agree before it counts. Once it does, the room
        remembers it — it will still be there in an hour.
      </p>
    </div>
  );
}
