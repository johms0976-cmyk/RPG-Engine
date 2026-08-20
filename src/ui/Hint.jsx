/* ============================================================
   HINT — the explanation you can actually get to.

   There is a quiet, systematic information loss running through
   the phone client, and it is entirely caused by one HTML
   attribute.

   `title="..."` renders as a tooltip on hover. Phones and tablets
   do not hover. On a touch device the attribute is, for practical
   purposes, `display: none` — the text is in the DOM, it is
   announced by some screen readers, and no sighted player using a
   finger will ever see it.

   The client uses `title` for, among other things:

     · what an item in your inventory actually is
       (`<Btn title={it.d}>` — the entire item description)
     · the Panic odds sentence, which explains which way is bad
     · why a room is marked LOUD or WET, and what that means
       for the thing that hunts by sound
     · the rule that makes the scene-cost figure legible instead
       of frightening

   Every one of those was written deliberately, by someone who
   thought carefully about what a player needs to know. Every one
   of them is invisible on the device the client was built for.

   THE FIX IS NOT A TOOLTIP LIBRARY.

   Hover-emulating tooltips on touch are their own disaster: they
   fire on scroll, they clip at the viewport edge, and they close
   when you try to read them. So this is a disclosure instead. The
   marker is a real button with a real hit target. Tapping it opens
   the text in place, underneath, where it can be read for as long
   as the reader wants and closed on purpose.

   `title` is kept alongside, so a Warden on a desk with a mouse
   still gets the fast path. The two are not in competition; one
   of them simply never worked on the hardware most of the table
   is holding.
   ============================================================ */
import React, { useState, useId } from "react";

/**
 * An inline "?" that reveals prose on tap.
 *
 * @param {string}  text   what to say
 * @param {string} [label] accessible name for the trigger
 * @param {"inline"|"block"} [as] inline sits after a word; block sits under a row
 */
export default function Hint({ text, label, as = "inline", children }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!text) return children || null;

  return (
    <span className={`hint hint-${as}`}>
      {children}
      <button
        type="button"
        className={`hint-btn${open ? " is-open" : ""}`}
        aria-expanded={open}
        aria-controls={id}
        aria-label={label || "What does this mean?"}
        title={text}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
      >
        ?
      </button>
      {open && (
        <span className="hint-body" id={id} role="note">
          {text}
        </span>
      )}
    </span>
  );
}

/**
 * A whole row that opens. Used where the thing being explained is
 * itself the content — a condition, an item — rather than a label
 * with a footnote attached.
 *
 * Kept in this file rather than its own because it is the same
 * idea and the same CSS, and because two components that must
 * stay visually identical should be able to see each other.
 */
export function Disclosure({ summary, meta, children, tone, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={`disc${open ? " is-open" : ""}${tone ? ` is-${tone}` : ""}`}>
      <button
        type="button"
        className="disc-head"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="disc-sum">{summary}</span>
        {meta && <span className="disc-meta">{meta}</span>}
        <span className="disc-mark" aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="disc-body" id={id}>{children}</div>}
    </div>
  );
}
