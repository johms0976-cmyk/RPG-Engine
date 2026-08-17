import React, { useState, useMemo } from "react";
import { Panel, Btn, Label, StatBox, Field, Modal } from "../ui/kit.jsx";
import {
  CLASSES, SKILL_TREE, SKILL_COST, SKILL_BONUS, skillTier, canTakeSkill,
  rollStats, randomFlavour, makeCharacter, STAT_LABEL, STAT_KEYS, SAVE_KEYS,
} from "../engine/rules.js";

const NAMES = [
  "ABEL", "LILITH", "MARLOWE", "VOSS", "OKONKWO", "SORENSEN", "HALL", "PARK",
  "REYES", "TANAKA", "BRENNAN", "IDRIS", "NOVAK", "SANTOS", "KOVAC", "ELLIS",
];

function blankDraft(i) {
  return {
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    cls: ["teamster", "scientist", "android", "marine"][i % 4],
    stats: rollStats(),
    picks: [],
    spent: [],
    loadout: null,
    ...randomFlavour(),
  };
}

export default function Creator({ mod, onDone, onBack }) {
  const [drafts, setDrafts] = useState(() =>
    Array.from({ length: Math.min(mod.crewSize.suggested, mod.crewSize.max) }, (_, i) => blankDraft(i)));
  const [idx, setIdx] = useState(0);
  const [browse, setBrowse] = useState(false);

  const draft = drafts[idx];
  const cls = CLASSES[draft.cls];
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
  const ready = draft.loadout && pickNeeded === 0 && pointsLeft === 0;
  const allReady = drafts.every((d) => {
    const c = CLASSES[d.cls];
    const used = d.spent.reduce((a, s) => a + SKILL_COST[skillTier(s)], 0);
    return d.loadout && used === c.points && (!c.pick || d.picks.length === c.pick.count);
  });

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
      skills: [...new Set([...CLASSES[d.cls].fixedSkills, ...d.picks, ...d.spent])],
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
              {d.name} · {CLASSES[d.cls].name}
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

            <div>
              <Label>1 · ROLL 6D10 FOR EACH STAT</Label>
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
                Max Health {finalStats.strength * 2}. A Stat of 30 is about average.
              </div>
            </div>

            <div>
              <Label>2 · PICK A CLASS</Label>
              <div className="btn-grid">
                {Object.values(CLASSES).map((c) => (
                  <Btn key={c.key} kind={draft.cls === c.key ? "accent" : "default"}
                    onClick={() => update({ cls: c.key, picks: [], spent: [] })}
                    hint={`Sanity ${c.saves.sanity} · Fear ${c.saves.fear} · Body ${c.saves.body} · Armor ${c.saves.armor}`}>
                    {c.name}
                  </Btn>
                ))}
              </div>
              <div className="note-box" style={{ marginTop: 6 }}>
                <strong>{cls.name}.</strong> {cls.blurb}<br />
                <em>{cls.panic}</em>
              </div>
            </div>

            {cls.pick && (
              <div>
                <Label>3 · CLASS SKILL — CHOOSE {cls.pick.count}</Label>
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

            <div>
              <Label>{cls.pick ? "4" : "3"} · SKILL POINTS — {pointsLeft} LEFT OF {cls.points}</Label>
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

            <div>
              <Label>{cls.pick ? "5" : "4"} · STARTING LOADOUT</Label>
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

            <div className="note-box">
              Trinket: {draft.trinket} · Patch: {draft.patch}
            </div>

            {!ready && (
              <div className="warn-box">
                {pickNeeded > 0 && <>Choose {pickNeeded} more class skill{pickNeeded === 1 ? "" : "s"}. </>}
                {pointsLeft > 0 && <>Spend {pointsLeft} more skill point{pointsLeft === 1 ? "" : "s"}. </>}
                {!draft.loadout && <>Pick a loadout.</>}
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
              {["trained", "expert", "master"].map((tier) => (
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
