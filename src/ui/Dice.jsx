/* ============================================================
   DICE — the d% reveal.

   Mothership's whole emotional engine is roll-under d%. In v1
   that arrived as a line of text that was already true by the
   time you read it. This makes the roll *happen*.

   The sequence, and the reason for each beat:

     RATTLE   ~340ms of both dice cycling. Establishes that the
              number is not decided yet.
     TENS     the tens die lands first. This is the beat that
              matters: on a target of 35, a tens die showing 6
              has already failed and the player knows it before
              the engine says so.
     ONES     lands ~420ms later. On a tens result that is still
              live, this is the whole game.
     VERDICT  the stamp. Doubles get called out as criticals
              because that is what doubles mean here.

   PANIC gets an extra held beat before the verdict — a second of
   nothing, which is the most expensive second the UI can spend
   and the best value for money in this entire codebase.

   prefers-reduced-motion collapses all of it to an instant
   result with no cycling. The information is identical; only
   the theatre is removed.
   ============================================================ */
import React, { useState, useEffect, useRef, useCallback } from "react";

const RATTLE = 340;
const TENS_HOLD = 420;
const ONES_HOLD = 260;
const PANIC_BEAT = 900;

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Drives one reveal. Returns the current phase and the digits to
 * show — which are random noise until each die lands.
 */
export function useDiceReveal(roll, { panic = false, onDone } = {}) {
  const [phase, setPhase] = useState("idle");
  const [noise, setNoise] = useState({ t: 0, o: 0 });
  const timers = useRef([]);
  const spinner = useRef(null);
  const done = useRef(onDone);
  done.current = onDone;

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (spinner.current) { clearInterval(spinner.current); spinner.current = null; }
  };

  useEffect(() => {
    clear();
    if (!roll) { setPhase("idle"); return; }

    if (prefersReduced()) {
      setPhase("verdict");
      if (done.current) done.current();
      return;
    }

    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms));
    setPhase("rattle");

    // Cycle both faces during the rattle so the numbers are visibly
    // undecided rather than blank.
    spinner.current = setInterval(() => {
      setNoise({ t: Math.floor(Math.random() * 10), o: Math.floor(Math.random() * 10) });
    }, 55);

    at(RATTLE, () => {
      clearInterval(spinner.current); spinner.current = null;
      setPhase("tens");
    });
    at(RATTLE + TENS_HOLD, () => setPhase("ones"));
    at(RATTLE + TENS_HOLD + ONES_HOLD, () => setPhase(panic ? "beat" : "verdict"));
    if (panic) at(RATTLE + TENS_HOLD + ONES_HOLD + PANIC_BEAT, () => setPhase("verdict"));
    at(RATTLE + TENS_HOLD + ONES_HOLD + (panic ? PANIC_BEAT : 0) + 40, () => {
      if (done.current) done.current();
    });

    return clear;
  }, [roll && roll.id, roll && roll.value, panic]);

  useEffect(() => () => clear(), []);

  const landedTens = phase !== "idle" && phase !== "rattle";
  const landedOnes = phase === "ones" || phase === "beat" || phase === "verdict";

  return {
    phase,
    tens: landedTens ? roll.tens : noise.t,
    ones: landedOnes ? roll.ones : noise.o,
    landedTens,
    landedOnes,
    showVerdict: phase === "verdict",
    holding: phase === "beat",
    skip: useCallback(() => { clear(); setPhase("verdict"); }, []),
  };
}

/* ---------------- the die face ---------------- */

function Die({ value, landed, kind }) {
  return (
    <div className={`die ${landed ? "landed" : "rolling"} ${kind}`} aria-hidden="true">
      <span className="die-face">{value}</span>
      <span className="die-kind">{kind === "tens" ? "10s" : "1s"}</span>
    </div>
  );
}

/**
 * The reveal panel.
 * `roll` is the shape useGame already puts in `lastRoll`, plus
 * tens/ones which the pure core now carries through.
 */
export function DiceReveal({ roll, panic = false, onDone, compact = false }) {
  const r = useDiceReveal(roll, { panic, onDone });
  if (!roll) return null;

  const tens = roll.tens != null ? roll.tens : Math.floor(roll.value / 10);
  const ones = roll.ones != null ? roll.ones : roll.value % 10;
  const shown = { ...roll, tens, ones };

  const verdict = roll.critHit ? "CRITICAL SUCCESS"
    : roll.critFail ? "CRITICAL FAILURE"
      : roll.success ? "SUCCESS" : "FAILURE";
  const tone = roll.critHit ? "crit-good" : roll.critFail ? "crit-bad"
    : roll.success ? "good" : "bad";

  // Once the tens die is down, say what it has already decided.
  const tensVerdict = (() => {
    if (!r.landedTens || r.landedOnes || roll.target == null) return null;
    const floor = shown.tens * 10;
    if (floor > roll.target) return "already over";
    if (floor + 9 <= roll.target) return "already under";
    return "live";
  })();

  return (
    <div
      className={`dice-reveal ${tone} ${r.showVerdict ? "settled" : ""} ${r.holding ? "holding" : ""} ${compact ? "compact" : ""}`}
      onClick={r.skip}
      role="status"
      aria-live="polite"
      aria-label={`${roll.label || "Check"}: rolled ${roll.value} against ${roll.target}. ${verdict}.`}
    >
      <div className="dice-head">
        <span className="dice-who">{roll.who}</span>
        <span className="dice-label">{roll.label}</span>
        {roll.target != null && <span className="dice-target">{roll.target}%</span>}
      </div>

      <div className="dice-pair">
        <Die value={shown.tens} landed={r.landedTens} kind="tens" />
        <Die value={shown.ones} landed={r.landedOnes} kind="ones" />
        {r.landedOnes && (
          <div className="dice-total">
            <span className="dice-total-v">{String(roll.value).padStart(2, "0")}</span>
            {roll.doubles && <span className="dice-doubles">DOUBLES</span>}
          </div>
        )}
      </div>

      {tensVerdict && (
        <div className={`dice-tens-call ${tensVerdict.replace(" ", "-")}`}>
          {tensVerdict === "already over" ? "that's over the number"
            : tensVerdict === "already under" ? "that's under, whatever comes next"
              : "still live"}
        </div>
      )}

      {r.holding && <div className="dice-hold" aria-hidden="true">···</div>}

      {r.showVerdict && (
        <div className="dice-verdict">
          <span className="stamp">{verdict}</span>
          {roll.margin != null && roll.success && <span className="by">by {roll.margin}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * Queue wrapper: rolls arrive faster than they can be watched, so
 * this shows the most recent one and skips any that pile up behind
 * it rather than making the player wait through a backlog.
 */
export function DiceTheatre({ lastRoll, panicPending }) {
  const [showing, setShowing] = useState(null);
  const seen = useRef(null);

  useEffect(() => {
    if (!lastRoll || lastRoll === seen.current) return;
    seen.current = lastRoll;
    setShowing({ ...lastRoll, id: Math.random() });
  }, [lastRoll]);

  if (!showing) return null;
  return <DiceReveal roll={showing} panic={panicPending} />;
}

export default DiceReveal;
