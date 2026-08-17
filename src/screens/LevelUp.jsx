import React, { useState } from "react";
import { Panel, Btn, Label, Modal, Field } from "../ui/kit.jsx";
import {
  ADVANCEMENTS, STAT_KEYS, SAVE_KEYS, STAT_LABEL, SKILL_TREE, SKILL_COST,
  canTakeSkill, xpForLevel,
} from "../engine/rules.js";

export default function LevelUp({ g, onClose }) {
  const { crew, applyLevel, levelUp } = g;
  const pcId = levelUp.queue[0];
  const pc = crew.find((c) => c.id === pcId);
  const [choice, setChoice] = useState(null);
  const [key, setKey] = useState(null);

  if (!pc) { onClose(); return null; }

  const options = ADVANCEMENTS.filter((a) => !(a.id === "resolve" && pc.resolve >= 5));
  const keyList =
    choice === "stat" ? STAT_KEYS.filter((k) => pc.stats[k] < 85).map((k) => [k, `${STAT_LABEL[k]} ${pc.stats[k]} → ${pc.stats[k] + 5}`])
    : choice === "save" ? SAVE_KEYS.filter((k) => pc.saves[k] < 85).map((k) => [k, `${STAT_LABEL[k]} ${pc.saves[k]} → ${pc.saves[k] + 5}`])
    : choice === "skill" ? ["trained", "expert", "master"].flatMap((t) =>
        Object.keys(SKILL_TREE[t]).filter((s) => canTakeSkill(pc, s).ok).map((s) => [s, `${s} (${t}, +${{ trained: 10, expert: 15, master: 20 }[t]}%)`]))
    : [];

  const ready = choice === "resolve" || (choice && key);

  return (
    <Modal title={`${pc.name} advances`} onClose={onClose} dismissable={false}>
      <Panel title={`${pc.name} — level ${pc.level} → ${pc.level + 1}`} icons={`${pc.xp} XP`} dark>
        <div className="stack">
          <div className="note-box">
            Surviving is the qualification. Spend {xpForLevel(pc.level)} XP on one improvement.
            {levelUp.queue.length > 1 && ` ${levelUp.queue.length - 1} more crew waiting.`}
          </div>

          <Label>CHOOSE ONE</Label>
          <div className="btn-grid">
            {options.map((a) => (
              <Btn key={a.id} kind={choice === a.id ? "accent" : "ghost"}
                onClick={() => { setChoice(a.id); setKey(null); }} hint={a.blurb}>
                {a.name}
              </Btn>
            ))}
          </div>

          {keyList.length > 0 && (
            <Field label={choice === "skill" ? "Which skill?" : "Which one?"}>
              <select value={key || ""} onChange={(e) => setKey(e.target.value || null)}>
                <option value="">choose…</option>
                {keyList.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </Field>
          )}

          {choice === "resolve" && (
            <div className="note-box">
              Resolve {pc.resolve} → {pc.resolve + 1}. Every point subtracts 1 from all Panic
              Effect rolls. At a total of 1 or less, there is no effect at all.
            </div>
          )}

          <Btn kind="accent" disabled={!ready}
            onClick={() => { applyLevel(pc.id, { id: choice, key }); setChoice(null); setKey(null); }}>
            Confirm
          </Btn>
          <Btn kind="ghost" onClick={onClose}>Later</Btn>
        </div>
      </Panel>
    </Modal>
  );
}
