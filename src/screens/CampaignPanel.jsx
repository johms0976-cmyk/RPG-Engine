/* ============================================================
   CHOOSING A CAMPAIGN, OR NOT CHOOSING ONE.

   Its own file rather than another function inside Lobby.jsx,
   because it owns state — a name being typed, a list being read
   off localStorage — and Lobby is otherwise a pure render of
   props. A screen that was pure and now has a text field in it is
   a screen that is about to grow four more.

   "JUST THIS SESSION" IS FIRST AND IS THE DEFAULT.

   It is the honest default for the same reason the session length
   defaults to none: a group who came round to play a ninety-minute
   module on a Tuesday should never have to name anything, and a
   feature that asks people to commit before they have played is a
   feature that gets skipped past. Nothing is created until
   somebody types a name.
   ============================================================ */
import React from "react";
import { Panel, Btn } from "../ui/kit.jsx";
import { listCampaigns, createCampaign, campaignLine } from "../engine/campaign.js";

export default function CampaignPanel({ campaignId = null, onCampaign }) {
  /* Read once. The list only changes because this component
     changed it, so re-reading on every render would be a lot of
     JSON parsing to observe nothing. */
  const [all, setAll] = React.useState(() => listCampaigns());
  const [naming, setNaming] = React.useState(false);
  const [name, setName] = React.useState("");

  const make = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const c = createCampaign(trimmed);
    setAll(listCampaigns());
    setNaming(false);
    setName("");
    onCampaign(c.id);
  };

  return (
    <Panel title="Is this part of something">
      <div className="btn-row" style={{ flexWrap: "wrap" }}>
        <Btn
          kind={campaignId ? "ghost" : "accent"}
          className="inline small"
          onClick={() => onCampaign(null)}
        >
          Just this session
        </Btn>
        {all.map((c) => (
          <Btn
            key={c.id}
            kind={campaignId === c.id ? "accent" : "ghost"}
            className="inline small"
            onClick={() => onCampaign(c.id)}
          >
            {c.name}
          </Btn>
        ))}
        {!naming && (
          <Btn kind="ghost" className="inline small" onClick={() => setNaming(true)}>
            + New campaign
          </Btn>
        )}
      </div>

      {naming && (
        <div className="btn-row" style={{ marginTop: 8 }}>
          <input
            autoFocus
            value={name}
            maxLength={60}
            placeholder="What do you call it?"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") make(); }}
          />
          <Btn kind="primary" className="inline small" onClick={make}>Start it</Btn>
          <Btn kind="default" className="inline small" onClick={() => { setNaming(false); setName(""); }}>
            Cancel
          </Btn>
        </div>
      )}

      <p className="clue-meta" style={{ margin: "8px 0 0" }}>
        {campaignId
          ? `${campaignLine(all.find((c) => c.id === campaignId) || null)} `
            + "Tonight gets written into it when the session ends. It changes nothing about how the "
            + "session plays — it is a record, not a rule."
          : "Nothing is remembered between evenings. Name a campaign if this table means to come back "
            + "to these people."}
      </p>
    </Panel>
  );
}
