import React, { useState, useMemo } from "react";
import { Panel, Btn, Label, StatBox, Field, Modal } from "../ui/kit.jsx";
import {
  CLASSES, SKILL_TREE, SKILL_COST, SKILL_BONUS, skillTier, canTakeSkill, RULESET,
  rollStats, randomFlavour, makeCharacter, STAT_LABEL, STAT_KEYS, SAVE_KEYS,
} from "../engine/rules.js";

const NAMES = [
  "ABEL", "LILITH", "MARLOWE", "VOSS", "OKONKWO", "SORENSEN", "HALL", "PARK",
  "REYES", "TANAKA", "BRENNAN", "IDRIS", "NOVAK", "SANTOS", "KOVAC", "ELLIS",
];

/* What a class looks like when a system does not have them: no
   bonuses, no saves, no fixed skills, no points to spend. Every
   expression below reads through this rather than guarding, which
   keeps the class-shaped code identical in both cases. */
const EMPTY_CLASS = {
  key: null, name: "", blurb: "", panic: "",
  saves: {}, bonus: {}, fixedSkills: [], pick: null, points: 0,
};

function blankDraft(i) {
  return {
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    /* Taken from the ruleset rather than written out. The four keys
       were literals here, so a fifth class — from a house ruleset or
       a future system — was registered, rendered in the picker, and
       never once handed to anybody by the "roll me a crew" button. */
    cls: RULESET.create.steps.includes("class")
      ? (Object.keys(CLASSES)[i % Math.max(1, Object.keys(CLASSES).length)] || null)
      : null,
    stats: rollStats(),
    picks: [],
    spent: [],
    loadout: null,
    ...randomFlavour(),
  };
}

/* WHICH STEPS THIS SYSTEM HAS.

   Read once, at module scope, because the ruleset is fixed for the
   life of the tab — see engine/ruleset.js. `has("class")` is false
   under a classless system and every class-shaped thing below
   disappears with it, including the readiness rule, which is the
   part that would otherwise leave somebody unable to finish a
   character for a reason the screen never states. */
const STEPS = RULESET.create.steps;
const has = (step) => STEPS.includes(step);

/* Numbered in the order they survive. A system without classes should
   not have a screen that goes 1, 3, 4. */
const stepNo = (step) => STEPS.filter((x) => x !== "name" && x !== "flavour").indexOf(step) + 1;

export default function Creator({ mod, onDone, onBack }) {
  const [drafts, setDrafts] = useState(() =>
    Array.from({ length: Math.min(mod.crewSize.suggested, mod.crewSize.max) }, (_, i) => blankDraft(i)));
  const [idx, setIdx] = useState(0);
  const [browse, setBrowse] = useState(false);

  const draft = drafts[idx];
  /* An empty class rather than a missing one, so every read below is
     the same shape whether or not this system has classes. */
  const cls = CLASSES[draft.cls] || EMPTY_CLASS;
  const update = (patch) => setDrafts((d) => d.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  const fixed = cls.fixedSkills;
  const chosen = [...fixed, ...draft.picks, ...draft.spent];
  const pointsUsed = draft.spent.reduce((a, s) => a + SKILL_COST[skillTier(s)], 0);
  const pointsLeft = cls.points - pointsUsed;
  const pickNeeded = cls.pick ? cls.pick.count - draft.picks.length : 0;

  const finalStats = useMemo(() => {
    const s = { ...draft.stats };
    Object.entries(cls.bonus).forEach(([k, v]) => (s[k] += v));
    return s;
  }, [draft.stats, cls]);

  const loadouts = Object.entries(mod.loadouts);
  /* Only the declared steps can block finishing. Requiring a loadout
     under a system with no loadout step, or all skill points spent
     under one with no skills, is how a creator becomes impossible to
     complete with nothing on screen explaining why. */
  const draftReady = (d) => {
    const c = CLASSES[d.cls] || EMPTY_CLASS;
    if (has("loadout") && !d.loadout) return false;
    if (!has("skills")) return true;
    const used = d.spent.reduce((a, x) => a + SKILL_COST[skillTier(x)], 0);
    if (used !== c.points) return false;
    return !c.pick || d.picks.length === c.pick.count;
  };
  const ready = draftReady(draft);
  const allReady = drafts.every(draftReady);

  const toggleSpent = (skill) => {
    if (draft.spent.includes(skill)) {
      update({ spent: draft.spent.filter((s) => s !== skill) });
      return;
    }
    const cost = SKILL_COST[skillTier(skill)];
    if (cost > pointsLeft) return;
    const probe = { skills: [...fixed, ...draft.picks, ...draft.spent] };
    if (!canTakeSkill(probe, skill).ok) return;
    update({ spent: [...draft.spent, skill] });
  };

  const finish = () => {
    const crew = drafts.map((d) => makeCharacter({
      name: d.name, cls: d.cls, stats: d.stats,
      skills: [...new Set([...((CLASSES[d.cls] || EMPTY_CLASS).fixedSkills || []), ...d.picks, ...d.spent])],
      loadout: d.loadout, trinket: d.trinket, patch: d.patch,
    }, mod));
    onDone(crew);
  };

  const addCrew = () => {
    if (drafts.length >= mod.crewSize.max) return;
    setDrafts((d) => [...d, blankDraft(d.length)]);
    setIdx(drafts.length);
  };
  const removeCrew = () => {
    if (drafts.length <= mod.crewSize.min) return;
    setDrafts((d) => d.filter((_, i) => i !== idx));
    setIdx((i) => Math.max(0, i - 1));
  };

  return (
    <div className="center-screen" style={{ alignItems: "flex-start", padding: "20px 14px" }}>
      <div style={{ width: "100%", maxWidth: 760 }} className="stack">
        <div style={{ fontFamily: "var(--display)", fontSize: 28, fontWeight: 700, letterSpacing: "0.1em", color: "var(--bone)" }}>
          ASSEMBLE A CREW
        </div>

        {/* crew tabs */}
        <div className="btn-row" role="tablist" aria-label="Crew members">
          {drafts.map((d, i) => (
            <Btn key={i} role="tab" aria-selected={i === idx} kind={i === idx ? "accent" : "ghost"}
              className="inline small" onClick={() => setIdx(i)}>
              {has("class") && CLASSES[d.cls] ? `${d.name} · ${CLASSES[d.cls].name}` : d.name}
            </Btn>
          ))}
          {drafts.length < mod.crewSize.max && (
            <Btn kind="ghost" className="inline small" onClick={addCrew}>+ add</Btn>
          )}
          {drafts.length > mod.crewSize.min && (
            <Btn kind="danger" className="inline small" onClick={removeCrew}>− remove</Btn>
          )}
        </div>

        <Panel title={`Crew member ${idx + 1} of ${drafts.length}`}>
          <div className="stack">
            <Field label="Name">
              <input value={draft.name} onChange={(e) => update({ name: e.target.value.toUpperCase() })} maxLength={18} />
            </Field>

            {has("stats") && (
            <div>
              <Label>{stepNo("stats")} · STATS</Label>
              <div className="statgrid">
                {STAT_KEYS.map((k) => (
                  <StatBox key={k} label={STAT_LABEL[k]} value={finalStats[k]}
                    hot={cls.bonus[k] != null}
                    title={cls.bonus[k] ? `${draft.stats[k]} + ${cls.bonus[k]} class bonus` : `${draft.stats[k]}`} />
                ))}
              </div>
              <div className="btn-row" style={{ marginTop: 6 }}>
                <Btn kind="ghost" className="inline small" onClick={() => update({ stats: rollStats() })}>Re-roll stats</Btn>
                <Btn kind="ghost" className="inline small" onClick={() => update(randomFlavour())}>Re-roll trinket</Btn>
              </div>
              <div className="note-box" style={{ marginTop: 6 }}>
                {/* The ruleset's own sentence about its dice, not one
                    written here. "6d10, 30 is about average" is a fact
                    about Mothership and was hardcoded. */}
                Max Health {RULESET.health(finalStats)}.{RULESET.create.statNote ? ` ${RULESET.create.statNote}` : ""}
              </div>
            </div>
            )}

            {has("class") && (
            <div>
              <Label>{stepNo("class")} · PICK A CLASS</Label>
              <div className="btn-grid">
                {Object.values(CLASSES).map((c) => (
                  <Btn key={c.key} kind={draft.cls === c.key ? "accent" : "default"}
                    onClick={() => update({ cls: c.key, picks: [], spent: [] })}
                    /* Built from the ruleset's save list rather than
                       naming Mothership's four. */
                    hint={SAVE_KEYS.map((k) => `${STAT_LABEL[k]} ${c.saves[k] ?? "—"}`).join(" · ")}>
                    {c.name}
                  </Btn>
                ))}
              </div>
              <div className="note-box" style={{ marginTop: 6 }}>
                <strong>{cls.name}.</strong> {cls.blurb}
                {cls.panic && <><br /><em>{cls.panic}</em></>}
              </div>
            </div>
            )}

            {has("skills") && cls.pick && (
              <div>
                <Label>{stepNo("class")}b · CLASS SKILL — CHOOSE {cls.pick.count}</Label>
                <div className="btn-grid">
                  {cls.pick.from.map((s) => (
                    <Btn key={s} kind={draft.picks.includes(s) ? "accent" : "default"}
                      disabled={!draft.picks.includes(s) && draft.picks.length >= cls.pick.count}
                      onClick={() => update({
                        picks: draft.picks.includes(s)
                          ? draft.picks.filter((x) => x !== s)
                          : [...draft.picks, s],
                      })}>{s}</Btn>
                  ))}
                </div>
              </div>
            )}

            {has("skills") && (
            <div>
              <Label>{stepNo("skills")} · SKILL POINTS — {pointsLeft} LEFT OF {cls.points}</Label>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11, marginBottom: 6 }}>
                Already trained: {[...fixed, ...draft.picks].join(", ") || "nothing"}
              </div>
              <div className="btn-row">
                {draft.spent.map((s) => (
                  <Btn key={s} kind="accent" className="inline small" onClick={() => toggleSpent(s)}>
                    {s} ✕
                  </Btn>
                ))}
                <Btn kind="ghost" className="inline small" onClick={() => setBrowse(true)}>
                  {pointsLeft > 0 ? `Spend ${pointsLeft}` : "Change skills"}
                </Btn>
              </div>
            </div>
            )}

            {has("loadout") && (
            <div>
              <Label>{stepNo("loadout")} · STARTING LOADOUT</Label>
              <div className="btn-grid">
                {loadouts.map(([k, l]) => (
                  <Btn key={k} kind={draft.loadout === k ? "accent" : "default"}
                    onClick={() => update({ loadout: k })} hint={l.note}>{l.name}</Btn>
                ))}
              </div>
              {draft.loadout && (
                <div className="note-box" style={{ marginTop: 6 }}>
                  {mod.loadouts[draft.loadout].items.map((i) => mod.items[i] && mod.items[i].n).filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
            )}

            {has("flavour") && (draft.trinket || draft.patch) && (
              <div className="note-box">
                Trinket: {draft.trinket} · Patch: {draft.patch}
              </div>
            )}

            {!ready && (
              <div className="warn-box">
                {has("skills") && pickNeeded > 0 && <>Choose {pickNeeded} more class skill{pickNeeded === 1 ? "" : "s"}. </>}
                {has("skills") && pointsLeft > 0 && <>Spend {pointsLeft} more skill point{pointsLeft === 1 ? "" : "s"}. </>}
                {has("loadout") && !draft.loadout && <>Pick a loadout.</>}
              </div>
            )}
          </div>
        </Panel>

        <div className="btn-grid">
          <Btn kind="accent" disabled={!allReady} onClick={finish}>
            {allReady ? `Begin with ${drafts.length} crew` : "Every crew member needs finishing"}
          </Btn>
          <Btn kind="ghost" onClick={onBack}>Back</Btn>
        </div>
      </div>

      {browse && (
        <Modal title="Choose skills" onClose={() => setBrowse(false)}>
          <Panel title={`Skills — ${pointsLeft} points left`} dark>
            <div className="stack">
              {/* The ruleset's tiers, in its own order. Three named
                  ones were written in here. */}
              {Object.keys(SKILL_TREE).map((tier) => (
                <div key={tier}>
                  <Label>{tier.toUpperCase()} · {SKILL_COST[tier]} POINT{SKILL_COST[tier] > 1 ? "S" : ""} · +{SKILL_BONUS[tier]}%</Label>
                  <div className="btn-grid">
                    {Object.keys(SKILL_TREE[tier]).map((s) => {
                      const have = chosen.includes(s);
                      const own = draft.spent.includes(s);
                      const probe = { skills: [...fixed, ...draft.picks, ...draft.spent.filter((x) => x !== s)] };
                      const check = canTakeSkill(probe, s);
                      const affordable = own || SKILL_COST[tier] <= pointsLeft;
                      const prereqs = SKILL_TREE[tier][s];
                      return (
                        <Btn key={s} kind={own ? "accent" : have ? "solid" : "ghost"}
                          disabled={(have && !own) || (!own && (!check.ok || !affordable))}
                          onClick={() => toggleSpent(s)}
                          hint={prereqs.length ? `needs ${prereqs.join(" / ")}` : undefined}>
                          {s}
                        </Btn>
                      );
                    })}
                  </div>
                </div>
              ))}
              <Btn kind="accent" onClick={() => setBrowse(false)}>Done</Btn>
            </div>
          </Panel>
        </Modal>
      )}
    </div>
  );
}
