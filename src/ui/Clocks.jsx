/* ============================================================
   CLOCKS — the countdown as pressure, not as a timestamp.

   A player looking at their phone during a self-destruct sequence
   saw `fmtClock(w.clock)` in a panel header: the time of day on a
   rock nobody has been to in a fortnight. The countdown existed —
   `w.countdowns` has been carrying it all along, and buildRecap
   already reads it — but the one place it mattered rendered it as
   a number in a list of numbers.

   What a countdown is, at a table, is a bar getting shorter. So:

     · every running countdown draws as a track that empties, with
       the minutes left in the largest type on the strip
     · the colour is a function of proximity rather than of which
       countdown it is, because at four minutes the player does not
       care whether it is the reactor or the shuttle
     · a held countdown says so and stops animating, because the
       Warden holding the reactor is information the table should
       have — see wardenCountdown
     · nothing renders at all when nothing is ticking. A permanent
       empty clock strip is wallpaper by minute ten, which is the
       same mistake the panel header was making

   `full` is the module's own sense of how long this countdown was
   when it started, so a thirty-minute self-destruct and a
   four-hour cargo window draw at the same scale rather than both
   starting full and one of them crawling.
   ============================================================ */
import React from "react";

/** Under this many minutes and the thing is imminent rather than
    pending. Matches duress.js's PRESSED threshold so the two never
    disagree about what "soon" means. */
export const SOON_MINS = 5;
export const CLOSE_MINS = 20;

const band = (left) => (left <= 2 ? "now" : left <= SOON_MINS ? "soon" : left <= CLOSE_MINS ? "close" : "open");

const readable = (mins) => {
  if (mins >= 120) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
  return `${mins}m`;
};

/**
 * One countdown. `cd` is the shape the world stores:
 * `{ left, paused, cfg: { id, minutes, label, full } }`.
 */
export function ClockBar({ id, cd }) {
  const cfg = cd.cfg || {};
  const left = Math.max(0, cd.left);
  const full = Math.max(left, cfg.full || cfg.minutes || left || 1);
  const frac = Math.max(0, Math.min(1, left / full));
  const label = cfg.label || String(id).replace(/[_:]+/g, " ").toUpperCase();

  return (
    <div className={`clockbar is-${band(left)}${cd.paused ? " is-held" : ""}`}
      role="timer"
      aria-label={`${label}, ${readable(left)} remaining${cd.paused ? ", held" : ""}`}>
      <span className="clockbar-name">{label}</span>
      <span className="clockbar-track" aria-hidden="true">
        <i style={{ transform: `scaleX(${frac})` }} />
      </span>
      <span className="clockbar-left">{cd.paused ? "held" : readable(left)}</span>
    </div>
  );
}

/**
 * Every countdown the table is under. Renders nothing when nothing
 * is running, on purpose.
 */
export default function ClockStrip({ w, compact = false }) {
  const running = Object.entries((w && w.countdowns) || {});
  if (!running.length) return null;

  // Soonest first: the one about to land is the one being read.
  const sorted = [...running].sort((a, b) => a[1].left - b[1].left);
  const shown = compact ? sorted.slice(0, 2) : sorted;

  return (
    <div className="clockstrip">
      {shown.map(([id, cd]) => <ClockBar key={id} id={id} cd={cd} />)}
      {compact && sorted.length > shown.length && (
        <span className="clue-meta">+{sorted.length - shown.length} more</span>
      )}
    </div>
  );
}
