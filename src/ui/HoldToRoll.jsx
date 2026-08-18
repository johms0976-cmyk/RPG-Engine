/* ============================================================
   HOLD TO ROLL — giving the dice back.

   Mothership's whole emotional shape is the second between the
   Warden asking for a Fear Save and the number landing. Roll
   Theatre already made the *result* an event. What it could not
   fix is that the player never rolled anything: a button marked
   "Roll Fear" is an instruction to the computer to have the
   experience on your behalf.

   At a table you pick the dice up. There is a pause, entirely
   under your control, while you decide to let go. Nobody
   designed that pause — it is a consequence of dice being
   physical — and it is where the dread lives.

   So: press and hold. The bar fills. Let go early and nothing
   happens, which is the point; the roll leaves when *you* leave
   it. About two thirds of a second, long enough to feel like a
   decision and short enough that a table of five is not waiting
   on a ceremony.

   Shake works too, on phones that report motion, because a
   handful of players will try it and being right about that is
   worth the twenty lines.

   Accessibility is not an afterthought here: Space and Enter
   hold and release exactly like a finger, and anyone who cannot
   hold at all gets a plain button after the first attempt rather
   than being locked out of the game's central verb.
   ============================================================ */
import React, { useState, useRef, useEffect, useCallback } from "react";

export const HOLD_MS = 650;
/** Rough m/s² over gravity that reads as a deliberate shake. */
const SHAKE_FORCE = 16;

export default function HoldToRoll({ onRoll, label = "Roll", hint, disabled = false }) {
  const [held, setHeld] = useState(false);
  const [progress, setProgress] = useState(0);
  /* Shown after a hold is abandoned. Somebody who cannot hold a button
     steadily — a tremor, a trackpad, a switch device — should not be
     shut out of the one action the game asks for most. */
  const [offerTap, setOfferTap] = useState(false);
  const timer = useRef(null);
  const raf = useRef(null);
  const startedAt = useRef(0);
  const done = useRef(false);

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    cancelAnimationFrame(raf.current);
    timer.current = null;
    raf.current = null;
  }, []);

  const fire = useCallback(() => {
    if (done.current || disabled) return;
    done.current = true;
    clear();
    setHeld(false);
    setProgress(1);
    if (navigator.vibrate) navigator.vibrate([12, 40, 22]);
    onRoll();
  }, [onRoll, disabled, clear]);

  const start = useCallback(() => {
    if (disabled || done.current || held) return;
    setHeld(true);
    setOfferTap(false);
    startedAt.current = Date.now();
    if (navigator.vibrate) navigator.vibrate(8);
    timer.current = setTimeout(fire, HOLD_MS);
    const tick = () => {
      const p = Math.min(1, (Date.now() - startedAt.current) / HOLD_MS);
      setProgress(p);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [disabled, held, fire]);

  const cancel = useCallback(() => {
    if (!held) return;
    clear();
    setHeld(false);
    setProgress(0);
    setOfferTap(true);
  }, [held, clear]);

  useEffect(() => () => clear(), [clear]);

  /* Shake. Only armed while this control is on screen, so a player
     jostling their phone in a corridor never rolls anything. */
  useEffect(() => {
    if (disabled || typeof window === "undefined" || !window.DeviceMotionEvent) return undefined;
    let last = 0;
    const onMotion = (e) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const force = Math.abs(a.x || 0) + Math.abs(a.y || 0) + Math.abs(a.z || 0);
      const now = Date.now();
      if (force > SHAKE_FORCE + 9.8 && now - last > 900) { last = now; fire(); }
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [fire, disabled]);

  return (
    <div className="hold-wrap">
      <button
        type="button"
        className={`hold-roll${held ? " is-held" : ""}`}
        disabled={disabled}
        aria-label={`${label} — press and hold`}
        onPointerDown={(e) => { e.preventDefault(); start(); }}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); start(); } }}
        onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") cancel(); }}
      >
        <span className="hold-fill" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
        <span className="hold-label">{held ? "Hold…" : label}</span>
        <span className="hold-hint">{hint || "press and hold — or shake"}</span>
      </button>

      {offerTap && (
        <button type="button" className="hold-plain" onClick={fire} disabled={disabled}>
          Or tap here to roll
        </button>
      )}
    </div>
  );
}
