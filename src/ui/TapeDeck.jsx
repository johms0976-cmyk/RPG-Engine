/* ============================================================
   TAPE DECK — a cassette that actually plays.

   Artefact.jsx draws a handout as the object it is. For every
   style but one that is the whole job: a note is paper, a log is
   a terminal, and reading it is the interaction.

   A cassette is not read. It is played, and until now the engine
   drew a beautiful label for a tape and then made the Warden
   perform the contents out loud — which is the one job the phone
   in the player's hand was already holding the hardware for.

   So: when a handout carries an `audio` source, the label grows
   a transport under it and the person holding that tape can put
   it in their ear.

   THREE THINGS THIS DELIBERATELY DOES NOT DO

   It does not autoplay. Browsers forbid it without a gesture and
   ui/audio.js already establishes the house position that sound
   is opted into rather than inflicted.

   It does not hide the transcript. A tape that only exists as
   audio is a tape a deaf player cannot have, and a table in a
   noisy pub cannot use. The written version stays exactly where
   it was; the deck is an addition to it, never a replacement.

   It does not broadcast. This element renders wherever an
   Artefact renders, and *where* an Artefact renders is already
   the access rule — Evidence filters by `handouts[id].by`, so a
   tape appears on the phone of the character who played it and
   nowhere else. A Warden who wants the whole room to hear a tape
   puts it on the table deliberately, which is a different verb
   and a different screen.

   THE REELS

   Tape transfers from the supply spool to the take-up spool, and
   because the tape has thickness the radius follows the square
   root of the fraction played, not the fraction itself. That is
   why a real cassette's spools visibly change speed while the
   tape runs at a constant rate. It costs one Math.sqrt and it is
   the only thing on this screen that tells you, without reading a
   number, that you are three minutes into something.
   ============================================================ */
import React, { useState, useRef, useEffect, useCallback } from "react";
import "./tape.css";

const HUB = 7;      // spindle radius
const FULL = 25;    // a full spool

/** Radius of a spool holding `f` of the tape (0..1), by area. */
export function spoolRadius(f) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(f) ? f : 0));
  return Math.sqrt(HUB * HUB + (FULL * FULL - HUB * HUB) * clamped);
}

/** Seconds as m:ss. Tapes are minutes long; hours would be a lie. */
export function clockOf(secs) {
  const s = Math.max(0, Math.floor(Number.isFinite(secs) ? secs : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Reel({ fill, spinning, side }) {
  const r = spoolRadius(fill);
  return (
    <div className={`tape-reel${spinning ? " is-running" : ""}`} data-side={side}>
      <svg viewBox="-30 -30 60 60" aria-hidden="true">
        <circle className="tape-wound" cx="0" cy="0" r={r} />
        <circle className="tape-hub" cx="0" cy="0" r={HUB} />
        <g className="tape-teeth">
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <rect key={a} x="-1.1" y={-HUB} width="2.2" height="3.4"
              transform={`rotate(${a})`} />
          ))}
        </g>
      </svg>
    </div>
  );
}

/**
 * @param {string}  src      the recording
 * @param {number}  secs     declared duration, used until metadata lands
 * @param {string}  label    what the spine says, for the accessible name
 * @param {string}  note     one line under the transport, e.g. how loud this is
 */
export default function TapeDeck({ src, secs = 0, label = "Cassette", note = null }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [len, setLen] = useState(secs);
  const [failed, setFailed] = useState(false);

  /* A tape left running on a screen the player has navigated away
     from is a voice coming out of a pocket for no reason. */
  useEffect(() => () => { const a = ref.current; if (a) { a.pause(); } }, []);

  useEffect(() => {
    const onHide = () => { if (document.hidden && ref.current) ref.current.pause(); };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  const toggle = useCallback(() => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      /* iOS resolves this promise late and rejects it if the gesture
         was not trusted. Either way the element's own events are what
         move the UI, so nothing here has to know which happened. */
      const p = a.play();
      if (p && p.catch) p.catch(() => setFailed(true));
    } else a.pause();
  }, []);

  const seek = useCallback((to) => {
    const a = ref.current;
    if (!a) return;
    const t = Math.max(0, Math.min(len || 0, to));
    a.currentTime = t;
    setAt(t);
  }, [len]);

  const fill = len > 0 ? at / len : 0;

  if (failed) {
    return (
      <div className="tape-deck is-dead" role="status">
        <p className="tape-dead">
          This handset will not play the recording. The written version is
          below, and the Warden has the tape on the desk.
        </p>
      </div>
    );
  }

  return (
    <div className="tape-deck" data-playing={playing ? "yes" : "no"}>
      <div className="tape-window">
        <Reel side="supply" fill={1 - fill} spinning={playing} />
        <div className="tape-span" aria-hidden="true">
          <i style={{ width: `${Math.round(fill * 100)}%` }} />
        </div>
        <Reel side="takeup" fill={fill} spinning={playing} />
      </div>

      <div className="tape-transport">
        <button type="button" className="tape-key is-primary" onClick={toggle}
          aria-label={playing ? `Stop ${label}` : `Play ${label}`}>
          <span className={`tape-glyph ${playing ? "is-stop" : "is-play"}`} aria-hidden="true" />
          <span>{playing ? "Stop" : "Play"}</span>
        </button>
        <button type="button" className="tape-key" onClick={() => seek(at - 10)}
          aria-label="Back ten seconds">−10s</button>
        <span className="tape-count" role="timer" aria-live="off">
          {clockOf(at)}<i>/</i>{clockOf(len)}
        </span>
      </div>

      <label className="tape-scrub">
        <span className="sr-only">Position in {label}</span>
        <input type="range" min="0" max={Math.max(1, Math.round(len))} step="1"
          value={Math.round(at)} onChange={(e) => seek(Number(e.target.value))} />
      </label>

      {note && <p className="tape-note">{note}</p>}

      <audio
        ref={ref}
        src={src}
        preload="none"
        playsInline
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setLen(d);
        }}
        onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setAt(0); }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
