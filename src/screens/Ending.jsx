import React from "react";
import { useTheme, Btn } from "../ui/kit.jsx";
import { fmtClock } from "../engine/rules.js";

export default function Ending({ mod, w, pc, onAgain, onLibrary }) {
  const C = useTheme();
  const end = mod.endings[w.ended] || { title: "THE END", text: "", good: false };
  const lines = mod.debrief ? mod.debrief(w, pc, mod) : [];
  const xp = mod.xp ? mod.xp(w, pc) : 10;

  return (
    <div style={{ background: C.void, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 22 }}>
      <div style={{ maxWidth: 600, width: "100%" }}>
        <div style={{ fontFamily: C.mono, fontSize: 10, letterSpacing: "0.34em", color: C.graphite, marginBottom: 10 }}>
          SESSION ENDS · T+{fmtClock(w.clock)}
        </div>
        <div style={{ fontFamily: C.display, fontSize: "clamp(38px,9vw,76px)", fontWeight: 700, lineHeight: 0.88, color: end.good ? C.accent : C.bone, marginBottom: 18 }}>
          {end.title}
        </div>
        <p style={{ fontFamily: C.mono, fontSize: 13, lineHeight: 1.8, color: C.bone, marginBottom: 22 }}>{end.text}</p>
        <div style={{ border: `2px solid ${C.bone}`, padding: 14, fontFamily: C.mono, fontSize: 11, lineHeight: 1.9, color: C.bone, marginBottom: 20 }}>
          <div style={{ letterSpacing: "0.2em", fontSize: 9, color: C.graphite, marginBottom: 8 }}>DEBRIEF</div>
          {pc.name} · {pc.cls.toUpperCase()} · Health {pc.health}/{pc.maxHealth} · Stress {pc.stress}<br />
          Locations mapped: {Object.keys(w.visited).length} of {Object.keys(mod.rooms).length}<br />
          {lines.map((l, i) => <span key={i}>{l}<br /></span>)}
          <span style={{ color: C.accent }}>XP earned: {xp}</span>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ minWidth: 200 }}><Btn kind="accent" onClick={onAgain}>Run it again</Btn></div>
          <div style={{ minWidth: 200 }}><Btn kind="ghost" onClick={onLibrary}>Back to library</Btn></div>
        </div>
      </div>
    </div>
  );
}
