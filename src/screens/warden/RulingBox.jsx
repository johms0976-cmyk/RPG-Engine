/* ============================================================
   THE RULING BOX — where the Warden writes something down and it
   stays written.

   A Warden answers a question the module did not anticipate maybe
   fifteen times an evening. Fourteen of those are throwaway and
   the fifteenth is the ceiling panel: a thing that now exists, that
   the player is going to come back to, and that the room will flatly
   deny ten minutes later unless somebody records it.

   The design problem is that the Warden is *mid-sentence*. They
   have a player waiting and four other people listening. Anything
   that takes more than one field and one button will not be used,
   and a control that is not used at the moment it is needed is
   worse than no control, because it looks like the feature exists.

   So the shape is: type, pick where it sticks, press. The scope
   picker defaults to the room, which is the common case, and the
   audience defaults to everybody, which is the honest one.

   ------------------------------------------------------------
   WHY THE SUBJECT FIELD APPEARS AND DISAPPEARS

   A ruling about a *thing* needs the thing's name, because that
   name is what the parser will match on afterwards — it is the
   difference between the panel existing and the panel being
   mentioned. Making the field always visible would ask the Warden
   to leave it blank fourteen times out of fifteen; hiding it
   behind the scope means the one time it matters, it is the only
   other thing on screen.

   ------------------------------------------------------------
   THE LEDGER IS UNDERNEATH, INCLUDING WHAT WAS TAKEN BACK

   `wardenLedger` returns retired rulings too and this screen shows
   them struck through, on the argument in engine/ruling.js: the
   players heard the original, and a record that quietly loses the
   thing six people reacted to is worse than one showing the
   correction. This is the only screen where retired rulings are
   visible, and the person who made the mistake is the person who
   needs to see it.
   ============================================================ */
import React, { useState } from "react";
import { Btn, Label, Field } from "../../ui/kit.jsx";
import { wardenLedger, SCOPE, SCOPE_LABEL, MAX_RULING } from "../../engine/ruling.js";

const SCOPES = [
  [SCOPE.ROOM, "This room"],
  [SCOPE.THING, "One thing"],
  [SCOPE.WORLD, "Everywhere"],
];

export default function RulingBox({ g }) {
  const { mod, w, crew, warden } = g;
  const [text, setText] = useState("");
  const [scope, setScope] = useState(SCOPE.ROOM);
  const [subject, setSubject] = useState("");
  const [told, setTold] = useState([]);
  const [error, setError] = useState(null);

  /* Rulings live on the world and the Warden's deck reads the
     unredacted one, so this is everything — including the private
     ones and the retracted ones. */
  const ledger = wardenLedger(w);
  const roomName = ((mod.rooms || {})[w.room] || {}).name || w.room;

  const toggle = (pcId) =>
    setTold((t) => (t.includes(pcId) ? t.filter((x) => x !== pcId) : [...t, pcId]));

  const commit = () => {
    const res = warden.rule(text, {
      scope,
      subject: scope === SCOPE.THING ? subject : undefined,
      told: told.length ? told : undefined,
    });
    if (!res.ok) { setError(res.error); return; }
    /* Clear everything except the scope. A Warden making one ruling
       about the room is quite likely making a second one, and
       resetting the picker every time is the small friction that
       stops a control being reached for. */
    setText(""); setSubject(""); setTold([]); setError(null);
  };

  const ready = text.trim().length > 0 && (scope !== SCOPE.THING || subject.trim().length > 0);

  return (
    <div className="stack">
      <Label>RULE SOMETHING TRUE</Label>
      <p className="clue-meta" style={{ margin: 0 }}>
        It gets said now, and it stays said — the room will describe it,
        and they can look at it and act on it afterwards.
      </p>

      <Field label={`WHAT IS TRUE${scope === SCOPE.ROOM ? ` — ${roomName}` : ""}`}>
        <textarea
          rows={2}
          value={text}
          maxLength={MAX_RULING}
          placeholder="It is on four wing-nuts and one of them is missing."
          onChange={(e) => { setText(e.target.value); setError(null); }}
          onKeyDown={(e) => {
            /* The Warden is typing with a table waiting. Enter sends;
               shift-enter is the escape hatch for the rare two-line
               ruling. Same bargain as the bar above. */
            if (e.key === "Enter" && !e.shiftKey && ready) { e.preventDefault(); commit(); }
          }}
        />
      </Field>

      <div className="btn-row">
        {SCOPES.map(([k, label]) => (
          <Btn key={k} kind={scope === k ? "accent" : "ghost"} className="inline small"
            title={SCOPE_LABEL[k]} onClick={() => setScope(k)}>
            {label}
          </Btn>
        ))}
      </div>

      {scope === SCOPE.THING && (
        <Field label="WHAT IT IS CALLED — they will be able to look at this by name">
          <input
            value={subject}
            placeholder="ceiling panel"
            onChange={(e) => { setSubject(e.target.value); setError(null); }}
          />
        </Field>
      )}

      {crew.filter((c) => c.alive !== false).length > 1 && (
        <>
          <Label>WHO HEARS IT — nobody selected means the whole table</Label>
          <div className="btn-row">
            {crew.filter((c) => c.alive !== false).map((c) => (
              <Btn key={c.id} kind={told.includes(c.id) ? "accent" : "ghost"}
                className="inline small" onClick={() => toggle(c.id)}>
                {c.name}
              </Btn>
            ))}
          </div>
          {told.length > 0 && (
            <p className="clue-meta" style={{ margin: 0 }}>
              Only those phones receive it. It stays off the shared screen and
              out of everybody else's transcript.
            </p>
          )}
        </>
      )}

      {error && <p className="clue-meta" role="alert" style={{ margin: 0 }}>{error}</p>}

      <Btn kind="solid" disabled={!ready} onClick={commit}>
        {told.length ? `Tell ${told.length}` : "Make it true"}
      </Btn>

      {ledger.length > 0 && (
        <>
          <Label>WHAT THIS TABLE HAS DECIDED</Label>
          <div className="clues">
            {ledger.map((r) => {
              const where = r.scope === SCOPE.WORLD ? "everywhere"
                : r.scope === SCOPE.THING ? r.subject
                : ((mod.rooms || {})[r.room] || {}).name || r.room;
              const names = (r.told || []).map((id) => (crew.find((c) => c.id === id) || {}).name)
                .filter(Boolean).join(", ");
              return (
                <div key={r.id} className={`clue${r.retired ? " is-resolved" : ""}`} style={{ display: "block" }}>
                  <span className="clue-kind">{where}</span>
                  <div className="clue-text" style={{ margin: "4px 0" }}>
                    {r.retired ? <s>{r.text}</s> : r.text}
                  </div>
                  <div className="clue-meta">
                    {r.retired
                      ? `taken back${r.retiredWhy ? ` — ${r.retiredWhy}` : ""}`
                      : names ? `told to ${names}` : "the whole table"}
                  </div>
                  {!r.retired && (
                    <div className="btn-row" style={{ marginTop: 6 }}>
                      <Btn kind="ghost" className="inline small" onClick={() => warden.unrule(r.id)}>
                        Take it back
                      </Btn>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
