import React from "react";
import { Panel, Btn, Label } from "../ui/kit.jsx";
import { fmtClock } from "../engine/rules.js";
import { toMarkdown, filename, rollStats } from "../engine/transcript.js";
import { downloadText } from "../engine/storage.js";
import { pad } from "../engine/dice.js";
import { endCard, endCardText } from "../engine/endcard.js";
import { getCampaign, recordSession, campaignLine } from "../engine/campaign.js";
import { toFragment } from "../engine/continuity.js";
import { missesFrom, backlogMarkdown } from "../engine/misses.js";

export default function Ending({ mod, w, crew, feed, onAgain, onLibrary, phone = false, pcId = null, campaignId = null }) {
  /* COPYING, ON A PHONE.

     `downloadText` is right on a laptop and close to useless on a
     handset, where a downloaded .md lands somewhere the person will
     never find it again. Copying puts the evening straight into the
     message they were about to send anybody.

     It matters more than it looks because of what a player's copy
     actually is. The snapshot every phone holds was redacted host-
     side, so a player's feed is *their* evening — the things they
     were told, without the things they were not. Six people at this
     table can each take away a different and individually honest
     account of the same session, and none of them contains anybody
     else's secrets. */
  /* WHOSE COPY THIS IS.

     `phone` already tells us which device we are on and `pcId` who
     is holding it, so the transcript can be addressed without a new
     prop. A phone gets that player's rulings — including the ones
     whispered only to them. The host is the Warden's device and
     holds unredacted state, so its copy carries everything,
     including the rulings that were taken back. */
  const asWho = { viewerPcId: phone ? pcId : null, isWarden: !phone };

  const [copied, setCopied] = React.useState(false);
  const copy = React.useCallback(() => {
    const text = toMarkdown({ mod, world: w, crew, feed, ...asWho });
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2500); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => {});
      return;
    }
    /* Older webviews, and any browser that has not been given
       clipboard permission. Silent failure here would be worse than
       the deprecated call. */
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", "");
      ta.style.position = "absolute"; ta.style.left = "-9999px";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      done();
    } catch { /* nothing to be done, and nothing to say about it */ }
  }, [mod, w, crew, feed]);

  /* B.5 — THE CARD, next to the transcript rather than instead of
     it. The transcript is for somebody who wants to reread the
     evening; this is for the message they are about to send, which
     is the only artefact that reaches people who were not here. */
  const card = pcId ? endCard({ mod, w, crew, feed, pcId }) : null;
  const [cardCopied, setCardCopied] = React.useState(false);
  const copyCard = React.useCallback(() => {
    if (!card) return;
    const text = endCardText(card);
    const done = () => { setCardCopied(true); setTimeout(() => setCardCopied(false), 2500); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => {});
      return;
    }
    done();
  }, [card]);

  const end = mod.endings[w.ended] || { title: "IT IS OVER", text: "" };
  const stats = rollStats(w);
  const debrief = mod.debrief ? mod.debrief(w, crew[0], mod) : [];
  const survivors = crew.filter((c) => c.alive !== false);

  /* ============================================================
     WRITING THE EVENING DOWN

     Once, here, on the host's screen only, and only if the table
     named a campaign in the lobby. `phone` is the player's copy of
     this screen — six phones each recording the same evening into
     six local campaigns would be six different half-true records,
     so the shared screen is the one that keeps the book.

     `recordSession` is idempotent on `sessionId`, which matters
     more than it looks: this component sets state twice for the
     two copy buttons, so it re-renders during an ordinary
     end-of-session, and an effect that appended would append
     again every time somebody copied their card.

     The id is derived from the module, the ending and the clock
     rather than generated, so the same evening re-entered from a
     restored save is still the same evening.
     ============================================================ */
  const missCount = missesFrom(feed).length;
  const sessionId = `${mod.id}:${w.ended}:${w.clock || 0}`;
  const [recorded, setRecorded] = React.useState(null);
  React.useEffect(() => {
    if (phone || !campaignId) return;
    const c = recordSession(campaignId, {
      sessionId,
      modId: mod.id,
      modTitle: mod.title,
      ending: w.ended,
      endingTitle: end.title,
      good: !!end.good,
      minutes: w.clock || 0,
      survivors: survivors.map((p) => p.name),
      lost: crew.filter((p) => p.alive === false).map((p) => p.name),
      /* THE FACTS THIS TABLE MADE TRUE. `recordSession` harvests
         the keepable rulings out of the world — see
         engine/continuity.js for what "keepable" excludes and why.
         Passing the world is optional there, so every other caller
         is unaffected. */
      world: w,
    });
    setRecorded(c || getCampaign(campaignId));
  }, [phone, campaignId, sessionId]);

  return (
    <div className="center-screen" style={{ alignItems: "flex-start", padding: "28px 16px" }}>
      <div style={{ width: "100%", maxWidth: 680 }} className="stack">
        {/* First on the screen, above the module's own ending text.
            What happened to YOU is the thing you look for, and it
            was previously several scrolls below what happened to
            the scenario. */}
        {card && (
          <section className="endcard" aria-label="Your character">
            <div className="endcard-name">{card.name}</div>
            {card.cls && <div className="endcard-cls">{card.cls}</div>}
            <div className={`endcard-fate${card.survived ? " is-alive" : ""}`}>
              {card.survived ? "Walked away." : "Did not make it."}
            </div>
            {/* Verbatim from the feed or absent. See endcard.js — a
                card that invented this would be lying about somebody's
                evening in the one artefact they show other people. */}
            {card.line && <blockquote className="endcard-line">{card.line}</blockquote>}
            <Btn kind="ghost" className="inline small" onClick={copyCard}>
              {cardCopied ? "Copied" : "Copy this"}
            </Btn>
          </section>
        )}
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.22em", color: "var(--graphite)" }}>
            {mod.title} · {fmtClock(w.clock)} ELAPSED
          </div>
          <h1 style={{ fontFamily: "var(--display)", fontSize: 40, fontWeight: 700, letterSpacing: "0.06em",
            color: end.good ? "var(--accent)" : "var(--blood)", margin: "8px 0 0", lineHeight: 1 }}>
            {end.title}
          </h1>
        </div>

        <Panel>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{end.text}</p>
        </Panel>

        <Panel title="The crew">
          <div className="stack">
            {crew.map((c) => (
              <div key={c.id} style={{ fontFamily: "var(--mono)", fontSize: 12, borderBottom: "1px solid var(--bone2)", paddingBottom: 6 }}>
                <strong style={{ fontFamily: "var(--display)", letterSpacing: "0.08em", fontSize: 15 }}>{c.name}</strong>
                {" · "}{c.cls.toUpperCase()}{c.level > 0 ? ` · level ${c.level}` : ""}
                <br />
                {c.alive === false
                  ? <span style={{ color: "var(--blood)" }}>Did not come back.</span>
                  : <>Health {c.health}/{c.maxHealth} · Stress {c.stress} · Resolve {c.resolve} · {c.xp} XP</>}
                {c.conditions.length > 0 && <><br />{c.conditions.join(", ")}</>}
              </div>
            ))}
            <div style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
              {survivors.length} of {crew.length} walked away.
            </div>
          </div>
        </Panel>

        {/* Stated rather than silent. A record kept without saying
            so is a record the table cannot check, and this one is
            about people they are going to bring back next week. */}
        {recorded && (
          <Panel title={recorded.name}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.7 }}>
              <div>Tonight is in the book.</div>
              <div className="clue-meta" style={{ marginTop: 4 }}>{campaignLine(recorded)}</div>
            </div>

            {/* ============================================================
                WHAT THIS TABLE MADE TRUE

                The facts they invented, shown back to them once, at
                the moment they are proudest of them. Not a control —
                choosing which of these are still true happens at the
                START of the next session, where the table can
                actually remember what they meant. See
                engine/continuity.js on why that choice is never made
                for them.

                The export is here rather than there because this is
                the screen somebody is already copying things off.
                ============================================================ */}
            {(recorded.facts || []).length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div className="clue-meta" style={{ marginBottom: 6 }}>
                  {recorded.facts.length} thing{recorded.facts.length === 1 ? "" : "s"} this table
                  {" "}made true. You will be asked which are still true next time.
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.7 }}>
                  {recorded.facts.slice(-6).map((f, i) => (
                    <div key={i} className="clue-meta">— {f.text}</div>
                  ))}
                </div>
                <Btn
                  kind="ghost"
                  className="inline small"
                  onClick={() => downloadText(
                    `${recorded.id}-${mod.id}-fragment.js`,
                    toFragment(recorded, { modId: mod.id, title: mod.title }),
                    "text/javascript",
                  )}
                >
                  Export as a module fragment
                </Btn>
              </div>
            )}
          </Panel>
        )}

        {/* ============================================================
            WHAT THE MODULE HAD NO ANSWER FOR

            Only shown when there were misses, and only on the
            shared screen — this is an authoring artefact, not a
            line of play, and a player does not want their own
            sentences read back at them at the end of the night.

            It is the listener backlog for whoever wrote the
            module, generated from what real people actually tried.
            See engine/misses.js.
            ============================================================ */}
        {!phone && missCount > 0 && (
          <Panel title="What the module had no answer for">
            <p className="muted" style={{ marginTop: 0 }}>
              {missCount} sentence{missCount === 1 ? "" : "s"} fell through to the oracle
              tonight. Each one is a listener this module is missing.
            </p>
            <Btn
              kind="ghost"
              className="inline small"
              onClick={() => downloadText(
                `${mod.id}-misses.md`,
                backlogMarkdown(feed, { title: `${mod.title} — parse misses` }),
                "text/markdown",
              )}
            >
              Export the backlog
            </Btn>
          </Panel>
        )}

        {debrief.length > 0 && (
          <Panel title="Debrief">
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.7 }}>
              {debrief.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </Panel>
        )}

        {stats.n > 0 && (
          <Panel title="The dice">
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.8 }}>
              <div>{stats.n} rolls · {stats.rate}% success rate</div>
              <div>{stats.crit} critical success{stats.crit === 1 ? "" : "es"} · {stats.fumble} critical failure{stats.fumble === 1 ? "" : "s"}</div>
              {stats.best && <div>Best margin: {stats.best.who} made {stats.best.label} by {stats.best.margin}</div>}
              {stats.worst && <div>Worst: {stats.worst.who} missed {stats.worst.label} by {-stats.worst.margin}</div>}
            </div>
          </Panel>
        )}

        <div className="btn-grid">
          <Btn kind="accent" onClick={copy}>
            {copied ? "Copied" : "Copy what happened tonight"}
          </Btn>
          {/* A file is the right answer on the machine that has a
              file system and somewhere to put it. */}
          {!phone && (
            <Btn kind="ghost" onClick={() => downloadText(filename(mod, w), toMarkdown({ mod, world: w, crew, feed, ...asWho }), "text/markdown")}>
              Export the session transcript
            </Btn>
          )}
          {onAgain && <Btn kind="ghost" onClick={onAgain}>Run it again</Btn>}
          <Btn kind="ghost" onClick={onLibrary}>{phone ? "Done" : "Back to the shelf"}</Btn>
        </div>

        <div className="note-box">
          {phone
            ? "This is your own record of the evening — the things this character was told, "
              + "without the things they were not. Everyone else's copy is different."
            : "The save has been kept, not deleted. You can come back to this debrief from the library."}
        </div>
      </div>
    </div>
  );
}
