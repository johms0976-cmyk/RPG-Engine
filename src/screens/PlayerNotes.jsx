/* ============================================================
   WHAT WE KNOW — the phone's fifth tab, and the one the table
   was missing.

   Three things live here, and they are together because they
   answer the same question at three different distances:

     THE JOB       why are we here, who is paying, what did we
                   agree the session would and would not contain.
     THE BOARD     what have we found out, and what has it got to
                   do with the other thing. This is the Warden's
                   pinned board — `state.clues` and `state.marks`
                   have been in every snapshot since the protocol
                   was written, and `useRemoteGame` has been
                   unpacking them into `g.w` the whole time.
                   Nothing outside the Warden's own Board view
                   ever rendered them, so a Warden pinning a
                   connection in front of the table was writing to
                   a screen nobody at the table could read.
     THE RULES     how a roll works, what Stress does, and what
                   happens at 0 Health.

   That last one is not padding. Mothership's resolution is four
   sentences long and every one of them is inverted relative to
   what a new player expects — roll *under*, doubles are the
   interesting result, Saves are things done *to* you. A table
   with one experienced Warden and four new players spends the
   first hour asking "wait, do I want high or low", and the
   answer being on the phone in their hand is worth more than
   any amount of atmosphere. An experienced player never opens
   this tab. That is fine; it costs them one word in a tab bar.

   Read-only by construction. `ClueBoard` already takes
   `canWrite` and `isWarden`, and `visibleClues` already filters
   the Warden's secret pins — so a player gets the same board
   with the Warden's private annotations withheld, and there is
   nothing here for a phone to write back.
   ============================================================ */
import React from "react";
import { Panel } from "../ui/kit.jsx";
import ClueBoard from "../ui/ClueBoard.jsx";

/* ---------------- the reference card ----------------

   Deliberately not a rules dump. Six facts, each one a thing a
   player at this table will need inside the first twenty minutes
   and will not want to ask about out loud twice. Everything else
   is in the book. */
const BASICS = [
  ["Rolling", "Percentile dice, and you want to roll LOW. Equal to or under the number is a success. There is no target number to beat — the number on your sheet is the target."],
  ["Checks vs Saves", "A Check is something you choose to do: Strength, Speed, Intellect, Combat. A Save is something happening to you that you would rather it did not: Sanity, Fear, Body, Armor."],
  ["Skills", "A relevant Skill adds 10, 15 or 20 to the stat you are rolling under — a bigger number to get under, not a bonus to the roll."],
  ["Criticals", "Doubles are critical. Under your number, that is a critical success. Over it, a critical failure — and a critical failure on a Save means a Panic Check."],
  ["Advantage", "Roll two sets and take the one you prefer. Disadvantage is the same roll and you take the one you do not."],
  ["Opposed", "Both sides roll under their own number. Of those who succeed, the higher roll wins — so a bare success loses to a near miss from above."],
];

const STRESS = [
  ["Stress goes up", "Every failed Save. Getting knocked out. Twenty-four hours without rest, or without food and water. Anything the ship you are standing in takes."],
  ["Panic Check", "2d10 against your current Stress. Roll OVER and you keep it together and shed 1 Stress. Roll equal or under and you Panic."],
  ["Panic Effect", "2d10 plus your Stress, minus your Resolve. High is bad. This is the one roll in the game where you want the total low."],
  ["Resolve", "Starts at 0, caps at 5, and every point is −1 on the Panic Effect table. It is the only defence against the number that kills you."],
  ["0 Health", "Body Save. Pass and you are unconscious and the Warden secretly rolls for when you wake. Fail and you are dead."],
];

function Facts({ rows }) {
  return (
    <dl className="wiz-review">
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

export default function PlayerNotes({ mod, w, crew, pc, safety }) {
  const marks = (w && w.marks) || [];
  const lines = (safety && safety.lines) || [];
  const veils = (safety && safety.veils) || [];
  const others = (crew || []).filter((c) => c.id !== (pc && pc.id));

  return (
    <div className="stack" style={{ paddingBottom: 24 }}>
      {/* ---- the job ---- */}
      <Panel title="The job">
        <div className="stack">
          <div>
            <strong style={{ letterSpacing: "0.08em" }}>{mod.title}</strong>
            {mod.subtitle && (
              <div className="clue-meta" style={{ marginTop: 2 }}>{mod.subtitle}</div>
            )}
          </div>
          {mod.blurb && <p style={{ margin: 0 }}>{mod.blurb}</p>}
          {mod.contentWarning && (
            <p className="clue-meta" style={{ margin: 0 }}>
              <strong>Content:</strong> {mod.contentWarning}
            </p>
          )}
        </div>
      </Panel>

      {/* ---- the contract the table made with itself ----

          Agreed in the lobby, packed into every snapshot, and until
          now readable only during the ninety seconds before the game
          started. The point of a line is that it can be checked
          mid-scene by the person who is about to need it. */}
      {(lines.length > 0 || veils.length > 0) && (
        <Panel title="Lines and veils">
          <div className="stack">
            {lines.length > 0 && (
              <div>
                <div className="clue-meta">WE DO NOT GO THERE</div>
                <div>{lines.map((l) => <span key={l} className="tag">{l}</span>)}</div>
              </div>
            )}
            {veils.length > 0 && (
              <div>
                <div className="clue-meta">OFF-SCREEN, NOT OFF-LIMITS</div>
                <div>{veils.map((v) => <span key={v} className="tag">{v}</span>)}</div>
              </div>
            )}
            <p className="clue-meta" style={{ margin: 0 }}>
              Anyone can stop or veil anything at any point without saying why.
              The card is on the Actions tab and it arrives anonymously.
            </p>
          </div>
        </Panel>
      )}

      {/* ---- the board ----

          Same component the Warden uses, with writing off and the
          Warden's secret pins filtered out by visibleClues. */}
      <ClueBoard
        clues={(w && w.clues) || []}
        links={(w && w.clueLinks) || []}
        isWarden={false}
        canWrite={false}
      />

      {marks.length > 0 && (
        <Panel title={`On the map · ${marks.length}`}>
          <div className="stack">
            {marks.map((m, i) => (
              <div key={m.id || i} className="clue">
                <span className="clue-kind">{m.room || "somewhere"}</span>
                <span>{m.text || m.label}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ---- who is out there ----

          Names and states only. Health belongs to the Crew tab; what
          this answers is the question you ask when the lights go out,
          which is "who else is still on this station". */}
      {others.length > 0 && (
        <Panel title="The crew">
          <div className="stack">
            {others.map((c) => (
              <div key={c.id} className="clue">
                <span className="clue-kind">{c.cls}</span>
                <span>
                  <strong>{c.name}</strong>
                  {c.alive === false ? " — dead" : c.unconscious ? " — unconscious" : ""}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ---- the four sentences ---- */}
      <Panel title="How rolling works">
        <Facts rows={BASICS} />
      </Panel>

      <Panel title="Stress, Panic and dying">
        <Facts rows={STRESS} />
        <p className="clue-meta" style={{ margin: "8px 0 0" }}>
          Your class changes how this goes for everyone else — a Marine who
          Panics puts the room on a Fear Save, a Scientist who fails Sanity
          hands out Stress. Check your own on the Sheet tab.
        </p>
      </Panel>
    </div>
  );
}
