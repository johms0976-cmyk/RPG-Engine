/* ============================================================
   TITLE SEQUENCE

   A boot log that types itself, then the slam. The point is not
   decoration: the pre-flight lines tell the player what module
   they loaded, how many rooms it has, whether it validated, and
   what the content warning is — which is exactly the
   information a title screen should carry and usually doesn't.

   Skippable at any keypress or tap, and skipped entirely under
   prefers-reduced-motion.
   ============================================================ */
import React, { useState, useEffect, useRef } from "react";
import { Btn } from "./kit.jsx";

const reduced = () =>
  typeof window !== "undefined" && window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function TitleSequence({ mod, onBegin, onGather, onQuick, onBack }) {
  const lines = useRef([
    { t: "PWR ....... NOMINAL", k: "ok" },
    { t: `CART ...... ${mod.title.toUpperCase()}`, k: "ok" },
    { t: `ROOMS ..... ${Object.keys(mod.rooms).length}  ·  THREATS ${Object.keys(mod.threats).length}  ·  NPCS ${Object.keys(mod.npcs).length}`, k: "" },
    mod.problems && mod.problems.length
      ? { t: `VALIDATE .. ${mod.problems.length} PROBLEM${mod.problems.length === 1 ? "" : "S"}`, k: "bad" }
      : { t: "VALIDATE .. PASS", k: "ok" },
    { t: "NET ....... NONE. NO KEY. NO TOKENS.", k: "ok" },
    mod.contentWarning ? { t: `ADVISORY .. ${mod.contentWarning.toUpperCase()}`, k: "bad" } : null,
  ].filter(Boolean)).current;

  const [shown, setShown] = useState(reduced() ? lines.length : 0);
  const [done, setDone] = useState(reduced());

  useEffect(() => {
    if (done) return;
    if (shown >= lines.length) { setDone(true); return; }
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 180 : 145);
    return () => clearTimeout(t);
  }, [shown, done, lines.length]);

  const skip = () => { setShown(lines.length); setDone(true); };

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape" || e.key === "Enter") skip(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div className="title-seq" onClick={done ? undefined : skip}>
      <div className="warn-strip" aria-hidden="true" />

      <pre className="preflight" aria-label="Pre-flight check">
        {lines.slice(0, shown).map((l, i) => (
          <div key={i} className={l.k}>{l.t}</div>
        ))}
      </pre>

      {done && (
        <>
          <h1 className="title-main">{mod.title}</h1>
          <div className="title-rule" aria-hidden="true" />
          <div className="title-sub">{mod.subtitle}</div>
          {mod.blurb && <p className="title-blurb">{mod.blurb}</p>}
          {mod.byline && <div className="title-sub">{mod.byline}</div>}

          <div className="title-actions">
            {/* Hosting a table is the common case when this tab was opened
                as the Warden's screen, so it leads. */}
            {onGather && (
              <Btn kind="primary" onClick={onGather} hint="players build their own on their phones">
                GATHER THE TABLE
              </Btn>
            )}
            <Btn kind={onGather ? "default" : "primary"} onClick={onBegin}>
              {onGather ? "BUILD THE CREW HERE" : "MAKE A CREW"}
            </Btn>
            <Btn onClick={onQuick}>QUICK START</Btn>
            <Btn onClick={onBack}>LIBRARY</Btn>
          </div>
        </>
      )}

      {!done && <button className="skip" onClick={skip}>PRESS ANY KEY TO SKIP</button>}
    </div>
  );
}

export default TitleSequence;
