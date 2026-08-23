/* ============================================================
   THE TABLE'S OWN CONTROLS.

   Three small things that a person behind a screen supplies for
   free, and that nothing supplies when the chair is empty:

     WhoseGo    who the table is actually waiting on
     SafetyBanner  the card, visibly doing something, on every phone
     TableVote  the ballot for the decisions a Warden used to make

   None of them is clever. All three are here because their
   absence is the difference between a wardenless table that works
   and four people politely waiting for each other.
   ============================================================ */
import React, { useEffect, useState } from "react";
import { Btn } from "../ui/kit.jsx";
import { tallyOf, abstaining } from "../engine/vote.js";

/* ============================================================
   WHOSE GO IS IT

   The largest usability hole in wardenless play, and the one
   nobody writes down, because with a Warden it is not a feature —
   it is a person looking at you.

   `tempo.js` has known the answer the whole time: scene rings,
   lanes, and a per-player ledger. It was simply never rendered as
   a sentence addressed to the person who needs it. Without that
   sentence the default state of a table with no referee is four
   people each assuming somebody else is about to speak.

   THE WORDING IS THE FEATURE. "Waiting on ANA" is information.
   "It's your go" is an invitation, and the difference between
   those two matters most to exactly the player this is for — the
   one who was never going to interrupt.
   ============================================================ */
export function WhoseGo({ waiting, pcId, crew }) {
  if (!waiting || !pcId) return null;

  const mine = waiting[pcId];
  /* Being blocked behind somebody's roll is already reported by the
     existing strip, and two strips saying overlapping things is
     worse than one saying less. */
  if (mine && mine.state === "blocked") return null;

  if (mine && mine.state === "acting") {
    return (
      <div className="net-strip is-go" role="status">
        <strong>It&apos;s your go.</strong> Nobody is waiting on anything else.
      </div>
    );
  }

  const actingId = Object.keys(waiting).find((id) => waiting[id] && waiting[id].state === "acting");
  if (!actingId || actingId === pcId) return null;
  const who = (crew || []).find((c) => c.id === actingId);
  if (!who) return null;

  return (
    <div className="net-strip is-wait" role="status">
      The table is on <strong>{who.name}</strong>.
    </div>
  );
}

/* ============================================================
   THE CARD, VISIBLY DOING SOMETHING

   WARDENLESS.md promised this in bold and the code did not do it:
   a stop card held nothing, reached no phone, and could only be
   taken down from the screen in the middle of the table.

   Two things are load-bearing here and both are about the person
   who played it.

   FIRST, IT IS ON EVERY PHONE. A card whose only visible effect
   is on somebody else's device teaches its player that the card
   is decorative, and that is the single worst thing a safety tool
   can teach.

   SECOND, ANY PHONE CAN CLEAR IT. Not just the host. If clearing
   lived on the shared screen then whoever reached for it would be
   visibly the person handling it, and if the card was about them
   they would have to reach past it to say so. The clear carries
   no identity for the same reason the card does not.

   What it does NOT do: adjudicate, resume on a timer, or soften
   the wording. All three levels hold the table identically,
   nothing here counts down, and the text says what was played.
   ============================================================ */
const LEVEL_TEXT = {
  check: {
    head: "Someone asked to check in.",
    body: "The table is paused. Nobody needs to explain and nobody needs to own it. Carry on when the room is ready.",
  },
  veil: {
    head: "Someone asked to veil this.",
    body: "The table is paused. Whatever was about to happen can happen off-screen. There is a vote below about skipping past it.",
  },
  stop: {
    head: "Someone played the stop card.",
    body: "The table is paused and this is out of the game entirely. Don't ask who, and don't work around it.",
  },
};

export function SafetyBanner({ call, onClear }) {
  if (!call) return null;
  const t = LEVEL_TEXT[call.level] || LEVEL_TEXT.check;
  return (
    <div className="safety-banner" role="alert">
      <strong>{t.head}</strong>
      <p>{t.body}</p>
      {/* Every phone gets this button, including the one that raised
          the card. Which is the point: from the outside, taking it
          down looks the same whoever did it. */}
      <Btn kind="default" onClick={onClear}>Everyone&apos;s alright — carry on</Btn>
    </div>
  );
}

/* ============================================================
   THE VOTE

   engine/vote.js decides; this is the ballot paper. Five topics,
   one primitive, and it is deliberately dull to look at — a vote
   about whether to stop playing should not be a fun interaction.

   ABSTAINING IS SHOWN, because it is an answer. A table of five
   where two have tapped yes has not agreed to anything, and a
   display that showed only "2 yes" would read as a landslide.
   ============================================================ */
export function TableVote({ vote, mine, onCast }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!vote || vote.result) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [vote && vote.at, vote && !!vote.result]);

  if (!vote) return null;
  const tally = tallyOf(vote);
  const left = Math.max(0, Math.ceil((vote.closesAt - Date.now()) / 1000));

  if (vote.result) {
    const opt = vote.options.find((o) => o.id === vote.result.choice);
    return (
      <div className="vote-card is-done" role="status">
        <strong>{opt ? opt.label : vote.result.choice}</strong>
        <span className="vote-why">
          {vote.result.why === "expired" ? "nobody answered in time" : "the table decided"}
        </span>
      </div>
    );
  }

  return (
    <div className="vote-card" role="group" aria-label={vote.label}>
      <strong>{vote.label}</strong>
      <p className="vote-blurb">{vote.blurb}</p>
      <div className="vote-options">
        {vote.options.map((o) => (
          <Btn
            key={o.id}
            kind={mine === o.id ? "primary" : "default"}
            onClick={() => onCast(o.id)}
          >
            {o.label}{tally[o.id] ? ` · ${tally[o.id]}` : ""}
          </Btn>
        ))}
      </div>
      {/* Silence is a no, so it is counted out loud. */}
      <div className="vote-foot">
        {abstaining(vote)} of {vote.of.length} haven&apos;t answered · {left}s
      </div>
    </div>
  );
}

/* ============================================================
   ASKING THE SITUATION SOMETHING

   Players could act on a room, search it, and interrogate anybody
   standing in it. They could not ask the room itself anything —
   what do I see, how far is that, is the door still open, who
   else is here — which with a Warden present is something like
   forty per cent of what gets said at a table.

   The answer comes back as a whisper from the host and contains
   nothing new: the room the crew has already entered, the exits
   already on their own buttons, the people already visible, the
   clues they pinned themselves. Retrieval, not narration.

   And when the question is one the module cannot answer, it says
   so plainly rather than returning the room description in a
   confident tone. The director is not an improviser; a player
   should find that out once, clearly, rather than by slowly
   noticing the answers are not about what they asked.
   ============================================================ */
const SUGGESTED = ["What do I see?", "Ways out?", "Who's in here?", "What do we know?"];

export function AskRoom({ onAsk, disabled }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);

  const fire = (q) => {
    const t = String(q || "").trim();
    if (!t) return;
    onAsk(t);
    setText("");
    setOpen(false);
  };

  if (!open) {
    return (
      <Btn kind="default" disabled={disabled} onClick={() => setOpen(true)}>
        Ask the room
      </Btn>
    );
  }

  return (
    <div className="ask-room">
      <div className="ask-quick">
        {SUGGESTED.map((q) => (
          <button key={q} className="ask-chip" onClick={() => fire(q)}>{q}</button>
        ))}
      </div>
      <div className="ask-line">
        <input
          className="ask-input"
          value={text}
          placeholder="…or ask something else"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") fire(text); }}
        />
        <Btn kind="primary" onClick={() => fire(text)}>Ask</Btn>
        <Btn kind="default" onClick={() => setOpen(false)}>Close</Btn>
      </div>
    </div>
  );
}
