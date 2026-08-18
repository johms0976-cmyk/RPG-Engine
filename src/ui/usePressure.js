/* ============================================================
   PRESSURE — the interface as an instrument.

   The engine already knew how close the table was to the end of
   a countdown; the only thing it did with that knowledge was
   make the alarm beep more often. Everything on screen looked
   exactly the same at four minutes to reactor breach as it did
   at four hours.

   This publishes that number as a CSS custom property on the
   document root, and pressure.css does the rest: grain comes up,
   the bone dirties, panel borders start to flicker, the clock
   itself gets unsteady. No component subscribes to it, nothing
   re-renders because of it, and no layout moves — it is one
   number written to one property about twice a minute.

   Two deliberate limits:

     · It is capped well below "unreadable". An interface that
       degrades until players cannot use it has stopped being
       atmosphere and started being an accessibility failure.
     · prefers-reduced-motion switches the whole thing off in
       pressure.css. Flicker is a genuine hazard, not a mood.
   ============================================================ */
import { useEffect } from "react";

/** Minutes at which pressure starts being felt at all. */
export const PRESSURE_WINDOW = 60;

/** 0 when nothing is ticking, 1 when the shortest countdown is done. */
export function pressureOf(w) {
  const list = Object.values((w && w.countdowns) || {}).filter((c) => !c.paused);
  if (!list.length) return 0;
  const soonest = Math.min(...list.map((c) => Math.max(0, c.left)));
  return Math.max(0, Math.min(1, 1 - soonest / PRESSURE_WINDOW));
}

export function usePressure(w) {
  const value = pressureOf(w);
  // Quantised to twenty steps: the CSS cannot show more than that and
  // it stops a per-minute tick from writing the property constantly.
  const step = Math.round(value * 20) / 20;

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const root = document.documentElement;
    root.style.setProperty("--pressure", String(step));
    // A boolean hook for rules that should switch rather than ramp.
    if (step > 0.001) root.setAttribute("data-pressure", "on");
    else root.removeAttribute("data-pressure");
    return () => {
      root.style.removeProperty("--pressure");
      root.removeAttribute("data-pressure");
    };
  }, [step]);

  return step;
}

export default usePressure;
