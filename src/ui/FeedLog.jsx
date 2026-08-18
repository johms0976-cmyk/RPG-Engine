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

export function register(line) {
  if (line.kind === "beat") return "beat";
  if (line.to || line.kind === "whisper") return "whisper";
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

export default function FeedLog({
  feed = [], crew = [], emptyText = "Nothing yet.", showStamps = true,
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
              <p className={`feedlog-line k-${line.kind} is-${reg}${line.phantom ? " is-phantom" : ""}`}>
                {showStamps && (
                  <span className="feedlog-meta" aria-hidden="true">
                    <i className="feedlog-clock">{stamp(line.clock)}</i>
                    {who && <i className="feedlog-who">{who}</i>}
                    {line.live && <i className="feedlog-live" title="The Warden said this">·</i>}
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
