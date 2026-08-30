/* ============================================================
   THE WARDEN'S PHONE — the deck, for one hand.

   WHY THIS IS A SECOND FILE AND NOT A MEDIA QUERY

   The same answer `TableFar.jsx` gives about the sofa, and for the
   same reason. WardenDeck is a bar, a drawer, seven tabs and about
   ninety controls; that is the right shape for a laptop and it is
   not a shape that survives being made narrow. Reflowing it into
   380 pixels produces roughly nine screens of scroll, and a
   control you have to scroll to is a control you do not reach for
   mid-sentence — which is the only moment a Warden ever reaches
   for one.

   So this is not the deck adapted. It is a different, much
   smaller set of things, chosen on the argument that a phone can
   hold four:

     1. what the table is waiting on you for   (engine/wardenNow.js)
     2. the mouth — say a line, as you or as anyone in the room
     3. the brake — hold, and let go
     4. one drawer of levers, on the people who need them

   Everything else stays on the desk deck, deliberately. A Warden
   editing initiative order or rewriting a countdown is sitting
   down; a Warden holding a phone is standing at the table, and
   the two want different software.

   ------------------------------------------------------------
   WHAT THIS IS FOR, WHICH IS NOT WHAT IT LOOKS LIKE

   Not "run the whole session from a phone", although you can. The
   case that actually recurs is the laptop plugged into the
   television. The host tab is the authority AND the shared
   screen, `HostBar` toggles that one screen between the deck and
   the table view, and the consequence is that a Warden who opens
   the drawer opens it in front of everybody. Every lever in this
   file is one they would otherwise have pulled while six people
   watched.

   The second case is smaller and more common than it sounds: a
   Warden who wants to stand up. Nothing about running a table
   requires sitting behind a screen, and until now the software
   did.

   ------------------------------------------------------------
   IT IS THE SAME AUTHORITY, NOT A SECOND ONE

   This renders inside the host tab, off the same `g`, calling the
   same `warden.*` functions the desk deck calls. There is no new
   socket, no privileged client, and no second copy of the game —
   INV-1 is untouched, and it is untouched by construction rather
   than by care. If the Warden's phone is running this, the
   Warden's phone IS the host tab, reached through `?mode=host`
   with the relay's token or through the remote door, exactly as
   `HostGate` already describes.
   ============================================================ */
import React, { useState, useMemo, useRef } from "react";
import { Btn, Label, Field } from "../ui/kit.jsx";
import { wardenNow, TONE } from "../engine/wardenNow.js";
import { waitingRoom } from "../net/protocol.js";
import { currentTurn } from "../engine/combat.js";
import { npcsIn } from "../engine/world.js";
import { tempoOf } from "../engine/tempo.js";
import { STAT_LABEL, SAVE_KEYS, STAT_KEYS } from "../engine/rules.js";
import "../ui/wardenphone.css";

/** How many entries fit above the mouth before the mouth is pushed
    off a short handset. Four, and the fifth is a count rather than a
    row — a list that grows until it fills the screen is a list that
    eats the thing underneath it. */
const SHOWN = 4;

const DRAWERS = [
  ["crew", "Crew"],
  ["room", "Room"],
  ["table", "Table"],
];

export default function WardenPhone({ g, net }) {
  const { mod, w, crew, warden, combat } = g;
  const [drawer, setDrawer] = useState(null);
  const [line, setLine] = useState("");
  const [voice, setVoice] = useState("warden");
  const inputRef = useRef(null);

  const t = tempoOf(w);
  const here = useMemo(() => npcsIn(mod, w), [mod, w]);
  const unread = net && net.inbox ? net.inbox.filter((m) => m.unread).length : 0;

  /* Computed here rather than taken off the snapshot because the
     snapshot's copy is packed for the phones and this is not one of
     them — it is the host. `waitingRoom` is pure and cheap, and
     calling it directly means the Warden's own surface never lags a
     broadcast behind the table it is describing. */
  const waiting = useMemo(() => {
    if (!net || !crew.length) return {};
    return waitingRoom({
      game: g, claims: net.claims || {}, currentTurn, lastActed: net.lastActed || {},
    });
  }, [g, net, crew.length]);

  const now = useMemo(
    () => wardenNow({
      g, waiting, safetyCall: net ? net.safetyCall : null, unread,
    }),
    [g, waiting, net, unread],
  );

  const speak = () => {
    const text = line.trim();
    if (!text) return;
    if (voice === "warden") warden.say(text);
    else if (voice === "note") warden.note(text);
    else warden.npcSay(voice, text);
    setLine("");
    if (inputRef.current) inputRef.current.focus();
  };

  const shown = now.slice(0, SHOWN);
  const spare = now.length - shown.length;

  return (
    <div className="wphone" role="region" aria-label="Warden">
      {/* WHERE EVERYBODY IS, ALWAYS. The one fact that has to survive
          every other thing on this screen, because it is the answer
          to the question a Warden is asked most often and the one
          they lose first when they look away. */}
      <div className="wphone-where">
        <span>{(mod.rooms[w.room] && mod.rooms[w.room].name) || w.room}</span>
        {combat && <span className="wphone-fight">ROUND {combat.round}</span>}
      </div>

      <div className="wphone-now" role="list" aria-label="Waiting on you">
        {shown.length === 0 && (
          <div className="wphone-quiet" role="listitem">
            Nothing is waiting on you.
          </div>
        )}
        {shown.map((item) => (
          <div key={item.id} role="listitem" className={`wphone-card is-${item.tone}`}>
            <strong>{item.title}</strong>
            <span>{item.note}</span>
          </div>
        ))}
        {spare > 0 && (
          <div className="wphone-spare" role="listitem">
            and {spare} more — the desk deck has all of it
          </div>
        )}
      </div>

      {drawer && (
        <div className="wphone-drawer" role="region" aria-label="Warden controls">
          {drawer === "crew" && <CrewDrawer g={g} />}
          {drawer === "room" && <RoomDrawer g={g} onVoice={(id) => {
            setVoice(id); setDrawer(null);
            if (inputRef.current) inputRef.current.focus();
          }} />}
          {drawer === "table" && <TableDrawer g={g} net={net} />}
        </div>
      )}

      {/* THE MOUTH, ABOVE THE TABS AND BELOW EVERYTHING ELSE.
          Thumb reach on a handset is the bottom third, and the thing
          a Warden does forty times an evening is say a sentence. */}
      <form
        className="wphone-bar"
        onSubmit={(e) => { e.preventDefault(); speak(); }}>
        <label className="sr-only" htmlFor="wphone-voice">Who is speaking</label>
        <select id="wphone-voice" value={voice} onChange={(e) => setVoice(e.target.value)}>
          <option value="warden">You</option>
          <option value="note">Note</option>
          {here.map((id) => (
            <option key={id} value={id}>{mod.npcs[id] ? mod.npcs[id].name : id}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="wphone-line">Say something</label>
        <input
          id="wphone-line"
          ref={inputRef}
          value={line}
          onChange={(e) => setLine(e.target.value)}
          placeholder={voice === "note" ? "Only you see this…" : "Say something…"}
          autoComplete="off"
        />
        <Btn kind="accent" className="inline small" type="submit" disabled={!line.trim()}>
          Say
        </Btn>
      </form>

      <nav className="wphone-tabs" role="tablist" aria-label="Warden controls">
        {/* The brake is a tab-sized button rather than a lever inside
            one, because a pause you have to open a drawer to reach is
            a pause you do not take — the same argument WardenDeck
            makes for putting it on the bar, transposed to a surface
            with no keyboard to bind Shift+Space to. */}
        <button
          type="button"
          className={t.held ? "is-on" : ""}
          aria-pressed={t.held}
          onClick={() => warden.hold()}>
          {t.held ? "Resume" : "Hold"}
        </button>
        {DRAWERS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={drawer === k}
            className={drawer === k ? "is-on" : ""}
            onClick={() => setDrawer((d) => (d === k ? null : k))}>
            {label}
            {k === "table" && unread ? ` ${unread}` : ""}
          </button>
        ))}
      </nav>

    </div>
  );
}

/* ============================================================
   CREW — the two numbers, and the roll.

   Health and Stress and nothing else. Conditions, items, skills
   and stat blocks are all on the desk deck and all of them are
   things a Warden reads rather than changes, which makes them the
   wrong things to put on the surface that has room for four.
   ============================================================ */
function CrewDrawer({ g }) {
  const { crew, warden } = g;
  const [open, setOpen] = useState(null);

  const living = crew.filter((c) => c.alive !== false);
  if (!living.length) return <p className="clue-meta">Nobody is playing yet.</p>;

  return (
    <div className="stack">
      {living.map((pc) => (
        <div key={pc.id} className="wphone-pc">
          <button
            type="button"
            className="wphone-pc-head"
            aria-expanded={open === pc.id}
            onClick={() => setOpen((o) => (o === pc.id ? null : pc.id))}>
            <strong>{pc.name}</strong>
            <span>{pc.health}/{pc.maxHealth} · S{pc.stress}</span>
          </button>
          {open === pc.id && (
            <div className="stack" style={{ padding: "6px 0" }}>
              <div className="btn-row">
                <span className="wphone-lever">Health</span>
                {[-5, -1, 1].map((n) => (
                  <Btn key={n} kind="ghost" className="inline small"
                    aria-label={`Health ${n > 0 ? `+${n}` : n}`}
                    onClick={() => warden.adjust(pc.id, { health: n })}>
                    {n > 0 ? `+${n}` : n}
                  </Btn>
                ))}
              </div>
              <div className="btn-row">
                <span className="wphone-lever">Stress</span>
                {[-1, 1, 2].map((n) => (
                  <Btn key={n} kind="ghost" className="inline small"
                    aria-label={`Stress ${n > 0 ? `+${n}` : n}`}
                    onClick={() => warden.adjust(pc.id, { stress: n })}>
                    {n > 0 ? `+${n}` : n}
                  </Btn>
                ))}
              </div>
              <AskFor pc={pc} warden={warden} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Calling for a roll, in one line. The desk deck's version carries a
    "because…" field; this one does not, because a reason typed with
    one thumb while somebody waits is a reason that does not get
    typed. Saying it out loud is what a Warden was going to do anyway. */
function AskFor({ pc, warden }) {
  const [name, setName] = useState("fear");
  const kind = SAVE_KEYS.includes(name) ? "save" : "stat";
  return (
    <div className="btn-row">
      <label className="sr-only" htmlFor={`ask-${pc.id}`}>Which roll</label>
      <select id={`ask-${pc.id}`} value={name} onChange={(e) => setName(e.target.value)}>
        <optgroup label="Saves">
          {SAVE_KEYS.map((k) => <option key={k} value={k}>{STAT_LABEL[k]} Save</option>)}
        </optgroup>
        <optgroup label="Checks">
          {STAT_KEYS.map((k) => <option key={k} value={k}>{STAT_LABEL[k]} Check</option>)}
        </optgroup>
      </select>
      <Btn kind="accent" className="inline small"
        onClick={() => warden.ask(pc.id, { kind, name })}>
        Ask
      </Btn>
    </div>
  );
}

/* ============================================================
   ROOM — who is standing here, and what is ticking.
   ============================================================ */
function RoomDrawer({ g, onVoice }) {
  const { mod, w, warden } = g;
  const here = npcsIn(mod, w);
  const running = Object.entries(w.countdowns || {});

  return (
    <div className="stack">
      <div>
        <Label>SPEAK AS</Label>
        {here.length === 0
          ? <p className="clue-meta" style={{ margin: 0 }}>Nobody else is in this room.</p>
          : (
            <div className="btn-row">
              {here.map((id) => (
                <Btn key={id} kind="ghost" className="inline small" onClick={() => onVoice(id)}>
                  {mod.npcs[id] ? mod.npcs[id].name : id}
                </Btn>
              ))}
            </div>
          )}
      </div>

      <div>
        <Label>CLOCKS</Label>
        {running.length === 0
          ? <p className="clue-meta" style={{ margin: 0 }}>Nothing ticking.</p>
          : running.map(([id, c]) => (
            <div key={id} className="btn-row" style={{ marginBottom: 4 }}>
              <span className="wphone-lever">{id} · {c.left}m</span>
              <Btn kind={c.paused ? "accent" : "ghost"} className="inline small"
                onClick={() => warden.countdown(id, "pause")}>
                {c.paused ? "Run" : "Hold"}
              </Btn>
            </div>
          ))}
      </div>

      <div className="btn-row">
        <Btn kind="ghost" className="inline small" onClick={() => warden.breather()}>
          Five minutes
        </Btn>
        {warden.canUndo && (
          <Btn kind="danger" className="inline small" onClick={() => warden.undo()}>
            Undo {warden.undoLabel}
          </Btn>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   TABLE — the phones.

   Only ever whispers. Sound cues, cue recording and the peer log
   all live on the desk deck: they are things done deliberately,
   with a moment to choose, and none of them is what somebody
   standing at the table reaches for.
   ============================================================ */
function TableDrawer({ g, net }) {
  const { crew } = g;
  const [to, setTo] = useState("");
  const [text, setText] = useState("");
  const inbox = (net && net.inbox) || [];

  /* Opening the drawer is reading them. The desk deck does the same
     thing for the same reason: a badge that stays lit after you have
     looked at the thing it points to is a badge you learn to ignore. */
  React.useEffect(() => {
    if (!net) return;
    inbox.filter((m) => m.unread).forEach((m) => net.markRead(m.id));
  }, [net, inbox]);

  if (!net) {
    return (
      <p className="clue-meta" style={{ margin: 0 }}>
        No phones are connected, so there is nobody to whisper to.
      </p>
    );
  }

  const claimed = crew.filter((c) => net.claims && net.claims[c.id]);

  return (
    <div className="stack">
      {claimed.length === 0 ? (
        <p className="clue-meta" style={{ margin: 0 }}>
          Nobody has picked up a character yet.
        </p>
      ) : (
        <>
          <Field label="Say it to">
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">Choose…</option>
              {claimed.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Only they see this">
            <input value={text} onChange={(e) => setText(e.target.value)}
              placeholder="The panel is warm." autoComplete="off" />
          </Field>
          <Btn kind="accent" disabled={!to || !text.trim()}
            onClick={() => {
              net.whisper(net.claims[to], text.trim());
              setText("");
            }}>
            Whisper
          </Btn>
        </>
      )}

      {inbox.length > 0 && (
        <div>
          <Label>THEY SAID</Label>
          <ul className="wphone-inbox">
            {inbox.slice(0, 6).map((m) => {
              const pc = crew.find((c) => c.id === m.pcId);
              return (
                <li key={m.id} className={m.unread ? "is-unread" : ""}>
                  <strong>{(pc && pc.name) || m.name || "somebody"}</strong> {m.text}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export { TONE };
