/* ============================================================
   PLAY — the deck of the machine. Everything on screen is
   generated from module data plus generic runtime state.
   ============================================================ */
import React, { useState, useEffect, useRef } from "react";
import { useTheme, Panel, Btn, Bar, Label, ActionGroup, StatBox, SheetRow, Modal, feedStyleTable } from "../ui/kit.jsx";
import { BaseMap } from "../ui/Map.jsx";
import { armorSave, skillTier, SKILL_BONUS, STAT_LABEL, statValue, fmtClock } from "../engine/rules.js";
import { test } from "../engine/effects.js";
import { npcsIn, visibleExits, carriedWeapons } from "../engine/world.js";

export default function Play({ g, onQuit }) {
  const C = useTheme();
  const {
    mod, w, pc, feed, pending, combat, talking, device, busy, aiOn, aiFailed, items,
    setTalking, setDevice, setAiOn, doMove, doSearch, useItem, deviceAction,
    askScripted, askFree, doFreeAction, attackWith, useCounter, fleeCombat, endTurn,
    resolvePending, act, api,
  } = g;

  const [narrow, setNarrow] = useState(typeof window !== "undefined" && window.innerWidth < 1000);
  const [tab, setTab] = useState("log");
  const [freeText, setFreeText] = useState("");
  const [npcText, setNpcText] = useState("");
  const feedRef = useRef(null);

  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 1000);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  useEffect(() => { if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight; }, [feed, busy]);

  if (!pc) return null;
  const room = mod.rooms[w.room];
  const ctx = api.ctx();
  const here = npcsIn(mod, w);
  const exits = visibleExits(mod, w);
  const weapons = carriedWeapons(mod, pc);
  const styles = feedStyleTable(C, mod.feedStyles);

  const features = Object.entries(room.features || {}).filter(([, f]) => test(f.when, ctx));
  const roomActions = (room.actions || []).filter((a) => test(a.when, ctx));
  const globalActions = (mod.actions || []).filter((a) => test(a.when, ctx));
  const allActions = [...roomActions, ...globalActions];
  const devicesHere = Object.entries(mod.devices || {}).filter(([id]) =>
    features.some(([, f]) => f.device === id));
  const threat = combat ? mod.threats[combat.threatId] : null;
  const counters = threat ? (threat.counters || []).filter((k) => test(k.when, ctx)) : [];
  const countdowns = Object.entries(w.countdowns || {});

  const Feed = (
    <div ref={feedRef} style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 9, minHeight: 0 }}>
      {feed.map((f) => (
        <div key={f.id} style={{ fontFamily: C.mono, fontSize: 12.5, lineHeight: 1.55, whiteSpace: "pre-wrap", ...(styles[f.kind] || {}) }}>
          {f.kind === "you" ? "› " + f.text : f.text}
        </div>
      ))}
      {busy && <div style={{ fontFamily: C.mono, fontSize: 11, color: C.graphite, letterSpacing: "0.2em" }}>· · ·</div>}
    </div>
  );

  const ActionArea = (
    <div style={{ borderTop: `2px solid ${C.ink}`, background: C.bone2, padding: 10, flexShrink: 0, maxHeight: narrow ? "none" : 360, overflowY: "auto" }}>
      {pending ? (
        <div>
          <div style={{ fontFamily: C.mono, fontSize: 11, marginBottom: 8 }}>
            The Warden asks for a <b>{STAT_LABEL[pending.name]} {pending.kind === "save" ? "save" : "check"}</b>
            {pending.skill ? ` (${pending.skill})` : ""}{pending.mode !== "none" ? ` at ${pending.mode}` : ""}
            {pending.reason ? ` — ${pending.reason}` : ""}.
          </div>
          <Btn kind="accent" onClick={() => resolvePending(pending)}>
            Roll d% — {STAT_LABEL[pending.name]} {statValue(pc, pending.kind, pending.name, pending.skill, items)}%
          </Btn>
        </div>
      ) : combat ? (
        <div>
          <div style={{ fontFamily: C.display, fontWeight: 700, letterSpacing: "0.14em", fontSize: 16, marginBottom: 2 }}>
            COMBAT — ROUND {combat.round} · {threat.combatLabel || threat.name}
          </div>
          <div style={{ fontFamily: C.mono, fontSize: 10, color: C.graphite, marginBottom: 8 }}>
            {threat.note || `Hits landed: ${w.threats[combat.threatId].hits}/${threat.maxHits ?? 3}.`}
          </div>
          {combat.stunned ? (
            <Btn kind="danger" onClick={() => { api.say("system", "You are frozen. The round belongs to it."); endTurn(); }}>
              You are surprised — lose the round
            </Btn>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1fr 1fr", gap: 6 }}>
              {weapons.length === 0 && <Btn disabled>No weapon in hand</Btn>}
              {weapons.map((wid) => {
                const used = pc.uses[wid] || 0;
                const out = items[wid].shots && used >= items[wid].shots;
                return (
                  <Btn key={wid} kind="solid" disabled={out} onClick={() => attackWith(wid)}>
                    Attack — {items[wid].n}{items[wid].dmg ? ` (${items[wid].dmg})` : ""}
                    {items[wid].shots ? ` [${Math.max(0, items[wid].shots - used)}]` : ""}
                  </Btn>
                );
              })}
              {counters.map((k) => <Btn key={k.id} kind="accent" onClick={() => useCounter(k.id)}>{k.label}</Btn>)}
              <Btn kind="danger" onClick={fleeCombat}>Run</Btn>
            </div>
          )}
        </div>
      ) : talking ? (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <div style={{ fontFamily: C.display, fontWeight: 700, letterSpacing: "0.13em", fontSize: 16 }}>
              {mod.npcs[talking].name} — {mod.npcs[talking].role}
            </div>
            <Btn style={{ width: "auto", padding: "3px 8px", fontSize: 11 }} onClick={() => setTalking(null)}>Done</Btn>
          </div>
          <div style={{ fontFamily: C.mono, fontSize: 11, color: C.graphite, marginBottom: 8 }}>{mod.npcs[talking].brief}</div>
          <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1fr 1fr", gap: 6, marginBottom: 8 }}>
            {mod.talkPrompts.map((q) => (
              <Btn key={q} disabled={busy} onClick={() => (aiOn ? askFree(talking, q) : askScripted(talking, q))}>{q}</Btn>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (!npcText.trim() || busy) return; askFree(talking, npcText.trim()); setNpcText(""); }}
            style={{ display: "flex", gap: 6 }}>
            <input value={npcText} onChange={(e) => setNpcText(e.target.value)}
              placeholder={`Say something to ${mod.npcs[talking].name.split(" ")[0]}…`}
              style={{ flex: 1, fontFamily: C.mono, fontSize: 12, padding: "8px 9px", border: `2px solid ${C.ink}`, background: C.bone, color: C.ink, outline: "none" }} />
            <Btn type="submit" kind="solid" style={{ width: "auto", padding: "8px 14px" }} disabled={busy}>Say</Btn>
          </form>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          <ActionGroup label="Move">
            {exits.map((e, i) => {
              const locked = e.gate && !w.flags[e.gate.flag];
              const blocked = e.needs && !test(e.needs, ctx);
              return (
                <Btn key={e.to + i} kind={String(e.to).startsWith("@") ? "danger" : "default"} onClick={() => doMove(e)}
                  title={locked ? "Locked. You'll have to get through it." : ""}>
                  {String(e.to).startsWith("@") && w.flags[`confirm:${e.to.slice(1)}`] ? `${e.label} — confirm` : e.label}
                  {locked ? "  🔒" : ""}{blocked ? `  (${e.needsHint || "blocked"})` : ""}
                </Btn>
              );
            })}
          </ActionGroup>

          {features.length > 0 && (
            <ActionGroup label="Look at">
              {features.map(([k, f]) => (
                <Btn key={k} onClick={() => doSearch(k)} style={{ opacity: w.searched[`${w.room}:${k}`] ? 0.55 : 1 }}>{f.name}</Btn>
              ))}
            </ActionGroup>
          )}

          {(here.length > 0 || allActions.length > 0 || devicesHere.length > 0) && (
            <ActionGroup label="Do">
              {here.filter((n) => !mod.npcs[n].silent).map((n) => (
                <Btn key={n} kind="solid" onClick={() => setTalking(n)}>Talk to {mod.npcs[n].name}</Btn>
              ))}
              {devicesHere.map(([id, dv]) => (
                <Btn key={id} kind="solid" onClick={() => setDevice(id)}>{dv.label || `Use the ${dv.title}`}</Btn>
              ))}
              {allActions.map((a) => (
                <Btn key={a.id} kind={a.kind || "default"} onClick={() => act(a.effects)}>{a.label}</Btn>
              ))}
            </ActionGroup>
          )}

          <form onSubmit={(e) => { e.preventDefault(); if (!freeText.trim() || busy) return; doFreeAction(freeText.trim()); setFreeText(""); }}
            style={{ display: "flex", gap: 6 }}>
            <input value={freeText} onChange={(e) => setFreeText(e.target.value)} placeholder="Or describe what you do…"
              style={{ flex: 1, fontFamily: C.mono, fontSize: 12, padding: "8px 9px", border: `2px solid ${C.ink}`, background: C.bone, color: C.ink, outline: "none" }} />
            <Btn type="submit" kind="solid" style={{ width: "auto", padding: "8px 14px" }} disabled={busy}>Act</Btn>
          </form>
        </div>
      )}
    </div>
  );

  const Sheet = (
    <Panel title={pc.name} icons={pc.cls.toUpperCase()} style={{ flex: 1, minHeight: 0 }}>
      <Bar label="HEALTH" value={pc.health} max={pc.maxHealth} color={C.blood} warn={pc.health <= pc.maxHealth / 2} />
      <div style={{ display: "flex", gap: 10, margin: "8px 0 10px" }}>
        <StatBox label="STRESS" value={pc.stress} hot={pc.stress >= 7} />
        <StatBox label="RESOLVE" value={pc.resolve} />
        <StatBox label="CLOCK" value={fmtClock(w.clock)} />
      </div>
      {Object.entries(mod.meters).length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          {Object.entries(mod.meters).map(([k, m]) => (
            <StatBox key={k} label={(m.name || k).toUpperCase()} value={pc.meters[k] ?? 0} hot={(pc.meters[k] ?? 0) >= (m.danger ?? 7)} />
          ))}
        </div>
      )}
      <SheetRow title="STATS" items={[["STR", pc.stats.strength], ["SPD", pc.stats.speed], ["INT", pc.stats.intellect], ["CMB", pc.stats.combat]]} />
      <SheetRow title="SAVES" items={[["SAN", pc.saves.sanity], ["FEAR", pc.saves.fear], ["BODY", pc.saves.body], ["ARM", armorSave(pc, items)]]} />
      {pc.conditions.length > 0 && (
        <div style={{ margin: "8px 0", padding: "6px 8px", background: C.ink, color: C.accent, fontFamily: C.mono, fontSize: 10, lineHeight: 1.6 }}>
          {pc.conditions.map((c, i) => <div key={i}>▸ {c}</div>)}
        </div>
      )}
      <Label>SKILLS</Label>
      <div style={{ fontFamily: C.mono, fontSize: 10.5, lineHeight: 1.7, marginBottom: 10 }}>
        {pc.skills.length ? pc.skills.map((s) => `${s} +${SKILL_BONUS[skillTier(s)] || 0}%`).join(" · ") : "None"}
      </div>
      <Label>CARRYING</Label>
      <div style={{ display: "grid", gap: 4 }}>
        {pc.items.map((i) => (
          <button key={i} onClick={() => useItem(i)} title={items[i].d}
            style={{ textAlign: "left", fontFamily: C.mono, fontSize: 10.5, padding: "5px 7px", border: `1.5px solid ${C.ink}`, background: items[i].found ? C.accent : "transparent", color: C.ink, cursor: "pointer", lineHeight: 1.3 }}>
            {items[i].n}
            {items[i].uses ? ` (${Math.max(0, items[i].uses - (pc.uses[i] || 0))})` : ""}
            {items[i].shots ? ` [${Math.max(0, items[i].shots - (pc.uses[i] || 0))}]` : ""}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 10, fontFamily: C.mono, fontSize: 9.5, color: C.graphite, lineHeight: 1.6 }}>
        TRINKET · {pc.trinket}<br />PATCH · {pc.patch}<br />CREDITS · {pc.credits}
      </div>
    </Panel>
  );

  const MapCol = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
      <Panel title={mod.title} icons={`${Object.keys(w.visited).length}/${Object.keys(mod.rooms).length} MAPPED`} style={{ flexShrink: 0 }} bodyStyle={{ padding: 6, overflow: "hidden" }}>
        <BaseMap mod={mod} w={w} onGo={(id) => { const e = (room.exits || []).find((x) => x.to === id); if (e) doMove(e); }} />
      </Panel>
      <Panel title={room.name} icons={(room.tags || []).join(" · ")} style={{ flex: 1, minHeight: 90 }}>
        <div style={{ fontFamily: C.mono, fontSize: 11.5, lineHeight: 1.6 }}>{room.look}</div>
        {here.length > 0 && (
          <div style={{ marginTop: 9, paddingTop: 8, borderTop: `1.5px solid ${C.ink}`, fontFamily: C.mono, fontSize: 10.5 }}>
            <b>PRESENT</b><br />{here.map((n) => mod.npcs[n].name).join(" · ")}
          </div>
        )}
        {countdowns.map(([id, cd]) => (
          <div key={id} style={{ marginTop: 9, background: C.accent, padding: "6px 8px", fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.ink }}>
            {id.toUpperCase()} · {cd.left} MIN
          </div>
        ))}
      </Panel>
    </div>
  );

  const dev = device ? mod.devices[device] : null;

  return (
    <div style={{ background: C.void, minHeight: "100vh", padding: narrow ? 8 : 14, fontFamily: C.mono, color: C.bone }}>
      <style>{`* { box-sizing: border-box; } button:focus-visible, input:focus-visible { outline: 3px solid ${C.accent}; outline-offset: 1px; }
        ::-webkit-scrollbar { width: 9px; height: 9px; } ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.graphite}; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }`}</style>

      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: C.display, fontSize: narrow ? 24 : 32, fontWeight: 700, letterSpacing: "0.06em", lineHeight: 0.95, color: C.accent }}>
            {mod.title}
          </div>
          <div style={{ fontFamily: C.mono, fontSize: 9.5, letterSpacing: "0.28em", color: C.graphite, marginTop: 3 }}>{mod.subtitle}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontFamily: C.mono, fontSize: 10, color: C.graphite, letterSpacing: "0.1em" }}>T+{fmtClock(w.clock)} · {room.name}</div>
          <button onClick={() => setAiOn(!aiOn)} style={{ fontFamily: C.mono, fontSize: 9.5, letterSpacing: "0.1em", padding: "5px 9px", border: `1.5px solid ${aiOn ? C.accent : C.graphite}`, background: "transparent", color: aiOn ? C.accent : C.graphite, cursor: "pointer" }}>
            WARDEN {aiOn ? "LIVE" : "OFF"}
          </button>
          <button onClick={onQuit} style={{ fontFamily: C.mono, fontSize: 9.5, letterSpacing: "0.1em", padding: "5px 9px", border: `1.5px solid ${C.graphite}`, background: "transparent", color: C.graphite, cursor: "pointer" }}>
            EJECT
          </button>
        </div>
      </header>

      {aiFailed && aiOn && (
        <div style={{ background: C.accent, color: C.ink, padding: "6px 10px", fontFamily: C.mono, fontSize: 10.5, marginBottom: 10 }}>
          The live Warden couldn't be reached, so free text is falling back to scripted responses. Everything the module needs is still on the buttons.
        </div>
      )}

      {narrow && (
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {[["log", "PLAY"], ["map", "MAP"], ["sheet", "SHEET"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ flex: 1, fontFamily: C.display, fontWeight: 700, letterSpacing: "0.12em", fontSize: 13, padding: "7px 0", border: `2px solid ${C.bone}`, background: tab === k ? C.bone : "transparent", color: tab === k ? C.ink : C.bone, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
      )}

      <div style={{ display: narrow ? "block" : "grid", gridTemplateColumns: "300px minmax(0,1fr) 290px", gap: 12, height: narrow ? "auto" : "calc(100vh - 118px)" }}>
        {(!narrow || tab === "map") && MapCol}
        {(!narrow || tab === "log") && (
          <Panel title="Session Log" icons={combat ? "COMBAT" : pending ? "ROLL REQUIRED" : "IN PLAY"}
            bodyStyle={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }} style={{ minHeight: narrow ? 520 : 0 }}>
            {Feed}{ActionArea}
          </Panel>
        )}
        {(!narrow || tab === "sheet") && Sheet}
      </div>

      {dev && (
        <Modal onClose={() => setDevice(null)}>
          <Panel title={dev.title} icons={dev.icons || ""}>
            <div style={{ fontFamily: C.mono, fontSize: 11, lineHeight: 1.7, marginBottom: 12, color: C.graphite, whiteSpace: "pre-wrap" }}>
              {(dev.status ? dev.status(w, pc, ctx) : []).join("\n")}
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {dev.actions.filter((a) => test(a.when, ctx)).map((a) => (
                <Btn key={a.id} kind={a.kind || "default"} onClick={() => deviceAction(device, a.id)}>
                  {typeof a.label === "function" ? a.label(w, pc) : a.label}
                </Btn>
              ))}
              <Btn kind="solid" onClick={() => setDevice(null)}>Step away</Btn>
            </div>
          </Panel>
        </Modal>
      )}
    </div>
  );
}
