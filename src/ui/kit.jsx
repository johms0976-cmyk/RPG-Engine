/* ============================================================
   UI KIT — the chassis.

   Colours come from the loaded module's theme, written into CSS
   custom properties so the stylesheet can use media queries and
   :focus-visible. Modals trap focus and close on Escape. The
   feed is a live region so a screen reader actually reads the
   game, which for a text game is the whole point.
   ============================================================ */
import React, { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from "react";

const ThemeCtx = createContext(null);
export const useTheme = () => useContext(ThemeCtx) || {};

/* ============================================================
   THEME DEPTH — why a module gets more than a colour.

   A theme used to be an accent and a treatment, which meant the
   next module in the library was this one recoloured. But the
   thing that makes a place feel like a different place is rarely
   its hue: it is the face the headings are set in, how dirty the
   paper is, and whether the horror lines look like the rest of
   the text or like something the document is trying not to say.

   So three things are wired through instead of one:

     · every theme key becomes a CSS custom property, which
       already worked, and now formally includes `display`,
       `mono` and `grain`
     · `grain` (0–1) drives a permanent paper texture that is
       independent of the countdown's pressure grain — one is
       the module's character, the other is the clock
     · `feedStyles` lets a module restyle individual feed kinds
       without shipping a stylesheet, since a module is data and
       must stay data

   feedStyles is written as a scoped <style> element rather than
   inline styles because feed lines are generated in a loop deep
   inside kit.jsx, and threading a style object down to them
   would mean every module change re-rendered the whole log.
   ============================================================ */
function FeedStyles({ styles }) {
  const css = useMemo(() => {
    if (!styles) return "";
    return Object.entries(styles).map(([kind, rules]) => {
      // Only properties we name are allowed through. A module is data
      // from a folder, and data should not be able to write arbitrary
      // CSS into the page.
      const allow = ["color", "background", "borderLeft", "fontStyle", "fontWeight",
        "fontFamily", "fontSize", "letterSpacing", "textTransform", "padding", "opacity"];
      const body = allow
        .filter((k) => rules[k] != null)
        .map((k) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${rules[k]}`)
        .join(";");
      const safeKind = String(kind).replace(/[^a-z0-9_-]/gi, "");
      return body ? `.feed .k-${safeKind}{${body}}` : "";
    }).join("\n");
  }, [styles]);

  if (!css) return null;
  return <style>{css}</style>;
}

export function ThemeProvider({ theme, treatment = "print", children, feedStyles }) {
  const style = {};
  for (const [k, v] of Object.entries(theme || {})) style[`--${k}`] = v;
  // `treatment` drives the art-direction skin in art.css: print
  // (default), crt, or thermal. Modules opt in via theme.treatment.
  const t = ["print", "crt", "thermal"].includes(treatment) ? treatment : "print";
  // The module's own paper. Separate from --pressure, which is the
  // countdown; a module can be grubby from the first minute.
  const grain = Math.max(0, Math.min(1, Number((theme && theme.grain) ?? 0)));
  return (
    <ThemeCtx.Provider value={theme}>
      <div style={style} className="app" data-treatment={t} data-grain={grain > 0 ? "on" : undefined}>
        <FeedStyles styles={feedStyles} />
        {children}
        {t === "crt" && <div className="crt-rollbar" aria-hidden="true" />}
      </div>
    </ThemeCtx.Provider>
  );
}

export function Panel({ title, icons, children, dark, className = "", bodyClass = "", style, as = "section", labelledBy }) {
  const Tag = as;
  const id = useRef(`p${Math.random().toString(36).slice(2, 8)}`).current;
  return (
    <Tag className={`panel ${dark ? "dark" : ""} ${className}`} style={style}
      aria-labelledby={title ? id : labelledBy}>
      {title && (
        <header>
          <h2 id={id}>{title}</h2>
          {icons && <span className="icons">{icons}</span>}
        </header>
      )}
      <div className={`body ${bodyClass}`}>{children}</div>
    </Tag>
  );
}

export function Btn({ children, onClick, disabled, kind = "default", className = "", title, hint, type = "button", ...rest }) {
  return (
    <button type={type} title={title} onClick={disabled ? undefined : onClick} disabled={disabled}
      className={`btn ${kind} ${className}`} {...rest}>
      <span>{children}</span>
      {hint && <span className="hint">{hint}</span>}
    </button>
  );
}

export function Bar({ label, value, max, color, warn }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className={`bar ${warn ? "warn" : ""}`}>
      <div className="bar-label">
        <span>{label}</span>
        <span className="bar-value">{value}/{max}</span>
      </div>
      <div className="bar-track" role="meter" aria-label={`${label} ${value} of ${max}`}
        aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        <div className="bar-fill" style={{ width: pct + "%", background: color }} />
      </div>
    </div>
  );
}

export const Label = ({ children }) => <div className="label">{children}</div>;

export function ActionGroup({ label, children }) {
  return (
    <div>
      <Label>{String(label).toUpperCase()}</Label>
      <div className="btn-grid">{children}</div>
    </div>
  );
}

export function StatBox({ label, value, hot, title }) {
  return (
    <div className={`statbox ${hot ? "hot" : ""}`} title={title}>
      <div className="v">{value}</div>
      <div className="k">{label}</div>
    </div>
  );
}

export function SheetRow({ title, items }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <Label>{title}</Label>
      <div className="statgrid">
        {items.map(([k, v, hot]) => <StatBox key={k} label={k} value={v} hot={hot} />)}
      </div>
    </div>
  );
}

/* ---------------- accessible modal ---------------- */

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ children, onClose, title, wide, dismissable = true }) {
  const ref = useRef(null);
  const restore = useRef(null);

  useEffect(() => {
    restore.current = document.activeElement;
    const node = ref.current;
    if (node) {
      const first = node.querySelector(FOCUSABLE);
      (first || node).focus();
    }
    const onKey = (e) => {
      if (e.key === "Escape" && dismissable) { e.stopPropagation(); onClose && onClose(); return; }
      if (e.key !== "Tab" || !node) return;
      const items = Array.from(node.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (restore.current && restore.current.focus) restore.current.focus();
    };
  }, [onClose, dismissable]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (dismissable && e.target === e.currentTarget) onClose && onClose(); }}>
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}

/* ---------------- the feed ---------------- */

export function Feed({ feed, autoScroll = true }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!autoScroll || !ref.current) return;
    ref.current.scrollTop = ref.current.scrollHeight;
  }, [feed, autoScroll]);

  return (
    <div ref={ref} className="body scroll" id="feed-scroll">
      {/* role=log + aria-live is what makes this game playable with a
          screen reader. Without it, none of the narration is announced. */}
      <div className="feed" role="log" aria-live="polite" aria-relevant="additions text" aria-label="Session log">
        {feed.map((f) => (
          <p key={f.id} className={`k-${f.kind}`}>{f.text}</p>
        ))}
      </div>
    </div>
  );
}

export const Tag = ({ children }) => <span className="tag">{children}</span>;

/** A tidy labelled field. */
export function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

export function useKey(key, fn, active = true) {
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    if (!active) return;
    const h = (e) => {
      if (e.key !== key) return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      saved.current(e);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [key, active]);
}
