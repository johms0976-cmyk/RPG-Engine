/* ============================================================
   WHAT THE MODULE DID AT A REAL TABLE.

   `engine/analytics.js` does the reading; this puts it on a
   screen. It lives inside Warden tools rather than on the ending
   screen, and that placement is the argument:

   The ending screen belongs to the TABLE. It is read once,
   together, ninety seconds after somebody died, and what belongs
   on it is what happened to these people tonight. A panel saying
   "nobody has ever found the vent" is addressed to the author,
   not to the six people who just finished, and putting it there
   turns the last minute of an evening into a post-mortem of the
   scenario.

   Warden tools is where somebody goes when they are prepping —
   deliberately, on a different day, alone. That is the person
   this is for.

   ------------------------------------------------------------
   IT NEEDS A CAMPAIGN, AND SAYS SO

   Digests are written by `recordSession`, which only runs when a
   table named a campaign in the lobby. A group who has never
   done that has no record, and this says that plainly rather
   than rendering an empty report that looks like a module nobody
   engaged with.
   ============================================================ */
import React, { useMemo, useState } from "react";
import { Panel, Label, Field } from "../ui/kit.jsx";
import { listCampaigns, getCampaign, activeCampaignId } from "../engine/campaign.js";
import { tableReport } from "../engine/analytics.js";

export default function Analytics({ modules = [] }) {
  const campaigns = useMemo(() => listCampaigns(), []);
  const [cid, setCid] = useState(() => activeCampaignId() || (campaigns[0] && campaigns[0].id) || "");
  const campaign = cid ? getCampaign(cid) : null;

  const digests = useMemo(
    () => (campaign ? (campaign.sessions || []).map((s) => s.digest).filter(Boolean) : []),
    [campaign],
  );

  /* Only modules this campaign has actually played. Listing the whole
     shelf would offer a report on a scenario with no sessions in it,
     which reads as "nobody engaged with this" rather than "you have
     not played this". */
  const played = useMemo(() => {
    const ids = new Set(digests.map((d) => d.modId));
    return modules.filter((m) => ids.has(m.id));
  }, [modules, digests]);

  const [modId, setModId] = useState("");
  const mod = played.find((m) => m.id === modId) || played[0] || null;
  const report = useMemo(() => (mod ? tableReport(mod, digests) : null), [mod, digests]);

  if (!campaigns.length) {
    return (
      <Panel title="What the module did">
        <p style={{ margin: 0 }}>
          No campaigns yet. A session is only written down when a table names a
          campaign in the lobby — without one there is nothing to read back, which
          is deliberate: a record nobody asked for is a record nobody agreed to.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="What the module did">
      <div className="stack">
        <div className="btn-row" style={{ alignItems: "flex-end" }}>
          <div style={{ minWidth: 170 }}>
            <Field label="Campaign">
              <select value={cid} onChange={(e) => { setCid(e.target.value); setModId(""); }}>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>
          {played.length > 1 && (
            <div style={{ minWidth: 170 }}>
              <Field label="Module">
                <select value={mod ? mod.id : ""} onChange={(e) => setModId(e.target.value)}>
                  {played.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </Field>
            </div>
          )}
        </div>

        {!report && (
          <p style={{ margin: 0 }}>
            {digests.length === 0
              ? "This campaign has sessions in it, but none from a version of the engine that kept counts. Sessions recorded from now on will appear here."
              : "None of the modules this campaign has played are on the shelf."}
          </p>
        )}

        {report && (
          <>
            <div className="note-box">
              <strong>{report.modTitle}</strong> · {report.sessions} session
              {report.sessions === 1 ? "" : "s"} · {Math.round(report.minutes / 60)}h of game clock
            </div>

            {/* Everything below is a count. There is no score here and no
                verdict — see the header of engine/analytics.js. An ending
                nobody reaches may be an ending that costs something. */}
            <div>
              <Label>WHERE THE TIME WENT</Label>
              {/* The party's time, and the wording says so — `w.room`
                  is where most of the crew is standing, so a split
                  party is counted wherever the majority was. */}
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5 }}>
                {[...report.rooms].filter((r) => r.reached)
                  .sort((a, b) => b.perVisit - a.perVisit).slice(0, 8)
                  .map((r) => (
                    <li key={r.id}>
                      {r.name} — {r.perVisit}m per visit
                      {r.stalled > 0 && `, ${r.stalled} of them with nothing touched`}
                    </li>
                  ))}
              </ul>
              <p className="clue-meta" style={{ margin: "4px 0 0" }}>
                The party&apos;s time, not each player&apos;s. While the crew is split
                this counts everyone as being wherever most of them were.
              </p>
            </div>

            <Section
              label="ROOMS NOBODY HAS REACHED"
              empty="Every room has been walked into at least once."
              items={report.rooms.filter((r) => r.never).map((r) => `${r.name} · ${r.id}`)} />

            <Section
              label="ENDINGS NOBODY HAS REACHED"
              empty="Every ending has been reached at least once."
              items={report.endings.filter((e) => e.never).map((e) => `${e.title} · @${e.id}`)} />

            <Section
              label="PEOPLE NOBODY HAS MET"
              empty="Every named character has been met."
              items={report.cast.filter((c) => c.never).map((c) => `${c.name} · ${c.lines} lines written`)} />

            <Section
              label="HANDOUTS NOBODY HAS OPENED"
              empty="Every handout has been read."
              items={report.handouts.filter((h) => h.never).map((h) => h.label)} />

            <div>
              <Label>LOCKS, AND WHAT THEY COST</Label>
              {report.gates.length === 0 ? (
                <p className="clue-meta" style={{ margin: 0 }}>
                  No door rolls recorded.
                </p>
              ) : (
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5 }}>
                  {report.gates.map((g) => (
                    <li key={g.label}>
                      <strong>{g.label}</strong> — {g.rolls} roll{g.rolls === 1 ? "" : "s"} across{" "}
                      {g.sessions} session{g.sessions === 1 ? "" : "s"}, {g.failed} failed,
                      opened in {g.opened}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <Label>PEOPLE'S LINES</Label>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5 }}>
                {report.cast.map((c) => (
                  <li key={c.id}>
                    {c.name} — met in {c.met} of {report.sessions}, best evening{" "}
                    {c.best} of {c.lines} lines
                  </li>
                ))}
              </ul>
            </div>

            <p className="clue-meta" style={{ margin: 0 }}>
              Counts, and nothing else. Nothing here is a fault: a quiet room may be a
              corridor and an unreached ending may be one that costs something to get
              to. What it is for is the hour you were about to spend on the module
              anyway — this says which hour.
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}

function Section({ label, items, empty }) {
  return (
    <div>
      <Label>{label}</Label>
      {items.length === 0 ? (
        <p className="clue-meta" style={{ margin: 0 }}>{empty}</p>
      ) : (
        <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5 }}>
          {items.map((t) => <li key={t}>{t}</li>)}
        </ul>
      )}
    </div>
  );
}
