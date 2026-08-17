import React from "react";
import { Panel, Btn, Label } from "../ui/kit.jsx";
import { fmtClock } from "../engine/rules.js";
import { toMarkdown, filename, rollStats } from "../engine/transcript.js";
import { downloadText } from "../engine/storage.js";
import { pad } from "../engine/dice.js";

export default function Ending({ mod, w, crew, feed, onAgain, onLibrary }) {
  const end = mod.endings[w.ended] || { title: "IT IS OVER", text: "" };
  const stats = rollStats(w);
  const debrief = mod.debrief ? mod.debrief(w, crew[0], mod) : [];
  const survivors = crew.filter((c) => c.alive !== false);

  return (
    <div className="center-screen" style={{ alignItems: "flex-start", padding: "28px 16px" }}>
      <div style={{ width: "100%", maxWidth: 680 }} className="stack">
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.22em", color: "var(--graphite)" }}>
            {mod.title} · {fmtClock(w.clock)} ELAPSED
          </div>
          <h1 style={{ fontFamily: "var(--display)", fontSize: 40, fontWeight: 700, letterSpacing: "0.06em",
            color: end.good ? "var(--accent)" : "var(--blood)", margin: "8px 0 0", lineHeight: 1 }}>
            {end.title}
          </h1>
        </div>

        <Panel>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{end.text}</p>
        </Panel>

        <Panel title="The crew">
          <div className="stack">
            {crew.map((c) => (
              <div key={c.id} style={{ fontFamily: "var(--mono)", fontSize: 12, borderBottom: "1px solid var(--bone2)", paddingBottom: 6 }}>
                <strong style={{ fontFamily: "var(--display)", letterSpacing: "0.08em", fontSize: 15 }}>{c.name}</strong>
                {" · "}{c.cls.toUpperCase()}{c.level > 0 ? ` · level ${c.level}` : ""}
                <br />
                {c.alive === false
                  ? <span style={{ color: "var(--blood)" }}>Did not come back.</span>
                  : <>Health {c.health}/{c.maxHealth} · Stress {c.stress} · Resolve {c.resolve} · {c.xp} XP</>}
                {c.conditions.length > 0 && <><br />{c.conditions.join(", ")}</>}
              </div>
            ))}
            <div style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
              {survivors.length} of {crew.length} walked away.
            </div>
          </div>
        </Panel>

        {debrief.length > 0 && (
          <Panel title="Debrief">
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.7 }}>
              {debrief.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </Panel>
        )}

        {stats.n > 0 && (
          <Panel title="The dice">
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.8 }}>
              <div>{stats.n} rolls · {stats.rate}% success rate</div>
              <div>{stats.crit} critical success{stats.crit === 1 ? "" : "es"} · {stats.fumble} critical failure{stats.fumble === 1 ? "" : "s"}</div>
              {stats.best && <div>Best margin: {stats.best.who} made {stats.best.label} by {stats.best.margin}</div>}
              {stats.worst && <div>Worst: {stats.worst.who} missed {stats.worst.label} by {-stats.worst.margin}</div>}
            </div>
          </Panel>
        )}

        <div className="btn-grid">
          <Btn kind="accent" onClick={() => downloadText(filename(mod, w), toMarkdown({ mod, world: w, crew, feed }), "text/markdown")}>
            Export the session transcript
          </Btn>
          <Btn kind="ghost" onClick={onAgain}>Run it again</Btn>
          <Btn kind="ghost" onClick={onLibrary}>Back to the shelf</Btn>
        </div>

        <div className="note-box">
          The save has been kept, not deleted. You can come back to this debrief from the library.
        </div>
      </div>
    </div>
  );
}
