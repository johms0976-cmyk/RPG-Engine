/* ============================================================
   LIBRARY — the shelf. Pick a tape, put it in the player.
   ============================================================ */
import React from "react";
import { useTheme, Btn } from "../ui/kit.jsx";
import { load } from "../engine/storage.js";

export default function Library({ modules, onPick, onResume }) {
  const C = useTheme();
  return (
    <div style={{ background: C.void, minHeight: "100vh", padding: "40px 20px", color: C.bone }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ fontFamily: C.mono, fontSize: 10, letterSpacing: "0.34em", color: C.graphite, marginBottom: 8 }}>
          RULES ENGINE · MOTHERSHIP 0e
        </div>
        <div style={{ fontFamily: C.display, fontSize: "clamp(40px,9vw,88px)", fontWeight: 700, lineHeight: 0.85, letterSpacing: "0.02em" }}>
          MODULE<span style={{ color: C.accent }}>·</span>LIBRARY
        </div>
        <p style={{ fontFamily: C.mono, fontSize: 12, lineHeight: 1.8, color: C.graphite, maxWidth: 560, marginTop: 18 }}>
          Load a module. The engine supplies the dice, the classes, the panic table and the character sheet.
          Everything else — the rooms, the crew, the thing in the dark — comes off the tape.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14, marginTop: 34 }}>
          {modules.map((m) => {
            const saved = load(m.id);
            return (
              <div key={m.id} style={{ border: `2px solid ${C.bone}`, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ height: 5, background: m.theme.accent, marginBottom: 4 }} />
                <div style={{ fontFamily: C.mono, fontSize: 8.5, letterSpacing: "0.24em", color: C.graphite }}>
                  {m.length.toUpperCase()} · {Object.keys(m.rooms).length} LOCATIONS
                </div>
                <div style={{ fontFamily: C.display, fontSize: 27, fontWeight: 700, lineHeight: 0.95, letterSpacing: "0.03em", color: m.theme.accent }}>
                  {m.title}
                </div>
                <div style={{ fontFamily: C.mono, fontSize: 11, lineHeight: 1.65, color: C.bone, flex: 1 }}>{m.blurb}</div>
                {m.byline && <div style={{ fontFamily: C.mono, fontSize: 9, color: C.graphite }}>{m.byline}</div>}
                {m.problems.length > 0 && (
                  <div style={{ fontFamily: C.mono, fontSize: 9.5, color: C.blood, lineHeight: 1.5 }}>
                    {m.problems.length} contract error{m.problems.length > 1 ? "s" : ""}: {m.problems[0]}
                  </div>
                )}
                <div style={{ display: "grid", gap: 5, marginTop: 4 }}>
                  <Btn kind="accent" onClick={() => onPick(m)} disabled={m.problems.length > 0}>Load module</Btn>
                  {saved && <Btn kind="ghost" onClick={() => onResume(m, saved)}>Resume session</Btn>}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ fontFamily: C.mono, fontSize: 9.5, color: C.graphite, marginTop: 40, lineHeight: 1.8, maxWidth: 620 }}>
          Adding your own: drop a folder in <code>src/modules/</code>, export a <code>defineModule({"{...}"})</code> object,
          and register it in <code>src/modules/index.js</code>. See <code>docs/MODULE_FORMAT.md</code>.
        </div>
      </div>
    </div>
  );
}
