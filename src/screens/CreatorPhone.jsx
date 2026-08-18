/* ============================================================
   CREATOR (PHONE) — session zero, one step to a screen.

   The desk version builds the whole crew at once, which means one
   person making six characters while five people watch. Six phones
   can do it at the same time. Same PSG steps, one character, and
   the result is offered to the Warden rather than inserted.

   Where this differs from the desk version is shape rather than
   rules. A 375px screen cannot hold name, stats, class, skills and
   loadout at once and still let you read any of them, and the old
   single-scroll layout put the "4 points left" counter about two
   thumb-flicks away from the skills it was talking about. So it is
   a wizard: one decision per screen, a crumb rail to say where you
   are, and a fixed bar at the bottom that will not let you past a
   step you haven't finished — and says why.

   Nothing here computes anything the Warden will trust. The result
   is a character *file* that gets offered upward; approval is
   theirs, same as before.
   ============================================================ */
import React, { useState, useMemo } from "react";
import { Panel, Btn, Label, StatBox, Field } from "../ui/kit.jsx";
import {
  CLASSES, SKILL_TREE, SKILL_COST, SKILL_BONUS, skillTier, canTakeSkill,
  rollStats, randomFlavour, makeCharacter, STAT_LABEL, STAT_KEYS, SAVE_KEYS,
} from "../engine/rules.js";
import { exportCharacter, newHistory } from "../engine/portable.js";
import { stash } from "../engine/locker.js";
import "../ui/wizard.css";

const TIERS = ["trained", "expert", "master"];

const STEPS = [
  { id: "name", label: "Name" },
  { id: "stats", label: "Stats" },
  { id: "class", label: "Class" },
  { id: "skills", label: "Skills" },
  { id: "loadout", label: "Kit" },
  { id: "review", label: "Review" },
];

export default function CreatorPhone({ mod, onOffer, onBack, playerName }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => ({
    name: (playerName || "").toUpperCase().slice(0, 18) || "",
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

  const fixed = cls.fixedSkills;
  // Skills the class gives away, either outright or as its pick-one-of.
  const free = [...fixed, ...(cls.pick ? cls.pick.from : [])];
  const chosen = [...fixed, ...draft.picks, ...draft.spent];
  const used = draft.spent.reduce((a, s) => a + (SKILL_COST[skillTier(s)] || 0), 0);
  const left = cls.points - used;
  const needPick = cls.pick ? cls.pick.count - draft.picks.length : 0;

  /* Toggling a skill off has to be allowed even when the prerequisite
     chain would now forbid taking it, or you can paint yourself into a
     corner you can only leave by starting again. */
  const toggleSpent = (skill) => {
    if (draft.spent.includes(skill)) {
      // Dropping a skill something else was built on drops that too.
      const kept = draft.spent.filter((s) => s !== skill);
      const survivors = [];
      for (const s of kept) {
        if (canTakeSkill({ skills: [...fixed, ...draft.picks, ...survivors] }, s).ok) survivors.push(s);
      }
      set({ spent: survivors });
      return;
    }
    const cost = SKILL_COST[skillTier(skill)];
    if (!cost || cost > left) return;
    if (chosen.includes(skill)) return;
    if (!canTakeSkill({ skills: chosen }, skill).ok) return;
    set({ spent: [...draft.spent, skill] });
  };

  const togglePick = (s) => set({
    picks: draft.picks.includes(s)
      ? draft.picks.filter((x) => x !== s)
      : draft.picks.length < cls.pick.count ? [...draft.picks, s] : draft.picks,
  });

  /* Why you can't move on yet, in words, or null if you can. Driving
     the button label off the same value means the two can never
     disagree about whether the step is finished. */
  const blocker = (() => {
    switch (STEPS[step].id) {
      case "name":
        return draft.name.trim() ? null : "Your character needs a name.";
      case "stats":
        return null;
      case "class":
        return null;
      case "skills":
        if (needPick > 0) return `Choose ${needPick} more class skill${needPick === 1 ? "" : "s"}.`;
        if (left > 0) return `You still have ${left} skill point${left === 1 ? "" : "s"} to spend.`;
        return null;
      case "loadout":
        return draft.loadout ? null : "Pick a loadout.";
      default:
        return null;
    }
  })();

  const furthest = (() => {
    if (!draft.name.trim()) return 0;
    if (needPick > 0 || left > 0) return 3;
    if (!draft.loadout) return 4;
    return STEPS.length - 1;
  })();

  const finish = () => {
    const pc = makeCharacter({
      name: draft.name.trim().toUpperCase(), cls: draft.cls, stats: draft.stats,
      skills: [...new Set(chosen)], loadout: draft.loadout,
      trinket: draft.trinket, patch: draft.patch,
    }, mod);
    const file = exportCharacter({ ...pc, history: newHistory() }, { moduleId: mod.id });
    stash(file);           // a copy stays on this phone whatever the Warden says
    onOffer(file);
  };

  /* ---------------- steps ---------------- */

  const body = {
    name: (
      <Panel title="Who are you?">
        <div className="wiz-step">
          <p className="wiz-lede">
            One name, the way it would be stencilled on a locker. You can change it
            up until you hand the character over.
          </p>
          <Field label="Name">
            <input value={draft.name} maxLength={18} autoFocus
              autoCapitalize="characters" autoCorrect="off" spellCheck={false}
              placeholder="RILEY"
              onChange={(e) => set({ name: e.target.value.toUpperCase() })} />
          </Field>
        </div>
      </Panel>
    ),

    stats: (
      <Panel title="Roll your stats">
        <div className="wiz-step">
          <p className="wiz-lede">
            Six ten-sided dice for each of the four stats. Re-roll as often as you
            like now — once you hand this over, it stands.
          </p>
          <div>
            <Label>Stats</Label>
            <div className="statgrid">
              {STAT_KEYS.map((k) => <StatBox key={k} label={STAT_LABEL[k]} value={draft.stats[k]} />)}
            </div>
            <p className="wiz-hint">Your class adds to these. You'll see the totals at the end.</p>
          </div>
          <Btn kind="ghost" onClick={() => set({ stats: rollStats() })}>Roll again</Btn>

          <div>
            <Label>Trinket and patch</Label>
            <div className="note-box">{draft.trinket}<br />{draft.patch}</div>
          </div>
          <Btn kind="ghost" onClick={() => set(randomFlavour())}>Draw again</Btn>
        </div>
      </Panel>
    ),

    class: (
      <Panel title="Pick a class">
        <div className="wiz-step">
          <div className="btn-grid">
            {Object.values(CLASSES).map((c) => (
              <Btn key={c.key} kind={draft.cls === c.key ? "accent" : "default"}
                hint={`${c.points} skill points`}
                onClick={() => {
                  if (c.key === draft.cls) return;
                  // Skills belong to the class that paid for them.
                  set({ cls: c.key, picks: [], spent: [] });
                }}>{c.name}</Btn>
            ))}
          </div>

          <p className="wiz-lede">{cls.blurb}</p>

          <div>
            <Label>Stats with {cls.name} bonus</Label>
            <div className="statgrid">
              {STAT_KEYS.map((k) => (
                <StatBox key={k} label={STAT_LABEL[k]} value={finalStats[k]}
                  hot={finalStats[k] !== draft.stats[k]} />
              ))}
            </div>
          </div>

          <div>
            <Label>Saves</Label>
            <div className="statgrid">
              {SAVE_KEYS.map((k) => <StatBox key={k} label={k} value={cls.saves[k]} />)}
            </div>
          </div>

          <div className="note-box">{cls.panic}</div>
          {fixed.length > 0 && <p className="wiz-hint">Comes with: {fixed.join(", ")}</p>}
        </div>
      </Panel>
    ),

    skills: (
      <Panel title="Spend your skills">
        <div className="wiz-step">
          {/* role=status so the count is announced when it changes —
              a blind player spending points otherwise gets no feedback
              at all that the tap did anything. */}
          <div className={`wiz-points ${left === 0 && needPick === 0 ? "is-done" : ""}`}
            role="status" aria-live="polite">
            <span>Points left</span>
            <span className="n" data-points={left}>{left}</span>
          </div>

          {fixed.length > 0 && (
            <div>
              <Label>Free with {cls.name}</Label>
              <p className="wiz-hint">{fixed.join(" · ")}</p>
            </div>
          )}

          {cls.pick && (
            <div>
              <Label>
                Class choice · pick {cls.pick.count}
                {needPick > 0 ? ` · ${needPick} to go` : " · done"}
              </Label>
              <div className="btn-grid">
                {cls.pick.from.map((s) => (
                  <Btn key={s} kind={draft.picks.includes(s) ? "accent" : "default"}
                    onClick={() => togglePick(s)}>{s}</Btn>
                ))}
              </div>
              <p className="wiz-hint">These are free. They don't touch your points.</p>
            </div>
          )}

          {TIERS.map((tier) => (
            <div key={tier} className="wiz-tier">
              <Label>
                {tier} · {SKILL_COST[tier]} point{SKILL_COST[tier] > 1 ? "s" : ""} · +{SKILL_BONUS[tier]}%
              </Label>
              <div className="btn-grid">
                {/* Anything the class hands over free is kept out of the
                    paid list entirely. Showing it twice invites you to
                    pay a point for something you were about to be given. */}
                {Object.keys(SKILL_TREE[tier]).filter((s) => !free.includes(s)).map((s) => {
                  const own = draft.spent.includes(s);
                  const have = chosen.includes(s);
                  // Test the prerequisite against a version of yourself
                  // without this skill, so an owned skill stays togglable.
                  const probe = { skills: [...fixed, ...draft.picks, ...draft.spent.filter((x) => x !== s)] };
                  const ok = canTakeSkill(probe, s).ok;
                  const affordable = own || SKILL_COST[tier] <= left;
                  const prereqs = SKILL_TREE[tier][s];
                  return (
                    <Btn key={s}
                      kind={own ? "accent" : have ? "solid" : "default"}
                      disabled={(have && !own) || (!own && (!ok || !affordable))}
                      onClick={() => toggleSpent(s)}
                      hint={
                        have && !own ? "already yours"
                          : !ok && !own ? `needs ${prereqs.join(" / ")}`
                            : !affordable && !own ? "too expensive"
                              : own ? "tap to drop" : undefined
                      }>
                      {s}
                    </Btn>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    ),

    loadout: (
      <Panel title="Starting loadout">
        <div className="wiz-step">
          <p className="wiz-lede">What the company issued you. One kit, everything in it.</p>
          <div className="btn-grid">
            {Object.entries(mod.loadouts).map(([k, l]) => (
              <Btn key={k} kind={draft.loadout === k ? "accent" : "default"}
                hint={l.note} onClick={() => set({ loadout: k })}>{l.name || k}</Btn>
            ))}
          </div>
          {draft.loadout && (
            <div className="note-box">
              {mod.loadouts[draft.loadout].items
                .map((i) => mod.items[i] && mod.items[i].n).filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      </Panel>
    ),

    review: (
      <Panel title="Check it over">
        <div className="wiz-step">
          <dl className="wiz-review">
            <dt>Name</dt><dd>{draft.name.trim().toUpperCase()}</dd>
            <dt>Class</dt><dd>{cls.name}</dd>
            <dt>Skills</dt><dd>{[...new Set(chosen)].join(" · ") || "None."}</dd>
            <dt>Loadout</dt><dd>{draft.loadout ? (mod.loadouts[draft.loadout].name || draft.loadout) : "—"}</dd>
            <dt>Trinket</dt><dd>{draft.trinket}</dd>
            <dt>Patch</dt><dd>{draft.patch}</dd>
          </dl>

          <div>
            <Label>Stats</Label>
            <div className="statgrid">
              {STAT_KEYS.map((k) => <StatBox key={k} label={STAT_LABEL[k]} value={finalStats[k]} />)}
            </div>
          </div>

          <div>
            <Label>Saves</Label>
            <div className="statgrid">
              {SAVE_KEYS.map((k) => <StatBox key={k} label={k} value={cls.saves[k]} />)}
            </div>
          </div>

          <p className="wiz-hint">
            Offering sends this to the Warden's screen for approval. A copy is kept
            in your locker on this phone either way, so nothing is lost if they
            send it back.
          </p>
        </div>
      </Panel>
    ),
  }[STEPS[step].id];

  const last = step === STEPS.length - 1;

  return (
    <div className="wiz">
      <nav className="wiz-crumbs" aria-label="Character creation steps">
        {STEPS.map((s, i) => {
          const state = i === step ? "is-current" : i <= furthest ? "is-done" : "";
          return (
            <button key={s.id} type="button" className={`wiz-crumb ${state}`}
              disabled={i > furthest && i !== step}
              aria-current={i === step ? "step" : undefined}
              onClick={() => i <= furthest && setStep(i)}>
              <span className="n">{i + 1}</span><span>{s.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="wiz-progress" aria-hidden="true">
        <i style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      <div className="wiz-body">{body}</div>

      {blocker && <p className="wiz-blocked">{blocker}</p>}

      <div className="wiz-nav">
        <Btn kind="ghost" onClick={() => (step === 0 ? onBack && onBack() : setStep(step - 1))}>
          {step === 0 ? "Cancel" : "Back"}
        </Btn>
        {last ? (
          <Btn kind="accent" onClick={finish}>Offer to the Warden</Btn>
        ) : (
          <Btn kind="primary" disabled={!!blocker} onClick={() => setStep(step + 1)}>
            {blocker ? "Not yet" : "Next"}
          </Btn>
        )}
      </div>
    </div>
  );
}
