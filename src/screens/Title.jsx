import React from "react";
import { useTheme, Btn } from "../ui/kit.jsx";

export default function Title({ mod, onBegin, onQuick, onBack }) {
  const C = useTheme();
  return (
    <div style={{ background: C.void, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 680, width: "100%" }}>
        <div style={{ fontFamily: C.mono, fontSize: 10, letterSpacing: "0.34em", color: C.graphite, marginBottom: 10 }}>
          {mod.length.toUpperCase()} FOR THE
        </div>
        <div style={{ fontFamily: C.display, fontSize: "clamp(46px,11vw,104px)", fontWeight: 700, color: C.bone, letterSpacing: "0.02em", lineHeight: 0.82 }}>
          MOTHERSHIP
        </div>
        <div style={{ fontFamily: C.mono, fontSize: 11, letterSpacing: "0.42em", color: C.bone, margin: "10px 0 30px" }}>
          {mod.subtitle.replace(/^MOTHERSHIP · /, "")}
        </div>
        <div style={{ fontFamily: C.display, fontSize: "clamp(32px,8vw,66px)", fontWeight: 700, color: C.accent, lineHeight: 0.88 }}>
          {mod.title}
        </div>
        {mod.pitch.map((p, i) => (
          <p key={i} style={{ fontFamily: C.mono, fontSize: 12.5, lineHeight: 1.75, color: i ? C.graphite : C.bone, marginTop: i ? 0 : 26, maxWidth: 540 }}>{p}</p>
        ))}
        {mod.contentWarning && (
          <div style={{ fontFamily: C.mono, fontSize: 10, lineHeight: 1.7, color: C.blood, border: `1.5px solid ${C.blood}`, padding: "8px 10px", margin: "18px 0", maxWidth: 540 }}>
            CONTENT WARNING · {mod.contentWarning}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 28, flexWrap: "wrap" }}>
          <div style={{ minWidth: 210 }}><Btn kind="accent" onClick={onBegin}>Make a character</Btn></div>
          <div style={{ minWidth: 210 }}><Btn kind="solid" onClick={onQuick}>Quick start — pregen</Btn></div>
          <div style={{ minWidth: 150 }}><Btn kind="ghost" onClick={onBack}>Back to library</Btn></div>
        </div>
        {mod.byline && (
          <div style={{ fontFamily: C.mono, fontSize: 9.5, color: C.graphite, marginTop: 26, lineHeight: 1.7 }}>{mod.byline}</div>
        )}
      </div>
    </div>
  );
}
