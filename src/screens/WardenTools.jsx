import React, { useState } from "react";
import { Panel, Btn, Label, Field } from "../ui/kit.jsx";
import {
  rollHorror, rollJob, rollFaction, rollNpcRole, rollScenario, scenarioToMarkdown,
} from "../engine/generators.js";
import { downloadText } from "../engine/storage.js";
import { evalDice } from "../engine/diceParser.js";
import { check, pad } from "../engine/dice.js";
import Analytics from "./Analytics.jsx";

export default function WardenTools({ onBack, modules = [] }) {
  const [scenario, setScenario] = useState(null);
  const [rolls, setRolls] = useState([]);
  const [expr, setExpr] = useState("2d10");
  const [target, setTarget] = useState(35);

  const push = (line) => setRolls((r) => [line, ...r].slice(0, 30));

  return (
    <div className="center-screen" style={{ alignItems: "flex-start", padding: "24px 14px" }}>
      <div style={{ width: "100%", maxWidth: 820 }} className="stack">
        <div>
          <div style={{ fontFamily: "var(--display)", fontSize: 30, fontWeight: 700, letterSpacing: "0.1em", color: "var(--bone)" }}>
            WARDEN TOOLS
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.16em", color: "var(--graphite)", marginTop: 6 }}>
            PREP GENERATORS · ALL LOCAL
          </div>
        </div>

        <Panel title="Session seed">
          <div className="stack">
            <div className="btn-row">
              <Btn kind="accent" className="inline" onClick={() => setScenario(rollScenario(Math.random))}>Roll a whole scenario</Btn>
              {scenario && (
                <Btn kind="ghost" className="inline" onClick={() =>
                  downloadText(`session-seed-${Date.now()}.md`, scenarioToMarkdown(scenario), "text/markdown")}>
                  Export as markdown
                </Btn>
              )}
            </div>

            {scenario && (
              <div className="stack" style={{ fontSize: 14, lineHeight: 1.55 }}>
                <div>
                  <Label>THE JOB</Label>
                  <div><strong>Sector.</strong> {scenario.job.sector}</div>
                  <div><strong>Task.</strong> {scenario.job.task}</div>
                  <div><strong>Complication.</strong> {scenario.job.complication}</div>
                  <div><strong>Pay.</strong> {scenario.job.pay.band} — {scenario.job.pay.credits}. {scenario.job.pay.note}</div>
                </div>
                <div>
                  <Label>THE CLIENT</Label>
                  <div>{scenario.faction.kind}</div>
                  <div><strong>Wants</strong> {scenario.faction.wants}, <strong>via</strong> {scenario.faction.method}.</div>
                  <div><strong>Pressure.</strong> {scenario.faction.pressure}</div>
                </div>
                <div>
                  <Label>THE HORROR</Label>
                  <div><strong>Transgression.</strong> {scenario.horror.transgression}</div>
                  <div><strong>Omens.</strong> {scenario.horror.omens.join(" · ")}</div>
                  <div><strong>Manifestation.</strong> {scenario.horror.manifestation}</div>
                  <div><strong>Banishment.</strong> {scenario.horror.banishment}</div>
                  <div><strong>Slumber.</strong> {scenario.horror.slumber}</div>
                </div>
                <div>
                  <Label>A FACE ON THE GROUND</Label>
                  <div>{scenario.role}</div>
                </div>
              </div>
            )}

            <div className="btn-row">
              <Btn kind="ghost" className="inline small" onClick={() => setScenario((s) => ({ ...(s || rollScenario(Math.random)), horror: rollHorror(Math.random) }))}>Re-roll Horror</Btn>
              <Btn kind="ghost" className="inline small" onClick={() => setScenario((s) => ({ ...(s || rollScenario(Math.random)), job: rollJob(Math.random) }))}>Re-roll job</Btn>
              <Btn kind="ghost" className="inline small" onClick={() => setScenario((s) => ({ ...(s || rollScenario(Math.random)), faction: rollFaction(Math.random) }))}>Re-roll client</Btn>
              <Btn kind="ghost" className="inline small" onClick={() => setScenario((s) => ({ ...(s || rollScenario(Math.random)), role: rollNpcRole(Math.random) }))}>Re-roll face</Btn>
            </div>
          </div>
        </Panel>

        <Panel title="Dice">
          <div className="stack">
            <div className="btn-row" style={{ alignItems: "flex-end" }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <Field label="Expression (2d10, 1d10+2, d%, 5d10x10)">
                  <input value={expr} onChange={(e) => setExpr(e.target.value)} />
                </Field>
              </div>
              <Btn kind="solid" className="inline" onClick={() => push(`${expr} = ${evalDice(expr, 0)}`)}>Roll</Btn>
            </div>
            <div className="btn-row" style={{ alignItems: "flex-end" }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                <Field label="Roll under">
                  <input type="number" min={1} max={99} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
                </Field>
              </div>
              {["none", "advantage", "disadvantage"].map((m) => (
                <Btn key={m} kind="ghost" className="inline small" onClick={() => {
                  const r = check(target, m);
                  push(`d% ${target}% [${m === "none" ? "—" : m === "advantage" ? "+" : "−"}] rolled ${pad(r.value)} · ${r.critHit ? "CRIT SUCCESS" : r.critFail ? "CRIT FAILURE" : r.success ? "success" : "failure"}`);
                }}>{m === "none" ? "Straight" : m === "advantage" ? "Advantage" : "Disadvantage"}</Btn>
              ))}
            </div>
            {rolls.length > 0 && (
              <pre style={{ fontFamily: "var(--mono)", fontSize: 11.5, margin: 0, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto" }}>
                {rolls.join("\n")}
              </pre>
            )}
          </div>
        </Panel>

        {/* Last, under the generators, and that ordering is the point:
            prep is what you came here to do and this is what tells you
            which prep is worth doing. See screens/Analytics.jsx for why
            it is not on the ending screen. */}
        <Analytics modules={modules} />

        <div className="note-box">
          The entries in these generators are original to this engine. The Warden's Operations
          Manual has its own d100 tables for Horrors, jobs and pay; those are Tuesday Knight
          Games' work and are not reproduced here. A module can supply its own entries through
          <code> wardenTables</code> and they will be used instead.
        </div>

        <Btn kind="ghost" onClick={onBack}>Back to the shelf</Btn>
      </div>
    </div>
  );
}
