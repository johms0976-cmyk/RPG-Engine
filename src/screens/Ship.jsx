/* ============================================================
   SHIP SCREEN — the sheet, and the fight.

   The sheet mirrors the layout of the book's ship sheet, because
   a player who knows that sheet should be able to read this in
   one glance: modules on the left, derived stats across the top,
   hull with its 25/50/75 marks, then fuel, galley and cargo.

   The 25/50/75 marks are the important bit of the whole screen.
   They are the difference between "we're on 40 hull" and "we're
   one bad round from a Critical Hit we cannot repair out here".
   ============================================================ */
import React, { useState } from "react";
import { Panel, Btn, Label, StatBox, ActionGroup, Tag } from "../ui/kit.jsx";
import {
  derive, MODULES, MODULE_KEYS, SHIP_WEAPONS, shipReport, jumpFuelCost,
} from "../core/index.js";

function HullTrack({ ship }) {
  const d = derive(ship);
  const pct = (ship.hull / d.maxHull) * 100;
  const tone = ship.hull <= d.thresholds.t75 ? "bad" : ship.hull <= d.thresholds.t50 ? "warn" : "";
  const marks = [
    { at: 75, v: d.thresholds.t25, label: "25%", crossed: ship.crossed.t25 },
    { at: 50, v: d.thresholds.t50, label: "50%", crossed: ship.crossed.t50 },
    { at: 25, v: d.thresholds.t75, label: "75%", crossed: ship.crossed.t75 },
  ];
  return (
    <div>
      <div className="bar-label">
        <span>HULL</span>
        <span className="bar-value">{ship.hull}/{d.maxHull}</span>
      </div>
      <div className="hull-track" role="meter" aria-valuenow={ship.hull} aria-valuemin={0}
        aria-valuemax={d.maxHull} aria-label={`Hull ${ship.hull} of ${d.maxHull}`}>
        <div className={`hull-fill ${tone}`} style={{ width: `${Math.max(0, pct)}%` }} />
        {marks.map((m) => (
          <div key={m.label} className={`hull-mark ${m.crossed ? "crossed" : ""}`} style={{ left: `${m.at}%` }}>
            <span>{m.label}</span>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--graphite)", marginTop: 3 }}>
        {ship.crossed.t75 ? "Past 75% lost — field repair is capped and the damage is structural."
          : ship.crossed.t50 ? "Past 50% lost — a starport is the only thing that fixes this properly."
            : ship.crossed.t25 ? "Past 25% lost — field repairs will not take you above that line."
              : "Cross a mark and you roll on the Critical Hit table."}
      </div>
    </div>
  );
}

function ModuleList({ ship }) {
  const live = derive(ship).live;
  return (
    <div>
      {MODULE_KEYS.filter((k) => ship.modules[k] > 0).map((k) => {
        const total = ship.modules[k];
        const alive = live[k];
        return (
          <div className="module-row" key={k} title={MODULES[k].blurb}>
            <span>{MODULES[k].name}</span>
            <span className="pips" aria-label={`${alive} of ${total} working`}>
              {Array.from({ length: Math.min(total, 12) }, (_, i) => (
                <i key={i} className={`pip ${i >= alive ? "dead" : ""}`} />
              ))}
              {total > 12 && <span style={{ fontSize: 9, marginLeft: 4 }}>×{total}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ShipSheet({ core, crewCount = 1, onJump, onRepairRoll }) {
  const ship = core.state.ship;
  /* HOOKS BEFORE THE EARLY RETURN, always.

     This used to sit below the `if (!ship)` return, which means
     the component called one hook on renders where a ship existed
     and none where it did not. React tracks hooks by call order,
     so nothing is wrong while the answer stays the same — and the
     render where it changes is the render that throws.

     That render is "the crew acquired a ship", which is the exact
     moment a campaign gets interesting and the worst available
     moment to lose the screen. It never fired in tests because
     every fixture either has a ship from the start or never gets
     one. Found by `react-hooks/rules-of-hooks`. */
  const [jumpTo, setJumpTo] = useState(1);

  if (!ship) {
    return <Panel title="SHIP"><p className="muted">No ship. You are somebody's cargo.</p></Panel>;
  }
  const d = derive(ship);
  const rep = shipReport(ship, crewCount);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Panel title={ship.name} icons={<Tag>{ship.classLabel}</Tag>}>
        <div className="ship-grid" style={{ marginBottom: 10 }}>
          <StatBox label="COMBAT" value={`${d.combat - (ship.combatPenalty || 0)}`} />
          <StatBox label="INTELLECT" value={`${d.intellect}`} />
          <StatBox label="SPEED" value={`${d.speed}`} hot={d.speed === 0} />
          <StatBox label="ARMOR" value={`${d.armorSave}`} hot={ship.armorBreached} />
          <StatBox label="JUMP" value={`${d.jumpRating}`} />
        </div>

        <HullTrack ship={ship} />

        <div className="ship-grid" style={{ marginTop: 10 }}>
          <StatBox label="FUEL" value={`${ship.fuel}/${d.maxFuel}`} hot={ship.fuel <= 3} />
          <StatBox label="GALLEY" value={`${ship.galleyStock}mo`} hot={!rep.galley.ok} />
          <StatBox label="CARGO" value={`${ship.cargo.length}/${d.maxCargo}`} />
          <StatBox label="CREW CAP" value={`${crewCount}/${d.maxCrew}`} hot={!rep.lifeSupport.ok} />
          <StatBox label="CRYO" value={`${d.cryoPods}`} />
        </div>

        {rep.condition.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <Label>CONDITION</Label>
            <ul className="condition-list">
              {rep.condition.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}

        <div style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 10, color: "var(--graphite)" }}>
          At Speed {d.speed}: interplanetary in {rep.travel.interplanetary}, interstellar in {rep.travel.interstellar}.
        </div>
      </Panel>

      <Panel title="MODULES">
        <ModuleList ship={ship} />
      </Panel>

      <Panel title="WEAPONS">
        {ship.weapons.length === 0 && <p className="muted">Unarmed. Most ships at least carry a cutter for rocks.</p>}
        {ship.weapons.map((w) => {
          const spec = SHIP_WEAPONS[w.key];
          return (
            <div className="module-row" key={w.uid}>
              <span style={{ opacity: w.disabled ? 0.4 : 1 }}>
                {spec.name} <span style={{ color: "var(--graphite)" }}>{spec.dmg}{spec.mdmg ? " MDMG" : " DMG"}</span>
              </span>
              <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {w.disabled && <Tag>WRECKED</Tag>}
                {w.charging > 0 && <Tag>CHARGING</Tag>}
                <span style={{ fontSize: 10 }}>{w.loaded}/{spec.shots}</span>
                {w.loaded < spec.shots && !w.disabled && (
                  <Btn className="tiny" onClick={() => core.do.reload(w.uid)}>LOAD</Btn>
                )}
              </span>
            </div>
          );
        })}
      </Panel>

      <Panel title="OPERATIONS">
        <ActionGroup label="Underway">
          <Btn onClick={() => core.do.burn(1)} hint={`−1 fuel`}>BURN A DAY</Btn>
          <Btn onClick={() => core.do.restock()} disabled={ship.galleyStock >= d.galleyMonths}>RESTOCK GALLEY</Btn>
          <Btn onClick={onRepairRoll} disabled={ship.repairUsed || ship.hull >= d.maxHull}
            hint={ship.repairUsed ? "already tried" : "Intellect Check"}>
            FIELD REPAIR
          </Btn>
        </ActionGroup>

        {d.jumpRating > 0 && (
          <div style={{ marginTop: 8 }}>
            <Label>JUMP</Label>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <input type="range" min={1} max={d.jumpRating} value={jumpTo}
                onChange={(e) => setJumpTo(Number(e.target.value))}
                aria-label="Jump rating" />
              <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                JUMP-{jumpTo} · {jumpFuelCost(jumpTo)} fuel
              </span>
              <Btn kind="primary" disabled={ship.fuel < jumpFuelCost(jumpTo) || ship.navDataWiped}
                onClick={() => (onJump ? onJump(jumpTo) : core.do.jump(jumpTo))}>
                ENGAGE
              </Btn>
            </div>
          </div>
        )}

        {ship.breaches.some((b) => !b.sealed) && (
          <div style={{ marginTop: 8 }}>
            <Label>BREACHES</Label>
            <div className="btn-grid">
              {ship.breaches.map((b, i) => !b.sealed && (
                <Btn key={i} kind="danger" onClick={() => core.do.seal(i)}>SEAL {String(b.room).toUpperCase()}</Btn>
              ))}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ---------------- ship-to-ship combat ---------------- */

export function ShipCombat({ core, gunnerCombat = 0 }) {
  const { ship, fight } = core.state;
  if (!fight || !ship) return null;
  const d = derive(ship);
  const enemy = fight.enemy;
  const spent = fight.actionsLeft <= 0;

  return (
    <Panel title="SHIP-TO-SHIP" icons={<Tag>ROUND {fight.round}</Tag>}>
      <div style={{ display: "flex", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <Label>{ship.name}</Label>
          <div className="hull-track">
            <div className="hull-fill" style={{ width: `${(ship.hull / d.maxHull) * 100}%` }} />
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10 }}>{ship.hull}/{d.maxHull}</div>
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <Label>{enemy.name}</Label>
          <div className="hull-track">
            <div className="hull-fill bad" style={{ width: `${(enemy.hull / enemy.maxHull) * 100}%` }} />
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10 }}>
            {enemy.hull}/{enemy.maxHull} · ARM {enemy.armorSave}% · CMB {enemy.combat}%
          </div>
        </div>
      </div>

      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--graphite)", marginBottom: 8 }}>
        {fight.actionsLeft} of {fight.maxActions} actions left.
        {" "}{d.computerActions} come from the computer; the rest are people at stations.
        {fight.grappled && " YOU ARE RIGGED TO THEM."}
      </div>

      <ActionGroup label="Fire">
        {ship.weapons.map((w) => {
          const spec = SHIP_WEAPONS[w.key];
          const dead = w.disabled || w.loaded <= 0 || w.charging > 0;
          return (
            <Btn key={w.uid} kind="danger" disabled={dead || spent}
              onClick={() => core.dispatch({ type: "FIGHT/FIRE", uid: w.uid, gunnerCombat })}
              hint={`${spec.dmg}${spec.mdmg ? " MDMG" : ""} · ${w.loaded} left`}>
              {spec.name.toUpperCase()}
            </Btn>
          );
        })}
      </ActionGroup>

      <ActionGroup label="Manoeuvre">
        <Btn disabled={spent} onClick={() => core.do.evade()} hint={`Speed ${d.speed}%`}>EVASIVE</Btn>
        <Btn disabled={spent} onClick={() => core.do.hail()}>HAIL THEM</Btn>
        <Btn disabled={spent || fight.grappled} onClick={() => core.do.flee()}>RUN</Btn>
        <Btn disabled={spent} onClick={() => core.dispatch({ type: "FIGHT/REPAIR", stat: 30 })}>PATCH HULL</Btn>
      </ActionGroup>

      <div style={{ marginTop: 8 }}>
        <Btn kind="primary" onClick={() => core.do.endRound()}>
          END ROUND — THEY FIRE
        </Btn>
      </div>
    </Panel>
  );
}

export default ShipSheet;
