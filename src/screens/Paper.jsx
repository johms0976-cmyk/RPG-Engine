/* ============================================================
   PAPER MODE, ON SCREEN.

   A layout whose real target is a sheet of A4 and whose on-screen
   form is a preview of it. Almost all of the interesting work is
   in `ui/paper.css` under `@media print`; this file's job is to
   put the author's own words in an order somebody can run a
   session from, and to stay out of the way of the printer.

   THE SCREEN IS THE PREVIEW, NOT THE OTHER WAY ROUND. Anything
   that cannot be printed — a control, a collapsed section, a
   tooltip — is a thing that is on the page in one medium and not
   the other, and the whole point of this surface is that the two
   agree. So there are exactly four controls, they live in a bar
   that `@media print` deletes, and everything below it is the
   document.
   ============================================================ */
import React, { useMemo, useState } from "react";
import { Btn } from "../ui/kit.jsx";
import { paperPack, paperMarkdown, paperFilename, blankSheet } from "../engine/paper.js";
import { downloadText } from "../engine/storage.js";
import { STAT_KEYS, SAVE_KEYS } from "../engine/rules.js";
import "../ui/paper.css";

/** What goes in the folder. All four default on: a Warden who
    presses print without reading this bar should get the whole
    module rather than a third of it. */
const PARTS = [
  ["module", "The module"],
  ["cast", "Cast and threats"],
  ["props", "Handouts and tables"],
  ["sheets", "Blank character sheets"],
];

export default function Paper({ mod, w = null, onBack }) {
  const pack = useMemo(() => paperPack(mod, w), [mod, w]);
  const [on, setOn] = useState(() => Object.fromEntries(PARTS.map(([k]) => [k, true])));
  const [sheets, setSheets] = useState(pack.card.crewSize.suggested || 4);
  const sheet = useMemo(() => blankSheet({ stats: STAT_KEYS, saves: SAVE_KEYS }), []);

  return (
    <div className="paper">
      <div className="paper-bar">
        <Btn kind="accent" className="inline" onClick={() => window.print()}>Print</Btn>
        <Btn kind="ghost" className="inline"
          onClick={() => downloadText(paperFilename(mod), paperMarkdown(pack), "text/markdown")}>
          Save as markdown
        </Btn>
        {PARTS.map(([k, label]) => (
          <label key={k} className="paper-check">
            <input type="checkbox" checked={!!on[k]}
              onChange={(e) => setOn((o) => ({ ...o, [k]: e.target.checked }))} />
            <span>{label}</span>
          </label>
        ))}
        {on.sheets && (
          <label className="paper-check">
            <span>×</span>
            <input type="number" min={0} max={12} value={sheets} aria-label="How many sheets"
              onChange={(e) => setSheets(Math.max(0, Math.min(12, Number(e.target.value) || 0)))} />
          </label>
        )}
        <Btn kind="ghost" className="inline" onClick={onBack}>Back</Btn>
      </div>

      <article className="paper-doc">
        <header className="paper-head">
          <h1>{pack.card.title}</h1>
          {pack.card.subtitle && <p className="paper-sub">{pack.card.subtitle}</p>}
          {pack.card.byline && <p className="paper-by">{pack.card.byline}</p>}
          {pack.card.blurb && <p className="paper-blurb">{pack.card.blurb}</p>}
          <p className="paper-meta">
            {`${pack.card.rooms} locations · crew of ${pack.card.crewSize.min}–${pack.card.crewSize.max}`
              + `${pack.card.length ? ` · ${pack.card.length}` : ""}`}
          </p>
          {/* Above the fold on the first page, on purpose. A content
              warning somebody finds on page nine has not warned them. */}
          {pack.card.contentWarning && (
            <p className="paper-warn"><strong>Content warning.</strong> {pack.card.contentWarning}</p>
          )}
        </header>

        {on.module && (
          <>
            {(pack.running.setting || pack.running.constraints.length > 0) && (
              <section className="paper-section">
                <h2>Running it</h2>
                {pack.running.setting && <p>{pack.running.setting}</p>}
                {pack.running.voice && <p><strong>Voice.</strong> {pack.running.voice}</p>}
                {pack.running.constraints.length > 0 && (
                  <ul>{pack.running.constraints.map((c, i) => <li key={i}>{c}</li>)}</ul>
                )}
                {pack.running.npcNote && <p>{pack.running.npcNote}</p>}
              </section>
            )}

            {pack.running.intro.length > 0 && (
              <section className="paper-section">
                <h2>Read this out first</h2>
                {pack.running.intro.map((line, i) => <p key={i} className="paper-read">{line}</p>)}
              </section>
            )}

            <section className="paper-section">
              <h2>Rooms</h2>
              {pack.rooms.map((r) => <RoomBlock key={r.id} room={r} />)}
            </section>

            {pack.items.length > 0 && (
              <section className="paper-section">
                <h2>What is out there to find</h2>
                <ul>
                  {pack.items.map((i) => (
                    <li key={i.id}><strong>{i.name}.</strong> {i.text}</li>
                  ))}
                </ul>
              </section>
            )}

            {pack.flags.length > 0 && (
              <section className="paper-section paper-flags">
                <h2>Flags</h2>
                {/* The nearest thing a module has to a state machine, and
                    the thing hardest to hold in your head off a screen. */}
                <ul>
                  {pack.flags.map((f) => (
                    <li key={f.id}>
                      <code>{f.id}</code>
                      {f.fired ? " — set" : ""}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {on.cast && pack.cast.length > 0 && (
          <section className="paper-section">
            <h2>Cast</h2>
            {pack.cast.map((c) => (
              <div key={c.id} className="paper-npc">
                <h3>{c.name}{c.role ? ` — ${c.role}` : ""}</h3>
                {c.brief && <p>{c.brief}</p>}
                {c.note && <p className="paper-note">{c.note}</p>}
                {c.knows.length > 0 && (
                  <>
                    {/* Stated once per module rather than left implied.
                        `knows` is simultaneously the script and the
                        ceiling, and a Warden reading it off paper has no
                        tooltip to tell them so. */}
                    <p className="paper-note">Everything they can say:</p>
                    <ul>
                      {c.knows.map((k) => (
                        <li key={k.i} className={k.told ? "is-told" : ""}>{k.text}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ))}
          </section>
        )}

        {on.cast && pack.threats.length > 0 && (
          <section className="paper-section">
            <h2>Threats</h2>
            {pack.threats.map((t) => (
              <div key={t.id} className="paper-threat">
                <h3>{t.name}</h3>
                <p className="paper-stats">
                  {`Combat ${t.combat ?? "—"} · Speed ${t.speed ?? "—"} · ${t.maxHits ?? "—"} hits`
                    + `${t.unseen ? " · unseen" : ""}`}
                </p>
                {t.note && <p>{t.note}</p>}
                <ul>
                  {t.attacks.map((a, i) => (
                    <li key={i}><strong>{a.name} ({a.dmg}).</strong> {a.text}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        {on.props && pack.handouts.length > 0 && (
          <section className="paper-section">
            <h2>Handouts</h2>
            {/* One per page. A handout is a prop — it is cut out and put
                on the table, and a page with three on it is a page you
                cannot hand anybody. */}
            {pack.handouts.map((ho) => (
              <div key={ho.id} className="paper-handout">
                <div className="paper-handout-label">{ho.label}</div>
                <p>{ho.text}</p>
              </div>
            ))}
          </section>
        )}

        {on.props && pack.tables.length > 0 && (
          <section className="paper-section">
            <h2>Tables</h2>
            {pack.tables.map((t) => (
              <div key={t.id} className="paper-table">
                <h3>{t.name}{t.die ? ` · ${t.die}` : ""}</h3>
                <ul>
                  {t.entries.map((e, i) => (
                    <li key={i}>{e.range ? `${e.range} — ` : ""}{e.text}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        {on.module && pack.endings.length > 0 && (
          <section className="paper-section">
            <h2>Endings</h2>
            {pack.endings.map((e) => (
              <div key={e.id} className="paper-ending">
                <h3>{e.title} <code>@{e.id}</code></h3>
                {e.text && <p className="paper-read">{e.text}</p>}
              </div>
            ))}
          </section>
        )}

        {on.sheets && Array.from({ length: sheets }, (_, i) => (
          <Sheet key={i} sheet={sheet} />
        ))}
      </article>
    </div>
  );
}

function RoomBlock({ room }) {
  return (
    <div className="paper-room">
      <h3>
        {room.n ? `${room.n}. ` : ""}{room.name}
        {room.start && <span className="paper-tag">START</span>}
        {room.tags.map((t) => <span key={t} className="paper-tag">{t}</span>)}
      </h3>
      {room.look && <p className="paper-read">{room.look}</p>}

      {room.exits.length > 0 && (
        <ul className="paper-exits">
          {room.exits.map((e, i) => (
            <li key={i}>
              <strong>{e.label}</strong>
              <span className="paper-note">
                {` → ${e.to}${e.mins ? ` · ${e.mins}m` : ""}`}
                {e.gate ? ` · locked (${e.gate.flag})${e.gate.roll ? ` · ${e.gate.roll}` : ""}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      {room.features.length > 0 && (
        <ul className="paper-features">
          {room.features.map((f) => (
            <li key={f.key} className={f.done ? "is-done" : ""}>
              <strong>{f.name}.</strong> {f.text}
              {(f.gives.length > 0 || f.beats.length > 0 || f.deep) && (
                <span className="paper-note">
                  {` (${[
                    f.deep ? "takes a proper search" : null,
                    f.gives.length ? `gives ${f.gives.join(", ")}` : null,
                    f.beats.length ? f.beats.join(", ") : null,
                  ].filter(Boolean).join(" · ")})`}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {room.actions.length > 0 && (
        <ul className="paper-features">
          {room.actions.map((a, i) => (
            <li key={i}>
              <strong>{a.label}</strong>
              {a.beats.length > 0 && <span className="paper-note"> ({a.beats.join(" · ")})</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Blank, and it stays blank. A sheet with numbers on it is a pregen,
    and a table who wanted pregens can print a finished crew instead. */
function Sheet({ sheet }) {
  const lines = (n) => Array.from({ length: n }, (_, i) => <span key={i} className="paper-line" />);
  return (
    <section className="paper-sheet">
      <h2>Character</h2>
      <div className="paper-sheet-grid">
        {sheet.rows.identity.map((label) => (
          <label key={label} className="paper-field"><span>{label}</span><i /></label>
        ))}
      </div>

      <div className="paper-boxes">
        {sheet.stats.map((s) => (
          <div key={s.key} className="paper-box"><span>{s.label}</span><i /></div>
        ))}
      </div>
      <div className="paper-boxes">
        {sheet.saves.map((s) => (
          <div key={s.key} className="paper-box"><span>{s.label} SAVE</span><i /></div>
        ))}
      </div>

      <div className="paper-sheet-grid">
        {sheet.rows.condition.map((label) => (
          <label key={label} className="paper-field"><span>{label}</span><i /></label>
        ))}
        {sheet.rows.kit.map((label) => (
          <label key={label} className="paper-field"><span>{label}</span><i /></label>
        ))}
      </div>

      <h3>Skills</h3>
      <div className="paper-lines">{lines(sheet.lined.skills)}</div>
      <h3>Carrying</h3>
      <div className="paper-lines">{lines(sheet.lined.gear)}</div>
      <h3>Conditions</h3>
      <div className="paper-lines">{lines(sheet.lined.conditions)}</div>
      <h3>Notes</h3>
      <div className="paper-lines">{lines(sheet.lined.notes)}</div>
    </section>
  );
}
