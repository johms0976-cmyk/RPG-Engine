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

/* ============================================================
   STRAIN — the same idea, pointed at the character.

   `pressure` is a property of the *world*: a countdown is running
   and everyone at the table shares it. Strain is a property of
   the person holding the phone, and in Mothership that is the
   more important of the two, because Stress is the actual
   antagonist. A character at Stress 14 is a different reading
   experience from one at Stress 2, and until now the interface
   said nothing about it at all.

   The mapping is deliberately not linear. Nothing happens below
   MIN_STRESS, because a character with a couple of points is
   fine and a screen that degrades from the first bad roll has
   nowhere left to go by the time it matters. Between there and
   the Panic-likely range it ramps, and it caps — hard — well
   short of illegible.

   THE ACCESSIBILITY LINE, STATED PLAINLY. This is atmosphere
   layered over an interface that must remain usable by someone
   having the worst moment of their character's life. So: no
   layout movement, no opacity below the point where text is
   readable, and the whole thing switches off under
   prefers-reduced-motion. A player who cannot read their own
   status strip is not immersed, they are excluded. */

/** Below this, Stress is a number on a sheet and nothing more. */
export const STRAIN_FLOOR = 5;
/** At and above this the treatment is at full strength. Chosen
    because Panic checks become genuinely likely around here. */
export const STRAIN_CEILING = 15;

/** 0 to 1, from a character's Stress. */
export function strainOf(pc) {
  const stress = (pc && pc.stress) || 0;
  if (stress <= STRAIN_FLOOR) return 0;
  return Math.max(0, Math.min(1, (stress - STRAIN_FLOOR) / (STRAIN_CEILING - STRAIN_FLOOR)));
}

/**
 * Publish the acting character's Stress as a CSS property, exactly
 * as usePressure does for the world's countdowns. Same contract:
 * one number, written rarely, read by dread.css. No component
 * subscribes and nothing re-renders.
 */
export function useStrain(pc) {
  const value = strainOf(pc);
  // Five steps rather than twenty: Stress moves in whole points and
  // a finer scale would just be writes nobody can see.
  const step = Math.round(value * 5) / 5;

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const root = document.documentElement;
    root.style.setProperty("--strain", String(step));
    if (step > 0.001) root.setAttribute("data-strain", "on");
    else root.removeAttribute("data-strain");
    return () => {
      root.style.removeProperty("--strain");
      root.removeAttribute("data-strain");
    };
  }, [step]);

  return step;
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
