import React, { useState, useMemo } from "react";
import { Panel, Btn, Label, Bar, StatBox, Modal, Feed, Field, ActionGroup, useKey } from "../ui/kit.jsx";
import MapV2 from "../ui/Map2.jsx";
import { DiceTheatre } from "../ui/Dice.jsx";
import audio, { bedForTags } from "../ui/audio.js";
import { ShipSheet, ShipCombat } from "./Ship.jsx";
import Contractors from "./Contractors.jsx";
import ShoreLeave from "./ShoreLeave.jsx";
import { fmtClock, STAT_LABEL, STAT_KEYS, SAVE_KEYS, armorSave, RestQuality, xpForLevel } from "../engine/rules.js";
import { npcsIn, threatIn, visibleExits, carriedWeapons } from "../engine/world.js";
import { rangeBand, catalogue } from "../engine/gear.js";
import { canFire, shotsForAttack, isTrainedShooter, reloadCost, liveEnemies, currentTurn, grabberOf } from "../engine/combat.js";
import { test as testWhen } from "../engine/effects.js";
import { toMarkdown, filename } from "../engine/transcript.js";
import { downloadText } from "../engine/storage.js";
import LevelUp from "./LevelUp.jsx";
import Shop from "./Shop.jsx";

export default function Play({ g, core, onQuit }) {
  const {
    mod, w, crew, pc, feed, pending, combat, talking, device, resting, levelUp, shopping, items, houseRules,
    setTalking, setDevice, setActiveId, setResting, setLevelUp, setShopping,
    doMove, doSearch, useItem, deviceAction, askNpc, doFreeAction,
    attackWith, reloadWeapon, aim, combatMove, setTarget, useCounter, fleeCombat, escapeGrab, endPcTurn,
    doRest, offerRest, applyLevel, possibleAssists, possibleTherapists, resolvePending, buy, sell,
  } = g;

  const [cmd, setCmd] = useState("");
  const [drawer, setDrawer] = useState(null); // 'left' | 'right' | null
  const [overlay, setOverlay] = useState(null); // 'ship' | 'crew-for-hire' | 'shore'
  const [sound, setSound] = useState(false);
  const [assistId, setAssistId] = useState(null);
  const [showSheet, setShowSheet] = useState(false);

  const room = mod.rooms[w.room];

  // A device is reachable if the room lists it, or if any feature in the
  // room points at it. Modules describe terminals the second way.
  const roomDevices = useMemo(() => {
    const ids = new Set(room.devices || []);
    Object.values(room.features || {}).forEach((f) => { if (f.device) ids.add(f.device); });
    return [...ids].filter((id) => mod.devices[id]);
  }, [room, mod.devices]);

  // Module-wide and room actions, filtered by their `when` predicate.
  const roomActions = useMemo(() => {
    const ctx = g.api.ctx();
    return (mod.actions || []).concat(room.actions || []).filter((a) => !a.when || testWhen(a.when, ctx));
  }, [mod.actions, room, g, w, pc]);

  const heldBy = combat ? grabberOf(combat, pc.id) : null;

  // Ambience follows the room's tags. Nothing plays until the
  // player explicitly turns sound on — browsers require a gesture
  // and so does not being obnoxious.
  React.useEffect(() => {
    if (!sound) return;
    audio.playBed(bedForTags(room.tags || []));
  }, [sound, room.tags, w.room]);

  // The countdown alarm gets more insistent as the clock runs out.
  const countdowns = Object.values(w.countdowns || {});
  const urgency = countdowns.length
    ? 1 - Math.min(1, Math.min(...countdowns.map((c) => c.left)) / 60)
    : 0;
  React.useEffect(() => {
    if (!sound || !countdowns.length) return;
    audio.sfx.alarm(urgency);
  }, [sound, Math.floor(urgency * 6), countdowns.length]);
  const here = npcsIn(mod, w);
  const exits = visibleExits(mod, w);
  const enemies = combat ? liveEnemies(combat) : [];
  const turn = combat ? currentTurn(combat) : null;
  const myTurn = combat && turn && turn.side === "pc" && turn.id === pc.id;
  const actor = combat ? combat.actors[pc.id] : null;
  const weapons = pc ? carriedWeapons(mod, pc) : [];
  const target = combat ? enemies.find((e) => e.uid === combat.targetUid) || enemies[0] : null;
  const assists = possibleAssists(pc);

  useKey("Escape", () => { if (drawer) setDrawer(null); });

  const submit = (e) => {
    e.preventDefault();
    const t = cmd.trim();
    if (!t) return;
    setCmd("");
    doFreeAction(t);
  };

  const exportTranscript = () => {
    const md = toMarkdown({ mod, world: w, crew, feed });
    downloadText(filename(mod, w), md, "text/markdown");
  };

  if (!pc) return null;

  /* ---------------- left column: crew + sheet ---------------- */
  const leftCol = (
    <>
      <Panel title="Crew" icons={`${crew.filter((c) => c.alive !== false).length}/${crew.length}`}>
        <div className="roster">
          {crew.map((c) => (
            <button key={c.id}
              className={`roster-row ${c.id === pc.id ? "active" : ""} ${c.alive === false ? "dead" : c.unconscious ? "down" : ""}`}
              onClick={() => c.alive !== false && !c.unconscious && setActiveId(c.id)}
              aria-pressed={c.id === pc.id}
              aria-label={`${c.name}, ${c.cls}, health ${c.health} of ${c.maxHealth}, stress ${c.stress}${c.alive === false ? ", dead" : c.unconscious ? ", unconscious" : ""}`}>
              <span>
                <span className="who">{c.name}</span>
                <br />
                <span style={{ fontSize: 9.5, letterSpacing: "0.1em", opacity: 0.75 }}>
                  {c.cls.toUpperCase()}{c.level > 0 ? ` · LVL ${c.level}` : ""}
                </span>
              </span>
              <span className="vitals">
                {c.alive === false ? "DEAD" : c.unconscious ? "DOWN" : `${c.health}/${c.maxHealth}`}
                <br />
                <span style={{ color: c.stress >= 8 ? "var(--blood)" : "inherit" }}>ST {c.stress}</span>
              </span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title={pc.name} icons={`${pc.credits}cr · ${pc.xp}xp`} className="scroll">
        <Bar label="HEALTH" value={pc.health} max={pc.maxHealth} warn={pc.health < pc.maxHealth / 3} />
        <Bar label="STRESS" value={pc.stress} max={20} color="var(--blood)" warn={pc.stress >= 8} />
        {houseRules.wounds && <Bar label="WOUNDS" value={pc.wounds || 0} max={pc.maxWounds || 2} color="var(--blood)" />}

        <Label>STATS</Label>
        <div className="statgrid">
          {STAT_KEYS.map((k) => <StatBox key={k} label={STAT_LABEL[k].slice(0, 3).toUpperCase()} value={pc.stats[k]} />)}
        </div>
        <Label>SAVES</Label>
        <div className="statgrid">
          {SAVE_KEYS.map((k) => (
            <StatBox key={k} label={STAT_LABEL[k].slice(0, 3).toUpperCase()}
              value={k === "armor" ? armorSave(pc, items) : pc.saves[k]} />
          ))}
        </div>
        <div className="statgrid" style={{ marginTop: 4, gridTemplateColumns: "1fr 1fr" }}>
          <StatBox label="RESOLVE" value={pc.resolve} hot={pc.resolve > 0} />
          <StatBox label="NEXT LVL" value={`${pc.xp}/${xpForLevel(pc.level)}`} />
        </div>

        {pc.conditions.length > 0 && (
          <>
            <Label>CONDITIONS</Label>
            <div>{pc.conditions.map((c) => <span key={c} className="tag">{c}</span>)}</div>
          </>
        )}

        <Label>SKILLS</Label>
        <div style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{pc.skills.join(", ") || "none"}</div>

        <Label>CARRYING</Label>
        <div className="btn-grid">
          {pc.items.map((id) => {
            const it = items[id];
            if (!it) return null;
            const ammo = it.shots ? `${pc.ammo[id] ?? it.shots}/${it.shots}${pc.spare[id] ? ` +${pc.spare[id]}` : ""}` : null;
            const used = it.uses ? `${it.uses - (pc.uses[id] || 0)} left` : null;
            return (
              <Btn key={id} kind="default" className="small" onClick={() => useItem(id)}
                hint={ammo || used || undefined} title={it.d}>
                {it.n}
              </Btn>
            );
          })}
        </div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--graphite)", marginTop: 8 }}>
          {pc.trinket} · {pc.patch}
        </div>
      </Panel>
    </>
  );

  /* ---------------- right column: map + actions ---------------- */
  const rightCol = (
    <>
      <Panel title="Location" icons={fmtClock(w.clock)}>
        <MapV2 mod={mod} w={w} crew={crew} activeId={pc.id}
          onGo={(id) => {
            const ex = exits.find((e) => e.to === id);
            if (ex) { doMove(ex); if (sound) audio.sfx.door(); }
          }} />
      </Panel>

      {g.lastRoll && (
        <DiceTheatre lastRoll={g.lastRoll} panicPending={pc.stress >= 8} />
      )}

      {core && core.state.fight && (
        <ShipCombat core={core} gunnerCombat={pc.stats.combat} />
      )}

      <Panel title="Actions" className="scroll">
        <div className="stack">
          {!combat && (
            <>
              <ActionGroup label="Move">
                {exits.map((e, i) => (
                  <Btn key={i} onClick={() => doMove(e)} hint={e.needsHint || (e.mins ? `${e.mins}m` : undefined)}>
                    {e.label || (mod.rooms[e.to] ? mod.rooms[e.to].name : String(e.to))}
                  </Btn>
                ))}
              </ActionGroup>

              {Object.keys(room.features || {}).length > 0 && (
                <ActionGroup label="Look at">
                  {Object.entries(room.features).map(([k, f]) => (
                    <Btn key={k} onClick={() => doSearch(k)}
                      hint={w.searched[`${w.room}:${k}`] ? "searched" : f.deep ? "thorough" : undefined}>
                      {f.name}
                    </Btn>
                  ))}
                </ActionGroup>
              )}

              {here.length > 0 && (
                <ActionGroup label="Talk to">
                  {here.map((id) => (
                    <Btn key={id} onClick={() => setTalking(id)} hint={mod.npcs[id].role}>{mod.npcs[id].name}</Btn>
                  ))}
                </ActionGroup>
              )}

              {roomDevices.length > 0 && (
                <ActionGroup label="Use">
                  {roomDevices.map((id) => (
                    <Btn key={id} kind="solid" onClick={() => setDevice(id)}>
                      {mod.devices[id].label || mod.devices[id].title}
                    </Btn>
                  ))}
                </ActionGroup>
              )}

              {roomActions.map((a) => (
                <Btn key={a.id} kind={a.kind || "default"} onClick={() => g.act(a.effects)}>{a.label}</Btn>
              ))}

              <ActionGroup label="Downtime">
                <Btn kind="ghost" onClick={() => offerRest({})}>Rest and recover</Btn>
                {Object.keys(mod.shops || {}).length > 0 && (
                  <Btn kind="ghost" onClick={() => setShopping(Object.keys(mod.shops)[0])}>Requisition</Btn>
                )}
              </ActionGroup>
            </>
          )}

          {combat && (
            <>
              <div className="warn-box">
                ROUND {combat.round} · {myTurn ? `YOUR TURN — ${actor.actions} action${actor.actions === 1 ? "" : "s"}` : "waiting"}
              </div>

              {heldBy && (
                <div className="warn-box" style={{ borderColor: "var(--blood)" }}>
                  {heldBy.name.toUpperCase()} HAS HOLD OF YOU. Tearing free takes your whole turn.
                </div>
              )}

              <ActionGroup label={`Target — ${target ? `${target.name}, ${target.distance}m` : "none"}`}>
                {enemies.map((e) => (
                  <Btn key={e.uid} kind={target && e.uid === target.uid ? "accent" : "default"}
                    onClick={() => setTarget(e.uid)} hint={`${e.distance}m · ${e.hits}/${e.maxHits} hits`}>
                    {e.name}
                  </Btn>
                ))}
              </ActionGroup>

              {assists.length > 0 && (
                <Field label="Assisted by (Advantage, once per day)">
                  <select value={assistId || ""} onChange={(e) => setAssistId(e.target.value || null)}>
                    <option value="">nobody</option>
                    {assists.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
              )}

              <ActionGroup label="Attack">
                {weapons.map((id) => {
                  const it = items[id];
                  const band = target ? rangeBand(it, target.distance) : { band: "—", ok: false };
                  const fire = canFire(pc, id, it, houseRules);
                  const left = it.shots ? (pc.ammo[id] ?? it.shots) : null;
                  return (
                    <Btn key={id} disabled={!myTurn || !band.ok || !fire.ok || actor.actions <= 0}
                      onClick={() => { attackWith(id, target && target.uid, assistId); setAssistId(null); }}
                      hint={`${band.band}${left != null ? ` · ${left}/${it.shots}` : ""}${it.auto ? ` · burst ${shotsForAttack(pc, it)}` : ""}`}>
                      {it.n}
                    </Btn>
                  );
                })}
              </ActionGroup>

              <ActionGroup label="Manoeuvre">
                {weapons.filter((id) => items[id].shots && (pc.ammo[id] ?? items[id].shots) < items[id].shots).map((id) => (
                  <Btn key={id} disabled={!myTurn} onClick={() => reloadWeapon(id)}
                    hint={reloadCost(pc) === 0 ? "free action" : "1 action"}>
                    Reload {items[id].n}
                  </Btn>
                ))}
                <Btn disabled={!myTurn || actor.actions < 2} onClick={aim} hint="full turn · Advantage next shot">Aim</Btn>
                <Btn disabled={!myTurn || actor.actions <= 0} onClick={() => combatMove("close")} hint="1 action">Close the distance</Btn>
                <Btn disabled={!myTurn || actor.actions <= 0} onClick={() => combatMove("back")} hint="1 action">Back off</Btn>
                {target && (mod.threats[target.threatId].counters || [])
                  .filter((k) => !k.when || testWhen(k.when, g.api.ctx()))
                  .map((k) => (
                    <Btn key={k.id} kind="solid" disabled={!myTurn || actor.actions <= 0}
                      onClick={() => useCounter(k.id)} hint={k.hint}>{k.label}</Btn>
                  ))}
                {heldBy && (
                  <Btn kind="accent" disabled={!myTurn} onClick={escapeGrab} hint="whole turn · Strength">
                    Tear free
                  </Btn>
                )}
                <Btn kind="danger" disabled={!myTurn || !!heldBy} onClick={fleeCombat}
                  hint={heldBy ? "not while it has you" : undefined}>Run</Btn>
                <Btn kind="ghost" disabled={!myTurn} onClick={endPcTurn}>End turn</Btn>
              </ActionGroup>
            </>
          )}

          <hr className="rule" />
          {core && (
            <ActionGroup label="Off the floor">
              <Btn onClick={() => setOverlay("ship")}
                hint={core.state.ship ? `${core.state.ship.hull} hull` : "none aboard"}>SHIP</Btn>
              <Btn onClick={() => setOverlay("hire")}
                hint={`${(core.state.hirelings || []).filter((m) => m.alive).length} contracted`}>CONTRACTORS</Btn>
              <Btn onClick={() => setOverlay("shore")} hint="between sessions">SHORE LEAVE</Btn>
            </ActionGroup>
          )}
          <hr className="rule" />
          <div className="btn-row">
            <Btn kind="ghost" className="inline small"
              onClick={() => setSound(audio.setEnabled(!sound))}
              aria-pressed={sound}>
              {sound ? "Sound on" : "Sound off"}
            </Btn>
            <Btn kind="ghost" className="inline small" onClick={exportTranscript}>Export transcript</Btn>
            <Btn kind="ghost" className="inline small" onClick={onQuit}>Eject</Btn>
          </div>
        </div>
      </Panel>
    </>
  );

  return (
    <>
      <a className="skip-link" href="#feed-scroll">Skip to the session log</a>
      <div className={`play-grid ${drawer === "left" ? "drawer-left" : drawer === "right" ? "drawer-right" : ""}`}>
        <div className="col-left">{leftCol}</div>

        <div className="col-feed">
          <Panel title={room.name} icons={`${fmtClock(w.clock)} · ${Object.entries(w.countdowns).map(([k, c]) => `${k.toUpperCase()} ${c.left}m`).join(" · ") || "no timers"}`}
            bodyClass="flush" style={{ flex: 1, minHeight: 0 }}>
            <Feed feed={feed} />
          </Panel>

          <form onSubmit={submit} className="cmdbar">
            <label htmlFor="cmd" className="sr-only">What do you do?</label>
            <input id="cmd" value={cmd} onChange={(e) => setCmd(e.target.value)}
              placeholder="look · search the crates · go to the workspace · ask sonya about mike · help"
              autoComplete="off" />
            <Btn type="submit" kind="accent" className="inline" disabled={!cmd.trim()}>Do it</Btn>
          </form>
        </div>

        <div className="col-right">{rightCol}</div>
      </div>

      <nav className="mobile-bar" aria-label="Panels">
        <Btn kind="ghost" className="small" onClick={() => setDrawer(drawer === "left" ? null : "left")}>Crew</Btn>
        <Btn kind="ghost" className="small" onClick={() => setDrawer(null)}>Log</Btn>
        <Btn kind="ghost" className="small" onClick={() => setDrawer(drawer === "right" ? null : "right")}>Actions</Btn>
        <Btn kind="ghost" className="small" onClick={() => setShowSheet(true)}>Sheet</Btn>
      </nav>

      {/* ---------------- modals ---------------- */}

      {core && overlay && (
        <Modal title={overlay === "ship" ? "Ship" : overlay === "hire" ? "Contractors" : "Shore leave"}
          onClose={() => setOverlay(null)} wide>
          <div className="stack" style={{ maxHeight: "80dvh", overflowY: "auto" }}>
            {overlay === "ship" && (
              <ShipSheet core={core} crewCount={crew.filter((c) => c.alive !== false).length}
                onRepairRoll={() => {
                  const best = crew.filter((c) => c.alive !== false)
                    .sort((a, b) => b.stats.intellect - a.stats.intellect)[0];
                  const skilled = best && (best.skills.includes("Mechanical Repair") || best.skills.includes("Engineering"));
                  core.dispatch({
                    type: "SHIP/REPAIR",
                    stat: best ? best.stats.intellect + (skilled ? 15 : 0) : 30,
                  });
                }} />
            )}
            {overlay === "hire" && (
              <Contractors core={core} negotiatorIntellect={pc.stats.intellect} />
            )}
            {overlay === "shore" && (
              <ShoreLeave core={core} crew={crew.filter((c) => c.alive !== false)}
                onEnd={() => setOverlay(null)} />
            )}
            <Btn kind="ghost" onClick={() => setOverlay(null)}>Close</Btn>
          </div>
        </Modal>
      )}

      {pending && pending.kind === "roll" && (
        <Modal title="A roll is called for" onClose={() => {}} dismissable={false}>
          <Panel title="Roll" dark>
            <div className="stack">
              <p style={{ margin: 0 }}>{pending.req.reason || `${STAT_LABEL[pending.req.name]} ${pending.req.kind === "save" ? "Save" : "Check"}`}</p>
              {assists.length > 0 && (
                <Field label="Assisted by">
                  <select value={assistId || ""} onChange={(e) => setAssistId(e.target.value || null)}>
                    <option value="">nobody</option>
                    {assists.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
              )}
              <Btn kind="accent" onClick={() => { resolvePending({ assist: assistId }); setAssistId(null); }}>
                Roll {STAT_LABEL[pending.req.name]}
              </Btn>
            </div>
          </Panel>
        </Modal>
      )}

      {pending && pending.kind === "optStress" && (
        <Modal title="Take the Stress?" onClose={() => {}} dismissable={false}>
          <Panel title="Opt-in stress" dark>
            <div className="stack">
              <p style={{ margin: 0 }}>{pending.why || "That was a lot."} Take {pending.amount} Stress?</p>
              <div className="btn-row">
                <Btn kind="accent" className="inline" onClick={() => resolvePending({ accept: true })}>Take it</Btn>
                <Btn kind="ghost" className="inline" onClick={() => resolvePending({ accept: false })}>Not yet</Btn>
              </div>
            </div>
          </Panel>
        </Modal>
      )}

      {talking && <TalkModal g={g} npcId={talking} onClose={() => setTalking(null)} />}
      {device && <DeviceModal g={g} deviceId={device} onClose={() => setDevice(null)} />}
      {resting && <RestModal g={g} onClose={() => setResting(null)} />}
      {levelUp && <LevelUp g={g} onClose={() => setLevelUp(null)} />}
      {shopping && <Shop g={g} shopId={shopping} onClose={() => setShopping(null)} />}
      {showSheet && (
        <Modal title="Character sheet" onClose={() => setShowSheet(false)}>
          <Panel title={pc.name} dark>{leftCol}</Panel>
        </Modal>
      )}
    </>
  );
}

/* ---------------- talk ---------------- */
function TalkModal({ g, npcId, onClose }) {
  const { mod, w, askNpc } = g;
  const n = mod.npcs[npcId];
  const [line, setLine] = useState("");
  const state = w.npcs[npcId];

  const send = (t) => { if (t.trim()) { askNpc(npcId, t.trim()); setLine(""); } };

  return (
    <Modal title={`Talking to ${n.name}`} onClose={onClose}>
      <Panel title={n.name} icons={n.role} dark>
        <div className="stack">
          {n.brief && <div className="note-box">{n.brief}</div>}
          <Label>SUGGESTED</Label>
          <div className="btn-grid">
            {(mod.talkPrompts || []).map((p) => (
              <Btn key={p} kind="ghost" className="small" onClick={() => send(p)}>{p}</Btn>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(line); }} className="cmdbar">
            <label htmlFor="talkline" className="sr-only">Say something</label>
            <input id="talkline" value={line} onChange={(e) => setLine(e.target.value)} placeholder="say something…" autoComplete="off" />
            <Btn type="submit" kind="accent" className="inline" disabled={!line.trim()}>Say</Btn>
          </form>
          <div className="note-box">
            {n.name} answers from what they know. {state.told.length} of {(n.knows || []).length} things
            already said. They are not a model; they will not invent.
          </div>
          <Btn kind="ghost" onClick={onClose}>Stop talking</Btn>
        </div>
      </Panel>
    </Modal>
  );
}

/* ---------------- device ---------------- */
function DeviceModal({ g, deviceId, onClose }) {
  const { mod, w, pc, deviceAction } = g;
  const dev = mod.devices[deviceId];
  const status = typeof dev.status === "function" ? dev.status(w, pc) : [];
  return (
    <Modal title={dev.title} onClose={onClose}>
      <Panel title={dev.title} icons={dev.icons} dark>
        <div className="stack">
          {status.length > 0 && (
            <pre style={{ fontFamily: "var(--mono)", fontSize: 11.5, margin: 0, whiteSpace: "pre-wrap" }}>
              {status.join("\n")}
            </pre>
          )}
          <div className="btn-grid">
            {dev.actions.map((a) => (
              <Btn key={a.id} kind={a.kind || "ghost"} onClick={() => deviceAction(deviceId, a.id)}>
                {typeof a.label === "function" ? a.label(w, pc) : a.label}
              </Btn>
            ))}
          </div>
          <Btn kind="ghost" onClick={onClose}>Step away</Btn>
        </div>
      </Panel>
    </Modal>
  );
}

/* ---------------- rest ---------------- */
function RestModal({ g, onClose }) {
  const { crew, doRest, possibleTherapists, houseRules } = g;
  const [quality, setQuality] = useState("SAFE");
  const [hours, setHours] = useState(6);
  const [therapists, setTherapists] = useState({});

  return (
    <Modal title="Rest" onClose={onClose}>
      <Panel title="Rest, heal and shed stress" dark>
        <div className="stack">
          <div className="note-box">
            Six hours or more. Each character makes a Body Save to heal by the amount they
            succeeded by, and a Fear Save to shed 1 Stress for every 10 points of margin.
            Critical Successes double both. A Critical Failure on the Body Save reopens the wound.
            Once per day each.
          </div>

          <Label>WHERE</Label>
          <div className="btn-grid">
            {Object.values(RestQuality).map((q) => (
              <Btn key={q.key} kind={quality === q.key ? "accent" : "ghost"}
                onClick={() => setQuality(q.key)} hint={q.blurb}>{q.name}</Btn>
            ))}
          </div>

          <Field label={`Hours — ${hours}`}>
            <input type="range" min={6} max={12} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
          </Field>

          <Label>THERAPY (PSYCHOLOGY OR THEOLOGY, ONCE PER DAY)</Label>
          {crew.filter((c) => c.alive !== false).map((c) => {
            const opts = possibleTherapists(c);
            if (!opts.length) return null;
            return (
              <Field key={c.id} label={`Who talks ${c.name} down?`}>
                <select value={therapists[c.id] || ""} onChange={(e) => setTherapists({ ...therapists, [c.id]: e.target.value || undefined })}>
                  <option value="">nobody</option>
                  {opts.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
            );
          })}

          <div className="btn-row">
            <Btn kind="accent" className="inline" onClick={() => doRest({ quality, hours, therapists })}>Sleep</Btn>
            <Btn kind="ghost" className="inline" onClick={onClose}>Stay awake</Btn>
          </div>
        </div>
      </Panel>
    </Modal>
  );
}
