/* ============================================================
   LOBBY — the table assembling, before there is a session.

   This is the step the engine was missing. The Warden could build
   a whole crew alone on the desk, or start a session and let phones
   claim bodies they had no hand in making — but there was nowhere
   for the ordinary thing to happen, which is five people sitting
   round a table making characters at the same time while the
   Warden watches them arrive.

   The Warden's job on this screen is to approve and to know when
   to start. Everything else is other people typing. So: who is
   connected and what they are doing, what is waiting on you, who
   is already in, and one button that goes when the module says
   there are enough of them.
   ============================================================ */
import React, { useState } from "react";
import { Panel, Btn, Label, Field } from "../ui/kit.jsx";
import Approvals from "./Approvals.jsx";

/* ============================================================
   LINES AND VEILS — the conversation before the horror.

   Mothership ships safety tools in its own rulebook, and the
   lobby is where they belong: before anyone has a character to
   be brave about, while the group is still a group of people
   rather than a crew.

   A line is out of the game entirely. A veil happens but
   off-screen. Both go into every snapshot, so any phone can
   re-read them at 1am in the middle of act three — a contract
   nobody can check is not one.

   The module's own content warning is shown alongside, because
   the honest version of this conversation starts with the
   Warden saying what is actually in the box.
   ============================================================ */
function SafetyPanel({ mod, safety, onSafety }) {
  const [line, setLine] = useState("");
  const [kind, setKind] = useState("lines");
  const s = safety || { lines: [], veils: [] };

  const add = () => {
    const t = line.trim();
    if (!t) return;
    onSafety({ ...s, [kind]: [...new Set([...(s[kind] || []), t])] });
    setLine("");
  };

  const drop = (which, t) =>
    onSafety({ ...s, [which]: (s[which] || []).filter((x) => x !== t) });

  return (
    <Panel title="Lines and veils">
      <div className="stack">
        {mod.contentWarning && (
          <div className="note-box">
            <strong>This module contains.</strong> {mod.contentWarning}
          </div>
        )}

        <p className="clue-meta" style={{ margin: 0 }}>
          Ask out loud, add what people say, and anything anyone would rather
          not say out loud they can add later through the card on their phone.
          Every player can re-read this list mid-session.
        </p>

        <div className="btn-row" style={{ alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <Field label={kind === "lines" ? "Not in this game at all" : "Happens, but off-screen"}>
              <input value={line} onChange={(e) => setLine(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
                placeholder={kind === "lines" ? "harm to animals" : "detailed injury"} />
            </Field>
          </div>
          <Btn kind={kind === "lines" ? "danger" : "ghost"} className="inline small"
            onClick={() => setKind("lines")}>Line</Btn>
          <Btn kind={kind === "veils" ? "solid" : "ghost"} className="inline small"
            onClick={() => setKind("veils")}>Veil</Btn>
          <Btn kind="primary" className="inline small" disabled={!line.trim()} onClick={add}>Add</Btn>
        </div>

        <div>
          <Label>LINES</Label>
          <div className="btn-row">
            {(s.lines || []).length === 0
              ? <span className="clue-meta">None named.</span>
              : s.lines.map((t) => (
                <Btn key={t} kind="ghost" className="inline small" title="Remove"
                  onClick={() => drop("lines", t)}>{t} ×</Btn>
              ))}
          </div>
        </div>

        <div>
          <Label>VEILS</Label>
          <div className="btn-row">
            {(s.veils || []).length === 0
              ? <span className="clue-meta">None named.</span>
              : s.veils.map((t) => (
                <Btn key={t} kind="ghost" className="inline small" title="Remove"
                  onClick={() => drop("veils", t)}>{t} ×</Btn>
              ))}
          </div>
        </div>

        <div className="note-box">
          Every phone gets a card in the corner for the rest of the session.
          Pressing it tells you someone asked for a pause — never who. That is
          deliberate and it cannot be undone from this screen.
        </div>
      </div>
    </Panel>
  );
}

/** What a connected phone is doing right now, in the Warden's terms.
    Derived rather than reported: a phone that has claimed a character
    is playing it, a phone with an offer in the queue is waiting on
    you, anything else is still deciding. */
function peerState(peer, submissions, roster) {
  if (peer.pcId) {
    const pc = roster.find((c) => c.id === peer.pcId);
    return { kind: "in", label: pc ? pc.name : "in the crew" };
  }
  if (submissions.some((s) => s.clientId === peer.clientId)) {
    return { kind: "waiting", label: "waiting on you" };
  }
  return { kind: "building", label: "building…" };
}

export default function Lobby({
  mod, peers = [], submissions = [], roster = [],
  onAccept, onReject, onDrop, onBegin, onBack, onDeskCreate, joinUrl,
  safety, onSafety,
}) {
  const min = (mod.crewSize && mod.crewSize.min) || 1;
  const max = (mod.crewSize && mod.crewSize.max) || 6;
  const short = Math.max(0, min - roster.length);
  const full = roster.length >= max;

  return (
    <div className="lobby">
      <Panel title={`${mod.title} — gathering the table`}>
        <div className="stack">
          <p className="lobby-lede">
            Players join on their phones and build a character each. Everything
            they offer lands here for you to wave through or send back. Nothing
            starts until you say so.
          </p>
          {joinUrl && (
            <div className="note-box">
              Same wifi, then: <strong>{joinUrl.replace(/^https?:\/\//, "")}</strong>
              {" "}— or use Show QR in the bar above.
            </div>
          )}
        </div>
      </Panel>

      <div className="lobby-grid">
        <div className="stack">
          <Panel title={`Phones · ${peers.length}`}>
            {peers.length === 0 ? (
              <p className="clue-meta" style={{ margin: 0 }}>
                Nobody yet. They need to be on the same wifi and open the address above.
              </p>
            ) : (
              <ul className="lobby-peers">
                {peers.map((p) => {
                  const st = peerState(p, submissions, roster);
                  return (
                    <li key={p.clientId} className={`lobby-peer is-${st.kind}`}>
                      <span className="who">{p.name}</span>
                      <span className="what">{st.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title={`At the table · ${roster.length}`}>
            {roster.length === 0 ? (
              <p className="clue-meta" style={{ margin: 0 }}>
                Nobody approved yet. {min > 1 ? `This module wants at least ${min}.` : ""}
              </p>
            ) : (
              <ul className="lobby-roster">
                {roster.map((c) => (
                  <li key={c.id}>
                    <span className="who">{c.name}</span>
                    <span className="what">{c.cls}</span>
                    <Btn kind="ghost" className="inline small" onClick={() => onDrop(c.id)}>
                      Remove
                    </Btn>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="stack">
          <Approvals queue={submissions} mod={mod} onAccept={onAccept} onReject={onReject} />
          {onSafety && <SafetyPanel mod={mod} safety={safety} onSafety={onSafety} />}
        </div>
      </div>

      <div className="lobby-foot">
        {full && (
          <div className="warn-box">
            The table is full at {max}. Remove someone before letting another in.
          </div>
        )}
        <div className="btn-grid">
          <Btn kind="accent" disabled={short > 0} onClick={onBegin}>
            {short > 0
              ? `Need ${short} more character${short === 1 ? "" : "s"}`
              : `Begin with ${roster.length} character${roster.length === 1 ? "" : "s"}`}
          </Btn>
          {onDeskCreate && (
            <Btn kind="ghost" onClick={onDeskCreate}>
              Build the crew here instead
            </Btn>
          )}
          <Btn kind="ghost" onClick={onBack}>Back</Btn>
        </div>
        <div>
          <Label>Note</Label>
          <p className="clue-meta" style={{ margin: 0 }}>
            Anyone who turns up late can still build a character mid-session — it
            arrives on the Board tab and joins the crew when you approve it.
          </p>
        </div>
      </div>
    </div>
  );
}
