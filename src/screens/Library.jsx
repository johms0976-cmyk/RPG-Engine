import React, { useState, useEffect } from "react";
import { Panel, Btn, Label, Modal, Field } from "../ui/kit.jsx";
import { moduleCard } from "../engine/defineModule.js";
import { listSlots, exportSlot, importSlot, clear, downloadText, settings as loadSettings, saveSettings } from "../engine/storage.js";
import { HOUSE_RULES, withDefaults } from "../engine/houserules.js";
import { installModule, removeModule, exportInstalled } from "../engine/moduleStore.js";
import { toPortable, portableFilename, PMOD_EXT } from "../engine/portableModule.js";

export default function Library({ modules, broken = [], onPick, onResume, onWardenTools, onShelfChange }) {
  const [slots, setSlots] = useState([]);
  const [showRules, setShowRules] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState("");
  const [msg, setMsg] = useState(null);
  /* Loading a module and importing a save are deliberately separate
     doors. They take the same kind of file and mean entirely different
     things, and a single "import" button that guesses would eventually
     guess wrong about somebody's campaign. */
  const [loading, setLoading] = useState(false);
  const [loadText, setLoadText] = useState("");
  const [loadErr, setLoadErr] = useState(null);
  const fileRef = React.useRef(null);
  const [rules, setRules] = useState(() => withDefaults(loadSettings().houseRules));

  const refresh = () => setSlots(listSlots());
  useEffect(refresh, []);

  const setRule = (k, v) => {
    const next = { ...rules, [k]: v };
    setRules(next);
    saveSettings({ ...loadSettings(), houseRules: next });
  };

  const doImport = () => {
    const r = importSlot(importText);
    setMsg(r.ok ? `Imported into ${r.moduleId} · slot "${r.name}".` : r.error);
    if (r.ok) { setImporting(false); setImportText(""); refresh(); }
  };

  /* ---------------- loading a module ---------------- */

  const doLoad = (text, { overwrite = false } = {}) => {
    const r = installModule(text, { overwrite });
    if (r.ok) {
      setMsg(`Loaded "${r.mod.title}". It is on the shelf.`);
      setLoading(false); setLoadText(""); setLoadErr(null);
      onShelfChange && onShelfChange();
      return;
    }
    /* A name collision is the one failure worth offering a way past,
       because the commonest cause is loading a newer copy of a module
       you already have. */
    if (r.conflict) {
      setLoadErr({
        text: r.error,
        detail: null,
        retry: () => doLoad(text, { overwrite: true }),
        retryLabel: "Replace it",
      });
      return;
    }
    setLoadErr({ text: r.error, detail: r.detail || null });
  };

  const onFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => doLoad(String(reader.result));
    reader.onerror = () => setLoadErr({ text: "Couldn't read that file." });
    reader.readAsText(file);
    /* Reset, so choosing the same file twice fires the change event twice.
       Without this, a failed load cannot be retried by re-picking it. */
    e.target.value = "";
  };

  const dropModule = (m) => {
    if (!removeModule(m.id)) return;
    setMsg(`Removed "${m.title}" from the shelf. Your saves for it are untouched.`);
    onShelfChange && onShelfChange();
  };

  const exportModule = (m) => {
    /* Prefer the bytes the author shipped; fall back to re-serialising a
       bundled module, which is lossy and says so. */
    const stored = exportInstalled(m.id);
    if (stored) { downloadText(portableFilename(m), stored, "application/json"); return; }
    const { json, lost } = toPortable(m);
    downloadText(portableFilename(m), json, "application/json");
    setMsg(lost.length
      ? `Exported "${m.title}" as a starting point. ${lost.length} thing${lost.length === 1 ? "" : "s"} could not travel: ${lost.join("; ")}.`
      : `Exported "${m.title}".`);
  };

  return (
    <div className="center-screen" style={{ alignItems: "flex-start", padding: "28px 16px" }}>
      <div style={{ width: "100%", maxWidth: 880 }} className="stack">
        <header style={{ marginBottom: 4 }}>
          <div style={{ fontFamily: "var(--display)", fontSize: 36, fontWeight: 700, letterSpacing: "0.1em", color: "var(--bone)", lineHeight: 1 }}>
            THE SHELF
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.18em", color: "var(--graphite)", marginTop: 6 }}>
            MOTHERSHIP ENGINE · RUNS ENTIRELY OFFLINE · NO ACCOUNT, NO NETWORK, NO TOKENS
          </div>
        </header>

        <div className="btn-row">
          <Btn kind="ghost" className="inline" onClick={() => setShowRules(true)}>House rules</Btn>
          <Btn kind="ghost" className="inline" onClick={onWardenTools}>Warden tools</Btn>
          <Btn kind="ghost" className="inline" onClick={() => setImporting(true)}>Import a save</Btn>
          <Btn kind="accent" className="inline" onClick={() => { setLoadErr(null); setLoading(true); }}>
            Load a module
          </Btn>
        </div>

        {msg && <div className="note-box">{msg}</div>}

        {modules.map((m) => {
          const card = moduleCard(m);
          const mine = slots.filter((s) => s.moduleId === m.id);
          /* `bad` rather than `broken`: the prop of that name is the list of
             stored modules that no longer parse, and shadowing it here is how
             the shelf silently stopped reporting them. */
          const bad = card.problems.length > 0;
          return (
            <Panel key={m.id} title={card.title} icons={m.portable ? `${card.length} · LOADED` : card.length}>
              <div className="stack">
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.16em", color: "var(--graphite)" }}>
                  {card.subtitle}
                </div>
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5 }}>{card.blurb}</p>
                {card.byline && <div className="note-box">{card.byline}</div>}
                {card.contentWarning && (
                  <div className="warn-box">
                    <strong>Content warning.</strong> {card.contentWarning}
                  </div>
                )}
                <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--graphite)" }}>
                  {card.rooms} locations · crew of {card.crewSize.min}–{card.crewSize.max} (suggested {card.crewSize.suggested})
                </div>

                {bad && (
                  <div className="warn-box">
                    <strong>This module will not load cleanly.</strong>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                      {card.problems.slice(0, 8).map((p, i) => <li key={i}>{p}</li>)}
                      {card.problems.length > 8 && <li>…and {card.problems.length - 8} more</li>}
                    </ul>
                  </div>
                )}
                {!bad && card.warnings.length > 0 && (
                  <details>
                    <summary style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--graphite)", cursor: "pointer" }}>
                      {card.warnings.length} validation warning{card.warnings.length === 1 ? "" : "s"}
                    </summary>
                    <ul style={{ fontFamily: "var(--mono)", fontSize: 10.5, margin: "6px 0 0", paddingLeft: 18, color: "var(--graphite)" }}>
                      {card.warnings.slice(0, 10).map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </details>
                )}

                <Btn kind="accent" onClick={() => onPick(m)} disabled={bad}>
                  {bad ? "Cannot load" : "New game"}
                </Btn>

                <div className="btn-row">
                  <Btn kind="ghost" className="inline small" onClick={() => exportModule(m)}>
                    Export module
                  </Btn>
                  {m.portable && (
                    <Btn kind="danger" className="inline small" onClick={() => dropModule(m)}>
                      Remove from shelf
                    </Btn>
                  )}
                </div>

                {mine.length > 0 && (
                  <>
                    <Label>SAVED GAMES</Label>
                    <div className="stack">
                      {mine.map((s) => (
                        <div key={s.key} style={{ border: "1.5px solid var(--ink)", padding: 8 }}>
                          <div style={{ fontFamily: "var(--mono)", fontSize: 11, marginBottom: 6 }}>
                            <strong>{s.name}</strong> · {new Date(s.at).toLocaleString()}
                            {s.ended ? " · finished" : ""}
                            <br />
                            {s.crew.map((c) => `${c.name}${c.alive ? "" : " †"}`).join(", ") || "no crew"}
                          </div>
                          <div className="btn-row">
                            <Btn kind="solid" className="inline small" onClick={() => onResume(m, s.name)}>Resume</Btn>
                            <Btn kind="ghost" className="inline small" onClick={() => {
                              const json = exportSlot(m.id, s.name);
                              if (json) downloadText(`${m.id}-${s.name}.json`, json, "application/json");
                            }}>Export</Btn>
                            <Btn kind="danger" className="inline small" onClick={() => { clear(m.id, s.name); refresh(); }}>Delete</Btn>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Panel>
          );
        })}

        {broken.length > 0 && (
          <div className="warn-box">
            <strong>
              {broken.length} loaded module{broken.length === 1 ? "" : "s"} no longer
              {broken.length === 1 ? "s" : ""} load.
            </strong>
            <p style={{ margin: "6px 0", fontSize: 13 }}>
              These were stored by an earlier session and will not parse now — usually because
              the engine changed under them. They are kept rather than deleted, so you can
              export and repair them.
            </p>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5 }}>
              {broken.map((b) => (
                <li key={b.id} style={{ marginBottom: 6 }}>
                  <strong>{b.title}</strong> — {b.error}
                  <div className="btn-row" style={{ marginTop: 4 }}>
                    <Btn kind="ghost" className="inline small" onClick={() => {
                      const json = exportInstalled(b.id);
                      if (json) downloadText(`${b.id}${PMOD_EXT}`, json, "application/json");
                    }}>Export</Btn>
                    <Btn kind="danger" className="inline small" onClick={() => {
                      removeModule(b.id);
                      onShelfChange && onShelfChange();
                    }}>Remove</Btn>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="note-box">
          This engine has no network code. Nothing you type leaves the machine, no API key is
          stored anywhere, and nothing costs anything to run. The Warden is a local parser,
          an oracle and a table of sensory detail.
        </div>
      </div>

      {showRules && (
        <Modal title="House rules" onClose={() => setShowRules(false)}>
          <Panel title="House rules" dark>
            <div className="stack">
              <p style={{ margin: 0, fontSize: 13.5 }}>
                Optional rules from the Warden's Operations Manual, plus one clarification the
                rulebook leaves genuinely ambiguous. Defaults are Rules As Written.
              </p>
              {Object.entries(HOUSE_RULES).map(([k, def]) => (
                <div key={k} style={{ borderTop: "1px solid var(--graphite)", paddingTop: 8 }}>
                  {def.kind === "bool" ? (
                    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                      <input type="checkbox" checked={!!rules[k]} onChange={(e) => setRule(k, e.target.checked)}
                        style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }} />
                      <span>
                        <strong style={{ fontFamily: "var(--display)", letterSpacing: "0.08em" }}>{def.name}</strong>
                        <br /><span style={{ fontSize: 12, color: "var(--bone2)" }}>{def.blurb}</span>
                      </span>
                    </label>
                  ) : (
                    <Field label={def.name}>
                      <select value={rules[k]} onChange={(e) => setRule(k, e.target.value)}>
                        {def.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <span style={{ fontSize: 12, color: "var(--bone2)" }}>{def.blurb}</span>
                    </Field>
                  )}
                </div>
              ))}
              <Btn kind="accent" onClick={() => setShowRules(false)}>Done</Btn>
            </div>
          </Panel>
        </Modal>
      )}

      {loading && (
        <Modal title="Load a module" onClose={() => setLoading(false)}>
          <Panel title="Load a module" dark>
            <div className="stack">
              <p style={{ margin: 0, fontSize: 13.5 }}>
                A module is a <code>{PMOD_EXT}</code> or <code>.json</code> file written against
                the module format. It is read as data and never executed — there is no code in
                it to run.
              </p>

              <input
                ref={fileRef}
                type="file"
                accept={`${PMOD_EXT},.json,application/json`}
                onChange={onFile}
                style={{ display: "none" }}
              />
              <Btn kind="accent" onClick={() => fileRef.current && fileRef.current.click()}>
                Choose a file
              </Btn>

              <Label>OR PASTE IT</Label>
              <Field label="Module JSON">
                <textarea
                  rows={10}
                  value={loadText}
                  onChange={(e) => { setLoadText(e.target.value); setLoadErr(null); }}
                  placeholder={'{ "kind": "rpg-engine-module", "v": 1, "module": { … } }'}
                />
              </Field>

              {loadErr && (
                <div className="warn-box">
                  <strong>{loadErr.text}</strong>
                  {loadErr.detail && (
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5 }}>
                      {loadErr.detail.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                  )}
                  {loadErr.retry && (
                    <div className="btn-row" style={{ marginTop: 6 }}>
                      <Btn kind="danger" className="inline small" onClick={loadErr.retry}>
                        {loadErr.retryLabel}
                      </Btn>
                    </div>
                  )}
                </div>
              )}

              <div className="btn-row">
                <Btn kind="accent" className="inline" onClick={() => doLoad(loadText)} disabled={!loadText.trim()}>
                  Load
                </Btn>
                <Btn kind="ghost" className="inline" onClick={() => setLoading(false)}>Cancel</Btn>
              </div>

              <p className="clue-meta" style={{ margin: 0 }}>
                Loaded modules live in this browser only. Export one to move it to another
                machine. Removing a module does not touch your saves for it.
              </p>
            </div>
          </Panel>
        </Modal>
      )}

      {importing && (
        <Modal title="Import a save" onClose={() => setImporting(false)}>
          <Panel title="Import a save" dark>
            <div className="stack">
              <Field label="Paste the exported JSON">
                <textarea rows={10} value={importText} onChange={(e) => setImportText(e.target.value)} />
              </Field>
              <div className="btn-row">
                <Btn kind="accent" className="inline" onClick={doImport} disabled={!importText.trim()}>Import</Btn>
                <Btn kind="ghost" className="inline" onClick={() => setImporting(false)}>Cancel</Btn>
              </div>
            </div>
          </Panel>
        </Modal>
      )}
    </div>
  );
}
