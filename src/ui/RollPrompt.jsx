/* ============================================================
   ROLL PROMPT — the sheet, at the moment you need the sheet.

   See engine/rollpreview.js for why this exists. In short: the
   old prompt asked a player to roll without showing them what
   they were rolling against, which is a thing no physical table
   has ever done.

   WHAT IS ON IT, AND WHY EACH THING EARNED ITS SPACE.

   THE NUMBER, large. This is the whole point. Roll-under d% means
   the target *is* the character sheet — 35 Fear is a different
   person from 65 Fear — and it is the only number a player needs
   to decide anything.

   THE DIRECTION, said out loud, every time. "Roll under." Not a
   footnote, not in the tab you have to open. Every system a new
   player has come from is roll-high, and the single most common
   thing said at a first Mothership table is "wait, do I want high
   or low". It costs four characters to answer it permanently.

   THE BREAKDOWN. `collectModifiers` already assembles this and
   already hands it to the feed *after the fact*. The same list,
   before the roll, is a different feature entirely: +15 Hacking,
   +10 Lockpick Set, [-] Vaccsuit is the player learning that
   taking the suit off is a decision they are allowed to make.
   Modifiers arriving from *other people* — a Marine standing
   near you, an Android standing near you — matter even more,
   because those are invisible on your own sheet and always will
   be.

   THE ODDS. Two numbers. Success, because Advantage changes it
   by more than anyone's intuition says. And critical failure,
   flagged loudly on Saves, because a Critical Failure on a Save
   is a Panic Check and Panic is what kills Mothership characters.
   A player who can see "18% critical failure — that's a Panic
   Check" is being told the truth about the roll they are about
   to make. That is not hand-holding. It is the sheet.

   THE ASSIST, moved up next to the number it changes. It used to
   be a select above the button with no stated effect; now
   choosing a helper visibly moves the odds, which is what makes
   it a decision rather than a dropdown.

   ------------------------------------------------------------
   WHAT IS DELIBERATELY ABSENT

   No advice. The panel never says "you should probably take the
   assist" or colours the number red at 30%. Telling a player the
   odds is giving them the sheet; telling them what to do with the
   odds is playing their character for them, and this game is
   about people making bad decisions under pressure on purpose.
   ============================================================ */
import React, { useMemo } from "react";
import { Panel, Btn, Field, Label } from "./kit.jsx";
import HoldToRoll from "./HoldToRoll.jsx";
import Hint from "./Hint.jsx";
import { previewRoll, previewSentence, pct } from "../engine/rollpreview.js";
import { STAT_LABEL } from "../engine/rules.js";

/** One modifier, drawn as what it does rather than as a number. */
function Mod({ m }) {
  const kind = m.adv ? "adv" : m.dis ? "dis" : m.bonus > 0 ? "up" : m.bonus < 0 ? "down" : "flat";
  const value = m.adv ? "ADV" : m.dis ? "DIS" : `${m.bonus > 0 ? "+" : ""}${m.bonus}`;
  return (
    <li className={`rp-mod is-${kind}`}>
      <span className="rp-mod-v">{value}</span>
      <span className="rp-mod-s">{m.source}</span>
      {m.kind && <span className="rp-mod-k">{m.kind}</span>}
    </li>
  );
}

export default function RollPrompt({ g, pending, assistId, onAssist, onRoll }) {
  const { pc, crew, items, mod, w, houseRules, possibleAssists } = g;
  const req = pending.req || {};

  const preview = useMemo(
    () => previewRoll(req, { pc, crew, items, mod, world: w, houseRules }, assistId),
    [req, pc, crew, items, mod, w, houseRules, assistId],
  );

  const assists = possibleAssists ? possibleAssists(pc) : [];

  /* What the same roll would look like with the helper, so the
     dropdown is a comparison instead of a leap of faith. Only
     computed when there is somebody to compare against. */
  const withAssist = useMemo(() => {
    if (assistId || !assists.length) return null;
    return previewRoll(req, { pc, crew, items, mod, world: w, houseRules }, assists[0].id);
  }, [assistId, assists, req, pc, crew, items, mod, w, houseRules]);

  if (!preview) return null;

  const statName = STAT_LABEL[req.name] || req.name;
  const isSave = req.kind === "save";

  return (
    <Panel title={isSave ? `${statName} Save` : `${statName} Check`} dark>
      <div className="stack rp">
        {/* Why. The Warden's own words where they gave any. */}
        {req.reason && <p className="rp-reason">{req.reason}</p>}

        {/* THE NUMBER. */}
        <div className={`rp-target is-${preview.mode}`}>
          <span className="rp-target-lead">roll under</span>
          <strong className="rp-target-n">{preview.target}</strong>
          {preview.mode !== "none" && (
            <span className={`rp-target-mode is-${preview.mode}`}>
              {preview.mode === "advantage" ? "ADVANTAGE" : "DISADVANTAGE"}
            </span>
          )}
          <span className="sr-only">{previewSentence(preview)}</span>
        </div>

        {/* Where the number came from. The base is named because a
            player wants to know whether the 55 is who they are or
            what they are carrying. */}
        <ul className="rp-mods">
          <li className="rp-mod is-base">
            <span className="rp-mod-v">{preview.base}</span>
            <span className="rp-mod-s">{isSave ? `${statName} Save` : statName}</span>
            <span className="rp-mod-k">your sheet</span>
          </li>
          {preview.breakdown.map((m, i) => <Mod key={`${m.source}:${i}`} m={m} />)}
        </ul>

        {/* THE ODDS, and the one that bites. */}
        <div className="rp-odds">
          <div className="rp-odd is-good">
            <span className="rp-odd-n">{pct(preview.success)}%</span>
            <span className="rp-odd-k">succeeds</span>
          </div>
          <div className={`rp-odd is-bad${preview.critFailPanics ? " is-panic" : ""}`}>
            <span className="rp-odd-n">{pct(preview.critFail)}%</span>
            <span className="rp-odd-k">
              critical failure
              <Hint
                label="What a critical failure does"
                text={preview.critFailPanics
                  ? "Doubles above your target. On a Save that is a Panic Check — 2d10 against your current Stress — which is the roll that actually ends characters."
                  : "Doubles above your target. The Warden decides what going badly wrong looks like here."}
              />
            </span>
          </div>
        </div>

        {/* THE HELP. */}
        {assists.length > 0 && (
          <Field label="Assisted by — Advantage, once per day each">
            <select value={assistId || ""} onChange={(e) => onAssist(e.target.value || null)}>
              <option value="">nobody</option>
              {assists.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        {withAssist && withAssist.success > preview.success && (
          <p className="rp-compare">
            With help: {pct(withAssist.success)}% succeeds
            {withAssist.critFail < preview.critFail
              ? `, ${pct(withAssist.critFail)}% critical failure`
              : ""}.
            {" "}It costs {assists[0].name} their assist for the day.
          </p>
        )}

                {tableDice && !appRolls ? (
          <DeclareDice
            preview={preview}
            label={`Confirm ${statName}`}
            isSave={isSave}
            advTieBreak={houseRules.advTieBreak}
            onDeclare={(pairs) => onRoll(pairs)}
            onFallBack={() => setAppRolls(true)}
          />
        ) : (
          <HoldToRoll
            label={`Roll ${statName}`}
            hint={isSave ? "press and hold — or shake" : "press and hold"}
            onRoll={() => onRoll()}
          />
        )}
        {/* The preview is the phone's arithmetic, not the table's.
            Saying so once is cheaper than a player deciding the app
            is broken the first time the host knows something they
            don't. */}
        <p className="rp-caveat">
          Worked out on this phone from what it can see. If the Warden is
          holding something back, the real number may be kinder or crueller.
        </p>
      </div>
    </Panel>
  );
}

/* ============================================================
   OPT-IN STRESS — the other prompt, given the same treatment.

   "Take 2 Stress?" is a real decision and it was being asked
   without the one figure that decides it: what taking it does to
   your Panic odds. Stress 7 to Stress 9 is 21% to 36%. That is
   the difference between yes and no, and nobody was being shown
   it.
   ============================================================ */
export function StressPrompt({ pc, pending, onAnswer }) {
  const before = pc.stress;
  const after = Math.min(20, before + (pending.amount || 0));
  return (
    <Panel title="Take the Stress?" dark>
      <div className="stack rp">
        <p style={{ margin: 0 }}>{pending.why || "That was a lot."}</p>
        <div className="rp-stress">
          <span><strong>{before}</strong> Stress now</span>
          <span aria-hidden="true">→</span>
          <span><strong>{after}</strong> if you take it</span>
        </div>
        <p className="rp-compare">
          A Panic Check is 2d10 against your Stress — rolling over holds and
          sheds a point. That would move you from {pctPanic(before)}% to{" "}
          {pctPanic(after)}%.
        </p>
        <div className="btn-row">
          <Btn kind="accent" className="inline" onClick={() => onAnswer(true)}>Take it</Btn>
          <Btn kind="ghost" className="inline" onClick={() => onAnswer(false)}>Not yet</Btn>
        </div>
        <Label>WHY YOU MIGHT</Label>
        <p className="rp-caveat" style={{ marginTop: 0 }}>
          Stress is not only a countdown to Panic. It is the resource the
          Warden is offering to buy something from you with.
        </p>
      </div>
    </Panel>
  );
}

/* Local so this file does not have to import the whole odds module
   for one number; it is the same arithmetic, and odds.js owns the
   canonical version used everywhere else. */
function pctPanic(stress) {
  const s = Math.max(0, Math.floor(stress || 0));
  if (s < 2) return 0;
  if (s >= 20) return 100;
  let out = 0;
  for (let t = 2; t <= s; t += 1) out += 10 - Math.abs(t - 11);
  return Math.round(out);
}
