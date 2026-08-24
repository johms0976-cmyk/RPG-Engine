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
import { directorPlan, VETO_LIMIT, CALLBACK_PREFIX, isHarshMove } from "../engine/director.js";

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

/** How many disputes equal one veto. See the ledger comment below:
    a Warden refusing a rung has judged the rung, a player waving off
    one move aimed at them has judged a moment. Two is the smallest
    number that says "more than once" — it is a judgement, and it is
    the first thing to change if the empty chair turns out to retire
    rungs too eagerly. */
export const DISPUTE_WEIGHT = 2;

/** A dispute arriving later than this after the Move that caused it
    is about something else. Twelve seconds is the spotlight's own
    lifetime in useHost — the window in which the player can still
    see the thing they are waving off. */
export const DISPUTE_WINDOW_MS = 12 * 1000;

export function useDirector({
  g, mod, enabled = false, auto = false, safetyCall = null,
  /* The spotlight needs the socket, which lives in useHost. The
     director only ever names who — routing stays with the one thing
     holding a connection, exactly as it does for every other
     addressed message. */
  onSpotlight = null,
  /* The last dispute the host saw, as `{ pcId, at }`. Observed
     rather than pushed, because useHost is constructed before this
     hook and a callback would need a ref to reach backwards. */
  dispute = null,
  /* C.3 — when this table said the evening ends, as a wall-clock
     ms timestamp. Zero means nobody asked to be steered, which is
     the default and stays the default. */
  sessionEndsAt = 0,
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

  /* ---------------- the prompt somebody walked away from ----------

     `pending` carries no timestamp of its own, so the first tick that
     sees a new one records when. Identity rather than deep equality:
     useGame replaces the whole object when it changes, and a prompt
     that has merely been *touched* (a situational modifier added) is
     still the same prompt the same person has not answered. */
  const pendingSince = useRef(0);
  const pendingSeen = useRef(null);
  const lastNudgeAt = useRef(0);

  /* ---------------- the ratchet, and its release ----------------

     Timestamps of Moves that made the evening worse, oldest first
     and trimmed to the window `rungBreather` cares about.

     Judged here rather than in the pure half because "harsh" is a
     property of the Move that was actually TAKEN. In assisted mode a
     Warden waves half of them away, and a director that counted its
     own suggestions would offer a table a breather from three things
     that never happened to them. */
  const harshAt = useRef([]);
  const lastBreatherAt = useRef(0);

  /* Which clues have already been reached for, so the board is not
     mined twice for the same sentence. */
  const lastCallbackAt = useRef(0);
  const calledBack = useRef({});

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

  /* ============================================================
     THE CORRECTION THE EMPTY CHAIR DID NOT HAVE

     Veto memory is the ladder's only feedback: three refusals and a
     rung stops being offered for the night. In assisted mode a
     person supplies those refusals by waving suggestions away.

     With the chair empty NOBODY WAVES ANYTHING AWAY, because there
     is no strip and no pause — the Moves are taken. So the one
     configuration with no human checking the ladder was also the
     one configuration in which the ladder could not be corrected.
     A rung that was wrong for a table stayed wrong for four hours.

     The wardenless equivalent already shipped in 2.7.0 and was
     never connected to anything but the floor ledger: the DISPUTE.
     A move addressed to you, waved off by you, believed without
     argument.

     A dispute is weaker evidence than a veto and is weighted as
     such. A Warden vetoing `callRoll` has judged the rung; a player
     waving off one roll aimed at them has judged a moment, and
     might simply have been mid-sentence. So it takes DISPUTE_WEIGHT
     of them to retire a rung that one veto counts once against —
     and the ledger they feed is the same one, because two parallel
     mechanisms for "the table said no" is one more than anybody
     could reason about later.
     ============================================================ */
  const disputes = useRef({});

  /* C.1 — which lines have already been answered, and C.3 — when
     last call was said. Refs rather than state for the reason the
     veto ledger is: they steer the next plan and must never
     themselves cause a render. */
  const heard = useRef({});
  const lastCallAt = useRef(0);

  /* Who the last taken Move was aimed at, so an incoming dispute can
     be attributed to the rung that caused it. A dispute arriving
     later than this is about something else and is not counted —
     silence rather than a guess. */
  const aimedAt = useRef(null);
  const seenDispute = useRef(0);

  /* A dispute lands here, is matched to the Move that caused it, and
     goes into the ledger. Unmatched disputes are dropped in silence:
     a player waving off something the director never said is a
     player waving off a person, and the ladder has no business
     learning from that. */
  useEffect(() => {
    if (!dispute || !dispute.at || dispute.at === seenDispute.current) return;
    seenDispute.current = dispute.at;
    const aim = aimedAt.current;
    if (!aim || !aim.rung) return;
    if (aim.pcId !== dispute.pcId) return;
    if (dispute.at - aim.at > DISPUTE_WINDOW_MS) return;
    disputes.current[aim.rung] = (disputes.current[aim.rung] || 0) + 1;
  }, [dispute]);

  /* Vetoes and disputes, in one number per rung, which is the number
     `directorPlan` has always been handed. Built fresh on each tick
     rather than accumulated, so the weighting can be changed without
     a session's history having been recorded at the old one. */
  const ledger = useCallback(() => {
    const out = { ...vetoes.current };
    for (const [rung, n] of Object.entries(disputes.current)) {
      out[rung] = (out[rung] || 0) + Math.floor(n / DISPUTE_WEIGHT);
    }
    return out;
  }, []);

  const feedLen = g && g.feed ? g.feed.length : 0;
  useEffect(() => {
    if (!feedLen) return;
    lastLineAt.current = Date.now();
  }, [feedLen]);

  useEffect(() => {
    if (!enabled) return;
    if (!startedAt.current) startedAt.current = Date.now();
  }, [enabled]);

  /* C.5 — moved to director.js, next to the rungs that emit these
     Moves, and made exhaustive. See MOVE_HARSH there: a kind with
     no entry now fails the suite instead of silently counting as
     harmless, which is how `listen` and `lastCall` both shipped
     without anybody deciding. */
  const isHarsh = isHarshMove;

  /** Run a Move against the engine. The whole surface, in one place. */
  const take = useCallback((m) => {
    const game = gRef.current;
    if (!game || !m) return;
    lastMoveAt.current = Date.now();
    setMove(null);

    /* Recorded on the way in, so `rungBreather` counts what happened
       rather than what was offered. Trimmed here rather than in the
       rung so the array cannot grow across a four-hour session. */
    if (isHarsh(m)) {
      const now = Date.now();
      harshAt.current = [...harshAt.current, now].filter((at) => now - at <= 30 * 60 * 1000);
    }

    /* Who this one was aimed at. Only Moves addressed to a person can
       be disputed, so only those are recorded — a dispute cannot be
       attributed to an atmosphere line and must not be. */
    aimedAt.current = m.pcId ? { pcId: m.pcId, rung: m.rung || null, at: Date.now() } : null;

    switch (m.kind) {
      case "describe":
        /* `interject` is the register a person's own narration lands
           in. That is the honest tag: with the chair empty this IS
           the narration, and dressing it as a module line would hide
           which sentences came from a policy. */
        if (game.warden) game.warden.say(m.text, "interject", { director: m.rung });
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
          game.warden.say(`${m.countdown}: ${m.left} minutes.`, "interject", { director: m.rung });
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
          /* Which counter, named by the Move. Falls back to the bare
             key so an untracked module — every module written before
             tracks existed — writes exactly where it always did. */
          game.warden.flag(m.stageFlag || "directorStage", m.nextStage);
        }
        return;
      /* C.1 — the author's own line, fired because somebody said
         something. `effects` is theirs; nothing here writes prose. */
      case "listen":
        if (m.heardId != null && !m.repeat) heard.current[m.heardId] = true;
        if (m.effects && game.runEffects) game.runEffects(m.effects);
        else if (m.label && game.say) game.say("room", m.label);
        return;

      /* C.3 — the time, said once, then a narrower ladder. The
         announcement is the honest half: a director steering
         toward an ending because a clock said so is fine, and a
         director doing it silently is not. */
      case "lastCall":
        lastCallAt.current = Date.now();
        if (game.warden) game.warden.flag("lastCall", true);
        if (game.say) {
          game.say("system",
            "The session has reached the length this table set. "
            + "Nothing new will be started from here.");
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
      case "combat":
        /* IT COMES THROUGH THE DOOR.

           `startCombat` is the same call the Warden deck's own "It
           attacks" button makes and the same one a module's sim
           makes, so nothing about the fight that follows is special
           — `runTurnsUntilPlayer` conducts it exactly as it always
           has. The only new thing in the world is that a policy
           chose the moment, from a list of moments a module author
           wrote down and `safeMove` re-checked.

           The reason goes in the feed before the fight starts. A
           table that is about to be attacked is owed the sentence
           that explains it, and it is the module author's sentence,
           not ours. */
        if (game.warden) {
          if (m.reason) game.warden.say(m.reason, "interject", { director: m.rung });
          game.warden.startCombat(m.threatId, {
            surprise: !!m.surprise,
            ...(m.count ? { count: m.count } : {}),
            ...(m.distance ? { distance: m.distance } : {}),
            room: m.room,
          });
          if (m.id) {
            const fired = { ...((game.w && game.w.flags && game.w.flags.directorAttacks) || {}) };
            fired[m.id] = true;
            game.warden.flag("directorAttacks", fired);
          }
        }
        return;
      case "callback":
        /* The crew's own words, read back to them. `CALLBACK_PREFIX`
           is the only string in the whole director that the engine
           owns, and it is a label rather than a claim — everything
           after it was typed by somebody at this table. */
        if (game.warden) {
          game.warden.say(`${CALLBACK_PREFIX} ${m.text}`, "interject", { director: m.rung });
        }
        lastCallbackAt.current = Date.now();
        if (m.clueId) calledBack.current = { ...calledBack.current, [m.clueId]: true };
        return;
      case "breather":
        /* Stamped `by: "director"` so it can end by itself. A
           breather a person called carries no stamp and therefore
           never does — see the asymmetry in `directorPlan`. */
        if (game.warden) game.warden.breather(true, { by: "director", ms: m.ms });
        lastBreatherAt.current = Date.now();
        /* The window is cleared rather than left to age out. The
           table has now had its rest; counting the same three bad
           moments towards a second one four minutes later would put
           the game on a permanent break. */
        harshAt.current = [];
        return;
      case "resume":
        if (game.warden) game.warden.breather(false);
        return;
      case "nudge":
        /* Addressed to one player, through the same spotlight route
           every other addressed Move uses. It does not touch their
           prompt and it does not roll for them — see the header of
           `rungPending` for why that line is not moved. */
        if (spotRef.current) spotRef.current(m.pcId, m.text);
        lastNudgeAt.current = Date.now();
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

      /* When the prompt on somebody's screen first appeared. Recorded
         on the tick that first sees it rather than by useGame, which
         has no reason to care how long a person takes. */
      if (game.pending !== pendingSeen.current) {
        pendingSeen.current = game.pending;
        pendingSince.current = game.pending ? Date.now() : 0;
        lastNudgeAt.current = 0;
      }

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
        pendingSince: pendingSince.current,
        lastNudgeAt: lastNudgeAt.current,
        harshAt: harshAt.current,
        lastBreatherAt: lastBreatherAt.current,
        lastCallbackAt: lastCallbackAt.current,
        calledBack: calledBack.current,
        vetoes: ledger(),
        heard: heard.current,
        sessionEndsAt,
        lastCallAt: lastCallAt.current,
      });

      if (!next) return;
      /* `wait` and `halt` are decisions to do nothing. They are not
         suggestions and must never appear as one — a strip saying
         "wait" is a strip that has trained the Warden to ignore it. */
      if (next.kind === "wait" || next.kind === "halt") return;

      /* PICKING IT BACK UP IS NOT A SUGGESTION.

         A director-called breather that has run its course has to end
         whether or not anybody is watching the strip, or the empty
         chair can stop the game and cannot start it again. It is also
         the exact inverse of a Move: it takes something away rather
         than adding it, so there is nothing here for a Warden to
         approve. Taken in both modes. */
      if (next.kind === "resume") { take(next); return; }

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
  return {
    move, take, dismiss,
    vetoes: vetoes.current, disputes: disputes.current,
    VETO_LIMIT, DISPUTE_WEIGHT,
  };
}
