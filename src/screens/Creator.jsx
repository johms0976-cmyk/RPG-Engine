/* ============================================================
   CREATOR — Mothership 0e character creation. Engine-owned.
   ============================================================ */
import React, { useState, useMemo } from "react";
import { useTheme, Btn } from "../ui/kit.jsx";
import {
  CLASSES, SKILL_TREE, SKILL_BONUS, SKILL_COST, skillTier,
  rollStats, randomFlavour, makeCharacter,
} from "../engine/rules.js";

export default function Creator({ mod, onDone, onBack }) {
  const C = useTheme();
  const [stats, setStats] = useState(rollStats);
  const [cls, setCls] = useState(null);
  const [picks, setPicks] = useState([]);
  const [bought, setBought] = useState([]);
  const [loadout, setLoadout] = useState(null);
  const [name, setName] = useState("");
  const [flavour, setFlavour] = useState(randomFlavour);

  const c = cls ? CLASSES[cls] : null;
  const owned = useMemo(() => (c ? [...c.fixedSkills, ...picks, ...bought] : []), [c, picks, bought]);
  const spent = bought.reduce((a, s) => a + SKILL_COST[skillTier(s)], 0);
  const left = c ? c.points - spent : 0;
  const picksLeft = c && c.pick ? c.pick.count - picks.length : 0;

  const canBuy = (s) => {
    if (owned.includes(s)) return false;
    const tier = skillTier(s);
    if (SKILL_COST[tier] > left) return false;
    const prereq = SKILL_TREE[tier][s];
    return !prereq.length || prereq.some((p) => owned.includes(p));
  };
  const ready = !!c && !!loadout && picksLeft === 0;

  const box = { border: `2px solid ${C.bone}`, padding: 14, marginBottom: 14 };
  const h = { fontFamily: C.display, fontWeight: 700, fontSize: 19, letterSpacing: "0.14em", marginBottom: 8 };
  const sub = { fontFamily: C.mono, fontSize: 10.5, color: C.graphite, lineHeight: 1.7, marginBottom: 10 };
  const pill = (on, disabled) => ({
    fontFamily: C.mono, fontSize: 10, padding: "5px 8px", cursor: disabled ? "not-allowed" : "pointer",
    border: `1.5px solid ${on ? C.accent : C.graphite}`, background: on ? C.accent : "transparent",
    color: on ? C.ink : disabled ? C.graphite : C.bone, opacity: disabled ? 0.4 : 1,
  });

  return (
    <div style={{ background: C.void, minHeight: "100vh", padding: 20, color: C.bone }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontFamily: C.display, fontSize: 38, fontWeight: 700, letterSpacing: "0.05em" }}>
            NEW <span style={{ color: C.accent }}>CHARACTER</span>
          </div>
          <div style={{ width: 150 }}><Btn kind="ghost" onClick={onBack}>Back</Btn></div>
        </div>

        <div style={box}>
          <div style={h}>1 · STATS</div>
          <div style={sub}>2d10 + 25 each. Health is Strength × 2.</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            {Object.entries(stats).map(([k, v]) => (
              <div key={k} style={{ border: `2px solid ${C.bone}`, padding: "6px 14px", textAlign: "center", minWidth: 84 }}>
                <div style={{ fontFamily: C.display, fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{v + (c?.bonus[k] || 0)}</div>
                <div style={{ fontFamily: C.mono, fontSize: 8, letterSpacing: "0.16em", color: C.graphite }}>{k.toUpperCase()}</div>
              </div>
            ))}
          </div>
          <div style={{ maxWidth: 200 }}><Btn kind="ghost" onClick={() => setStats(rollStats())}>Re-roll</Btn></div>
        </div>

        <div style={box}>
          <div style={h}>2 · CLASS</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8 }}>
            {Object.values(CLASSES).map((k) => {
              const on = cls === k.key;
              return (
                <button key={k.key} onClick={() => { setCls(k.key); setPicks([]); setBought([]); }}
                  style={{ textAlign: "left", padding: 10, border: `2px solid ${on ? C.accent : C.bone}`, background: on ? C.accent : "transparent", color: on ? C.ink : C.bone, cursor: "pointer" }}>
                  <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 19, letterSpacing: "0.11em" }}>{k.name}</div>
                  <div style={{ fontFamily: C.mono, fontSize: 10, lineHeight: 1.5, margin: "5px 0 7px", opacity: 0.85 }}>{k.blurb}</div>
                  <div style={{ fontFamily: C.mono, fontSize: 9.5 }}>SAN {k.saves.sanity} · FEAR {k.saves.fear} · BODY {k.saves.body} · ARM {k.saves.armor}</div>
                  <div style={{ fontFamily: C.mono, fontSize: 9, marginTop: 5, opacity: 0.75, lineHeight: 1.5 }}>{k.panic}</div>
                </button>
              );
            })}
          </div>
        </div>

        {c && (
          <div style={box}>
            <div style={h}>3 · SKILLS</div>
            <div style={sub}>
              Starting: {c.fixedSkills.join(", ") || "none"}. {c.pick ? `Pick ${c.pick.count} from: ${c.pick.from.join(", ")}. ` : ""}
              Then spend {c.points} points — trained 1, expert 2, master 3. Expert and master need a prerequisite you already hold.
            </div>
            {c.pick && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {c.pick.from.map((s) => {
                  const on = picks.includes(s);
                  return <button key={s} style={pill(on, !on && picks.length >= c.pick.count)}
                    onClick={() => setPicks(on ? picks.filter((x) => x !== s) : picks.length < c.pick.count ? [...picks, s] : picks)}>{s}</button>;
                })}
                <span style={{ fontFamily: C.mono, fontSize: 10, color: picksLeft ? C.accent : C.graphite, alignSelf: "center" }}>{picksLeft} to pick</span>
              </div>
            )}
            <div style={{ fontFamily: C.mono, fontSize: 10.5, marginBottom: 8, color: left ? C.accent : C.graphite }}>POINTS REMAINING: {left}</div>
            {["trained", "expert", "master"].map((tier) => (
              <div key={tier} style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: C.mono, fontSize: 8.5, letterSpacing: "0.2em", color: C.graphite, marginBottom: 5 }}>
                  {tier.toUpperCase()} +{SKILL_BONUS[tier]}% · {SKILL_COST[tier]} PT
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {Object.keys(SKILL_TREE[tier]).map((s) => {
                    const has = owned.includes(s);
                    const buyable = canBuy(s);
                    return <button key={s} disabled={!has && !buyable} style={pill(has, !has && !buyable)}
                      onClick={() => bought.includes(s) ? setBought(bought.filter((x) => x !== s)) : buyable && setBought([...bought, s])}>{s}</button>;
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={box}>
          <div style={h}>4 · LOADOUT</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 8 }}>
            {Object.entries(mod.loadouts).map(([k, l]) => {
              const on = loadout === k;
              return (
                <button key={k} onClick={() => setLoadout(k)}
                  style={{ textAlign: "left", padding: 10, border: `2px solid ${on ? C.accent : C.bone}`, background: on ? C.accent : "transparent", color: on ? C.ink : C.bone, cursor: "pointer" }}>
                  <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 17, letterSpacing: "0.12em" }}>{l.name}</div>
                  <div style={{ fontFamily: C.mono, fontSize: 9.5, fontStyle: "italic", margin: "4px 0 6px", opacity: 0.8 }}>{l.note}</div>
                  <div style={{ fontFamily: C.mono, fontSize: 9, lineHeight: 1.55, opacity: 0.9 }}>
                    {l.items.filter((i) => mod.items[i]).map((i) => mod.items[i].n).join(", ")}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={box}>
          <div style={h}>5 · FINISHING TOUCHES</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name"
            style={{ width: "100%", maxWidth: 320, fontFamily: C.display, fontSize: 22, fontWeight: 700, letterSpacing: "0.1em", padding: "8px 10px", border: `2px solid ${C.bone}`, background: "transparent", color: C.bone, outline: "none", marginBottom: 10 }} />
          <div style={sub}>
            TRINKET · {flavour.trinket}<br />PATCH · {flavour.patch}<br />STRESS starts at 2. RESOLVE starts at 0.
          </div>
          <div style={{ maxWidth: 180 }}><Btn kind="ghost" onClick={() => setFlavour(randomFlavour())}>Re-roll flavour</Btn></div>
        </div>

        <div style={{ maxWidth: 320, marginBottom: 40 }}>
          <Btn kind="accent" disabled={!ready} onClick={() => ready && onDone(makeCharacter(
            { name: name.trim().toUpperCase() || "UNNAMED", cls, stats, skills: owned, loadout, ...flavour },
            mod
          ))}>
            {ready ? "Begin" : picksLeft ? `Pick ${picksLeft} more skill${picksLeft > 1 ? "s" : ""}` : !cls ? "Pick a class" : "Pick a loadout"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
