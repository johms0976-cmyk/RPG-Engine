/* ============================================================
   PROPS — handouts as objects, and who is allowed to see them.

   Two things were missing from the old props tab.

   IMAGES. Mothership lives on greasy printouts: station
   schematics, crew manifests, the frame the camera caught. The
   engine could put text in the middle of the table and nothing
   else, so every module's most evocative material had to be
   described rather than shown. A handout may now carry an `img`
   (a URL, a data URI, or a file the Warden drops in at the
   table) and the whole existing plumbing — the rack, the
   fullscreen prop, the read-by ledger — carries it unchanged.

   ADDRESSING. "Show this to Riley and Chi only." Two players
   knowing something the table does not is a scene generator, and
   it is the exact thing a physical handout does when you slide
   it across to two people. Targeted handouts are addressed feed
   lines, so secrets.js keeps the text off everybody else's phone
   rather than asking their client not to render it.

   ------------------------------------------------------------
   AND WHY RULINGS LIVE ON THIS TAB

   A ruling is not obviously a prop, and putting it here was not
   the first instinct. It earns the place because it shares the
   thing this tab is actually about, which is not paper: it is
   *a fact, given to some subset of the people at the table*. The
   handout addressing and the ruling addressing are the same
   mechanism reaching the same `secrets.js` check, and a Warden
   who has learned "show it to some of them" here has already
   learned "tell it to some of them".

   It goes above the handout rack rather than below it, and above
   the empty-rack early return, because a module with no handouts
   is exactly the module whose Warden is improvising most.
   ============================================================ */
import React, { useState, useRef } from "react";
import { Btn, Label, Field } from "../../ui/kit.jsx";
import RulingBox from "./RulingBox.jsx";

export default function PropsTab({ g }) {
  const { mod, w, crew, warden } = g;
  const ids = Object.keys(mod.handouts || {});
  const seen = w.handouts || {};
  const targets = w.handoutTargets || {};
  const [picking, setPicking] = useState(null);      // handout id being addressed
  const [chosen, setChosen] = useState([]);          // pcIds
  const [dropped, setDropped] = useState({});        // id -> data URL, this session only
  const fileRef = useRef(null);
  const [dropFor, setDropFor] = useState(null);

  if (!ids.length) {
    return (
      <div className="stack">
        <RulingBox g={g} />
        <p className="clue-meta" style={{ margin: 0 }}>This module has no handouts.</p>
      </div>
    );
  }

  const toggle = (pcId) =>
    setChosen((c) => (c.includes(pcId) ? c.filter((x) => x !== pcId) : [...c, pcId]));

  const pickImage = (id) => { setDropFor(id); if (fileRef.current) fileRef.current.click(); };

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f || !dropFor) return;
    const r = new FileReader();
    r.onload = () => {
      // Held for this session only. It is not written into the module
      // and not saved — a picture the Warden pulled off their desktop
      // mid-scene should not silently become part of the cartridge.
      setDropped((d) => ({ ...d, [dropFor]: r.result }));
      if (mod.handouts[dropFor]) mod.handouts[dropFor].img = r.result;
      setDropFor(null);
    };
    r.readAsDataURL(f);
    e.target.value = "";
  };

  return (
    <div className="stack">
      <RulingBox g={g} />

      <Label>HANDOUTS</Label>
      <p className="clue-meta" style={{ margin: 0 }}>
        Who has read what, what is in the middle of the table, and who it is
        being held up to.
      </p>

      <input ref={fileRef} type="file" accept="image/*" onChange={onFile}
        style={{ display: "none" }} aria-hidden="true" tabIndex={-1} />

      <div className="clues">
        {ids.map((id) => {
          const h = mod.handouts[id];
          const s = seen[id];
          const readers = s
            ? s.by.map((pid) => (crew.find((c) => c.id === pid) || {}).name).filter(Boolean)
            : [];
          const onTable = w.tableHandout === id;
          const only = targets[id] || null;
          const img = h.img || dropped[id];

          return (
            <div key={id} className={`clue${s ? "" : " is-resolved"}`} style={{ display: "block" }}>
              <span className="clue-kind">{s ? "found" : "not yet"}</span>
              <div className="clue-text" style={{ margin: "4px 0" }}>{h.label}</div>

              {img && (
                <img src={img} alt="" className="prop-thumb" />
              )}

              <div className="clue-meta">
                {readers.length ? `read by ${readers.join(", ")}` : "nobody has seen it"}
                {only && ` · addressed to ${only.map((p) => (crew.find((c) => c.id === p) || {}).name).filter(Boolean).join(", ")}`}
              </div>

              <div className="btn-row" style={{ marginTop: 6 }}>
                <Btn kind={onTable && !only ? "accent" : "ghost"} className="inline small"
                  onClick={() => warden.showHandout(onTable ? null : id)}>
                  {onTable ? "Take it off the table" : "Put it on the table"}
                </Btn>
                <Btn kind={picking === id ? "accent" : "ghost"} className="inline small"
                  onClick={() => { setPicking(picking === id ? null : id); setChosen(only || []); }}>
                  Show it to some of them
                </Btn>
                <Btn kind="ghost" className="inline small" onClick={() => pickImage(id)}>
                  {img ? "Change the picture" : "Add a picture"}
                </Btn>
              </div>

              {picking === id && (
                <div className="stack" style={{ marginTop: 8 }}>
                  <Label>WHO GETS TO SEE IT</Label>
                  <div className="btn-row">
                    {crew.filter((c) => c.alive !== false).map((c) => (
                      <Btn key={c.id} kind={chosen.includes(c.id) ? "accent" : "ghost"}
                        className="inline small" onClick={() => toggle(c.id)}>
                        {c.name}
                      </Btn>
                    ))}
                  </div>
                  <div className="btn-row">
                    <Btn kind="solid" className="inline small" disabled={!chosen.length}
                      onClick={() => { warden.showTo(id, chosen); setPicking(null); }}>
                      Slide it across
                    </Btn>
                    <Btn kind="ghost" className="inline small"
                      onClick={() => { setPicking(null); setChosen([]); }}>
                      Never mind
                    </Btn>
                  </div>
                  <p className="clue-meta" style={{ margin: 0 }}>
                    The text is only sent to those phones. Everyone else does not
                    receive it at all, so there is nothing on their handset to find.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
