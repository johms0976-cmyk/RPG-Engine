/* ============================================================
   THE WARDEN DECK — where the human sits.

   The engine narrates. Rooms describe themselves, NPCs answer
   from tables, clocks fire on their own. That automation is the
   reason one person can run a table from a laptop and it is not
   going anywhere.

   What it could not do was be interrupted. A Warden could whisper
   and pin a note; they could not say a sentence, answer as a
   character, take a point of Health off someone, hold the reactor
   countdown for two minutes, or make a noise in one person's
   hand. Those are not exotic powers. They are the ordinary verbs
   of running a game, and their absence is what made the Warden a
   spectator of their own session.

   So: a bar that is always there, and a drawer behind it.

     THE BAR is the mouth. One field. Type, press, it is said.
     The only choice next to it is who is speaking — the Warden,
     or one of the people in the room. Nothing else, because
     anything else added here is a thing to read while a player is
     waiting for an answer.

     THE DRAWER is the hands. Five tabs, each one lever per row,
     every lever landing in the feed like any other event. A
     referee who can change the score silently is not running a
     game, so the only things that stay quiet are the ones RAW
     says are determined secretly — and those show on this screen.

   None of it generates anything. There is no model here and no
   table being rolled on behalf of the Warden. Every control moves
   state the engine already owns; the words are always the
   Warden's own. That is the entire design brief: the module
   handles what it anticipated, the human handles the rest.
   ============================================================ */
import React, { useState, useRef, useEffect, useMemo } from "react";
import { Panel, Btn, Label, Field } from "../ui/kit.jsx";
import { STAT_KEYS, SAVE_KEYS, STAT_LABEL, PANIC_TABLE } from "../engine/rules.js";
import { npcsIn } from "../engine/world.js";
import { roomOf, partySummary, isSplit } from "../engine/party.js";
import { SOUND_CUES } from "../net/protocol.js";
import { tempoOf } from "../engine/tempo.js";
import audio, { bedForTags } from "../ui/audio.js";
import CueRecorder from "../ui/CueRecorder.jsx";
import TempoTab from "./warden/TempoTab.jsx";
import TableTab from "./warden/TableTab.jsx";
import DossierTab from "./warden/DossierTab.jsx";
import NpcBoard from "./warden/NpcBoard.jsx";
import PrepTab from "./warden/PrepTab.jsx";
import PropsTab from "./warden/PropsTab.jsx";
import InitiativeEditor from "./warden/InitiativeEditor.jsx";

/** Conditions a Warden reaches for by hand. The panic table supplies
    the canonical names so nothing here invents a new vocabulary. */
const CONDITIONS = [
  ...new Set([
    ...PANIC_TABLE.map((p) => p.name).filter((n) => !/Rush|Focus/.test(n)),
    "Addiction", "Withdrawal risk", "Hallucinating", "Paranoid", "Broken",
  ]),
].sort();

/* Tempo is first because it is the tab a Warden reaches for mid-
   sentence, and the drawer opens on whatever was last used.

   SIX, NOT EIGHT. `Sound` and `Whispers` were separate tabs and
   conceptually neither was: both are things you do *to the phones
   at the table*, which is what `Table` already means. A Warden
   hunting for "make Riley's handset knock" had to remember which
   of three tabs owned the phones, and the answer was all of them.
   They are now sections of one tab, in the order you reach for
   them: who is stuck, then what their phone does, then what you
   say to one of them. */
const TABS = [
  ["tempo", "Tempo"],
  ["crew", "Crew"],
  ["world", "World"],
  ["table", "Table"],
  ["props", "Props"],
  /* Prep sits between the levers and the reference, because that is
     what it is: things you have decided but not yet done. It also
     carries the guided opening, which is the first thing a new
     Warden should see and the reason the tab is not last. */
  ["prep", "Prep"],
  ["dossier", "Dossier"],
];

export default function WardenDeck({ g, net }) {
  const { mod, w, crew, warden } = g;
  const t = tempoOf(w);
  const [open, setOpen] = useState(null);
  const [line, setLine] = useState("");
  const [voice, setVoice] = useState("warden");   // "warden" | "note" | npcId
  const inputRef = useRef(null);

  const here = useMemo(() => npcsIn(mod, w), [mod, w]);
  const unread = (net && net.inbox ? net.inbox.filter((m) => m.unread).length : 0);

  /* Everyone in the cast, with the people actually in the room first —
     the Warden is nearly always answering as someone standing there,
     and hunting for them in an alphabetical list costs the beat. */
  const cast = useMemo(() => {
    const living = mod.npcOrder.filter((id) => w.npcs[id] && w.npcs[id].alive && !w.npcs[id].taken);
    return [...here, ...living.filter((id) => !here.includes(id))];
  }, [mod.npcOrder, w.npcs, here]);

  const speak = () => {
    const t = line.trim();
    if (!t) return;
    if (voice === "warden") warden.say(t);
    else if (voice === "note") warden.note(t);
    else warden.npcSay(voice, t);
    setLine("");
    if (inputRef.current) inputRef.current.focus();
  };

  /* #16 — QUICK VOICES.

     The picker already sorts the people in the room to the top, which
     is most of the problem. The rest of it is that reaching for a
     select at all costs the beat you were about to deliver. Alt+1..5
     binds to the first five NPCs standing in the room, Alt+0 goes
     back to the Warden's own voice, and none of it fires while the
     focus is in a text field that is not this one. */
  useEffect(() => {
    const onKey = (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = (e.target.tagName || "").toLowerCase();
      if ((tag === "input" || tag === "textarea") && e.target.id !== "wdeck-line") return;
      if (e.key === "0") { e.preventDefault(); setVoice("warden"); return; }
      const n = Number(e.key);
      if (!n || n > 5) return;
      const id = here[n - 1];
      if (!id) return;
      e.preventDefault();
      setVoice(id);
      if (inputRef.current) inputRef.current.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [here]);

  /* #1 — the raised hand, on the bar rather than behind the drawer.
     A pause you have to open a drawer to reach is a pause you do not
     take. Shift+Space anywhere that is not a text field. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== "Space" || !e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      e.preventDefault();
      warden.hold();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [warden]);

  const placeholder = voice === "warden"
    ? "The light in the corridor is out. You did not turn it off."
    : voice === "note"
      ? "Note to self — only you see this."
      : `As ${mod.npcs[voice] ? mod.npcs[voice].name : "them"} — say something…`;

  return (
    <>
      {open && (
        <div className="wdeck-drawer" role="region" aria-label="Warden controls">
          <div className="wdeck-tabs" role="tablist">
            {TABS.map(([k, label]) => (
              <Btn key={k} kind={open === k ? "primary" : "ghost"} className="inline small"
                role="tab" aria-selected={open === k} onClick={() => setOpen(k)}>
                {label}{k === "whispers" && unread ? ` · ${unread}` : ""}
              </Btn>
            ))}
            <Btn kind="ghost" className="inline small" style={{ marginLeft: "auto" }}
              onClick={() => setOpen(null)}>Close</Btn>
          </div>

          <div className="wdeck-body">
            {open === "tempo" && <TempoTab g={g} />}
            {open === "crew" && <CrewTab g={g} />}
            {open === "world" && (
              <WorldTab g={g} onSpeak={(id) => { setVoice(id); inputRef.current && inputRef.current.focus(); }} />
            )}
            {open === "table" && (
              <TableTab g={g} net={net}
                sound={<SoundTab g={g} net={net} />}
                whispers={<WhisperTab net={net} crew={crew} />} />
            )}
            {open === "props" && <PropsTab g={g} />}
            {open === "prep" && <PrepTab g={g} />}
            {open === "dossier" && <DossierTab g={g} />}
          </div>
        </div>
      )}

      <div className="wdeck-bar">
        <label className="sr-only" htmlFor="wdeck-voice">Who is speaking</label>
        <select id="wdeck-voice" className="wdeck-voice" value={voice}
          onChange={(e) => setVoice(e.target.value)}>
          <option value="warden">The Warden</option>
          <option value="note">Note to self</option>
          {cast.length > 0 && (
            <optgroup label="Speak as">
              {cast.map((id) => (
                <option key={id} value={id}>
                  {mod.npcs[id].name}{here.includes(id) ? " · here" : ""}
                </option>
              ))}
            </optgroup>
          )}
        </select>

        <form className="wdeck-form" onSubmit={(e) => { e.preventDefault(); speak(); }}>
          <label className="sr-only" htmlFor="wdeck-line">What do you say?</label>
          <input id="wdeck-line" ref={inputRef} value={line} autoComplete="off"
            onChange={(e) => setLine(e.target.value)} placeholder={placeholder} />
          <Btn type="submit" kind="accent" className="inline" disabled={!line.trim()}>Say it</Btn>
        </form>

        {/* The one control that must never be behind anything. */}
        <Btn kind={t.held ? "danger" : "ghost"} className="inline wdeck-hold"
          aria-pressed={t.held}
          title="Hold the table — Shift+Space"
          onClick={() => warden.hold()}>
          {t.held ? "HELD" : "Hold"}
        </Btn>

        {/* LET TIME PASS. `advance` only ever ran off a player action,
            so the base did not tick while the table talked — the thing
            in the vents never moved through five minutes of real
            conversation. This is a thing a Warden does constantly and
            it belongs on the bar, not three clicks into World. */}
        <Btn kind="ghost" className="inline small" title="Ten minutes go by"
          onClick={() => warden.passTime(10)}>
          +10m
        </Btn>

        {/* THE STEP BACK. 2d10 on the wrong character used to have no
            path home but hand-editing state. It lands in the feed like
            everything else — see engine/history.js. */}
        <Btn kind="ghost" className="inline small"
          disabled={!warden.canUndo}
          title={warden.undoLabel ? `Take back ${warden.undoLabel}` : "Nothing to take back"}
          onClick={() => warden.undo()}>
          Undo
        </Btn>

        <Btn kind={open ? "primary" : "solid"} className="inline"
          onClick={() => setOpen(open ? null : "tempo")}
          aria-expanded={!!open}>
          Levers{unread ? ` · ${unread}` : ""}
        </Btn>
      </div>
    </>
  );
}

/* ============================================================
   CREW — the per-character levers.
   ============================================================ */
function CrewTab({ g }) {
  const { crew, warden, items, mod } = g;
  const [sel, setSel] = useState(null);
  const pc = crew.find((c) => c.id === sel) || crew[0];
  if (!pc) return <p className="clue-meta">No crew yet.</p>;

  return (
    <div className="stack">
      <div className="btn-row">
        {crew.map((c) => (
          <Btn key={c.id} kind={c.id === pc.id ? "accent" : "ghost"} className="inline small"
            onClick={() => setSel(c.id)}
            hint={c.alive === false ? "dead" : `${c.health}/${c.maxHealth} · ST ${c.stress}`}>
            {c.name}
          </Btn>
        ))}
      </div>

      <div className="wdeck-grid">
        <div>
          <Label>HEALTH — {pc.health}/{pc.maxHealth}</Label>
          <div className="btn-row">
            {[-5, -1, 1, 5].map((n) => (
              <Btn key={n} kind={n < 0 ? "danger" : "ghost"} className="inline small"
                onClick={() => warden.adjust(pc.id, { health: n, why: "the Warden's call" })}>
                {n > 0 ? `+${n}` : n}
              </Btn>
            ))}
          </div>
        </div>

        <div>
          <Label>STRESS — {pc.stress}</Label>
          <div className="btn-row">
            {[-2, -1, 1, 2].map((n) => (
              <Btn key={n} kind={n > 0 ? "danger" : "ghost"} className="inline small"
                onClick={() => warden.adjust(pc.id, { stress: n, why: "the Warden's call" })}>
                {n > 0 ? `+${n}` : n}
              </Btn>
            ))}
          </div>
        </div>
      </div>

      <ConditionRow pc={pc} warden={warden} />
      <ItemRow pc={pc} items={items} mod={mod} warden={warden} />
      <AskRow pc={pc} warden={warden} />
      <NudgeRow g={g} />
    </div>
  );
}

/* ============================================================
   #17 — THE VISIBLE THUMB ON THE SCALE.

   A referee who changes the score silently is not running a
   game, and this codebase takes that seriously enough that the
   only things kept quiet are the ones RAW says are determined
   secretly. But a Warden with no lever at all is a Warden who
   has to argue with the dice out loud.

   So: Advantage, Disadvantage or a flat modifier, applied to a
   roll that has been called and not yet made, and shown in the
   modifier breakdown as the Warden's call in front of everybody.
   Fiat with a receipt.
   ============================================================ */
function NudgeRow({ g }) {
  const { pending, warden, crew } = g;
  const [why, setWhy] = useState("");

  if (!pending || pending.kind !== "roll") {
    return (
      <div>
        <Label>PUT YOUR THUMB ON IT</Label>
        <p className="clue-meta" style={{ margin: 0 }}>
          Available while a roll is called and not yet made. Whatever you do
          here shows up in the breakdown as your call — nothing changes
          silently.
        </p>
      </div>
    );
  }

  const who = crew.find((c) => c.id === pending.req.pcId);
  const mode = pending.req.mode || "none";

  return (
    <div>
      <Label>
        {who ? `${who.name.toUpperCase()} IS ABOUT TO ROLL` : "A ROLL IS PENDING"}
        {pending.req.wardenTouched ? " · TOUCHED" : ""}
      </Label>
      <div className="btn-row" style={{ marginBottom: 6 }}>
        <Btn kind={mode === "advantage" ? "accent" : "ghost"} className="inline small"
          onClick={() => warden.nudge({ mode: mode === "advantage" ? "none" : "advantage" })}>
          Advantage
        </Btn>
        <Btn kind={mode === "disadvantage" ? "danger" : "ghost"} className="inline small"
          onClick={() => warden.nudge({ mode: mode === "disadvantage" ? "none" : "disadvantage" })}>
          Disadvantage
        </Btn>
        {[-20, -10, 10, 20].map((n) => (
          <Btn key={n} kind={n < 0 ? "danger" : "solid"} className="inline small"
            onClick={() => warden.nudge({ bonus: n, why: why.trim() || undefined })}>
            {n > 0 ? `+${n}` : n}
          </Btn>
        ))}
      </div>
      <Field label="Because… (shown to everyone)">
        <input value={why} onChange={(e) => setWhy(e.target.value)}
          placeholder="you braced the hatch first" />
      </Field>
    </div>
  );
}

function ConditionRow({ pc, warden }) {
  const [pick, setPick] = useState(CONDITIONS[0]);
  return (
    <div>
      <Label>CONDITIONS</Label>
      <div className="btn-row" style={{ marginBottom: 6 }}>
        {(pc.conditions || []).length === 0
          ? <span className="clue-meta">None.</span>
          : pc.conditions.map((c) => (
            <Btn key={c} kind="ghost" className="inline small" title="Lift this"
              onClick={() => warden.condition(pc.id, c, false)}>
              {c} ×
            </Btn>
          ))}
      </div>
      <div className="btn-row">
        <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Condition to apply">
          {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <Btn kind="solid" className="inline small" onClick={() => warden.condition(pc.id, pick, true)}>
          Apply
        </Btn>
      </div>
    </div>
  );
}

function ItemRow({ pc, items, mod, warden }) {
  /* The module's own items first, then general gear. A Warden reaching
     for "the keycard" wants this module's keycard, not the twelfth
     entry in the standard equipment list. */
  const ids = useMemo(() => {
    const own = Object.keys(mod.items || {});
    return own.sort((a, b) => (items[a].n || "").localeCompare(items[b].n || ""));
  }, [mod.items, items]);
  const [pick, setPick] = useState(ids[0]);

  return (
    <div>
      <Label>CARRYING</Label>
      <div className="btn-row" style={{ marginBottom: 6 }}>
        {pc.items.length === 0
          ? <span className="clue-meta">Nothing.</span>
          : pc.items.map((id) => items[id] && (
            <Btn key={id} kind="ghost" className="inline small" title="Take it away"
              onClick={() => warden.item(pc.id, id, false)}>
              {items[id].n} ×
            </Btn>
          ))}
      </div>
      <div className="btn-row">
        <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Item to grant">
          {ids.map((id) => <option key={id} value={id}>{items[id].n}</option>)}
        </select>
        <Btn kind="solid" className="inline small" onClick={() => warden.item(pc.id, pick, true)}>
          Hand it over
        </Btn>
      </div>
    </div>
  );
}

function AskRow({ pc, warden }) {
  const [name, setName] = useState("fear");
  const [reason, setReason] = useState("");
  const kind = SAVE_KEYS.includes(name) ? "save" : "stat";

  return (
    <div>
      <Label>CALL FOR A ROLL</Label>
      <div className="btn-row" style={{ alignItems: "flex-end" }}>
        <select value={name} onChange={(e) => setName(e.target.value)} aria-label="Which roll">
          <optgroup label="Saves">
            {SAVE_KEYS.map((k) => <option key={k} value={k}>{STAT_LABEL[k]} Save</option>)}
          </optgroup>
          <optgroup label="Checks">
            {STAT_KEYS.map((k) => <option key={k} value={k}>{STAT_LABEL[k]} Check</option>)}
          </optgroup>
        </select>
        <div style={{ flex: 1, minWidth: 140 }}>
          <Field label="Because…">
            <input value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="the ladder gives under you" />
          </Field>
        </div>
        <Btn kind="accent" className="inline small"
          onClick={() => warden.ask(pc.id, { kind, name, reason: reason.trim() || undefined })}>
          Ask {pc.name}
        </Btn>
      </div>
      <p className="clue-meta" style={{ margin: "6px 0 0" }}>
        Lands on their phone alone. Nobody else's buttons stop working.
      </p>
    </div>
  );
}

/* ============================================================
   WORLD — clocks, cast and violence.
   ============================================================ */
/* The cast, on the same screen as the levers that move them. See
   screens/warden/NpcBoard.jsx for why that adjacency is the whole
   point rather than a layout preference. */
function WorldTab({ g, onSpeak }) {
  return (
    <>
      <NpcBoard g={g} onSpeak={onSpeak} />
      <WorldLevers g={g} />
    </>
  );
}

function WorldLevers({ g }) {
  const { mod, w, warden, combat } = g;
  const [cdId, setCdId] = useState("pressure");
  const [cdMins, setCdMins] = useState(10);
  const [npcId, setNpcId] = useState(mod.npcOrder[0] || "");
  const [roomId, setRoomId] = useState(w.room);
  const [threatId, setThreatId] = useState(Object.keys(mod.threats)[0] || "");

  const running = Object.entries(w.countdowns || {});
  const roomIds = Object.keys(mod.rooms);

  return (
    <div className="stack">
      <div>
        <Label>COUNTDOWNS</Label>
        {running.length === 0
          ? <p className="clue-meta" style={{ margin: "0 0 6px" }}>Nothing ticking.</p>
          : running.map(([id, c]) => (
            <div key={id} className="btn-row" style={{ marginBottom: 6 }}>
              <span className={`sig ${c.paused ? "sig-secret" : "sig-dis"}`}>
                {id.toUpperCase()} · {c.left}m{c.paused ? " · held" : ""}
              </span>
              <Btn kind="ghost" className="inline small" onClick={() => warden.countdown(id, "add", -5)}>−5m</Btn>
              <Btn kind="ghost" className="inline small" onClick={() => warden.countdown(id, "add", 5)}>+5m</Btn>
              <Btn kind={c.paused ? "accent" : "ghost"} className="inline small"
                onClick={() => warden.countdown(id, "pause")}>
                {c.paused ? "Let it run" : "Hold it"}
              </Btn>
              <Btn kind="danger" className="inline small" onClick={() => warden.countdown(id, "stop")}>Stop</Btn>
            </div>
          ))}
        <div className="btn-row" style={{ alignItems: "flex-end" }}>
          <div style={{ minWidth: 120, flex: 1 }}>
            <Field label="Name">
              <input value={cdId} onChange={(e) => setCdId(e.target.value.replace(/\s+/g, "").toLowerCase())} />
            </Field>
          </div>
          <div style={{ width: 90 }}>
            <Field label="Minutes">
              <input type="number" min={1} max={480} value={cdMins}
                onChange={(e) => setCdMins(Number(e.target.value))} />
            </Field>
          </div>
          <Btn kind="solid" className="inline small" disabled={!cdId}
            onClick={() => warden.countdown(cdId, "start", cdMins)}>Start it</Btn>
        </div>
      </div>

      <hr className="rule" />

      {/* ============================================================
          WHERE EVERYBODY IS.

          The party used to be one token in one room, which made
          this panel unnecessary and the game much worse. Now that
          people can be in different places, the Warden needs the
          two things a physical table gets for free: a glance that
          says who is where, and a hand that can move somebody who
          should not be there.
          ============================================================ */}
      <PartyRow g={g} />

      <hr className="rule" />

      <div>
        <Label>LET TIME PASS</Label>
        <div className="btn-row">
          {[5, 10, 30, 60].map((n) => (
            <Btn key={n} kind="ghost" className="inline small"
              onClick={() => warden.passTime(n)}>
              {n < 60 ? `${n} minutes` : "an hour"}
            </Btn>
          ))}
        </div>
        <p className="clue-meta" style={{ margin: "6px 0 0" }}>
          The base only ticks when somebody acts, which is defensible
          right up until the table spends five minutes arguing and the
          thing in the vents does not move. This charges the clock
          immediately — countdowns, routines and the simulation all
          get their pass.
        </p>
      </div>

      <hr className="rule" />

      <div>
        <Label>MOVE SOMEONE</Label>
        <div className="btn-row">
          <select value={npcId} onChange={(e) => setNpcId(e.target.value)} aria-label="Who">
            {mod.npcOrder.map((id) => (
              <option key={id} value={id}>
                {mod.npcs[id].name}
                {w.npcs[id] && !w.npcs[id].alive ? " (dead)" : ""}
              </option>
            ))}
          </select>
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)} aria-label="Where to">
            {roomIds.map((id) => <option key={id} value={id}>{mod.rooms[id].name}</option>)}
          </select>
          <Btn kind="solid" className="inline small" onClick={() => warden.moveNpc(npcId, roomId)}>Move</Btn>
          <Btn kind="ghost" className="inline small" onClick={() => warden.moveNpc(npcId, w.room)}>
            Bring them here
          </Btn>
        </div>
      </div>

      <hr className="rule" />

      <div>
        <Label>VIOLENCE</Label>
        {combat ? (
          <div className="stack">
            <div className="btn-row">
              <span className="sig sig-dis">Round {combat.round}</span>
              <Btn kind="danger" className="inline small" onClick={() => warden.endCombat()}>
                Break it off
              </Btn>
            </div>
            <InitiativeEditor g={g} />
          </div>
        ) : (
          <div className="btn-row">
            <select value={threatId} onChange={(e) => setThreatId(e.target.value)} aria-label="What attacks">
              {Object.keys(mod.threats).map((id) => (
                <option key={id} value={id}>{mod.threats[id].name || id}</option>
              ))}
            </select>
            <Btn kind="danger" className="inline small" disabled={!threatId}
              onClick={() => warden.startCombat(threatId)}>It attacks</Btn>
            <Btn kind="ghost" className="inline small" disabled={!threatId}
              onClick={() => warden.startCombat(threatId, { surprise: true })}>
              It attacks from surprise
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   THE PARTY, AS IT ACTUALLY IS.

   Six pips and two selects. The value is entirely in the glance:
   a Warden running a split table is holding two scenes in their
   head and the thing they lose first is who is standing where.
   ============================================================ */
function PartyRow({ g }) {
  const { mod, w, crew, warden } = g;
  const [who, setWho] = useState(null);
  const groups = useMemo(() => partySummary(crew, w, mod), [crew, w, mod]);
  const split = isSplit(crew, w);
  const roomIds = Object.keys(mod.rooms);
  const sel = crew.find((c) => c.id === who) || crew.find((c) => c.alive !== false) || crew[0];

  return (
    <div>
      <Label>
        WHERE EVERYBODY IS
        {split ? ` · SPLIT ACROSS ${groups.length}` : " · TOGETHER"}
      </Label>

      <div className="stack" style={{ gap: 4, marginBottom: 6 }}>
        {groups.map((grp) => (
          <div key={grp.room} className="btn-row">
            <span className={`sig ${grp.who.length === 1 ? "sig-secret" : "sig-dis"}`}>
              {grp.name}
            </span>
            <span className="clue-meta">
              {grp.who.map((x) => x.name).join(", ")}
              {grp.who.length === 1 ? " — on their own" : ""}
            </span>
          </div>
        ))}
        {!groups.length && <span className="clue-meta">Nobody is anywhere yet.</span>}
      </div>

      <div className="btn-row">
        <select value={sel ? sel.id : ""} onChange={(e) => setWho(e.target.value)}
          aria-label="Which character">
          {crew.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.alive === false ? " (dead)" : ""}
            </option>
          ))}
        </select>
        <select
          value={sel ? roomOf(sel, w) : w.room}
          onChange={(e) => sel && warden.movePc(sel.id, e.target.value)}
          aria-label="Put them where">
          {roomIds.map((id) => <option key={id} value={id}>{mod.rooms[id].name}</option>)}
        </select>
        {split && (
          <Btn kind="ghost" className="inline small" onClick={() => warden.regroup()}
            title="Everybody into the room most of them are already in">
            Regroup
          </Btn>
        )}
      </div>
      <p className="clue-meta" style={{ margin: "6px 0 0" }}>
        Somebody alone is the module working, not the module broken. It is
        also how people die, which is the correct relationship for this
        game to have with it.
      </p>
    </div>
  );
}

/* ============================================================
   SOUND — the cheapest presence in the room.

   The synth is already there; it was only ever driven by the
   room's tags and by feed events. A Warden could not hit a
   stinger on a beat or kill the music before a reveal, which is
   the oldest trick behind a screen.

   The last row is the one no other tool has: a noise that only
   one player's handset makes. Nothing appears in any log, so
   they have to decide on their own whether to say anything about
   it. That decision is the horror.
   ============================================================ */
function SoundTab({ g, net }) {
  const { mod, w } = g;
  const [on, setOn] = useState(audio.isEnabled());
  const [bed, setBed] = useState(null);
  const [cue, setCue] = useState("knock");
  const peers = (net && net.peers) || [];

  useEffect(() => audio.subscribe((s) => { setOn(s.enabled); setBed(s.bed); }), []);

  const roomBed = bedForTags((mod.rooms[w.room] || {}).tags || []);
  const BEDS = ["industrial", "medical", "derelict", "vacuum", "bridge", "organic", "quiet"];

  return (
    <div className="stack">
      <div className="btn-row">
        <Btn kind={on ? "primary" : "solid"} className="inline small"
          onClick={() => setOn(audio.setEnabled(!on))}>
          {on ? "Sound is on" : "Turn sound on"}
        </Btn>
        <Btn kind="danger" className="inline small"
          onClick={() => { audio.stopBed(); }} disabled={!on}>
          Cut everything
        </Btn>
        <span className="clue-meta">
          {bed ? `playing: ${bed}` : "silent"} · this room wants {roomBed}
        </span>
      </div>

      <div>
        <Label>HOLD A BED</Label>
        <div className="btn-row">
          {BEDS.map((b) => (
            <Btn key={b} kind={bed === b ? "accent" : "ghost"} className="inline small"
              disabled={!on} onClick={() => audio.playBed(b)}>{b}</Btn>
          ))}
        </div>
        <p className="clue-meta" style={{ margin: "6px 0 0" }}>
          The room takes its bed back when the crew next moves.
        </p>
      </div>

      <div>
        <Label>STINGERS</Label>
        <div className="btn-row">
          <Btn kind="ghost" className="inline small" disabled={!on} onClick={() => audio.sfx.panic()}>Panic</Btn>
          <Btn kind="ghost" className="inline small" disabled={!on} onClick={() => audio.sfx.death()}>Death</Btn>
          <Btn kind="ghost" className="inline small" disabled={!on} onClick={() => audio.sfx.alarm(0.9)}>Alarm</Btn>
          <Btn kind="ghost" className="inline small" disabled={!on} onClick={() => audio.sfx.damage()}>Impact</Btn>
          <Btn kind="ghost" className="inline small" disabled={!on} onClick={() => audio.sfx.door()}>Door</Btn>
          <Btn kind="ghost" className="inline small" disabled={!on} onClick={() => audio.sfx.knock()}>Knock</Btn>
          <Btn kind="ghost" className="inline small" disabled={!on} onClick={() => audio.sfx.hullHit()}>Hull</Btn>
        </div>
      </div>

      {net && (
        <div>
          <Label>IN ONE PERSON'S HAND</Label>
          {peers.length === 0 ? (
            <p className="clue-meta" style={{ margin: 0 }}>No phones connected.</p>
          ) : (
            <>
              <div className="btn-row" style={{ marginBottom: 6 }}>
                <select value={cue} onChange={(e) => setCue(e.target.value)} aria-label="Which sound">
                  {Object.entries(SOUND_CUES).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <span className="clue-meta">{SOUND_CUES[cue].blurb}</span>
              </div>
              <div className="btn-row">
                {peers.map((p) => (
                  <Btn key={p.clientId} kind="solid" className="inline small"
                    onClick={() => net.sound(p.clientId, cue)}>
                    → {p.name}
                  </Btn>
                ))}
              </div>
              <p className="clue-meta" style={{ margin: "6px 0 0" }}>
                Their handset only. Nothing is written down anywhere, so it is
                theirs to mention or to sit on.
              </p>
            </>
          )}
        </div>
      )}

      {net && net.cue && (
        <CueRecorder peers={peers} crew={g.crew} onSend={net.cue} />
      )}

      {net && peers.length > 0 && (
        <div>
          <Label>LOOK AT SOMEONE</Label>
          <div className="btn-row">
            {peers.map((p) => (
              <Btn key={p.clientId} kind="ghost" className="inline small"
                onClick={() => net.spotlightPeer(p.clientId, p.pcId)}>
                {p.name}
              </Btn>
            ))}
          </div>
          <p className="clue-meta" style={{ margin: "6px 0 0" }}>
            Their phone buzzes and says you are waiting on them. The table
            screen marks them too. It is eye contact, for a room where
            everyone is looking down.
          </p>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   WHISPERS — the other half of the secrecy loop.
   ============================================================ */
function WhisperTab({ net, crew }) {
  const [to, setTo] = useState(null);
  const [text, setText] = useState("");
  const inbox = (net && net.inbox) || [];
  const peers = (net && net.peers) || [];

  useEffect(() => {
    if (!net) return;
    inbox.filter((m) => m.unread).forEach((m) => net.markRead(m.id));
  }, [net, inbox]);

  if (!net) {
    return <p className="clue-meta">Whispers need phones at the table. Host a session to use them.</p>;
  }

  const send = (clientId, replyTo) => {
    const t = text.trim();
    if (!t || !clientId) return;
    net.whisper(clientId, t, replyTo || null);
    setText(""); setTo(null);
  };

  return (
    <div className="stack">
      <div>
        <Label>SAY SOMETHING TO ONE PERSON</Label>
        <div className="btn-row" style={{ alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <Field label="Whisper">
              <input value={text} onChange={(e) => setText(e.target.value)}
                placeholder="The locker was already open when you got there."
                onKeyDown={(e) => { if (e.key === "Enter" && to) send(to); }} />
            </Field>
          </div>
        </div>
        <div className="btn-row">
          {peers.length === 0
            ? <span className="clue-meta">No phones connected.</span>
            : peers.map((p) => {
              const pc = crew.find((c) => c.id === p.pcId);
              return (
                <Btn key={p.clientId} kind={to === p.clientId ? "accent" : "ghost"} className="inline small"
                  disabled={!text.trim()}
                  onClick={() => { setTo(p.clientId); send(p.clientId); }}>
                  → {pc ? pc.name : p.name}
                </Btn>
              );
            })}
        </div>
      </div>

      <hr className="rule" />

      <div>
        <Label>WHAT THEY SENT YOU</Label>
        {inbox.length === 0 ? (
          <p className="clue-meta" style={{ margin: 0 }}>
            Nothing yet. Players get a quiet button on their phone for the
            things that are ruined by being said out loud.
          </p>
        ) : (
          <div className="clues">
            {inbox.map((m) => {
              const pc = crew.find((c) => c.id === m.pcId);
              return (
                <div key={m.id} className={`clue${m.unread ? "" : " is-resolved"}`} style={{ display: "block" }}>
                  <span className="clue-kind">{pc ? pc.name : m.name}</span>
                  <div className="clue-text" style={{ margin: "4px 0" }}>{m.text}</div>
                  <div className="btn-row">
                    <Btn kind="ghost" className="inline small" disabled={!text.trim()}
                      onClick={() => send(m.clientId, m.id)}>
                      Reply with what's typed above
                    </Btn>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
