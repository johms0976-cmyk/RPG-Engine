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
import { directorPlan } from "../engine/director.js";

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
        return;
      default:
        return;
    }
  }, []);

  const dismiss = useCallback(() => {
    lastMoveAt.current = Date.now();
    setMove(null);
  }, []);

  useEffect(() => {
    if (!enabled) { setMove(null); return undefined; }
    const tick = () => {
      const game = gRef.current;
      if (!game || !game.crew || !game.crew.length) return;

      // A suggestion nobody answered goes stale rather than queueing.
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
      });

      if (!next) return;
      /* `wait` and `halt` are decisions to do nothing. They are not
         suggestions and must never appear as one — a strip saying
         "wait" is a strip that has trained the Warden to ignore it. */
      if (next.kind === "wait" || next.kind === "halt") return;

      if (auto) { take(next); return; }
      setMove((cur) => (cur ? cur : { ...next, at: Date.now() }));
    };
    const id = setInterval(tick, DIRECTOR_TICK_MS);
    return () => clearInterval(id);
  }, [enabled, auto, mod, safetyCall, take]);

  return { move, take, dismiss };
}
