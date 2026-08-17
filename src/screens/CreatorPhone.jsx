/* ============================================================
   CREATOR (PHONE) — session zero in parallel.

   The desk version builds the whole crew at once, which means one
   person making six characters while five people watch. Six phones
   can do it at the same time. Same PSG steps, one character, and
   the result is offered to the Warden rather than inserted.
   ============================================================ */
import React, { useState, useMemo } from "react";
import { Panel, Btn, Label, StatBox, Field } from "../ui/kit.jsx";
import {
  CLASSES, SKILL_TREE, SKILL_COST, skillTier, canTakeSkill,
  rollStats, randomFlavour, makeCharacter, STAT_LABEL, STAT_KEYS, SAVE_KEYS,
} from "../engine/rules.js";
import { exportCharacter, newHistory } from "../engine/portable.js";
import { stash } from "../engine/locker.js";

const ALL_SKILLS = Object.keys(SKILL_TREE);

export default function CreatorPhone({ mod, onOffer, onBack, playerName }) {
  const [draft, setDraft] = useState(() => ({
    name: (playerName || "").toUpperCase().slice(0, 18) || "UNNAMED",
    cls: "teamster",
    stats: rollStats(),
    picks: [],
    spent: [],
    loadout: null,
    ...randomFlavour(),
  }));

  const cls = CLASSES[draft.cls];
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const finalStats = useMemo(() => {
    const s = { ...draft.stats };
    Object.entries(cls.bonus).forEach(([k, v]) => (s[k] += v));
    return s;
  }, [draft.stats, cls]);

  const chosen = [...cls.fixedSkills, ...draft.picks, ...draft.spent];
  const used = draft.spent.reduce((a, s) => a + SKILL_COST[skillTier(s)], 0);
  const left = cls.points - used;
  const needPick = cls.pick ? cls.pick.count - draft.picks.length : 0;
  const ready = draft.loadout && needPick === 0 && left === 0 && draft.name.trim();

  const toggleSpent = (skill) => {
    if (draft.spent.includes(skill)) return set({ spent: draft.spent.filter((s) => s !== skill) });
    if (SKILL_COST[skillTier(skill)] > left) return;
    if (chosen.includes(skill)) return;
    if (!canTakeSkill({ skills: chosen }, skill).ok) return;
    set({ spent: [...draft.spent, skill] });
  };

  const finish = (alsoKeep) => {
    const pc = makeCharacter({
      name: draft.name.trim().toUpperCase(), cls: draft.cls, stats: draft.stats,
      skills: [...new Set(chosen)], loadout: draft.loadout,
      trinket: draft.trinket, patch: draft.patch,
    }, mod);
    const file = exportCharacter({ ...pc, history: newHistory() }, { moduleId: mod.id });
    if (alsoKeep) stash(file);
    onOffer(file);
  };

  return (
    <div className="join">
      <Panel title="Build your character">
        <div className="stack">
          <Field label="Name">
            <input value={draft.name} maxLength={18}
              onChange={(e) => set({ name: e.target.value.toUpperCase() })} />
          </Field>

          <div>
            <Label>1 · roll 6d10 for each stat</Label>
            <div className="statgrid">
              {STAT_KEYS.map((k) => <StatBox key={k} label={STAT_LABEL[k]} value={finalStats[k]} />)}
            </div>
            <Btn kind="ghost" className="inline small"
              onClick={() => set({ stats: rollStats() })}>Roll again</Btn>
          </div>

          <div>
            <Label>2 · pick a class</Label>
            <div className="btn-row">
              {Object.values(CLASSES).map((c) => (
                <Btn key={c.key} kind={draft.cls === c.key ? "accent" : "ghost"} className="inline small"
                  onClick={() => set({ cls: c.key, picks: [], spent: [] })}>{c.name}</Btn>
              ))}
            </div>
            <p className="clue-meta">{cls.blurb}</p>
            <div className="statgrid">
              {SAVE_KEYS.map((k) => <StatBox key={k} label={k} value={cls.saves[k]} />)}
            </div>
            <p className="clue-meta">{cls.panic}</p>
          </div>

          <div>
            <Label>3 · skills{left > 0 ? ` · ${left} point${left === 1 ? "" : "s"} left` : " · all spent"}</Label>
            {cls.fixedSkills.length > 0 && (
              <p className="clue-meta">Comes with: {cls.fixedSkills.join(", ")}</p>
            )}
            {cls.pick && (
              <>
                <p className="clue-meta">Pick {cls.pick.count}: </p>
                <div className="btn-row">
                  {cls.pick.from.map((s) => (
                    <Btn key={s} kind={draft.picks.includes(s) ? "accent" : "ghost"} className="inline small"
                      onClick={() => set({
                        picks: draft.picks.includes(s)
                          ? draft.picks.filter((x) => x !== s)
                          : draft.picks.length < cls.pick.count ? [...draft.picks, s] : draft.picks,
                      })}>{s}</Btn>
                  ))}
                </div>
              </>
            )}
            <div className="btn-row" style={{ marginTop: 8 }}>
              {ALL_SKILLS.filter((s) => !cls.fixedSkills.includes(s) && !(cls.pick && cls.pick.from.includes(s)))
                .map((s) => {
                  const tier = skillTier(s);
                  const held = draft.spent.includes(s);
                  const allowed = held || (SKILL_COST[tier] <= left && canTakeSkill({ skills: chosen }, s).ok);
                  return (
                    <Btn key={s} kind={held ? "accent" : "ghost"} className="inline small"
                      disabled={!allowed} title={`${tier} · ${SKILL_COST[tier]}pt`}
                      onClick={() => toggleSpent(s)}>{s}</Btn>
                  );
                })}
            </div>
          </div>

          <div>
            <Label>4 · starting loadout</Label>
            <div className="btn-row">
              {Object.entries(mod.loadouts).map(([k, v]) => (
                <Btn key={k} kind={draft.loadout === k ? "accent" : "ghost"} className="inline small"
                  onClick={() => set({ loadout: k })}>{v.name || k}</Btn>
              ))}
            </div>
          </div>

          <p className="clue-meta">{draft.trinket} · {draft.patch}</p>

          <div className="btn-row">
            <Btn kind="primary" disabled={!ready} onClick={() => finish(true)}>
              Offer to the Warden
            </Btn>
            {onBack && <Btn kind="ghost" onClick={onBack}>Back</Btn>}
          </div>
          {!ready && (
            <p className="clue-meta">
              {needPick > 0 && `Pick ${needPick} more. `}
              {left > 0 && `Spend ${left} more skill point${left === 1 ? "" : "s"}. `}
              {!draft.loadout && "Choose a loadout."}
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}
