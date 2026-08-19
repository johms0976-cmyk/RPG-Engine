/* ============================================================
   PACING — the clock the software could not see.

   The engine has always known the fiction's clock precisely:
   `w.clock` in minutes, countdowns to the minute, a 240-minute
   transfer window. It has never known what time it actually is.

   That gap is where sessions go wrong. The Warden's dossier
   budgets Ypsilon 14 in *real* hours — roughly an hour of
   wandering and talking, then the base turning, then an ending —
   and a Warden three real hours in with 180 fiction-minutes left
   on the transfer clock has a pacing problem that the software
   has every number needed to name and was saying nothing about.

   WHAT THIS IS NOT. It is not a schedule, and it does not tell
   anyone to hurry. Tables that spend two hours arguing in a
   corridor are not doing it wrong, and a tool that nags them is
   a tool that gets turned off. It reports one ratio and one
   sentence, on the Warden's screen only, and every lever it
   might suggest is one the Warden already had.

   THE RATIO. Fiction-minutes spent per real minute spent. A
   module carries its own expectation — Ypsilon's four fiction-
   hours are meant to fill roughly three real ones, so about 1.3
   — and the interesting states are the two ends:

     DRIFTING   the fiction is barely moving. Lots of talk, few
                clock-advancing actions. Usually good, and worth
                naming only when the session is nearly over and
                the module has not started.
     RUNNING    the fiction is outpacing the table. Six players
                each burning twenty minutes on searches, and the
                window will close before anybody has met anyone.

   Both are recoverable, and both are much easier to recover from
   at minute forty than at minute one-fifty.
   ============================================================ */

/** Fiction-minutes per real minute a module expects. Overridable
    by `mod.pacing.rate`; 1.3 suits a four-hour window in a three-
    hour sitting, which is the shape of most one-shots. */
export const DEFAULT_RATE = 1.3;

/** Below this fraction of the expected rate, the fiction is
    drifting. Above the second, it is running away. Deliberately
    wide — a table is allowed to be a table. */
export const DRIFT_UNDER = 0.45;
export const RUSH_OVER = 2.2;

/** Real minutes before any of this is worth a word. A session that
    has been going twenty minutes has no trend to report. */
export const WARMUP_MIN = 25;

/**
 * @param startedAt   Date.now() when the session began
 * @param clock       w.clock, fiction-minutes elapsed
 * @param now         injectable for tests
 * @param rate        fiction-minutes per real minute expected
 */
export function pacingOf({ startedAt, clock = 0, now = Date.now(), rate = DEFAULT_RATE }) {
  if (!startedAt) return null;
  const realMins = Math.max(0, (now - startedAt) / 60000);
  if (realMins < WARMUP_MIN) {
    return { state: "warmup", realMins, fictionMins: clock, ratio: null, expected: rate };
  }
  const observed = clock / realMins;
  const ratio = rate > 0 ? observed / rate : 1;

  let state = "steady";
  if (ratio < DRIFT_UNDER) state = "drifting";
  else if (ratio > RUSH_OVER) state = "running";

  return { state, realMins, fictionMins: clock, observed, ratio, expected: rate };
}

/**
 * One sentence for the Warden's screen, or null when there is
 * nothing worth saying — which is most of the time, and is the
 * property that keeps this from becoming wallpaper.
 *
 * `soonest` is the shortest live countdown in minutes, because
 * "you have 180 fiction-minutes left and 40 real ones" is the
 * form of the problem a Warden can actually act on.
 */
export function pacingNote(pacing, { soonest = null, label = null } = {}) {
  if (!pacing || pacing.state === "warmup" || pacing.state === "steady") return null;

  const real = Math.round(pacing.realMins);
  const hrs = Math.floor(real / 60);
  const realText = hrs ? `${hrs}h ${real % 60}m` : `${real}m`;

  if (pacing.state === "drifting") {
    /* Only worth naming when there is something waiting that the
       table has not reached. A slow, talkative session with no
       clock running is just a good session. */
    if (soonest == null) return null;
    return `${realText} of real time in, and ${soonest}m still on ${label || "the clock"}. The fiction is barely moving — if there is something you want them to reach, this is the point to bring it to them.`;
  }

  return `${realText} of real time in, and the fiction is running about ${Math.round(pacing.ratio * 100)}% of the expected pace${soonest != null ? `, with ${soonest}m left on ${label || "the clock"}` : ""}. At this rate the window closes before the table gets there.`;
}

/** The shortest live countdown, as `{ left, label }` or null. */
export function soonestClock(w) {
  const entries = Object.entries((w && w.countdowns) || {}).filter(([, c]) => !c.paused);
  if (!entries.length) return null;
  const [id, c] = entries.reduce((a, b) => (a[1].left <= b[1].left ? a : b));
  return { left: Math.max(0, c.left), label: c.label || id.toUpperCase() };
}
