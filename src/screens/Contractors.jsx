/* ============================================================
   CONTRACTORS — the hiring hall and the roster.

   Two halves. The market, where you pick a role, agree terms and
   make the Intellect Check; and the roster, where the people you
   hired sit and quietly accrue reasons to leave.

   The roster deliberately shows what they are OWED. That number
   is the entire drama of the subsystem: an unpaid contractor
   takes a −10 on their Loyalty Save, and a dead unpaid one
   leaves a debt to a next-of-kin who will find you.
   ============================================================ */
import React, { useState } from "react";
import { Panel, Btn, Label, Tag, ActionGroup, Field } from "../ui/kit.jsx";
import { MERC_ROLES, ROLE_KEYS, NEGOTIATION_TERMS, negotiationMod } from "../core/index.js";

function Hits({ merc }) {
  return (
    <span className="hits" aria-label={`${merc.hits} of ${merc.maxHits} hits left`}>
      {Array.from({ length: merc.maxHits }, (_, i) => (
        <i key={i} className={i >= merc.hits ? "gone" : ""} />
      ))}
    </span>
  );
}

function MercCard({ merc, onLoyalty, onDismiss, onOrders }) {
  return (
    <div className={`merc-card ${merc.orders === "self" ? "disloyal" : ""}`}>
      <header>
        <span className="merc-name">{merc.name}</span>
        <span className="merc-role">{merc.roleName}</span>
      </header>

      <div className="merc-stats">
        <span>HITS <Hits merc={merc} /></span>
        <span>CMB <b>{merc.combat}</b></span>
        <span>INST <b>{merc.instinct}</b></span>
        <span>LOY <b>{merc.loyalty}</b></span>
        {merc.xp > 0 && <span>XP <b>{merc.xp}</b></span>}
      </div>

      {merc.skills.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {merc.skills.map((s) => <Tag key={s}>{s}</Tag>)}
        </div>
      )}

      {merc.scumNote && (
        <p style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--blood)", margin: 0 }}>
          {merc.scumNote}
        </p>
      )}

      {merc.motivationRevealed && (
        <p style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--blood)", margin: 0 }}>
          {merc.motivation.text}
        </p>
      )}

      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: merc.owed > 0 ? "var(--blood)" : "var(--graphite)" }}>
        {merc.salary.toLocaleString()}cr/month
        {merc.owed > 0 && ` · OWED ${merc.owed.toLocaleString()}cr`}
        {merc.orders === "self" && " · NOT TAKING ORDERS"}
      </div>

      {merc.alive ? (
        <div className="btn-grid">
          <Btn className="tiny" onClick={() => onLoyalty(merc.id)}>LOYALTY SAVE</Btn>
          <Btn className="tiny" onClick={() => onOrders(merc.id, merc.orders === "hold" ? "follow" : "hold")}>
            {merc.orders === "hold" ? "FOLLOW" : "HOLD POSITION"}
          </Btn>
          <Btn className="tiny" kind="danger" onClick={() => onDismiss(merc.id)}>DISMISS</Btn>
        </div>
      ) : (
        <Tag>KILLED IN SERVICE</Tag>
      )}
    </div>
  );
}

export function Contractors({ core, negotiatorIntellect = 30, onClose }) {
  const { hirelings = [], candidate, credits = 0 } = core.state;
  const [role, setRole] = useState("marineGrunt");
  const [terms, setTerms] = useState(["monthPlus"]);

  const toggle = (id) =>
    setTerms((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  const spec = role === "scum" ? null : MERC_ROLES[role];
  const mod = negotiationMod(terms);
  const target = Math.max(1, Math.min(99, negotiatorIntellect + mod));

  const offer = () => {
    core.do.context({ negotiatorIntellect });
    core.do.offer(role, terms);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Panel title="HIRING HALL" icons={<Tag>{credits.toLocaleString()}cr</Tag>}>
        <p className="muted" style={{ fontSize: 11 }}>
          Broke and hungry people looking for work or a ride. Many of them are cutthroat
          and disloyal, and will leave you exactly when it costs you most.
        </p>

        <Field label="ROLE">
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLE_KEYS.map((k) => (
              <option key={k} value={k}>
                {MERC_ROLES[k].name} — {MERC_ROLES[k].advance}cr / {MERC_ROLES[k].salary}cr mo
              </option>
            ))}
            <option value="scum">Whoever is left (Scum) — 100cr / 200cr mo</option>
          </select>
        </Field>

        {spec && (
          <div className="merc-stats" style={{ margin: "6px 0" }}>
            <span>HITS <b>{spec.hits}</b></span>
            <span>CMB <b>{spec.combat}</b></span>
            <span>INST <b>{spec.instinct}</b></span>
            <span>LOY <b>{spec.loyalty}</b></span>
            {spec.skills.map((s) => <Tag key={s}>{s}</Tag>)}
          </div>
        )}

        <Label>TERMS</Label>
        <div className="btn-grid">
          {NEGOTIATION_TERMS.map((t) => (
            <Btn key={t.id} className={terms.includes(t.id) ? "on" : ""}
              kind={terms.includes(t.id) ? "primary" : "default"}
              onClick={() => toggle(t.id)}
              hint={`${t.mod > 0 ? "+" : ""}${t.mod}`}>
              {t.label}
            </Btn>
          ))}
        </div>

        <div style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 11 }}>
          Intellect {negotiatorIntellect}{mod ? (mod > 0 ? ` +${mod}` : ` ${mod}`) : ""} = <b>{target}%</b> to close.
        </div>

        <div style={{ marginTop: 8 }}>
          <Btn kind="primary" onClick={offer}>PUT AN OFFER OUT</Btn>
        </div>

        {candidate && (
          <div style={{ marginTop: 10 }}>
            <Label>THEY ACCEPTED</Label>
            <MercCard merc={candidate} onLoyalty={() => {}} onDismiss={() => {}} onOrders={() => {}} />
            <div className="btn-grid" style={{ marginTop: 6 }}>
              <Btn kind="primary" disabled={credits < candidate.advance}
                onClick={() => { core.do.credits(-candidate.advance); core.do.hire(candidate); }}>
                PAY {candidate.advance.toLocaleString()}cr ADVANCE
              </Btn>
              <Btn onClick={() => core.do.context({ candidate: null })}>WALK AWAY</Btn>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="ROSTER" icons={<Tag>{hirelings.filter((m) => m.alive).length} ABOARD</Tag>}>
        {hirelings.length === 0 && <p className="muted">Nobody. It is just the crew.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {hirelings.map((m) => (
            <MercCard key={m.id} merc={m}
              onLoyalty={(id) => core.do.loyaltyCheck(id, "the situation")}
              onDismiss={(id) => core.do.dismiss(id, m.owed === 0)}
              onOrders={(id, o) => core.do.orders(id, o)} />
          ))}
        </div>

        {hirelings.some((m) => m.alive) && (
          <ActionGroup label="Payroll">
            <Btn onClick={() => core.do.paySalaries(1)}
              hint={`${hirelings.filter((m) => m.alive).reduce((n, m) => n + m.salary, 0).toLocaleString()}cr`}>
              PAY A MONTH
            </Btn>
            <Btn onClick={() => core.do.awardXp(1)} hint="1 XP for surviving">AWARD XP</Btn>
          </ActionGroup>
        )}

        <p className="muted" style={{ fontSize: 10, marginTop: 8 }}>
          Contractors act last in the turn order and only take orders from whoever hired them.
        </p>
      </Panel>

      {onClose && <Btn onClick={onClose}>BACK</Btn>}
    </div>
  );
}

export default Contractors;
