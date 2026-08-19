/* ============================================================
   TEMPO — the tab that fixes "too fast".

   Everything on the Warden deck until now was a verb: hurt
   somebody, move somebody, start a fight. What it could not do
   was *conduct*. A Warden could speak but could not interrupt,
   could not structure a scene, could not state the situation and
   could not give the table a shape.

   Six controls, in the order a Warden reaches for them:

     HOLD       the raised hand. Everything stops.
     SITUATION  one pinned line answering "what's going on".
     ROUND      out-of-combat turns, so four people stop acting
                into each other.
     BEAT       a titled rule in the log. Chapter structure.
     RECAP      the session so far, on the shared screen.
     BREAK      a real one, with the clocks stopped.

   The rate limit lives at the bottom, off, where a house rule
   belongs.
   ============================================================ */
import React, { useState } from "react";
import { Btn, Label, Field } from "../../ui/kit.jsx";
import { tempoOf, sceneHolder, scenePosition, sceneCost, sceneSpent } from "../../engine/tempo.js";

const RATES = [
  [0, "Off"], [2000, "2s"], [4000, "4s"], [8000, "8s"],
];

export default function TempoTab({ g }) {
  const { w, crew, warden } = g;
  const t = tempoOf(w);
  const [line, setLine] = useState(t.situation || "");
  const [beat, setBeat] = useState("");
  const [label, setLabel] = useState("");

  const holder = sceneHolder(t);
  const holderPc = crew.find((c) => c.id === holder);

  return (
    <div className="stack">
      {/* ---------------- the raised hand ---------------- */}
      <div>
        <Label>HOLD THE TABLE</Label>
        <div className="btn-row">
          <Btn kind={t.held ? "danger" : "solid"} className="inline"
            onClick={() => warden.hold(!t.held)}>
            {t.held ? "Let them go" : "Hold everything"}
          </Btn>
          {t.breather ? (
            <Btn kind="danger" className="inline small" onClick={() => warden.breather(false)}>
              End the break
            </Btn>
          ) : (
            <Btn kind="ghost" className="inline small" onClick={() => warden.breather(true)}>
              Take five
            </Btn>
          )}
          {(t.held || t.breather) && (
            <span className="sig sig-secret">
              {t.breather ? "on a break" : "held"} · clocks stopped
            </span>
          )}
        </div>
        <p className="clue-meta" style={{ margin: "6px 0 0" }}>
          Nothing is lost while it is held. Intents from phones queue and run
          in the order they arrived the moment you release — the buttons go
          quiet and say why rather than failing.
        </p>
      </div>

      <hr className="rule" />

      {/* ---------------- the pinned line ---------------- */}
      <div>
        <Label>THE SITUATION</Label>
        <div className="btn-row" style={{ alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Field label="Pinned to every phone until you change it">
              <input value={line} onChange={(e) => setLine(e.target.value)}
                placeholder="The lights are out. Something is in the vents. The shuttle leaves in 20 minutes."
                onKeyDown={(e) => { if (e.key === "Enter") warden.situation(line); }} />
            </Field>
          </div>
          <Btn kind="accent" className="inline small" onClick={() => warden.situation(line)}>Pin it</Btn>
          {t.situation && (
            <Btn kind="ghost" className="inline small"
              onClick={() => { setLine(""); warden.situation(""); }}>Clear</Btn>
          )}
        </div>
      </div>

      <hr className="rule" />

      {/* ---------------- scene turns ---------------- */}
      <div>
        <Label>ROUND THE ROOM</Label>
        {!t.scene ? (
          <>
            <div className="btn-row" style={{ alignItems: "flex-end" }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <Field label="Call it something (optional)">
                  <input value={label} onChange={(e) => setLabel(e.target.value)}
                    placeholder="everyone, quickly" />
                </Field>
              </div>
              <Btn kind="solid" className="inline small"
                onClick={() => { warden.scene("start", label.trim() || null); setLabel(""); }}>
                Start going round
              </Btn>
            </div>
            <p className="clue-meta" style={{ margin: "6px 0 0" }}>
              One person's world moves at a time, in an order every phone can
              see. The others queue rather than being refused — this is
              combat's initiative without combat's weight.
            </p>
            <p className="clue-meta" style={{ margin: "6px 0 0" }}>
              A round also changes what time <em>costs</em>. Minutes accrue
              against each person and the clock moves once, by the longest
              thing anybody did — which is what actually happens when four
              people search four corners of the same room. Outside a round,
              every action still charges the clock on its own.
            </p>
          </>
        ) : (
          <>
            <div className="btn-row" style={{ marginBottom: 6 }}>
              <span className="sig sig-dis">
                Round {t.scene.round}{t.scene.label ? ` · ${t.scene.label}` : ""}
              </span>
              {/* WHAT THIS ROUND WILL COST. Charged at max() when the
                  ring wraps, so this number is the one that is about
                  to be spent — not the sum of what everybody did. */}
              <span className={`sig ${sceneCost(t.scene) > 30 ? "sig-secret" : "sig-dis"}`}
                title="Charged when the round wraps: the longest thing anybody did">
                {sceneCost(t.scene)}m so far
              </span>
              <Btn kind="accent" className="inline small" onClick={() => warden.scene("next")}>
                Next{holderPc ? ` — done with ${holderPc.name}` : ""}
              </Btn>
              <Btn kind="ghost" className="inline small" onClick={() => warden.scene("pass")}>
                They hang back
              </Btn>
              <Btn kind="danger" className="inline small" onClick={() => warden.scene("end")}>
                Open the room
              </Btn>
            </div>
            <div className="btn-row">
              {t.scene.order.map((id) => {
                const pc = crew.find((c) => c.id === id);
                if (!pc) return null;
                const pos = scenePosition(t, id);
                const spent = sceneSpent(t, id);
                return (
                  <Btn key={id} kind={pos === 0 ? "accent" : "ghost"} className="inline small"
                    hint={`${pos === 0 ? "has the room" : `${pos} away`}${spent ? ` · ${spent}m` : ""}`}
                    onClick={() => warden.scene("to", id)}>
                    {pc.name}
                  </Btn>
                );
              })}
            </div>
          </>
        )}
      </div>

      <hr className="rule" />

      {/* ---------------- shape ---------------- */}
      <div className="wdeck-grid">
        <div>
          <Label>DROP A BEAT</Label>
          <div className="btn-row" style={{ alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <Field label="Titled rule in everyone's log">
                <input value={beat} onChange={(e) => setBeat(e.target.value)}
                  placeholder="AFTER THE AIRLOCK"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && beat.trim()) { warden.beat(`— ${beat.trim().toUpperCase()} —`); setBeat(""); }
                  }} />
              </Field>
            </div>
            <Btn kind="solid" className="inline small" disabled={!beat.trim()}
              onClick={() => { warden.beat(`— ${beat.trim().toUpperCase()} —`); setBeat(""); }}>
              Mark it
            </Btn>
          </div>
        </div>

        <div>
          <Label>PREVIOUSLY ON…</Label>
          <div className="btn-row">
            <Btn kind="solid" className="inline small" onClick={() => warden.recap(false)}>
              Since the last one
            </Btn>
            <Btn kind="ghost" className="inline small" onClick={() => warden.recap(true)}>
              The whole session
            </Btn>
            {w.recap && (
              <Btn kind="danger" className="inline small" onClick={() => warden.clearRecap()}>
                Take it down
              </Btn>
            )}
          </div>
          <p className="clue-meta" style={{ margin: "6px 0 0" }}>
            Built from what the feed already recorded. Lands on the table screen.
          </p>
        </div>
      </div>

      <hr className="rule" />

      {/* ---------------- the house rule ---------------- */}
      <div>
        <Label>SLOW EVERYONE DOWN (HOUSE RULE)</Label>
        <div className="btn-row">
          {RATES.map(([ms, lbl]) => (
            <Btn key={ms} kind={t.rateMs === ms ? "accent" : "ghost"} className="inline small"
              onClick={() => warden.rate(ms)}>{lbl}</Btn>
          ))}
        </div>
        <p className="clue-meta" style={{ margin: "6px 0 0" }}>
          A minimum gap between world-moving actions, per player, out of
          combat. Blunt next to holding the table or going round the room —
          but it costs you no attention at all. Off by default.
        </p>
      </div>
    </div>
  );
}
