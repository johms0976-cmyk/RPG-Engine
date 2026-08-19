/* ============================================================
   PREP — the tab for things that have not happened yet.

   Two features share it because they are the same idea at
   different timescales: work done before the moment, so the
   moment itself can be played rather than administered.

   THE OPENING GUIDE (top, and only at the start) walks a
   first-time Warden through the deck's five most important
   levers while running the actual first scene. It disappears on
   its own — see modules/ypsilon14/opening.js.

   ARMED SEQUENCES (below, always) are "when they open the pod,
   fire these three things". They add no powers; they bundle
   levers the Warden already had under one name so the three
   arrive together and in order instead of being remembered,
   found and pressed while six people watch.
   ============================================================ */
import React, { useState } from "react";
import { Btn, Label, Field } from "../../ui/kit.jsx";
import { TRIGGERS, describeSequence } from "../../engine/armed.js";

/* ---------------- the guided opening ---------------- */

function OpeningGuide({ g }) {
  const { mod, w, warden } = g;
  const opening = mod.opening;
  const [skipped, setSkipped] = useState(0);

  if (!opening || !opening.live(w)) return null;

  const { done, next, complete } = opening.progress(w, skipped);
  if (complete || !next) return null;

  const i = opening.steps.indexOf(next);

  return (
    <div className="opening">
      <div className="opening-head">
        <span className="opening-k">FIRST FIFTEEN MINUTES</span>
        <span className="opening-count">{done.length} of {opening.steps.length}</span>
        {/* Dismissable at any point, and it does not come back. A
            Warden who knows this module does not need a chaperone. */}
        <Btn kind="ghost" className="inline small"
          onClick={() => warden.flag && warden.flag("opening_dismissed", true)}>
          Dismiss
        </Btn>
      </div>

      <h4 className="opening-title">{next.title}</h4>
      <p className="opening-lever">{next.lever}</p>
      <p className="opening-body">{next.body}</p>
      <p className="opening-why"><strong>Why:</strong> {next.why}</p>

      <div className="btn-row">
        <Btn kind="ghost" className="inline small" onClick={() => setSkipped(i + 1)}>
          {next.check ? "Skip this one" : "Done — next"}
        </Btn>
        {next.check && <span className="opening-auto">This one ticks itself when you do it.</span>}
      </div>
    </div>
  );
}

/* ---------------- armed sequences ---------------- */

function SequenceEditor({ g, onDone }) {
  const { mod, warden } = g;
  const [name, setName] = useState("");
  const [when, setWhen] = useState("manual");
  const [arg, setArg] = useState("");
  const [line, setLine] = useState("");

  const trigger = TRIGGERS[when];

  const save = () => {
    if (!name.trim()) return;
    /* The effects are the ordinary vocabulary. A `say` is the
       common case by a long way — most prep is "these three things
       get said in this order" — and anything more elaborate is
       written in the module rather than typed in here, because a
       text box that compiles effects is a scripting language
       nobody asked for. */
    const effects = line.trim()
      ? line.split("\n").filter(Boolean).map((t) => ({ say: t.trim(), tone: "warden" }))
      : [];
    warden.arm({ name: name.trim(), when, arg: arg || null, effects });
    setName(""); setArg(""); setLine("");
    onDone && onDone();
  };

  return (
    <div className="stack seq-editor">
      <Field label="Call it">
        <input value={name} onChange={(e) => setName(e.target.value)}
          maxLength={40} placeholder="They open the pod" />
      </Field>

      <Field label="Fires">
        <select value={when} onChange={(e) => { setWhen(e.target.value); setArg(""); }}>
          {Object.entries(TRIGGERS).map(([k, t]) => (
            <option key={k} value={k}>{t.label}</option>
          ))}
        </select>
      </Field>
      <p className="seq-blurb">{trigger.blurb}</p>

      {trigger.arg === "room" && (
        <Field label="Room">
          <select value={arg} onChange={(e) => setArg(e.target.value)}>
            <option value="">—</option>
            {Object.entries(mod.rooms).map(([id, r]) => (
              <option key={id} value={id}>{r.name}</option>
            ))}
          </select>
        </Field>
      )}
      {trigger.arg === "npc" && (
        <Field label="Who">
          <select value={arg} onChange={(e) => setArg(e.target.value)}>
            <option value="">—</option>
            {(mod.npcOrder || Object.keys(mod.npcs)).map((id) => (
              <option key={id} value={id}>{mod.npcs[id].name}</option>
            ))}
          </select>
        </Field>
      )}
      {(trigger.arg === "minutes" || trigger.arg === "stress") && (
        <Field label={trigger.arg === "stress" ? "Stress" : "Minutes"}>
          <input type="number" value={arg} onChange={(e) => setArg(e.target.value)} min={0} />
        </Field>
      )}
      {trigger.arg === "flag" && (
        <Field label="Flag">
          <input value={arg} onChange={(e) => setArg(e.target.value)} placeholder="pod_open" />
        </Field>
      )}

      <Field label="Lines to fire, one per row">
        <textarea rows={3} value={line} onChange={(e) => setLine(e.target.value)}
          placeholder={"The lid comes up on its own.\nThe smell arrives before anything else does."} />
      </Field>

      <div className="btn-row">
        <Btn kind="primary" className="inline" onClick={save}>Arm it</Btn>
        <Btn kind="ghost" className="inline" onClick={onDone}>Cancel</Btn>
      </div>
    </div>
  );
}

export default function PrepTab({ g }) {
  const { mod, w, warden } = g;
  const [adding, setAdding] = useState(false);
  const sequences = w.sequences || [];

  return (
    <div className="stack">
      <OpeningGuide g={g} />

      <div>
        <Label>ARMED</Label>
        {!sequences.length && !adding && (
          <p className="seq-empty">
            Nothing armed. A sequence is a name, a trigger and some lines — useful when you know
            what you want to happen but not yet when.
          </p>
        )}

        {sequences.map((s) => (
          <div key={s.id} className={`seq ${s.fired ? "is-fired" : ""} ${s.armed ? "" : "is-off"}`}>
            <div className="seq-main">
              <strong>{s.name}</strong>
              <span className="seq-when">{describeSequence(s, mod)}</span>
            </div>
            <div className="seq-actions">
              {s.fired ? (
                <span className="seq-tag">fired</span>
              ) : (
                <>
                  {/* Manual sequences are the common case and this is
                      their whole interface: one button, three things. */}
                  <Btn kind="primary" className="inline small" onClick={() => warden.fire(s.id)}>Fire</Btn>
                  {s.when !== "manual" && (
                    <Btn kind="ghost" className="inline small"
                      onClick={() => warden.setArmed(s.id, !s.armed)}>
                      {s.armed ? "Disarm" : "Arm"}
                    </Btn>
                  )}
                </>
              )}
              <Btn kind="ghost" className="inline small"
                onClick={() => warden.dropSequence(s.id)} aria-label={`Delete ${s.name}`}>×</Btn>
            </div>
          </div>
        ))}

        {adding
          ? <SequenceEditor g={g} onDone={() => setAdding(false)} />
          : <Btn kind="solid" className="inline" onClick={() => setAdding(true)}>Arm something</Btn>}
      </div>
    </div>
  );
}
