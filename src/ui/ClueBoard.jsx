/* ============================================================
   CLUE BOARD — what the crew actually knows.

   Separate from the feed on purpose. The feed is what happened;
   this is what it meant, and it does not scroll away.
   ============================================================ */
import React, { useState, useMemo } from "react";
import { Panel, Btn, Field } from "./kit.jsx";
import { CLUE_KINDS, visibleClues, linksFor, linkState } from "../engine/board.js";

/* ============================================================
   THREADS.

   The board answered "what do we know". It could not answer "and
   what has that got to do with the other thing", which is the
   entire activity a corkboard and a ball of red string exists
   for. Two clues and a word for why.

   Drawing one is a two-tap gesture rather than a drag: this has
   to work on a phone held in one hand, and dragging a line
   between two items in a scrolling list is a desktop idea.

   A thread whose ends are both resolved dims rather than
   vanishing, because the shape of a case you solved is worth
   keeping on the wall.
   ============================================================ */

export default function ClueBoard({
  clues, links = [], isWarden = false,
  onPin, onResolve, onUnpin, onLink, onUnlink, canWrite = true,
}) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState("fact");
  const [secret, setSecret] = useState(false);
  // The first end of a thread being drawn, if one is.
  const [threading, setThreading] = useState(null);
  const list = visibleClues(clues, isWarden);

  const labelOf = useMemo(() => {
    const m = {};
    for (const c of clues || []) m[c.id] = c.text;
    return m;
  }, [clues]);

  const tap = (id) => {
    if (!onLink) return;
    if (!threading) { setThreading(id); return; }
    if (threading === id) { setThreading(null); return; }
    onLink(threading, id);
    setThreading(null);
  };

  const pin = () => {
    if (!text.trim()) return;
    onPin && onPin(text.trim(), kind, { secret: isWarden && secret });
    setText("");
    setSecret(false);
  };

  return (
    <Panel title={`What we know${list.length ? ` · ${list.filter((c) => !c.resolved).length} open` : ""}`}>
      {canWrite && (
        <div className="stack" style={{ marginBottom: 12 }}>
          <Field label="Pin something">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && pin()}
              maxLength={240}
              placeholder="Door code 4471. Hall says don't trust Voss."
            />
          </Field>
          <div className="btn-row">
            {Object.entries(CLUE_KINDS).map(([k, v]) => (
              <Btn key={k} kind={kind === k ? "accent" : "ghost"} className="inline small"
                title={v.blurb} onClick={() => setKind(k)}>
                {v.label}
              </Btn>
            ))}
            {isWarden && (
              <Btn kind={secret ? "danger" : "ghost"} className="inline small"
                title="Only you will see this" onClick={() => setSecret((s) => !s)}>
                {secret ? "Warden only" : "Public"}
              </Btn>
            )}
            <Btn kind="primary" className="inline small" disabled={!text.trim()} onClick={pin}>Pin</Btn>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <p style={{ opacity: 0.6, margin: 0 }}>Nothing established yet.</p>
      ) : (
        <div className="clues">
          {threading && (
            <p className="clue-thread-hint" role="status">
              Threading from <strong>{labelOf[threading]}</strong> — tap what it
              connects to.{" "}
              <button type="button" className="linklike" onClick={() => setThreading(null)}>
                cancel
              </button>
            </p>
          )}

          {list.map((c) => {
            const threads = linksFor(links, c.id);
            return (
              <div key={c.id}
                className={`clue${c.resolved ? " is-resolved" : ""}${threading === c.id ? " is-threading" : ""}`}>
                <span className="clue-kind">{c.secret ? "warden" : CLUE_KINDS[c.kind].label}</span>
                <span className="clue-text">{c.text}</span>
                <span className="clue-meta">
                  {c.by ? `${c.by}` : "the Warden"}{c.room ? ` · ${c.room}` : ""}
                </span>

                {/* The threads off this pin, named by what is on the
                    other end — which is the only rendering of a
                    corkboard that works in a vertical list. */}
                {threads.length > 0 && (
                  <span className="clue-threads">
                    {threads.map((l) => {
                      const otherId = l.a === c.id ? l.b : l.a;
                      const state = linkState(l, clues);
                      return (
                        <span key={l.id} className={`clue-thread is-${state}`}>
                          <i aria-hidden="true">↝</i>
                          {labelOf[otherId] || "…"}
                          {l.note ? ` — ${l.note}` : ""}
                          {onUnlink && (
                            <button type="button" className="linklike" title="Cut this thread"
                              onClick={() => onUnlink(l.id)}>×</button>
                          )}
                        </span>
                      );
                    })}
                  </span>
                )}

                <span className="clue-actions">
                  {onLink && (
                    <Btn kind={threading === c.id ? "accent" : "ghost"} className="inline small"
                      title={threading ? "Connect these two" : "Draw a thread from this"}
                      onClick={() => tap(c.id)}>↝</Btn>
                  )}
                  <Btn kind="ghost" className="inline small"
                    title={c.resolved ? "Put it back on the board" : "Dealt with"}
                    onClick={() => onResolve && onResolve(c.id, !c.resolved)}>
                    {c.resolved ? "↺" : "✓"}
                  </Btn>
                  {isWarden && (
                    <Btn kind="ghost" className="inline small" title="Remove" onClick={() => onUnpin && onUnpin(c.id)}>×</Btn>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
