/* ============================================================
   DOSSIER — the Warden's own material, on the Warden's screen.

   Every module in here already ships the thing a Warden needs
   mid-scene: the setting in one paragraph, the voice to run it
   in, the constraints that keep it honest, and each NPC's
   `knows` list — which is simultaneously their script and the
   hard ceiling on what they may invent.

   All of it was written down and none of it was in the app. The
   answer to "wait, what does Sonya actually know about the
   shower?" was to alt-tab to a markdown file, which is the exact
   moment a session stops being a session.

   The live half is the ticking-off. Secrets go from open to
   fired as the flags set; every line an NPC has already said is
   struck through, so the Warden can see at a glance who still
   has something to give. engine/dossier.js derives all of it and
   invents none of it.
   ============================================================ */
import React, { useMemo, useState } from "react";
import { Btn, Label } from "../../ui/kit.jsx";
import { dossierFor } from "../../engine/dossier.js";

const VIEWS = [["cast", "Cast"], ["secrets", "Secrets"], ["triggers", "Triggers"], ["brief", "Brief"]];

export default function DossierTab({ g }) {
  const { mod, w } = g;
  const d = useMemo(() => dossierFor(mod, w), [mod, w]);
  const [view, setView] = useState("cast");
  const [open, setOpen] = useState(null);
  const [showFired, setShowFired] = useState(false);

  return (
    <div className="stack">
      <div className="btn-row">
        {VIEWS.map(([k, label]) => (
          <Btn key={k} kind={view === k ? "accent" : "ghost"} className="inline small"
            onClick={() => setView(k)}>{label}</Btn>
        ))}
        <span className="clue-meta" style={{ marginLeft: "auto" }}>
          {d.counts.secretsFired}/{d.counts.secretsTotal} fired · {d.counts.linesLeft} lines unsaid
        </span>
      </div>

      {/* ---------------- cast ---------------- */}
      {view === "cast" && (
        <div className="dossier">
          {d.cast.map((n) => (
            <div key={n.id} className={`dossier-npc${n.alive ? "" : " is-gone"}`}>
              <button type="button" className="dossier-head"
                aria-expanded={open === n.id}
                onClick={() => setOpen(open === n.id ? null : n.id)}>
                <span className="dossier-name">
                  <strong>{n.name}</strong>
                  <i>{n.role}</i>
                </span>
                <span className="dossier-count">
                  {n.alive ? `${n.left} left` : "gone"}
                  {n.where ? ` · ${n.where}` : ""}
                </span>
              </button>

              {open === n.id && (
                <div className="dossier-body">
                  {n.note && <p className="dossier-note">{n.note}</p>}
                  {n.brief && <p className="dossier-brief">{n.brief}</p>}
                  <ol className="dossier-knows">
                    {n.knows.length === 0 && <li className="clue-meta">Nothing scripted.</li>}
                    {n.knows.map((k) => (
                      <li key={k.i} className={k.told ? "is-told" : ""}>{k.text}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ---------------- secrets ---------------- */}
      {view === "secrets" && (
        <>
          <div className="btn-row">
            <Btn kind={showFired ? "accent" : "ghost"} className="inline small"
              onClick={() => setShowFired((v) => !v)}>
              {showFired ? "Showing everything" : "Only what hasn't fired"}
            </Btn>
          </div>
          <div className="dossier-flags">
            {d.secrets.filter((s) => showFired || !s.fired).map((s) => (
              <div key={s.id} className={`dossier-flag${s.fired ? " is-fired" : ""}`}>
                <span className="dossier-flag-id">{s.label}</span>
                <span className="dossier-flag-where">{s.where.slice(0, 3).join(" · ")}</span>
              </div>
            ))}
            {d.secrets.length === 0 && (
              <p className="clue-meta" style={{ margin: 0 }}>This module sets no flags.</p>
            )}
          </div>
        </>
      )}

      {/* ---------------- triggers ---------------- */}
      {view === "triggers" && (
        <div className="dossier-flags">
          {d.triggers.length === 0 && (
            <p className="clue-meta" style={{ margin: 0 }}>Nothing on a timer.</p>
          )}
          {d.triggers.map((t) => (
            <div key={`${t.kind}:${t.id}`} className={`dossier-flag${t.running ? "" : " is-fired"}`}>
              <span className="dossier-flag-id">{t.label}</span>
              <span className="dossier-flag-where">
                {t.kind} · {t.detail}{t.running ? "" : " · held"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- brief ---------------- */}
      {view === "brief" && (
        <div className="stack">
          {d.setting && (
            <div>
              <Label>WHAT IS ACTUALLY GOING ON</Label>
              <p className="dossier-prose">{d.setting}</p>
            </div>
          )}
          {d.voice && (
            <div>
              <Label>VOICE</Label>
              <p className="dossier-prose">{d.voice}</p>
            </div>
          )}
          {d.constraints.length > 0 && (
            <div>
              <Label>HOLD THE LINE ON</Label>
              <ul className="dossier-rules">
                {d.constraints.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
          {d.npcNote && <p className="dossier-prose">{d.npcNote}</p>}
          {d.endings.length > 0 && (
            <div>
              <Label>WHERE THIS CAN END</Label>
              <div className="btn-row">
                {d.endings.map((e) => (
                  <span key={e.id} className={`sig ${e.reached ? "sig-dis" : "sig-secret"}`}>
                    {e.title}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
