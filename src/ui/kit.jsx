/* ============================================================
   UI KIT — the chassis. Every colour and typeface comes from the
   loaded module's theme, so a tape can restyle the whole player.
   ============================================================ */
import React, { useState, createContext, useContext } from "react";

const ThemeCtx = createContext(null);
export const ThemeProvider = ({ theme, children }) => (
  <ThemeCtx.Provider value={theme}>{children}</ThemeCtx.Provider>
);
export const useTheme = () => useContext(ThemeCtx);

export function Panel({ title, icons, children, style, bodyStyle, dark }) {
  const C = useTheme();
  return (
    <div style={{
      background: dark ? C.ink : C.bone, color: dark ? C.bone : C.ink,
      border: `2px solid ${C.ink}`, display: "flex", flexDirection: "column", minHeight: 0, ...style,
    }}>
      {title && (
        <div style={{
          background: C.ink, color: C.bone, padding: "5px 9px", display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 8, flexShrink: 0, borderBottom: `2px solid ${C.ink}`,
        }}>
          <span style={{ fontFamily: C.display, fontWeight: 700, fontSize: 15, letterSpacing: "0.13em", textTransform: "uppercase" }}>{title}</span>
          {icons && <span style={{ fontFamily: C.mono, fontSize: 9, letterSpacing: "0.1em", color: C.accent }}>{icons}</span>}
        </div>
      )}
      <div style={{ padding: 10, overflowY: "auto", minHeight: 0, flex: 1, ...bodyStyle }}>{children}</div>
    </div>
  );
}

export function Btn({ children, onClick, disabled, kind = "default", style, title, type }) {
  const C = useTheme();
  const [hover, setHover] = useState(false);
  const hot = hover && !disabled;
  const kinds = {
    default: { background: hot ? C.ink : "transparent", color: hot ? C.bone : C.ink, border: `2px solid ${C.ink}` },
    solid: { background: hot ? C.accent : C.ink, color: hot ? C.ink : C.bone, border: `2px solid ${C.ink}` },
    accent: { background: hot ? C.ink : C.accent, color: hot ? C.accent : C.ink, border: `2px solid ${C.ink}` },
    danger: { background: hot ? C.blood : "transparent", color: hot ? C.bone : C.blood, border: `2px solid ${C.blood}` },
    ghost: { background: "transparent", color: hot ? C.accent : C.bone, border: `2px solid ${hot ? C.accent : C.graphite}` },
  };
  return (
    <button type={type} title={title} onClick={disabled ? undefined : onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        fontFamily: C.display, fontWeight: 700, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase",
        padding: "7px 10px", cursor: disabled ? "not-allowed" : "pointer", textAlign: "left", width: "100%",
        lineHeight: 1.15, transition: "background 90ms, color 90ms", opacity: disabled ? 0.35 : 1,
        ...kinds[kind], ...style,
      }}>{children}</button>
  );
}

export function Bar({ label, value, max, color, warn }) {
  const C = useTheme();
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: C.mono, fontSize: 9, letterSpacing: "0.12em", marginBottom: 2 }}>
        <span>{label}</span><span style={{ fontWeight: 700, color: warn ? C.blood : "inherit" }}>{value}/{max}</span>
      </div>
      <div style={{ height: 9, border: `1.5px solid ${C.ink}` }}>
        <div style={{ width: pct + "%", height: "100%", background: color || C.ink, transition: "width 240ms" }} />
      </div>
    </div>
  );
}

export function Label({ children }) {
  const C = useTheme();
  return <div style={{ fontFamily: C.mono, fontSize: 9, letterSpacing: "0.22em", color: C.graphite, margin: "4px 0 5px" }}>{children}</div>;
}

export function ActionGroup({ label, children }) {
  return <div><Label>{label.toUpperCase()}</Label><div style={{ display: "grid", gap: 5 }}>{children}</div></div>;
}

export function StatBox({ label, value, hot }) {
  const C = useTheme();
  return (
    <div style={{ flex: 1, border: `2px solid ${C.ink}`, textAlign: "center", padding: "4px 2px", background: hot ? C.accent : "transparent" }}>
      <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 21, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: C.mono, fontSize: 7.5, letterSpacing: "0.14em", color: C.graphite }}>{label}</div>
    </div>
  );
}

export function SheetRow({ title, items }) {
  const C = useTheme();
  return (
    <div style={{ marginBottom: 8 }}>
      <Label>{title}</Label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
        {items.map(([k, v]) => (
          <div key={k} style={{ border: `1.5px solid ${C.ink}`, textAlign: "center", padding: "3px 0" }}>
            <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 16, lineHeight: 1 }}>{v}</div>
            <div style={{ fontFamily: C.mono, fontSize: 7, letterSpacing: "0.1em", color: C.graphite }}>{k}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Modal({ children, onClose, width = 520 }) {
  const C = useTheme();
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(10,10,11,0.88)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16, zIndex: 60,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: width }}>{children}</div>
    </div>
  );
}

/** Feed line styling. Modules can override any key via `feedStyles`. */
export function feedStyleTable(C, overrides = {}) {
  return {
    room: { color: C.ink },
    warden: { color: C.ink },
    you: { color: C.ink, fontWeight: 700, borderLeft: `3px solid ${C.ink}`, paddingLeft: 8 },
    npc: { color: C.ink, borderLeft: `3px solid ${C.graphite}`, paddingLeft: 8 },
    system: { color: C.graphite, fontFamily: C.mono, fontSize: 11 },
    item: { color: C.ink, fontFamily: C.mono, fontSize: 11, fontWeight: 700 },
    search: { color: C.ink },
    move: { fontFamily: C.display, fontWeight: 700, letterSpacing: "0.14em", fontSize: 14, color: C.ink, borderTop: `2px solid ${C.ink}`, paddingTop: 6, marginTop: 4 },
    horror: { color: C.ink, background: C.accent, padding: "7px 9px", fontWeight: 600 },
    dmg: { color: C.bone, background: C.blood, padding: "5px 9px", fontFamily: C.mono, fontSize: 11 },
    good: { color: C.ink, borderLeft: `3px solid ${C.accent}`, paddingLeft: 8 },
    stress: { color: C.blood, fontFamily: C.mono, fontSize: 11, fontWeight: 700 },
    roll: { fontFamily: C.mono, fontSize: 10.5, color: C.graphite },
    rollgood: { fontFamily: C.mono, fontSize: 10.5, color: C.ink, background: C.bone2, padding: "4px 7px" },
    rollbad: { fontFamily: C.mono, fontSize: 10.5, color: C.bone, background: C.ink, padding: "4px 7px" },
    panic: { color: C.bone, background: C.ink, padding: "7px 9px", fontFamily: C.mono, fontSize: 11, borderLeft: `4px solid ${C.blood}` },
    alarm: { color: C.ink, background: C.accent, padding: "7px 9px", fontFamily: C.mono, fontSize: 11, fontWeight: 700 },
    handout: { color: C.ink, background: C.bone2, padding: "9px 10px", borderLeft: `4px solid ${C.ink}` },
    ...overrides,
  };
}
