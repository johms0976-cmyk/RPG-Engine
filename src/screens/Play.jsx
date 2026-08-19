import React, { useState, useMemo } from "react";
import { Panel, Btn, Label, Bar, StatBox, Modal, Feed, Field, ActionGroup, useKey } from "../ui/kit.jsx";
import MapV2 from "../ui/Map2.jsx";
import { DiceTheatre } from "../ui/Dice.jsx";
import audio, { bedForTags } from "../ui/audio.js";
import { ShipSheet, ShipCombat } from "./Ship.jsx";
import Contractors from "./Contractors.jsx";
import ShoreLeave from "./ShoreLeave.jsx";
import { fmtClock, STAT_LABEL, STAT_KEYS, SAVE_KEYS, armorSave, RestQuality, xpForLevel } from "../engine/rules.js";
import { npcsIn, threatIn, carriedWeapons } from "../engine/world.js";
import { roomOf, exitsFor, othersHere, isSplit, partySummary } from "../engine/party.js";
import { rangeBand, catalogue } from "../engine/gear.js";
import { canFire, shotsForAttack, isTrainedShooter, reloadCost, liveEnemies, currentTurn, grabberOf } from "../engine/combat.js";
import { test as testWhen } from "../engine/effects.js";
import { toMarkdown, filename } from "../engine/transcript.js";
import { downloadText } from "../engine/storage.js";
import LevelUp from "./LevelUp.jsx";
import Shop from "./Shop.jsx";
import WardenDeck from "./WardenDeck.jsx";
import HoldToRoll from "../ui/HoldToRoll.jsx";
import FullScreen from "../ui/FullScreen.jsx";
import { Evidence, Artefact } from "../ui/Artefact.jsx";
import FeedLog from "../ui/FeedLog.jsx";
import { usePressure } from "../ui/usePressure.js";
import ClockStrip from "../ui/Clocks.jsx";
import { tempoOf, sceneHolder, sceneHolders, canJumpIn } from "../engine/tempo.js";
import "../ui/pressure.css";
import "../ui/warden.css";
import "../ui/tempo.css";

/**
 * The play screen, shared by three seats that look identical to it:
 * the Warden's desk, a solo player's laptop, and a phone holding a
 * useRemoteGame. The differences are carried by props and by whether
 * the game object has a `warden` key — a phone's never does, so the
 * Warden's controls cannot render there even by accident.
 */
/**
 * THE RULE ABOUT BUTTONS
 *
 * Everything below follows one rule that the old screen did not: if
 * you cannot do it, it is not on the screen. Not greyed out — gone.
 *
 * A disabled button is a promise the interface has no intention of
 * keeping. It occupies the space, invites the tap, and answers with
 * nothing, which on a phone six people are sharing reads as an app
 * that has stopped working. Worse, a wall of grey is exactly as long
 * as a wall of live controls, so a player in combat has to read
 * fourteen things to find the two they may actually press.
 *
 * The exceptions are deliberate and few: the ones where the absence
 * of a button is itself confusing ("where did my gun go?"). Those
 * keep a visible reason in their place instead — see `Unavailable`.
 */
export default function Play({
  g, core, onQuit, net, onWhisper, onWhisperPeer, tableHandout, tableHandoutOnly,
}) {
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
  const [giving, setGiving] = useState(null);   // itemId being handed over
  const [bigMap, setBigMap] = useState(false);
  const [whisper, setWhisper] = useState("");
  const [showWhisper, setShowWhisper] = useState(false);
  /* Player-to-player. `null` when closed, otherwise the pcId being
     leaned over to. */
  const [whisperTo, setWhisperTo] = useState(null);
  const [peerText, setPeerText] = useState("");
  /* A prop the Warden is holding up, that this player has put down.
     The Warden decides what is on the table; the player decides how
     long they look at it. Reset whenever a different one goes up. */
  const [propDown, setPropDown] = useState(null);

  // The Warden's own screen is the one holding the authoritative game.
  const isWarden = !!g.warden;

  /* WHERE *THIS* CHARACTER IS.
     `w.room` is now derived — where most of the crew is — and it is
     the wrong thing for a phone to draw. Everything on this screen
     hangs off the room the person holding it is standing in, which
     is what makes splitting up mean anything. */
  const myRoom = roomOf(pc, w);
  const room = mod.rooms[myRoom] || mod.rooms[w.room];
  const withMe = pc ? othersHere(crew, pc, w) : [];
  const split = isSplit(crew, w);

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

  /* The brakes. A phone that is not allowed to move the world right
     now should not be showing controls that move the world — the
     whole point of the hold is that it is legible. */
  const tempo = tempoOf(w);
  const sceneOwner = sceneHolder(tempo);
  /* Lanes: once the party splits there is one holder per room, so
     "somebody else has the room" has to mean somebody else in *my*
     room. Without this, half a split table sees itself as blocked
     while the engine is perfectly willing to let them act. */
  const sceneOwners = sceneHolders(tempo, g.crew, w);
  const sceneMine = sceneOwners.includes(pc.id);
  const sceneBlocked = !!sceneOwner && !sceneMine;
  const mayJumpIn = canJumpIn(tempo, pc.id);
  const braked = tempo.held || !!tempo.breather || sceneBlocked;
  // The Warden's own screen is never braked by its own brake.
  const canAct = isWarden || !braked;

  // Ambience follows the room's tags. Nothing plays until the
  // player explicitly turns sound on — browsers require a gesture
  // and so does not being obnoxious.
  React.useEffect(() => {
    if (!sound) return;
    audio.playBed(bedForTags(room.tags || []));
  }, [sound, room.tags, myRoom]);

  // The countdown alarm gets more insistent as the clock runs out.
  /* The same number the alarm uses, published to CSS so the whole
     interface can degrade as the clock runs out. See pressure.css. */
  usePressure(w);

  const countdowns = Object.values(w.countdowns || {});
  const urgency = countdowns.length
    ? 1 - Math.min(1, Math.min(...countdowns.map((c) => c.left)) / 60)
    : 0;
  React.useEffect(() => {
    if (!sound || !countdowns.length) return;
    audio.sfx.alarm(urgency);
  }, [sound, Math.floor(urgency * 6), countdowns.length]);
  const here = npcsIn(mod, w, myRoom);
  const exits = exitsFor(mod, w, pc);
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
        {Object.keys(w.handouts || {}).length > 0 && (
          <div style={{ marginTop: 10 }}>
            <Evidence mod={mod} w={w} pcId={pc.id} owned={!isWarden} />
          </div>
        )}

        {crew.filter((c) => c.alive !== false && c.id !== pc.id).length > 0 && pc.items.length > 0 && (
          <div className="btn-row" style={{ marginTop: 8 }}>
            <Btn kind="ghost" className="inline small" onClick={() => setGiving(pc.items[0])}>
              Hand something over
            </Btn>
          </div>
        )}

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
        <MapV2 mod={mod} w={w} crew={crew} activeId={pc.id} youRoom={myRoom} wardenView={isWarden}
          onGo={(id) => {
            const ex = exits.find((e) => e.to === id);
            if (ex) { doMove(ex); if (sound) audio.sfx.door(); }
          }} />
        {/* A map in a drawer on a phone is about 140px tall, which is
            enough to know a map exists and not enough to read one. */}
        <div className="btn-row" style={{ marginTop: 8 }}>
          <Btn kind="ghost" className="inline small" onClick={() => setBigMap(true)}>
            Full screen
          </Btn>
        </div>

        {/* The clock, as the thing it is. See ui/Clocks.jsx — a
            countdown rendered as a timestamp is a countdown nobody
            reads. */}
        <ClockStrip w={w} />

        {/* Who you are standing with, once that is a question the
            game can answer with anything other than "everybody". */}
        {split && (
          <div className={`partystrip${withMe.length === 0 ? " is-alone" : ""}`}>
            {withMe.length === 0
              ? <span className="who">You are on your own in here.</span>
              : <span className="who">With you: {withMe.map((c) => c.name).join(", ")}</span>}
            <span className="where">
              · {partySummary(crew, w, mod)
                .filter((p) => p.room !== myRoom)
                .map((p) => `${p.who.map((x) => x.name).join(", ")} in ${p.name}`)
                .join(" · ") || "the rest of the crew are elsewhere"}
            </span>
          </div>
        )}
      </Panel>

      {g.lastRoll && (
        <DiceTheatre lastRoll={g.lastRoll} panicPending={pc.stress >= 8} />
      )}

      {core && core.state.fight && (
        <ShipCombat core={core} gunnerCombat={pc.stats.combat} />
      )}

      <Panel title="Actions" className="scroll">
        <div className="stack">
          {/* Held, on a break, or somebody else has the room. The
              controls are not greyed — they are not here. What is here
              instead is the reason, which is the thing a grey button
              never tells you. */}
          {!canAct && (
            <div className="brake-box" role="status">
              <strong>
                {tempo.breather ? "The table is taking five."
                  : tempo.held ? (tempo.heldWhy || "The Warden is speaking.")
                    : "Somebody else has the room."}
              </strong>
              <span>
                {sceneBlocked
                  ? "Your buttons come back when it's your go. Anything you tap now would only queue anyway."
                  : "Nothing is lost. Whatever you tap the moment this lifts runs in the order it arrived."}
              </span>
            </div>
          )}

          {!combat && canAct && (
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
                      hint={w.searched[`${myRoom}:${k}`] ? "searched" : f.deep ? "thorough" : undefined}>
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

              {myTurn && assists.length > 0 && (
                <Field label="Assisted by (Advantage, once per day)">
                  <select value={assistId || ""} onChange={(e) => setAssistId(e.target.value || null)}>
                    <option value="">nobody</option>
                    {assists.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
              )}

              {/* Weapons you could actually fire, this instant, at the
                  thing you have selected. A rifle that is out of range
                  or empty is not a choice you are making — showing it
                  greyed only makes you read it before rejecting it.
                  What replaces it is the *reason*, once, underneath. */}
              {myTurn && actor.actions > 0 && (() => {
                const shots = weapons.map((id) => {
                  const it = items[id];
                  const band = target ? rangeBand(it, target.distance) : { band: "—", ok: false };
                  const fire = canFire(pc, id, it, houseRules);
                  return { id, it, band, fire, left: it.shots ? (pc.ammo[id] ?? it.shots) : null };
                });
                const live = shots.filter((x) => x.band.ok && x.fire.ok);
                const dead = shots.filter((x) => !(x.band.ok && x.fire.ok));
                return (
                  <>
                    {live.length > 0 && (
                      <ActionGroup label="Attack">
                        {live.map(({ id, it, band, left }) => (
                          <Btn key={id}
                            onClick={() => { attackWith(id, target && target.uid, assistId); setAssistId(null); }}
                            hint={`${band.band}${left != null ? ` · ${left}/${it.shots}` : ""}${it.auto ? ` · burst ${shotsForAttack(pc, it)}` : ""}`}>
                            {it.n}
                          </Btn>
                        ))}
                      </ActionGroup>
                    )}
                    {dead.length > 0 && (
                      <p className="unavailable">
                        {dead.map(({ it, band, fire, left }) =>
                          `${it.n} — ${!fire.ok ? (fire.why || (left === 0 ? "empty" : "can't fire")) : `${band.band}, out of range`}`
                        ).join(" · ")}
                      </p>
                    )}
                  </>
                );
              })()}

              {/* Everything here is drawn only if it is a move you can
                  make right now. Out of turn there is nothing in this
                  group at all, which is a far clearer statement than
                  eleven grey rectangles. */}
              {myTurn && (
                <ActionGroup label="Manoeuvre">
                  {weapons
                    .filter((id) => items[id].shots && (pc.ammo[id] ?? items[id].shots) < items[id].shots)
                    .map((id) => (
                      <Btn key={id} onClick={() => reloadWeapon(id)}
                        hint={reloadCost(pc) === 0 ? "free action" : "1 action"}>
                        Reload {items[id].n}
                      </Btn>
                    ))}
                  {actor.actions >= 2 && !heldBy && (
                    <Btn onClick={aim} hint="full turn · Advantage next shot">Aim</Btn>
                  )}
                  {actor.actions > 0 && !heldBy && (
                    <>
                      <Btn onClick={() => combatMove("close")} hint="1 action">Close the distance</Btn>
                      <Btn onClick={() => combatMove("back")} hint="1 action">Back off</Btn>
                    </>
                  )}
                  {actor.actions > 0 && target && (mod.threats[target.threatId].counters || [])
                    .filter((k) => !k.when || testWhen(k.when, g.api.ctx()))
                    .map((k) => (
                      <Btn key={k.id} kind="solid"
                        onClick={() => useCounter(k.id)} hint={k.hint}>{k.label}</Btn>
                    ))}
                  {/* Being held collapses your options to exactly one,
                      and saying so is more useful than leaving the
                      others visible and dead. */}
                  {heldBy && (
                    <Btn kind="accent" onClick={escapeGrab} hint="whole turn · Strength">
                      Tear free
                    </Btn>
                  )}
                  {!heldBy && <Btn kind="danger" onClick={fleeCombat}>Run</Btn>}
                  <Btn kind="ghost" onClick={endPcTurn}>End turn</Btn>
                </ActionGroup>
              )}

              {!myTurn && (
                <p className="unavailable">
                  Waiting for {turn ? (turn.name || "them") : "the round"}. You can still
                  use what you are carrying, read, and hand things over.
                </p>
              )}
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
          {/* Passing the spotlight has to be the player's own move, or
              the Warden spends the evening as a traffic light. */}
          {/* "I want to react to that." The inverse of passing, and
              the only way out of combat for a player to be
              responsive rather than merely next. Once per round —
              see JUMPING IN in engine/tempo.js. */}
          {!combat && !sceneMine && mayJumpIn && g.jumpIn && (
            <>
              <hr className="rule" />
              <ActionGroup label="React">
                <Btn kind="accent" onClick={() => g.jumpIn()}
                  hint="you go next, once per round">
                  Cut in — I react to that
                </Btn>
              </ActionGroup>
            </>
          )}

          {!combat && sceneMine && g.endSceneTurn && (
            <>
              <hr className="rule" />
              <ActionGroup label="Round the room">
                <Btn kind="accent" onClick={() => g.endSceneTurn()}
                  hint="passes it to the next person">
                  I'm done — next
                </Btn>
                <Btn kind="ghost" onClick={() => g.passSceneTurn()}
                  hint="you go last this round instead">
                  I'll wait and see
                </Btn>
              </ActionGroup>
            </>
          )}

          {(onWhisper || onWhisperPeer) && (
            <>
              <hr className="rule" />
              <ActionGroup label="Quietly">
                {onWhisper && (
                  <Btn kind="solid" onClick={() => setShowWhisper(true)}
                    hint="only the Warden sees it">
                    Say something to the Warden
                  </Btn>
                )}
                {/* The half that was missing. Every secret in the game
                    used to have to pass through the Warden, which is
                    the one thing a conspiracy cannot do. */}
                {onWhisperPeer && crew.filter((c) => c.alive !== false && c.id !== pc.id).length > 0 && (
                  <Btn kind="ghost" onClick={() => setWhisperTo("")}
                    hint="only they see it">
                    Say something to one of them
                  </Btn>
                )}
              </ActionGroup>
            </>
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
            {/* FeedLog rather than Feed: an unread rule, a jump chip
                that stops new lines yanking you off what you were
                reading, and a timestamp per line so "when was that?"
                is answerable thirty seconds later. */}
            <FeedLog feed={feed} crew={crew} />
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
              <HoldToRoll
                label={`Roll ${STAT_LABEL[pending.req.name]}`}
                hint={pending.req.kind === "save" ? "press and hold — or shake" : "press and hold"}
                onRoll={() => { resolvePending({ assist: assistId }); setAssistId(null); }}
              />
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

      {/* ---------------- handing something over ---------------- */}
      {giving && (
        <Modal title="Hand something over" onClose={() => setGiving(null)}>
          <div className="stack">
            <p style={{ margin: 0 }}>
              It goes across with whatever is in it — a magazine changes hands
              half empty if that is how you are handing it over.
            </p>
            <Label>WHAT</Label>
            <div className="btn-grid">
              {pc.items.map((id) => items[id] && (
                <Btn key={id} kind={giving === id ? "accent" : "ghost"} className="small"
                  onClick={() => setGiving(id)}>{items[id].n}</Btn>
              ))}
            </div>
            <Label>TO</Label>
            <div className="btn-grid">
              {crew.filter((c) => c.alive !== false && c.id !== pc.id).map((c) => (
                <Btn key={c.id} kind="solid" className="small"
                  onClick={() => {
                    // Offer, not transfer. They see a card and take it,
                    // which is what stops the vibe check ending up in
                    // the wrong hands during a firefight. The Warden's
                    // own screen still hands things over outright.
                    if (isWarden || !g.offerItem) g.giveItem(giving, c.id);
                    else g.offerItem(giving, c.id);
                    setGiving(null);
                  }}>
                  {c.name}
                </Btn>
              ))}
            </div>
            <p className="clue-meta" style={{ margin: 0 }}>
              {isWarden
                ? "It changes hands immediately."
                : "They get a card and take it. In a fight it goes across on its own after ten seconds."}
            </p>
            <Btn kind="ghost" onClick={() => setGiving(null)}>Keep it</Btn>
          </div>
        </Modal>
      )}

      {/* ---------------- the map, properly ---------------- */}
      {bigMap && (
        <FullScreen title={room.name} tone="map" onClose={() => setBigMap(false)}>
          <MapV2 mod={mod} w={w} crew={crew} activeId={pc.id} youRoom={myRoom} wardenView={isWarden}
            onGo={(id) => {
              const ex = exits.find((e) => e.to === id);
              if (ex) { doMove(ex); setBigMap(false); if (sound) audio.sfx.door(); }
            }} />
        </FullScreen>
      )}

      {/* ---------------- a handout the Warden put on the table ---------------- */}
      {tableHandout && mod.handouts[tableHandout] && propDown !== tableHandout && (
        <FullScreen title="On the table" tone="artefact"
          onClose={() => setPropDown(tableHandout)}>
          <Artefact id={tableHandout} handout={mod.handouts[tableHandout]} flat />
          <p className="clue-meta" style={{ textAlign: "center", marginTop: 12 }}>
            {tableHandoutOnly && tableHandoutOnly.includes(pc.id)
              ? "You are being shown this and the rest of the table is not. What you do with that is yours."
              : "The Warden is holding this up. Putting it down only puts it down for you — it stays in your Evidence, and on the table screen."}
          </p>
        </FullScreen>
      )}

      {/* ---------------- whispering back ---------------- */}
      {showWhisper && onWhisper && (
        <Modal title="Only the Warden" onClose={() => setShowWhisper(false)}>
          <div className="stack">
            <p style={{ margin: 0 }}>
              Nothing appears in the log, on the table screen, or on anyone
              else's phone. For the things that are ruined by being said out
              loud.
            </p>
            <Field label="Say it">
              <input autoFocus value={whisper} onChange={(e) => setWhisper(e.target.value)}
                placeholder="I pocket the keycard while they're arguing."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && whisper.trim()) {
                    onWhisper(whisper.trim()); setWhisper(""); setShowWhisper(false);
                  }
                }} />
            </Field>
            <div className="btn-row">
              <Btn kind="accent" className="inline" disabled={!whisper.trim()}
                onClick={() => { onWhisper(whisper.trim()); setWhisper(""); setShowWhisper(false); }}>
                Send
              </Btn>
              <Btn kind="ghost" className="inline" onClick={() => setShowWhisper(false)}>Never mind</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ---------------- leaning over to one of them ---------------- */}
      {whisperTo !== null && onWhisperPeer && (
        <Modal title="Only them" onClose={() => { setWhisperTo(null); setPeerText(""); }}>
          <div className="stack">
            <p style={{ margin: 0 }}>
              It arrives on their phone as a card with your name on it. It is
              not in the log, not on the table screen, and not on anybody
              else's handset.
            </p>
            <Label>WHO</Label>
            <div className="btn-grid">
              {crew.filter((c) => c.alive !== false && c.id !== pc.id).map((c) => (
                <Btn key={c.id} kind={whisperTo === c.id ? "accent" : "ghost"} className="small"
                  onClick={() => setWhisperTo(c.id)}>{c.name}</Btn>
              ))}
            </div>
            {whisperTo && (
              <Field label="Say it">
                <input autoFocus value={peerText} onChange={(e) => setPeerText(e.target.value)}
                  placeholder="Don't drink it. Don't say anything."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && peerText.trim()) {
                      onWhisperPeer(whisperTo, peerText.trim());
                      setPeerText(""); setWhisperTo(null);
                    }
                  }} />
              </Field>
            )}
            <div className="btn-row">
              <Btn kind="accent" className="inline" disabled={!whisperTo || !peerText.trim()}
                onClick={() => {
                  onWhisperPeer(whisperTo, peerText.trim());
                  setPeerText(""); setWhisperTo(null);
                }}>
                Send
              </Btn>
              <Btn kind="ghost" className="inline"
                onClick={() => { setWhisperTo(null); setPeerText(""); }}>Never mind</Btn>
            </div>
            <p className="clue-meta" style={{ margin: 0 }}>
              Whether the Warden is told this happened is a rule your table
              set before the session, not something this screen decides.
            </p>
          </div>
        </Modal>
      )}

      {/* The Warden's own controls. `g.warden` exists only on the
          authoritative game, so this cannot render on a phone. */}
      {isWarden && <WardenDeck g={g} net={net} />}
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
