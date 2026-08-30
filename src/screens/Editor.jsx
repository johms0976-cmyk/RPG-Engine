/* ============================================================
   THE EDITOR — writing a module without a toolchain.

   `portableModule.js` made a scenario a file. This is the thing
   that writes one. Between them they close the gap the README has
   listed as "next" since 2.13: an author with a browser and no
   terminal can now write, validate, play and hand somebody a
   module, and at no point does a build run.

   ------------------------------------------------------------
   THE VALIDATION PANEL IS THE FEATURE

   Not the forms. The forms are ordinary and somebody could have
   written them in an afternoon.

   What is not ordinary is that `defineModule` already resolves
   every cross-reference in a module — hooks, tables, tracks,
   meters, handouts, item ids, room ids, threat ids, endings and
   dice expressions — and until now an author only ever saw that
   output on a library card, after a save, after a reload, in a
   different part of the app. It is running here on every
   keystroke, it is the same call the shelf makes, and it is
   rendered in the three registers the engine actually
   distinguishes:

     PROBLEMS   this will not load. The card refuses to start it.
     WARNINGS   this loads and then silently does nothing.
     COVERAGE   this is the shape of your module. NOT AN ERROR.

   That third one is the one to be careful about, and
   `coverage.js` argues it at length: a room with no features is a
   corridor, corridors are good, and software that nags about them
   is software telling an author their module is wrong when it is
   merely quiet. So it renders last, in grey, under a heading that
   says what it is.

   ------------------------------------------------------------
   WHAT THIS DELIBERATELY DOES NOT DO

   It does not cover effects, gates, device actions, tables or
   countdowns with forms. Those are the parts of the DSL where the
   shape genuinely matters, and a form that half-covers them
   produces modules whose authors cannot tell what they have
   written. They stay typed, in the per-room JSON panel, validated
   by the same compile as everything else — which is a worse
   experience than a form and a much better one than a text editor
   with no validation, which is the honest alternative it replaces.

   It also does not generate anything. There is no prose here that
   an author did not type. That is the same line the Warden deck
   draws and it is drawn in the same place.
   ============================================================ */
import React, { useState, useMemo, useEffect, useRef } from "react";
import { Panel, Btn, Label, Field, Modal } from "../ui/kit.jsx";
import { downloadText } from "../engine/storage.js";
import { installModule } from "../engine/moduleStore.js";
import { portableFilename, PMOD_EXT } from "../engine/portableModule.js";
import {
  blankDraft, draftFrom, compile, slug,
  addRoom, setRoom, removeRoom, renameRoom,
  link, setExit, removeExit, addEnding, removeEnding,
  setRoomJson, toEnvelope, roomIds,
  saveDraft, loadDraft, clearDraft,
} from "../engine/moduleDraft.js";
import "../ui/editor.css";

const TABS = [
  ["rooms", "Rooms"],
  ["ends", "Endings"],
  ["about", "About"],
];

export default function Editor({ onBack, onShelfChange, open = null }) {
  /* `open` is a module handed in from the shelf. Otherwise: whatever
     was being written when the tab last closed, and only then a blank
     one — losing an hour of writing to a closed tab is the commonest
     way an editor gets abandoned. */
  const [raw, setRaw] = useState(() => {
    if (open) {
      const from = draftFrom(open);
      if (from.ok) return from.raw;
    }
    const stored = loadDraft();
    return (stored && stored.raw) || blankDraft();
  });
  const [tab, setTab] = useState("rooms");
  const [sel, setSel] = useState(() => roomIds(raw)[0] || null);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [rawOpen, setRawOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState("");
  const fileRef = useRef(null);

  /* ONE STEP OF UNDO, AND NO MORE.

     A draft is a portable module and nothing else (see the header of
     moduleDraft.js), so there is no document identity to hang a real
     undo stack from. One step covers the mistake people actually make
     — deleting the wrong room — and pretending to more would be a
     history that silently loses entries across a rename. */
  const [prev, setPrev] = useState(null);
  const edit = (next) => {
    if (next === raw) return;
    setPrev(raw);
    setRaw(next);
  };

  useEffect(() => { saveDraft(raw); }, [raw]);
  useEffect(() => {
    if (sel && !raw.rooms[sel]) setSel(roomIds(raw)[0] || null);
  }, [raw, sel]);

  const report = useMemo(() => compile(raw), [raw]);
  const ids = roomIds(raw);
  const room = sel ? raw.rooms[sel] : null;

  /* ---------------- leaving with it ---------------- */

  const exportFile = () => {
    downloadText(portableFilename(raw), toEnvelope(raw), "application/json");
    setMsg(`Wrote ${portableFilename(raw)}. That file is the whole module.`);
  };

  const putOnShelf = () => {
    const r = installModule(toEnvelope(raw), { overwrite: true });
    if (!r.ok) { setErr({ text: r.error, detail: r.detail }); return; }
    setErr(null);
    setMsg(`"${r.mod.title}" is on the shelf. You can start a session with it now.`);
    onShelfChange && onShelfChange();
  };

  const doImport = (text) => {
    const from = draftFrom(text);
    if (!from.ok) { setErr({ text: from.error, detail: from.detail }); return; }
    setPrev(raw);
    setRaw(from.raw);
    setSel(roomIds(from.raw)[0] || null);
    setImporting(false); setImportText(""); setErr(null);
    setMsg("Opened. Nothing has been written to the shelf yet.");
  };

  const onFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => doImport(String(reader.result));
    reader.onerror = () => setErr({ text: "Couldn't read that file." });
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="center-screen editor" style={{ alignItems: "flex-start", padding: "24px 14px" }}>
      <div style={{ width: "100%", maxWidth: 980 }} className="stack">
        <header>
          <div style={{ fontFamily: "var(--display)", fontSize: 30, fontWeight: 700, letterSpacing: "0.1em", color: "var(--bone)" }}>
            WRITE A MODULE
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.16em", color: "var(--graphite)", marginTop: 6 }}>
            {ids.length} ROOM{ids.length === 1 ? "" : "S"} · SAVED IN THIS BROWSER · NOT ON THE SHELF UNTIL YOU PUT IT THERE
          </div>
        </header>

        <div className="btn-row">
          <Btn kind="accent" className="inline" onClick={putOnShelf} disabled={!report.ok}>
            {report.ok ? "Put it on the shelf" : "Fix the problems first"}
          </Btn>
          <Btn kind="ghost" className="inline" onClick={exportFile}>Export {PMOD_EXT}</Btn>
          <Btn kind="ghost" className="inline" onClick={() => { setErr(null); setImporting(true); }}>
            Open one
          </Btn>
          <Btn kind="ghost" className="inline" disabled={!prev}
            onClick={() => { setRaw(prev); setPrev(null); }}>
            Undo
          </Btn>
          <Btn kind="danger" className="inline" onClick={() => {
            if (!window.confirm("Throw this draft away and start again?")) return;
            clearDraft();
            const fresh = blankDraft();
            setPrev(raw); setRaw(fresh); setSel(roomIds(fresh)[0]);
          }}>Start again</Btn>
          <Btn kind="ghost" className="inline" onClick={onBack}>Back to the shelf</Btn>
        </div>

        {msg && <div className="note-box">{msg}</div>}
        {err && (
          <div className="warn-box">
            <strong>{err.text}</strong>
            {err.detail && (
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5 }}>
                {err.detail.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            )}
          </div>
        )}

        <Report report={report} />

        <div className="btn-row" role="tablist" aria-label="What you are editing">
          {TABS.map(([k, label]) => (
            <Btn key={k} role="tab" aria-selected={tab === k}
              kind={tab === k ? "accent" : "ghost"} className="inline"
              onClick={() => setTab(k)}>{label}</Btn>
          ))}
        </div>

        {tab === "rooms" && (
          <div className="editor-split">
            <Panel title="Rooms">
              <div className="stack">
                <div className="editor-list" role="list" aria-label="Rooms">
                  {ids.map((id) => {
                    const n = (raw.rooms[id].exits || []).length;
                    return (
                      <button key={id} type="button" role="listitem"
                        className={`editor-room${id === sel ? " is-on" : ""}`}
                        onClick={() => setSel(id)}>
                        <strong>{raw.rooms[id].name || id}</strong>
                        <span>
                          {`${id === raw.start ? "start · " : ""}${id} · ${n} exit${n === 1 ? "" : "s"}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <Btn kind="ghost" className="inline small" onClick={() => {
                  const out = addRoom(raw);
                  edit(out.raw); setSel(out.id);
                }}>+ Add a room</Btn>
              </div>
            </Panel>

            {room ? (
              <RoomPanel
                raw={raw} id={sel} room={room}
                onChange={edit}
                onSelect={setSel}
                onRaw={() => setRawOpen(true)}
              />
            ) : (
              <Panel title="Nothing selected"><p style={{ margin: 0 }}>Add a room.</p></Panel>
            )}
          </div>
        )}

        {tab === "ends" && <EndingsPanel raw={raw} onChange={edit} />}
        {tab === "about" && <AboutPanel raw={raw} onChange={edit} />}
      </div>

      {rawOpen && room && (
        <RawRoom
          id={sel} room={room}
          onClose={() => setRawOpen(false)}
          onApply={(text) => {
            const out = setRoomJson(raw, sel, text);
            if (!out.ok) return out.error;
            edit(out.raw); setRawOpen(false);
            return null;
          }}
        />
      )}

      {importing && (
        <Modal title="Open a module" onClose={() => setImporting(false)}>
          <Panel title="Open a module" dark>
            <div className="stack">
              <p style={{ margin: 0, fontSize: 13.5 }}>
                A <code>{PMOD_EXT}</code> or <code>.json</code> module file. This replaces
                what you are writing, so export it first if you want to keep it.
              </p>
              {/* Stated here rather than discovered at the door. The two
                  shipped modules both carry `hooks` and neither can be
                  opened, and an author who expected to fork Ypsilon
                  should be told that before they go looking for it. */}
              <p className="clue-meta" style={{ margin: 0 }}>
                Modules with JavaScript in them — the two that ship with this
                engine, among others — cannot be opened here. The format is
                data and carries no code, which is also why it is safe to
                load somebody else's.
              </p>
              <input ref={fileRef} type="file" accept={`${PMOD_EXT},.json,application/json`}
                onChange={onFile} style={{ display: "none" }} />
              <Btn kind="accent" onClick={() => fileRef.current && fileRef.current.click()}>
                Choose a file
              </Btn>
              <Field label="Or paste it">
                <textarea rows={8} value={importText}
                  onChange={(e) => setImportText(e.target.value)} />
              </Field>
              <div className="btn-row">
                <Btn kind="accent" className="inline" disabled={!importText.trim()}
                  onClick={() => doImport(importText)}>Open</Btn>
                <Btn kind="ghost" className="inline" onClick={() => setImporting(false)}>Cancel</Btn>
              </div>
            </div>
          </Panel>
        </Modal>
      )}
    </div>
  );
}

/* ============================================================
   THE REPORT — three registers, and they are not the same thing.
   ============================================================ */
function Report({ report }) {
  return (
    <div className="stack editor-report">
      {report.problems.length > 0 ? (
        <div className="warn-box">
          <strong>
            {report.problems.length} problem{report.problems.length === 1 ? "" : "s"} —
            this will not load.
          </strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5 }}>
            {report.problems.slice(0, 12).map((p, i) => <li key={i}>{p}</li>)}
            {report.problems.length > 12 && <li>…and {report.problems.length - 12} more</li>}
          </ul>
        </div>
      ) : (
        <div className="note-box">This loads cleanly.</div>
      )}

      {report.warnings.length > 0 && (
        <details>
          <summary className="editor-summary">
            {report.warnings.length} warning{report.warnings.length === 1 ? "" : "s"} —
            these load and then do nothing
          </summary>
          <ul className="editor-notes">
            {report.warnings.slice(0, 12).map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </details>
      )}

      {report.coverage.length > 0 && (
        <details>
          {/* NOT ERRORS, and the heading has to say so. See coverage.js:
              a room with no features is a corridor, and software that
              nags about corridors is telling an author their module is
              wrong when it is merely quiet. */}
          <summary className="editor-summary">
            The shape of it — nothing here is wrong
          </summary>
          <ul className="editor-notes">
            {report.coverage.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

/* ============================================================
   ONE ROOM.
   ============================================================ */
function RoomPanel({ raw, id, room, onChange, onSelect, onRaw }) {
  const [idField, setIdField] = useState(id);
  useEffect(() => { setIdField(id); }, [id]);

  const others = roomIds(raw).filter((r) => r !== id);
  const endings = Object.keys(raw.endings || {});

  const commitId = () => {
    if (idField === id) return;
    const next = renameRoom(raw, id, idField);
    if (next === raw) { setIdField(id); return; }
    onChange(next);
    onSelect(slug(idField));
  };

  return (
    <Panel title={room.name || id} icons={id === raw.start ? "START" : undefined}>
      <div className="stack">
        <Field label="Name — what players are told they are in">
          <input value={room.name || ""}
            onChange={(e) => onChange(setRoom(raw, id, { name: e.target.value }))} />
        </Field>

        <Field label="Id — what the module refers to it by">
          <input value={idField}
            onChange={(e) => setIdField(e.target.value)}
            onBlur={commitId}
            onKeyDown={(e) => { if (e.key === "Enter") commitId(); }} />
        </Field>
        <p className="clue-meta" style={{ margin: 0 }}>
          Renaming follows every exit, every <code>moveTo</code>, and anyone
          who starts here. Nothing is left pointing at the old name.
        </p>

        <Field label="Look — read out when they walk in">
          <textarea rows={5} value={room.look || ""}
            onChange={(e) => onChange(setRoom(raw, id, { look: e.target.value }))} />
        </Field>

        <div>
          <Label>WAYS OUT</Label>
          {(room.exits || []).length === 0 && (
            <p className="clue-meta" style={{ margin: "0 0 6px" }}>
              None. A room with no exits is somewhere the crew cannot leave.
            </p>
          )}
          {(room.exits || []).map((e, i) => (
            <div key={i} className="btn-row" style={{ marginBottom: 6, alignItems: "flex-end" }}>
              <div style={{ flex: 1, minWidth: 130 }}>
                <Field label="Label">
                  <input value={e.label || ""}
                    onChange={(ev) => onChange(setExit(raw, id, i, { label: ev.target.value }))} />
                </Field>
              </div>
              <span className="editor-to">{`\u2192 ${String(e.to)}`}</span>
              <Btn kind="danger" className="inline small"
                aria-label={`Remove the way to ${e.to}`}
                onClick={() => onChange(removeExit(raw, id, i))}>Remove</Btn>
            </div>
          ))}

          <AddExit
            others={others} endings={endings}
            onAdd={(to, back) => onChange(link(raw, id, to, { back }))} />
        </div>

        <div className="btn-row">
          <Btn kind="ghost" className="inline small" disabled={id === raw.start}
            onClick={() => onChange({ ...raw, start: id })}>
            {id === raw.start ? "This is where it starts" : "Start here"}
          </Btn>
          <Btn kind="ghost" className="inline small" onClick={onRaw}>This room as JSON</Btn>
          <Btn kind="danger" className="inline small"
            disabled={roomIds(raw).length <= 1}
            onClick={() => onChange(removeRoom(raw, id))}>Delete this room</Btn>
        </div>
      </div>
    </Panel>
  );
}

function AddExit({ others, endings, onAdd }) {
  const [to, setTo] = useState("");
  const [back, setBack] = useState(true);

  if (!others.length && !endings.length) {
    return (
      <p className="clue-meta" style={{ margin: 0 }}>
        Add a second room, or an ending, and you can join them.
      </p>
    );
  }

  return (
    <div className="btn-row" style={{ alignItems: "flex-end" }}>
      <div style={{ minWidth: 160 }}>
        <Field label="A way to">
          <select value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">Choose…</option>
            {others.map((r) => <option key={r} value={r}>{r}</option>)}
            {endings.map((e) => <option key={e} value={`@${e}`}>ending: {e}</option>)}
          </select>
        </Field>
      </div>
      <label className="editor-check">
        <input type="checkbox" checked={back} disabled={to.startsWith("@")}
          onChange={(e) => setBack(e.target.checked)} />
        {/* Two-way by default. An editor whose default strands the
            crew produces modules whose commonest bug is a room you
            cannot leave — see `link` in moduleDraft.js. */}
        <span>and back again</span>
      </label>
      <Btn kind="accent" className="inline small" disabled={!to}
        onClick={() => { onAdd(to, back && !to.startsWith("@")); setTo(""); }}>
        Join
      </Btn>
    </div>
  );
}

/* ============================================================
   ENDINGS — how the evening can finish.
   ============================================================ */
function EndingsPanel({ raw, onChange }) {
  const ids = Object.keys(raw.endings || {});
  return (
    <Panel title="Endings">
      <div className="stack">
        {ids.length === 0 && (
          <p style={{ margin: 0 }}>
            None yet. A module with no endings can still be played — the
            evening simply has no declared way to finish.
          </p>
        )}
        {ids.map((id) => (
          <div key={id} className="stack editor-ending">
            <Field label="Title">
              <input value={raw.endings[id].title || ""}
                onChange={(e) => onChange({
                  ...raw,
                  endings: { ...raw.endings, [id]: { ...raw.endings[id], title: e.target.value } },
                })} />
            </Field>
            <Field label="What is read out">
              <textarea rows={3} value={raw.endings[id].text || ""}
                onChange={(e) => onChange({
                  ...raw,
                  endings: { ...raw.endings, [id]: { ...raw.endings[id], text: e.target.value } },
                })} />
            </Field>
            <div className="btn-row">
              <span className="editor-to">{`@${id}`}</span>
              <Btn kind="danger" className="inline small"
                aria-label={`Delete the ending ${id}`}
                onClick={() => onChange(removeEnding(raw, id))}>Delete</Btn>
            </div>
          </div>
        ))}
        <Btn kind="ghost" className="inline small"
          onClick={() => onChange(addEnding(raw).raw)}>+ Add an ending</Btn>
      </div>
    </Panel>
  );
}

/* ============================================================
   ABOUT — the library card.
   ============================================================ */
function AboutPanel({ raw, onChange }) {
  const set = (patch) => onChange({ ...raw, ...patch });
  return (
    <Panel title="The card in the library">
      <div className="stack">
        <Field label="Title">
          <input value={raw.title || ""} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="Id — the name the engine files it under">
          <input value={raw.id || ""} onChange={(e) => set({ id: slug(e.target.value) })} />
        </Field>
        <Field label="Blurb">
          <textarea rows={3} value={raw.blurb || ""} onChange={(e) => set({ blurb: e.target.value })} />
        </Field>
        <Field label="Byline">
          <input value={raw.byline || ""} onChange={(e) => set({ byline: e.target.value })} />
        </Field>
        <Field label="Content warning — shown before anybody starts">
          <textarea rows={2} value={raw.contentWarning || ""}
            onChange={(e) => set({ contentWarning: e.target.value })} />
        </Field>
        <Field label="Length">
          <input value={raw.length || ""} onChange={(e) => set({ length: e.target.value })} />
        </Field>
        <p className="clue-meta" style={{ margin: 0 }}>
          Crew size, theme, items, NPCs and threats are all part of the format
          and none of them is required. Write them into the module file directly —
          <code> docs/MODULE_FORMAT.md</code> is the whole DSL.
        </p>
      </div>
    </Panel>
  );
}

/* ============================================================
   THE ESCAPE HATCH.
   ============================================================ */
function RawRoom({ id, room, onApply, onClose }) {
  const [text, setText] = useState(() => JSON.stringify(room, null, 2));
  const [bad, setBad] = useState(null);

  return (
    <Modal title={`${id} as JSON`} onClose={onClose} wide>
      <Panel title={`${id} as JSON`} dark>
        <div className="stack">
          <p style={{ margin: 0, fontSize: 13.5 }}>
            Effects, gates, devices and features live here. This is the same
            shape as <code>docs/MODULE_FORMAT.md</code> describes, and it is
            checked against the engine the moment you apply it.
          </p>
          <Field label="Room">
            <textarea rows={18} className="editor-json" value={text}
              onChange={(e) => { setText(e.target.value); setBad(null); }} />
          </Field>
          {bad && <div className="warn-box">{bad}</div>}
          <div className="btn-row">
            <Btn kind="accent" className="inline"
              onClick={() => setBad(onApply(text))}>Apply</Btn>
            <Btn kind="ghost" className="inline" onClick={onClose}>Cancel</Btn>
          </div>
        </div>
      </Panel>
    </Modal>
  );
}
