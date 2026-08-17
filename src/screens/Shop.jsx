import React, { useState } from "react";
import { Panel, Btn, Label, Modal, Field } from "../ui/kit.jsx";
import { catalogue } from "../engine/gear.js";

const RESALE = 0.4;

export default function Shop({ g, shopId, onClose }) {
  const { mod, pc, items, buy, sell } = g;
  const shop = mod.shops[shopId] || { name: "REQUISITION", markup: 1 };
  const [tab, setTab] = useState("buy");
  const [filter, setFilter] = useState("");

  const stock = (shop.stock ? shop.stock.map((id) => ({ id, ...items[id] })).filter((x) => x.n) : catalogue(items))
    .filter((x) => !filter || x.n.toLowerCase().includes(filter.toLowerCase()));

  const price = (it) => Math.round((it.cost || 0) * (shop.markup ?? 1));

  return (
    <Modal title={shop.name} onClose={onClose}>
      <Panel title={shop.name} icons={`${pc.credits}cr`} dark>
        <div className="stack">
          {shop.blurb && <div className="note-box">{shop.blurb}</div>}

          <div className="btn-row">
            <Btn kind={tab === "buy" ? "accent" : "ghost"} className="inline small" onClick={() => setTab("buy")}>Buy</Btn>
            <Btn kind={tab === "sell" ? "accent" : "ghost"} className="inline small" onClick={() => setTab("sell")}>Sell</Btn>
          </div>

          {tab === "buy" ? (
            <>
              <Field label="Filter">
                <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="rifle, suit, med…" />
              </Field>
              <div className="btn-grid" style={{ maxHeight: 340, overflowY: "auto" }}>
                {stock.map((it) => {
                  const p = price(it);
                  const owned = pc.items.includes(it.id);
                  return (
                    <Btn key={it.id} disabled={owned || pc.credits < p} onClick={() => buy(it.id, p)}
                      hint={owned ? "already carried" : `${p}cr`} title={it.d}>
                      {it.n}
                    </Btn>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="btn-grid" style={{ maxHeight: 340, overflowY: "auto" }}>
              {pc.items.filter((id) => items[id] && items[id].cost).map((id) => {
                const p = Math.round(items[id].cost * RESALE);
                return (
                  <Btn key={id} onClick={() => sell(id, p)} hint={`${p}cr`} title={items[id].d}>
                    {items[id].n}
                  </Btn>
                );
              })}
            </div>
          )}

          <div className="note-box">
            Anything sells back at {Math.round(RESALE * 100)}% of list. Ammunition comes with the
            weapon; a reload is included in the price.
          </div>
          <Btn kind="ghost" onClick={onClose}>Done</Btn>
        </div>
      </Panel>
    </Modal>
  );
}
