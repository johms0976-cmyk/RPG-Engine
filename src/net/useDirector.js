/* ============================================================
   useDirector — the policy, given hands.

   engine/director.js decides. This is the only thing that acts,
   and it is deliberately the smallest possible amount of code
   between a Move and the engine call it names, because everything
   interesting is meant to be in the pure half where it can be
   tested without a DOM.

   Two modes, one code path:

     assisted   a Move is proposed and sits in `move` until a
                person takes it or waves it away. Nothing runs by
                itself. This is how the ladder gets evaluated at a
                table that still has a referee to correct it.

     auto       the same Move, taken immediately. Empty chair.

   The difference is one boolean, which is the property that makes
   auto trustworthy: it is not a second implementation, it is the
   assisted path with the pause removed.

   WHAT IT WILL NOT DO. It never composes language. Every Move
   carries text the module wrote or text the engine already
   assembled from module pools, and `take` only ever routes it.
   There is no branch here that could produce a sentence nobody
   authored, which is what keeps the no-model promise structural
   rather than aspirational.
   ============================================================ */
import { useEffect, useRef, useState, useCallback } from "react";
import { directorPlan, VETO_LIMIT } from "../engine/director.js";

/** How often the policy is consulted. Slow, because everything it
    watches for develops over minutes and because the rungs have
    their own cooldowns — a faster tick would change nothing except
    how much work a quiet table does for no reason. */
export const DIRECTOR_TICK_MS = 10 * 1000;

/** A suggestion nobody answered is stale after this. It expires
    rather than queueing: a strip that accumulates turns into a list
    of jobs, and a Warden with a list of jobs is worse off than one
    with nothing. */
export const SUGGESTION_MS = 90 * 1000;

export function useDirector({
  g, mod, enabled = false, auto = false, safetyCall = null,
  /* The spotlight needs the socket, which lives in useHost. The
     director only ever names who — routing stays with the one thing
     holding a connection, exactly as it does for every other
     addressed message. */
  onSpotlight = null,
}) {
  const [move, setMove] = useState(null);
  const gRef = useRef(g);
  gRef.current = g;

  const spotRef = useRef(onSpotlight);
  spotRef.current = onSpotlight;

  const lastMoveAt = useRef(0);
  const lastAtmosphereAt = useRef(0);
  /* When anything last happened at all. Read off the feed rather
     than tracked separately — the feed is the record, and a second
     one would eventually disagree with it. */
  const lastLineAt = useRef(0);
  const startedAt = useRef(0);
  /* The id of the last failed roll the director has answered, so one
     bad roll gets at most one line about it. */
  const lastAftermathAt = useRef(0);
  /* Unprompted NPC speech: table-wide, and per person. Both, because
     one NPC monologuing and five NPCs taking turns are different
     failures and a single timer only prevents one of them. */
  const lastNpcAt = useRef(0);
  const npcSpokeAt = useRef({});

  /* ============================================================
     WHAT THE TABLE HAS ALREADY SAID NO TO

     rung -> how many times a person waved it away. Past VETO_LIMIT
     the rung stops being offered for the rest of the session.

     This is the cheapest instrument available for finding out which
     rungs are wrong, and it only works because assisted mode exists:
     a ladder nobody has vetoed is a ladder nobody has checked. It
     lives here rather than inside `directorPlan` so the pure
     function stays replayable — see the comment on `vetoes` there.

     Deliberately per-session and never persisted. A table that hated
     clock reminders one evening is not a table that hates them, and
     a preference the software remembers across months is a
     preference nobody can find or change.
     ============================================================ */
  const vetoes = useRef({});

  const feedLen = g && g.feed ? g.feed.length : 0;
  useEffect(() => {
    if (!feedLen) return;
    lastLineAt.current = Date.now();
  }, [feedLen]);

  useEffect(() => {
    if (!enabled) return;
    if (!startedAt.current) startedAt.current = Date.now();
  }, [enabled]);

  /** Run a Move against the engine. The whole surface, in one place. */
  const take = useCallback((m) => {
    const game = gRef.current;
    if (!game || !m) return;
    lastMoveAt.current = Date.now();
    setMove(null);

    switch (m.kind) {
      case "describe":
        /* `interject` is the register a person's own narration lands
           in. That is the honest tag: with the chair empty this IS
           the narration, and dressing it as a module line would hide
           which sentences came from a policy. */
        if (game.warden) game.warden.say(m.text, "interject");
        lastAtmosphereAt.current = Date.now();
        return;
      case "whisper":
        if (game.whisperTo) game.whisperTo(m.to, m.text);
        return;
      case "startScene":
        if (game.warden) game.warden.scene("start");
        return;
      case "spotlight":
        if (spotRef.current) spotRef.current(m.pcId, m.text);
        return;
      case "clock":
        if (game.warden) {
          game.warden.say(`${m.countdown}: ${m.left} minutes.`, "interject");
        }
        return;
      case "escalate":
        /* Module-authored effects, run through the module's own
           applier. Nothing new is composed — an escalation is a list
           the module author wrote, fired at the moment they said. */
        if (game.runEffects && m.effects) game.runEffects(m.effects);
        /* AND THEN ADVANCE THE LADDER.

           The bug this fixes was invisible and would have been very
           hard to read: `rungScripted` reads a stage number, nothing
           ever wrote one, so entry 0 fired, re-qualified on the next
           tick, and fired again — forever. No shipped module had an
           `escalate` list, so nothing hit it.

           The write belongs here rather than in the module, because
           a module author who has to increment their own counter is
           an author hand-rolling a state machine the engine already
           owns. `flag` is the ordinary channel: saved, restored, and
           visible in the state dump like every other bit of progress.

           `nextStage` comes off the Move rather than being
           recomputed, so a replayed feed shows exactly which rung was
           climbed and when. */
        if (game.warden && m.nextStage != null) {
          game.warden.flag("directorStage", m.nextStage);
        }
        return;
      case "pressure":
        /* THE MOVE THAT WAS PLANNED AND THEN DROPPED.

           `rungPressure` has always emitted this and the switch has
           never handled it, so it fell through to `default` and
           returned. Worse than a no-op: the ladder had already spent
           rung 6, so a real pressure beat *suppressed* the atmosphere
           line that would otherwise have run, and the table got
           silence exactly where it should have got the creature.

           `run` names a module hook — the threat's own drive, written
           by the module author. The director does not decide where
           anything goes; it asks the module to take its turn. */
        if (game.runEffects && m.run) game.runEffects([{ run: m.run }]);
        return;
      case "callRoll":
        /* The most frequent thing a Warden does, and the one thing
           the director could not do at all. `warden.ask` is the same
           call the deck's own roll button makes, so the prompt that
           lands on the phone is identical to the one a person would
           have sent — including the reason, which `safeMove` refuses
           to let through empty. */
        if (game.warden) {
          game.warden.ask(m.pcId, {
            kind: m.save ? "save" : "stat",
            name: m.stat,
            reason: m.reason,
            mode: m.mode || "none",
          });
        }
        if (m.id && game.warden) {
          const fired = { ...((game.w && game.w.flags && game.w.flags.directorRolls) || {}) };
          fired[m.id] = true;
          game.warden.flag("directorRolls", fired);
        }
        return;
      case "npcSay":
        /* Somebody opening their own mouth. The text is an untold
           entry from that NPC's own `knows` list — the same hard
           limit `npcReply` obeys — so INV-6 holds by construction
           rather than by care. Nothing here could compose a fact. */
        if (game.warden) game.warden.npcSay(m.npcId, m.text);
        lastNpcAt.current = Date.now();
        npcSpokeAt.current = { ...npcSpokeAt.current, [m.npcId]: Date.now() };
        return;
      case "end":
        /* The module's own ending, reached because one of the
           module's own conditions became true. The director does not
           write endings and cannot invent one — `rungEnding` refuses
           any id the module has not declared. */
        if (game.runEffects) game.runEffects([{ end: m.ending }]);
        return;
      default:
        return;
    }
  }, []);

  /* Waved away. The count is what makes assisted mode worth running:
     three refusals of the same rung and the director stops offering
     it, so the ladder is corrected by use rather than by argument. */
  const dismiss = useCallback((m) => {
    lastMoveAt.current = Date.now();
    const rung = (m && m.rung) || null;
    /* MUTATED IN PLACE, deliberately. Replacing the object would mean
       anything holding a reference from an earlier render — the strip,
       and any test — kept reading a stale count. Nothing needs to
       repaint when this changes: the strip re-renders when the next
       suggestion arrives, which is the only moment the number is
       read, and `directorPlan` is handed the live ref on every tick. */
    if (rung) vetoes.current[rung] = (vetoes.current[rung] || 0) + 1;
    setMove(null);
  }, []);

  useEffect(() => {
    if (!enabled) { setMove(null); return undefined; }
    const tick = () => {
      const game = gRef.current;
      if (!game || !game.crew || !game.crew.length) return;

      /* A suggestion nobody answered goes stale rather than queueing.
         Deliberately NOT counted as a veto: ignoring something is not
         the same as refusing it, and a strip that punished a Warden
         for being busy would quietly delete its own best rungs on the
         nights the table was going well. */
      setMove((cur) => (cur && Date.now() - cur.at > SUGGESTION_MS ? null : cur));

      const next = directorPlan({
        mod,
        w: game.w,
        crew: game.crew,
        feed: game.feed,
        combat: game.combat,
        pending: game.pending,
        safetyCall,
        startedAt: startedAt.current,
        now: Date.now(),
        lastMoveAt: lastMoveAt.current,
        lastAtmosphereAt: lastAtmosphereAt.current,
        lastLineAt: lastLineAt.current,
        lastAftermathAt: lastAftermathAt.current,
        lastNpcAt: lastNpcAt.current,
        npcSpokeAt: npcSpokeAt.current,
        vetoes: vetoes.current,
      });

      if (!next) return;
      /* `wait` and `halt` are decisions to do nothing. They are not
         suggestions and must never appear as one — a strip saying
         "wait" is a strip that has trained the Warden to ignore it. */
      if (next.kind === "wait" || next.kind === "halt") return;

      /* An aftermath line answers one specific failed roll, and the
         answer is recorded when the Move is *chosen* rather than when
         it is taken. Otherwise a suggestion sitting unanswered in the
         strip would be re-proposed every ten seconds for a minute and
         a half. */
      if (next.answered) lastAftermathAt.current = next.answered;

      if (auto) { take(next); return; }
      setMove((cur) => (cur ? cur : { ...next, at: Date.now() }));
    };
    const id = setInterval(tick, DIRECTOR_TICK_MS);
    return () => clearInterval(id);
  }, [enabled, auto, mod, safetyCall, take]);

  /* Exposed for the strip, which says so out loud when a rung has
     been retired — a system that silently stops offering something
     is a system nobody can tell is broken. */
  return { move, take, dismiss, vetoes: vetoes.current, VETO_LIMIT };
}
