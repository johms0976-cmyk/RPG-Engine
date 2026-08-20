/* ============================================================
   FEED LOG — the log you can look away from.

   The old feed auto-scrolled to the bottom on every new line.
   That is correct behaviour for a log you are staring at and
   actively hostile behaviour for one you glanced away from: the
   description of the thing in the drain arrives, three mechanical
   lines arrive after it, the view yanks to the bottom, and the
   only sentence that mattered is now above the fold and
   indistinguishable from the forty before it.

   Three additions, all of them standard in every chat client
   written in the last fifteen years and none of them present
   here:

     UNREAD RULE   a line across the log where you left off. It
                   is drawn once and does not move while you read.
     JUMP CHIP     if you have scrolled up, new lines do NOT drag
                   you down. A chip appears saying how many are
                   waiting and takes you there when you tap it.
     ATTRIBUTION   a timestamp and, where the engine knows one, a
                   name. "Who said that?" is otherwise unanswerable
                   thirty seconds later.

   Beats (— AFTER THE AIRLOCK —) render as rules with a title,
   which is what makes three hours of scrollback navigable at all.
   ============================================================ */
import React, { useEffect, useRef, useState, useMemo } from "react";

/** Close enough to the bottom that the player is plainly still
    reading live, so following is what they want. */
const STICK_PX = 64;

const MECHANICAL = new Set(["roll", "rollgood", "rollbad", "item", "system", "combat", "heal", "ammo"]);
const LOUD = new Set(["panic", "death", "end", "horror"]);

/* ============================================================
   THE PERSON, AND THE MACHINE.

   Every module writes its briefing text in the `warden` tone, so
   `interject` — the tone a live Warden's own narration lands in —
   was reading at exactly the same visual weight as an atmosphere
   roll that fired off a table. That is backwards. The thing a
   player most needs to weight differently is the sentence a human
   being just said out loud, and it was the one line on the screen
   with no mark on it at all.

   `live` covers the other half: the Warden answering *as* an NPC,
   which useGame stamps on the line so the feed can tell it apart
   from the same character reciting a scripted `knows` entry.

   One register, so the CSS says it once. A mark in the margin
   rather than a colour, because six modules retheme every colour
   in the palette and none of them can retheme a rule. */
const HUMAN = new Set(["interject", "wardennote"]);

export function register(line) {
  if (line.kind === "beat") return "beat";
  if (line.to || line.kind === "whisper") return "whisper";
  if (HUMAN.has(line.kind) || (line.extra && line.extra.live)) return "human";
  if (LOUD.has(line.kind)) return "loud";
  if (MECHANICAL.has(line.kind)) return "mech";
  return "say";
}

/** In-fiction clock, not wall clock. A player asking "when was
    that?" means the reactor, not their watch. */
const stamp = (clock) => {
  const m = Math.max(0, Math.floor(clock || 0));
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/* ============================================================
   WHO ELSE CAN SEE THIS LINE.

   `register()` has always given an addressed line its own visual
   register, and that was the right instinct half-executed: it
   tells you the line is *different*, not that it is *private*,
   and those are not the same thought at a table.

   Mothership runs on the gap between what the table knows and
   what you know. secrets.js does careful work keeping the two
   apart — a room description reaches the four people standing in
   the room and nobody else — but the interface then presented
   everything at one volume, so a player could not tell which of
   the things on their screen the person beside them could also
   read. And a player who is not sure they are the only one who
   knows says nothing, which is the exact opposite of what the
   mechanic is for.

   So an addressed line says who it reached. `to` survives
   redaction (see visibleFeed) and is either one pcId or a list,
   so the count is arithmetic rather than a guess.

   Not marked, deliberately: a distorted reading. distort.js
   exists to make a hallucinating player mistrust their own eyes,
   and a badge saying "this one is a lie" would end that in one
   glance. What you are not told, you cannot check. */
function audienceBadge(line, crew, myPcId) {
  if (line.kind === "whisper") return { label: "ONLY YOU", solo: true };
  if (line.to == null) return null;
  const to = Array.isArray(line.to) ? line.to : [line.to];
  const able = (crew || []).filter((c) => c.alive !== false);
  // Addressed to everybody still standing is not private, it is just
  // how a room description is routed. Saying "6 OF YOU" there would
  // make the badge wallpaper and the real ones invisible.
  if (able.length && to.length >= able.length) return null;
  if (to.length === 1) return { label: "ONLY YOU", solo: true };
  const others = to.filter((id) => id !== myPcId).length;
  return { label: `${to.length} OF YOU`, solo: false, others };
}

export default function FeedLog({
  feed = [], crew = [], myPcId = null, emptyText = "Nothing yet.", showStamps = true,
}) {
  const scroller = useRef(null);
  const end = useRef(null);
  /* The id we had read up to when this component last had the log at
     the bottom. Held in a ref as well as state because the effect that
     moves it must not itself cause the divider to jump. */
  const [seenId, setSeenId] = useState(() => (feed.length ? feed[feed.length - 1].id : 0));
  const [stuck, setStuck] = useState(true);
  const pinned = useRef(true);

  const lastId = feed.length ? feed[feed.length - 1].id : 0;
  const unread = useMemo(
    () => feed.filter((l) => l.id > seenId).length,
    [feed, seenId],
  );

  const nameOf = (id) => {
    const pc = (crew || []).find((c) => c.id === id);
    return pc ? pc.name : null;
  };

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX;
    pinned.current = atBottom;
    setStuck(atBottom);
    // Reading to the bottom is what marks things read. Nothing else
    // does — a line that scrolled past on its own was never read.
    if (atBottom) setSeenId(lastId);
  };

  useEffect(() => {
    if (!pinned.current) return;      // ← the whole fix, in one line
    if (end.current) end.current.scrollIntoView({ block: "end" });
    setSeenId(lastId);
  }, [lastId]);

  const jump = () => {
    pinned.current = true;
    setStuck(true);
    setSeenId(lastId);
    if (end.current) end.current.scrollIntoView({ block: "end", behavior: "smooth" });
  };

  if (!feed.length) return <p className="feedlog-empty">{emptyText}</p>;

  let dividerDrawn = false;

  return (
    <div className="feedlog-wrap">
      <div
        className="feedlog body scroll"
        id="feed-scroll"
        ref={scroller}
        onScroll={onScroll}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label="Session log"
      >
        {feed.map((line) => {
          const reg = register(line);
          const first = !dividerDrawn && line.id > seenId && unread > 0 && !stuck;
          if (first) dividerDrawn = true;
          const who = line.npc ? null : nameOf(line.pcId || line.by);
          const badge = audienceBadge(line, crew, myPcId);

          if (reg === "beat") {
            return (
              <React.Fragment key={line.id}>
                {first && <Divider n={unread} />}
                <div className="feedlog-beat" role="separator">
                  <span>{line.text}</span>
                </div>
              </React.Fragment>
            );
          }

          return (
            <React.Fragment key={line.id}>
              {first && <Divider n={unread} />}
              <p className={`feedlog-line k-${line.kind} is-${reg}${line.phantom ? " is-phantom" : ""}${badge ? " is-private" : ""}`}>
                {showStamps && (
                  <span className="feedlog-meta" aria-hidden="true">
                    <i className="feedlog-clock">{stamp(line.clock)}</i>
                    {who && <i className="feedlog-who">{who}</i>}
                    {line.live && <i className="feedlog-live" title="The Warden said this">·</i>}
                  </span>
                )}
                {badge && (
                  <span className={`feedlog-only${badge.solo ? " is-solo" : ""}`}
                    title={badge.solo
                      ? "Nobody else at this table was sent this line."
                      : `${badge.label.toLowerCase()} were sent this line. Nobody else was.`}
                    aria-label={badge.solo
                      ? "Only you were sent this"
                      : `Sent to ${badge.label.toLowerCase()}`}>
                    {badge.label}
                  </span>
                )}
                <span className="feedlog-text">{line.text}</span>
              </p>
            </React.Fragment>
          );
        })}
        <div ref={end} />
      </div>

      {!stuck && unread > 0 && (
        <button type="button" className="feedlog-jump" onClick={jump}>
          ↓ {unread} new
        </button>
      )}
    </div>
  );
}

function Divider({ n }) {
  return (
    <div className="feedlog-divider" role="separator" aria-label={`${n} unread`}>
      <span>{n} while you were away</span>
    </div>
  );
}
