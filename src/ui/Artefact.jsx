/* ============================================================
   ARTEFACTS — handouts as objects.

   A handout used to be `say("handout", label + text)`: a line in
   the log, in the same face as every other line, which scrolled
   away and was gone. A cassette tape, a scrawled note reading
   0389 and a Company manifest all looked identical, which is to
   say none of them looked like anything.

   At a physical table these are the things players *keep*. They
   get passed round, photographed, argued over and taken home. The
   log is not a home for them.

   So each handout gets a `style` and is drawn as the thing it is.
   All of it is CSS — no images, nothing fetched, the offline
   promise is untouched:

     terminal    green-on-black fixed pitch, scanlines, a cursor
     handwritten a slanted hand on off-white, ruled
     corporate   letterhead, redaction bars, a stamp
     tape        a cassette label with a handwritten spine
     note        torn paper, the default

   The gallery is the second half. Anything the crew has opened
   stays available on the phone that opened it, so "what did the
   third tape say" is answered by looking at the tape rather than
   by scrolling forty lines of log or asking the Warden to read it
   out again.
   ============================================================ */
import React, { useState } from "react";
import { Panel, Btn } from "./kit.jsx";
import FullScreen from "./FullScreen.jsx";

const STYLES = ["terminal", "handwritten", "corporate", "tape", "note"];

/** Fall back to something sensible for modules that never set one. */
export function styleOf(h) {
  if (h && STYLES.includes(h.style)) return h.style;
  const label = ((h && h.label) || "").toLowerCase();
  if (/^▶|cassette|tape/.test(label)) return "tape";
  if (/log|terminal|console|hrcls|report|>/.test(label)) return "terminal";
  if (/memo|manifest|contract|company|notice/.test(label)) return "corporate";
  return "note";
}

/** The artefact itself. `flat` drops the outer chrome for embedding. */
export function Artefact({ handout, id, onOpen, flat = false }) {
  if (!handout) return null;
  const style = styleOf(handout);

  const body = (
    <div className={`artefact is-${style}`} data-handout={id}>
      <div className="artefact-label">{handout.label}</div>
      <div className="artefact-text">{handout.text}</div>
      {style === "terminal" && <span className="artefact-cursor" aria-hidden="true" />}
      {style === "corporate" && <span className="artefact-stamp" aria-hidden="true">EYES ONLY</span>}
    </div>
  );

  if (flat) return body;

  return (
    <button type="button" className="artefact-shell" onClick={onOpen}
      aria-label={`Look at ${handout.label}`}>
      {body}
      {onOpen && <span className="artefact-more">Hold it up</span>}
    </button>
  );
}

/**
 * Everything this character has read, as things rather than as log.
 * `owned` limits it to handouts this player opened; the Warden's own
 * screen passes the whole set.
 */
export function Evidence({ mod, w, pcId, owned = true }) {
  const [open, setOpen] = useState(null);
  const seen = w.handouts || {};
  const ids = Object.keys(seen).filter((id) => {
    if (!mod.handouts[id]) return false;
    if (!owned || !pcId) return true;
    return (seen[id].by || []).includes(pcId);
  });

  return (
    <>
      <Panel title={`Evidence${ids.length ? ` · ${ids.length}` : ""}`}>
        {ids.length === 0 ? (
          <p className="clue-meta" style={{ margin: 0 }}>
            Nothing yet. Anything you read stays here, so you never have to
            scroll the log for it twice.
          </p>
        ) : (
          <div className="artefact-rack">
            {ids.map((id) => (
              <Artefact key={id} id={id} handout={mod.handouts[id]} onOpen={() => setOpen(id)} />
            ))}
          </div>
        )}
      </Panel>

      {open && (
        <FullScreen title={mod.handouts[open].label} tone="artefact" onClose={() => setOpen(null)}>
          <Artefact id={open} handout={mod.handouts[open]} flat />
        </FullScreen>
      )}
    </>
  );
}

export default Artefact;
