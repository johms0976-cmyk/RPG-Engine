/* ============================================================
   THE FLOOR UNDER THE EMPTY CHAIR.

   `engine/director.js` runs thirteen rungs. Five of them open with
   `const d = mod.director; if (!d) return null;` — escalate,
   aftermath, ending, callRoll and pressure. A module with no
   `director` block therefore loses all five and the empty chair
   falls back to floor, pacing and atmosphere: pacing and mood, and
   nothing that turns a screw.

   That failure is silent, which is the whole problem with it. A
   table plays a module somebody wrote to `docs/MODULE_FORMAT.md`,
   the room keeps talking, the situation never gets worse, and
   everyone concludes the mode is weak rather than that the content
   is missing.

   This is the floor. It is deliberately thin, and the reason it is
   thin is the reason it is trustworthy:

   ------------------------------------------------------------
   IT COMPOSES NOTHING.

   INV-6 says NPCs cannot invent facts, and the director inherits
   it — every line it speaks is text a module author wrote or text
   the engine assembled from module-authored pools. A generic
   director that wrote its own escalation beats would be a
   generator of fiction nobody signed off, on the shared screen, in
   a horror game. So this file never writes a sentence. It only
   *re-files* things a module has already declared into the shape
   the ladder reads.

   What that leaves is genuinely useful and genuinely limited:

     · `rate`      — derived from `length`, which every module has.
     · `endings`   — an ending that declares its own `when` becomes
                     a director ending. The module already said
                     when this evening is over; nobody was reading
                     it with the chair empty.
     · `pressure`  — wired if the module declares the conventional
                     hook, and not otherwise.
     · `onFail`    — taken from `flavour.onFail` if the author
                     wrote one. Absent means silence after a bad
                     roll, which is exactly what happens today.
     · `attacks`   — never generated. Deciding a threat comes
                     through the door is a judgement about a
                     specific module and it is not derivable.
     · `rolls`     — never generated. `safeMove` refuses a called
                     roll with no reason, and a reason is a
                     sentence, and we do not write sentences.

   So the honest summary is: the floor stops a module being
   *mood-only*, and it does not make it Ypsilon 14. The other half
   of A.2 — the validator warning in `defineModule` — is what makes
   the difference visible, and between the two of them an author
   finds out what they have not written yet.

   Everything generated here carries `generated: true` so that a
   Warden's state dump, the assisted strip and anyone reading a
   feed can tell a derived block from an authored one.
   ============================================================ */

/** Minutes of module clock per real minute, by declared length.
    The same scale `pacing.js` means by `rate`; a longer module is
    a slower burn, and a module that says nothing is a one-shot. */
const RATE_BY_LENGTH = {
  "one shot": 1,
  "one-shot": 1,
  "short": 1,
  "session": 1,
  "two sessions": 1.5,
  "campaign": 2,
  "long": 2,
};

export function rateFor(length) {
  const key = String(length || "").trim().toLowerCase();
  return RATE_BY_LENGTH[key] || 1;
}

/**
 * A director block derived from a raw module definition, or null if
 * there is nothing worth deriving.
 *
 * Takes the *raw* module — the object an author exported — because
 * this runs inside `defineModule` before the assembled `mod` exists.
 */
export function autoDirector(raw) {
  if (!raw || typeof raw !== "object") return null;

  const out = { generated: true, rate: rateFor(raw.length) };

  /* ---- endings ----------------------------------------------

     `mod.endings` is a map of id -> ending, and an ending may carry
     a `when` for exactly this purpose: the module saying "this is
     the state of the world in which the evening is over." With a
     Warden that sentence is read by a person. With the chair empty
     nothing was reading it, so a table that had already won carried
     on searching cupboards.

     `rungEnding` re-checks that the id exists in `mod.endings`
     before it fires, so a malformed entry here is inert rather than
     dangerous. */
  const endings = [];
  for (const [id, e] of Object.entries(raw.endings || {})) {
    if (!e || !e.when) continue;
    endings.push({ id, when: e.when, why: e.why || null, generated: true });
  }
  if (endings.length) out.endings = endings;

  /* ---- pressure ----------------------------------------------

     `directorPressure` is the conventional hook name — Ypsilon 14
     declares one and `docs/MODULE_FORMAT.md` documents it. If an
     author has written the hook they have already agreed to the
     director calling it; wiring it is not a decision this file is
     making on their behalf. */
  if (raw.hooks && typeof raw.hooks.directorPressure === "function") {
    out.pressure = "directorPressure";
  }

  /* ---- the line after a bad roll -----------------------------

     Module-authored or nothing. `flavour` is where a module already
     keeps its non-room prose pools, so an author who wants the
     empty chair to react to failure has one place to put it and
     does not need a whole director block to do it. */
  const pool = raw.flavour && Array.isArray(raw.flavour.onFail) ? raw.flavour.onFail : null;
  if (pool && pool.length) out.onFail = pool.slice();

  /* Nothing but `rate`, and `rate` alone is not a director — it is
     a number `rungPacing` already defaults. Returning null here is
     what lets `defineModule` tell the difference between "derived
     something" and "there was nothing to derive", which is the
     distinction the warning is about. */
  const useful = out.endings || out.pressure || out.onFail;
  return useful ? out : null;
}

/**
 * What an author has *not* written, in the order it costs them.
 *
 * Returned as plain strings for `defineModule` to file as warnings.
 * Deliberately phrased as absences rather than errors: a module
 * with no director block is a legal module and plays perfectly well
 * with a Warden in the chair. It is only the empty chair that goes
 * quiet, and the author deserves to be told which part of it will.
 */
export function directorGaps(raw, derived) {
  const d = (raw && raw.director) || null;
  const gaps = [];
  /* PRESENT, NOT NON-EMPTY.

     An author who writes `attacks: []` has thought about it and the
     answer is none — Ypsilon 14 is exactly that case, because its
     only threat is `unseen` and `safeMove` would refuse every entry
     anyway. Warning them about a decision they have already made and
     documented is how a validator teaches people to ignore it. The
     key being present is the signal; what is in it is their business. */
  const has = (k) => !!(d && Object.prototype.hasOwnProperty.call(d, k));

  if (!d && !derived) {
    gaps.push(
      "module has no \"director\" block and nothing could be derived — "
      + "with nobody in the Warden's chair this module can only pace and describe. "
      + "See docs/MODULE_FORMAT.md § the director block."
    );
    return gaps;
  }

  if (!has("escalate")) {
    gaps.push("director has no \"escalate\" list — the empty chair will never make the situation worse");
  }
  if (!has("rolls")) {
    gaps.push("director has no \"rolls\" list — the empty chair will never ask anybody for a save");
  }
  if (!has("onFail") && !(derived && derived.onFail)) {
    gaps.push("director has no \"onFail\" pool — a failed roll gets its mechanics and no sentence");
  }
  if (!has("endings") && !(derived && derived.endings)) {
    gaps.push("director has no \"endings\" list and no ending declares a \"when\" — with the chair empty nobody calls time");
  }
  if (!has("attacks")) {
    gaps.push("director has no \"attacks\" list — the empty chair can describe a threat but never sets one on the crew");
  }
  return gaps;
}
