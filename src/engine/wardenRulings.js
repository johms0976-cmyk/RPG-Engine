/* ============================================================
   THE WARDEN'S RULINGS — the controls, separated from the store.

   `ruling.js` is pure and has no idea a table exists. This is the
   half that touches the session: it commits to the world, puts a
   line in the feed, and addresses that line when the ruling was
   made to one person.

   It lives in its own file for one unglamorous reason. `useGame.js`
   is three thousand lines and is where the next contributor breaks
   something; a feature that needs six lines there instead of sixty
   is a feature that can be reviewed. Everything below is a plain
   function over injected accessors, so it is also testable without
   mounting a hook.

   ------------------------------------------------------------
   A RULING IS SAID BEFORE IT IS STORED

   The order matters and it is not arbitrary. A Warden types the
   sentence because they are answering a player who is waiting, so
   the sentence has to reach the table as a spoken line — in the
   feed, in the transcript, in the place the player is already
   looking. Storing it is the *second* thing that happens and the
   part nobody at the table perceives.

   Get that backwards and you have built a database with a chat
   feature. The whole value here is that the Warden does not have
   to think about it as a database at all: they answer the
   question, and the answer stops evaporating.

   ------------------------------------------------------------
   PRIVATE RULINGS ARE ADDRESSED LINES, NOT HIDDEN ONES

   `wardenShowTo` already established the pattern for handouts and
   this follows it exactly: a ruling told to two players is pushed
   as two feed entries carrying `to`, which `secrets.js` honours on
   the way out. The other three phones never receive the text.

   Not "receive it and decline to render it". Never receive it.
   That distinction is the entire reason the redaction is worth
   anything, and it is one that a well-meaning implementation
   loses without noticing.
   ============================================================ */
import { makeRuling, retireRuling, commitRuling, SCOPE } from "./ruling.js";

/**
 * Build the two controls the Warden deck calls.
 *
 * @param {object} io
 * @param {function} io.W          current world
 * @param {function} io.commitW    patch the world
 * @param {function} io.say        (kind, text, extra, to) — the feed.
 *        `to` takes an array and secrets.js already honours it, so a
 *        private ruling is one addressed line rather than N copies.
 * @param {function} io.nameOf     pcId -> display name
 * @param {function} [io.note]     Warden-only line, for the confirmation
 * @returns {{rule: function, unrule: function}}
 */
export function makeRulingControls({ W, commitW, say, nameOf, note }) {
  /**
   * Make a ruling.
   *
   * @param {string} text     the Warden's own sentence. Stored verbatim.
   * @param {object} [opts]
   * @param {string} [opts.scope]   SCOPE.ROOM (default), THING or WORLD.
   * @param {string} [opts.subject] required for THING.
   * @param {string} [opts.room]    defaults to the room the crew is in.
   * @param {string[]} [opts.told]  pcIds. Absent means the whole table.
   * @returns {{ok:true, ruling:object}|{ok:false, error:string}}
   */
  const rule = (text, opts = {}) => {
    const w = W();
    const { ruling, error } = makeRuling({
      text,
      scope: opts.scope || SCOPE.ROOM,
      subject: opts.subject,
      room: opts.room || w.room,
      told: opts.told,
      by: opts.by || "warden",
      clock: w.clock,
    });
    if (error) return { ok: false, error };

    /* SAID FIRST. See the header. */
    const spoken = ruling.scope === SCOPE.THING
      ? `${ruling.subject} — ${ruling.text}`
      : ruling.text;

    if (ruling.told && ruling.told.length) {
      say("warden", spoken, { ruling: ruling.id }, ruling.told);
      if (note) {
        const names = ruling.told.map((id) => (nameOf ? nameOf(id) : null)).filter(Boolean).join(", ");
        note(`Ruled to ${names || "nobody"}: ${ruling.text} The table does not have it.`);
      }
    } else {
      say("warden", spoken, { ruling: ruling.id });
    }

    /* AND STORED SECOND.

       `commitW` takes a patch, not a world, so the pure function's
       result is unwrapped here rather than reimplemented — the
       append rule stays in one place. */
    commitW({ rulings: commitRuling(w, ruling).rulings });
    return { ok: true, ruling };
  };

  /**
   * Take one back.
   *
   * The retraction is spoken too, and to the same audience, because
   * the players heard the original and a fact that silently stops
   * being true is worse than one that is visibly corrected. A
   * private ruling is retracted privately; a public one publicly.
   */
  const unrule = (id, why = null) => {
    const w = W();
    const r = (w.rulings || []).find((x) => x.id === id);
    if (!r || r.retired) return { ok: false, error: "No such ruling." };

    const line = `Scratch that — ${r.text}${why ? ` (${why})` : ""}`;
    say("system", line, { ruling: r.id }, r.told && r.told.length ? r.told : undefined);

    commitW({ rulings: retireRuling(w, id, why).rulings });
    return { ok: true };
  };

  return { rule, unrule };
}
