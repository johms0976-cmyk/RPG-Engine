/* ============================================================
   SHORE LEAVE — the between-sessions screen.

   Time is the currency. Every crew member gets a schedule, the
   longest schedule sets how many weeks pass, and the Profit Save
   at the end decides how much money survives the port.

   Anything that is this engine's invention rather than a PSG
   rule is tagged HOUSE in the UI, so a Warden can see at a
   glance what they are agreeing to.
   ============================================================ */
import React, { useState } from "react";
import { Panel, Btn, Label, Tag, ActionGroup, Field } from "../ui/kit.jsx";
import { ACTIVITIES, CYBERMODS, profitSaveTarget, derive, MODULES, MODULE_KEYS } from "../core/index.js";

const PORTS = [
  { name: "PROSPERO'S DREAM", quality: "well-equipped", markup: 1, note: "Everything, at a price, immediately." },
  { name: "RATSNEST STATION", quality: "poor", markup: 0.6, note: "Cheap. Repairs take three times as long and might not hold." },
  { name: "COMPANY DOCK 7", quality: "corporate", markup: 1.4, note: "Immaculate. They log everything you buy." },
];

export function ShoreLeave({ core, crew = [], onEnd }) {
  const dt = core.state.downtime;
  const credits = core.state.credits || 0;
  const ship = core.state.ship;
  const [picked, setPicked] = useState(null);
  const [who, setWho] = useState(crew[0] ? crew[0].id : null);
  const [mod, setMod] = useState("neuralLace");
  const [upgradeKey, setUpgradeKey] = useState("armor");

  if (!dt) {
    return (
      <Panel title="SHORE LEAVE">
        <p className="muted">Pick somewhere to dock. Where you tie up changes what it costs and how long it takes.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {PORTS.map((p) => (
            <Btn key={p.name} kind={picked === p.name ? "primary" : "default"}
              onClick={() => setPicked(p.name)} hint={p.note}>
              {p.name} · ×{p.markup} prices
            </Btn>
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <Btn kind="primary" disabled={!picked}
            onClick={() => core.do.begin(PORTS.find((p) => p.name === picked))}>
            DOCK
          </Btn>
        </div>
      </Panel>
    );
  }

  const plans = dt.plans || {};
  const nameOf = (id) => (crew.find((c) => c.id === id) || {}).name || id;
  const profitTarget = profitSaveTarget({
    weeks: dt.weeks,
    addictions: core.state.addictionCount || 0,
    credits,
    savvy: core.state.savvy,
  });

  const schedule = (activity, opts) => core.do.schedule(who, activity, opts || {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Panel title={dt.port.name}
        icons={<><Tag>{dt.weeks}W</Tag><Tag>{credits.toLocaleString()}cr</Tag></>}>
        <p className="muted" style={{ fontSize: 11 }}>
          {dt.port.note || ""} Prices ×{dt.port.markup}. The longest single schedule decides how long you are all here.
        </p>

        <Field label="WHO">
          <select value={who || ""} onChange={(e) => setWho(e.target.value)}>
            {crew.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>

        <ActionGroup label="Book time">
          {["rest", "therapy", "carouse", "work"].map((k) => (
            <Btn key={k} onClick={() => schedule(k)}
              hint={`${ACTIVITIES[k].weeks}w · ${Math.round(ACTIVITIES[k].cost * dt.port.markup).toLocaleString()}cr`}>
              {ACTIVITIES[k].name.toUpperCase()}
            </Btn>
          ))}
        </ActionGroup>

        <div style={{ marginTop: 10 }}>
          <Label>CYBERMODS <span className="house-tag">house</span></Label>
          <select value={mod} onChange={(e) => setMod(e.target.value)} style={{ width: "100%" }}>
            {Object.entries(CYBERMODS).map(([k, m]) => (
              <option key={k} value={k}>{m.name} — {m.cost.toLocaleString()}cr, {m.weeks}w</option>
            ))}
          </select>
          <p style={{ fontFamily: "var(--mono)", fontSize: 10.5, margin: "5px 0" }}>
            {CYBERMODS[mod].blurb}
            <br />
            <span style={{ color: "var(--blood)" }}>{CYBERMODS[mod].risk}</span>
          </p>
          <Btn disabled={credits < CYBERMODS[mod].cost * dt.port.markup}
            onClick={() => {
              const pc = crew.find((c) => c.id === who);
              schedule("cybermod", { cybermod: mod, bodySave: pc ? pc.saves.body : 25 });
            }}>
            BOOK SURGERY
          </Btn>
        </div>
      </Panel>

      <Panel title="THE SCHEDULE">
        {Object.keys(plans).every((k) => !plans[k] || !plans[k].length) && (
          <p className="muted">Nothing booked. You could just sit in the ship, but that is not rest.</p>
        )}
        {Object.entries(plans).map(([pcId, list]) => (
          list && list.length > 0 && (
            <div key={pcId} style={{ marginBottom: 8 }}>
              <Label>{nameOf(pcId)}</Label>
              {list.map((e, i) => (
                <div className="plan-row" key={i}>
                  <span>
                    {ACTIVITIES[e.activity].name}
                    {e.opts.cybermod && ` — ${CYBERMODS[e.opts.cybermod].name}`}
                  </span>
                  <span>
                    {e.weeks}w · {e.cost.toLocaleString()}cr
                    {!dt.resolved && (
                      <Btn className="tiny" onClick={() => core.do.unschedule(pcId, i)} aria-label="Remove">×</Btn>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )
        ))}

        <div style={{ fontFamily: "var(--mono)", fontSize: 11, marginTop: 6 }}>
          {dt.weeks} week{dt.weeks === 1 ? "" : "s"} · {dt.spent.toLocaleString()}cr committed
          {dt.spent > credits && <span style={{ color: "var(--blood)" }}> — you cannot pay for this</span>}
        </div>

        {!dt.resolved && (
          <div style={{ marginTop: 8 }}>
            <Btn kind="primary" disabled={dt.spent > credits || dt.weeks === 0}
              onClick={() => { core.do.credits(-dt.spent); core.do.resolve(); }}>
              LET THE TIME PASS
            </Btn>
          </div>
        )}
      </Panel>

      {ship && (
        <Panel title="THE YARD">
          <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, marginBottom: 6 }}>
            Repairs: 100,000cr and a day per hull. Upgrades: 10 million and a week per 10 hull.
            A port repair clears the 25/50/75 damage locks and every knocked-out module.
          </div>
          <ActionGroup label="Repair">
            {[10, 25, 50].map((n) => (
              <Btn key={n} onClick={() => core.do.portRepair(n)}
                disabled={ship.hull >= derive(ship).maxHull}
                hint={`${(n * 100000).toLocaleString()}cr`}>
                +{n} HULL
              </Btn>
            ))}
            <Btn onClick={() => core.do.refuel(999)} hint="10,000cr/unit at most ports">REFUEL</Btn>
          </ActionGroup>

          <div style={{ marginTop: 8 }}>
            <Label>UPGRADE</Label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <select value={upgradeKey} onChange={(e) => setUpgradeKey(e.target.value)}>
                {MODULE_KEYS.filter((k) => !MODULES[k].derived).map((k) => (
                  <option key={k} value={k}>{MODULES[k].name}</option>
                ))}
              </select>
              <Btn onClick={() => core.do.portUpgrade(upgradeKey, 1)}>FIT ONE</Btn>
            </div>
            <p style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--graphite)", marginTop: 4 }}>
              {MODULES[upgradeKey].blurb}
            </p>
          </div>
        </Panel>
      )}

      <Panel title="CASTING OFF">
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, marginBottom: 8 }}>
          PROFIT SAVE <b>{profitTarget}%</b> <span className="house-tag">house</span>
          <br />
          <span style={{ color: "var(--graphite)", fontSize: 10 }}>
            Roll under to leave with what you came in with. Long stays, addictions and
            large amounts of cash on your person all make it worse.
          </span>
        </div>
        <div className="btn-grid">
          <Btn onClick={() => core.do.profitSave()}>ROLL PROFIT SAVE</Btn>
          <Btn kind="primary" onClick={() => { core.do.end(); if (onEnd) onEnd(); }}>
            UNDOCK
          </Btn>
        </div>
      </Panel>
    </div>
  );
}

export default ShoreLeave;
