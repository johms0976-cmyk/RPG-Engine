/* ============================================================
   JOIN — the first thing a phone sees. Name, then pick a body.
   ============================================================ */
import React, { useEffect, useState } from "react";
import { Panel, Btn, Field } from "../ui/kit.jsx";

/* ============================================================
   WHAT THE TABLE IS PLAYING, BEFORE ANYBODY COMMITS TO IT.

   A player picked up a phone and saw a list of names to claim
   before they saw what the game was. Every module already ships
   the two things that answer it — a title with a blurb, and a
   `contentWarning` written specifically so a table can agree what
   it is in for — and neither had ever reached a handset.

   That is backwards for a horror game. The warning exists to be
   read *before* consent, and claiming a character is the consent.
   So it goes at the top of the first screen with the module's
   name on it, and it stays on the claim screen, because the
   person who picks up the sixth phone twenty minutes late has
   not read anything.

   It is not a modal and it does not need dismissing. A wall a
   player has to click through is a wall a player clicks through.
   ============================================================ */
function Masthead({ mod, compact }) {
  if (!mod) return null;
  return (
    <div className="join-masthead">
      <div className="join-masthead-title">{mod.title}</div>
      {mod.subtitle && <div className="join-masthead-sub">{mod.subtitle}</div>}
      {!compact && mod.blurb && <p className="join-masthead-blurb">{mod.blurb}</p>}
      {mod.contentWarning && (
        <p className="join-masthead-cw">
          <strong>Content:</strong> {mod.contentWarning}
        </p>
      )}
      {!compact && (
        <p className="clue-meta" style={{ margin: "6px 0 0" }}>
          Anyone at this table can stop or veil any of it at any point, without
          saying why — the card is on every screen, and it arrives anonymously.
        </p>
      )}
    </div>
  );
}

/* ============================================================
   HOW LONG WE HAVE BEEN CONNECTED TO NOTHING IN PARTICULAR.

   A phone that has an open socket and has never received a
   snapshot is in a state the join screen had no words for. It
   said "Connected. The Warden hasn't opened the table yet",
   which is a guess, and when the guess is wrong — because the
   Warden's own screen was refused by the relay and is sitting
   there saying "no phones connected" — both ends of the table
   are being told the other end is fine.

   The relay cannot tell us directly without a protocol change,
   but it does not need to: a host that is attached broadcasts a
   snapshot on connect and on every change, so silence past a
   few seconds is the answer. Six seconds is long enough to
   cover a slow first paint and short enough that nobody has
   started reloading yet.
   ============================================================ */
const QUIET_S = 6;

function useQuietSeconds(active) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!active) { setSecs(0); return undefined; }
    const from = Date.now();
    const t = setInterval(() => setSecs(Math.floor((Date.now() - from) / 1000)), 1000);
    return () => clearInterval(t);
  }, [active]);
  return secs;
}

export default function Join({
  snapshot, mod, peers, myName, onName, onClaim, onLocker, onBuild, status, phase, claiming, myPcId,
}) {
  const [draft, setDraft] = useState(myName || "");
  const state = snapshot && snapshot.state;
  const crew = (state && state.crew) || [];
  const lobby = (snapshot && snapshot.lobby) || [];
  const taken = Object.fromEntries((peers || []).filter((p) => p.pcId).map((p) => [p.pcId, p.name]));

  /* Socket open, nothing ever arrived. Hooks run unconditionally, so
     this sits above the early returns rather than inside the branch
     that uses it. */
  const quiet = useQuietSeconds(status === "open" && !snapshot);
  const noWarden = quiet >= QUIET_S;

  if (!myName) {
    return (
      <div className="join">
        <Panel title="Join the table">
          <Masthead mod={mod} />
          <Field label="Your name">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={24}
              placeholder="Sam"
              autoFocus
            />
          </Field>
          <Btn kind="primary" disabled={!draft.trim()} onClick={() => onName(draft.trim())}>
            Continue
          </Btn>
        </Panel>
      </div>
    );
  }

  /* No crew yet means no session yet. What the player should do about
     that depends entirely on where the Warden is, and the snapshot has
     been carrying that all along — it just wasn't being read. */
  if (!crew.length) {
    const gathering = phase === "lobby";
    /* Already approved, just nothing to play yet. Without this the
       player is shown "build a character" again and cheerfully builds a
       second one, which the Warden then has to reject. */
    const mine = myPcId && lobby.find((c) => c.id === myPcId);
    if (mine) {
      return (
        <div className="join">
          <Panel title="You're in">
            <div className="stack">
              <div className="wait-mark" aria-hidden="true"><i /><i /><i /></div>
              <p style={{ margin: 0 }}>
                <strong>{mine.name}</strong> is at the table. The game starts when
                the Warden says so.
              </p>
              {lobby.length > 1 && (
                <div className="note-box">
                  With you: {lobby.filter((c) => c.id !== myPcId).map((c) => c.name).join(" · ")}
                </div>
              )}
              <p className="clue-meta" style={{ margin: 0 }}>
                Nothing to do — this screen changes on its own.
              </p>
            </div>
          </Panel>
        </div>
      );
    }

    /* THE HONEST VERSION OF "WAITING". This phone reached the table
       server — it is running this app, which the server handed it —
       but no Warden screen has ever attached to that server, so
       there is nobody to wait for. Saying so is the only thing that
       gets somebody to look at the laptop. */
    if (noWarden) {
      return (
        <div className="join">
          <Panel title="No Warden on this table">
            <div className="stack">
              <p style={{ margin: 0 }}>
                This phone is connected to the table server, but the Warden&apos;s
                screen hasn&apos;t attached to it. Nothing is wrong with your
                phone or the wifi — you got this app from that server.
              </p>
              <div className="note-box">
                <strong>Say this out loud:</strong> the Warden&apos;s screen needs
                to be open at <code>/?mode=host</code>, and on the machine running
                the server it has to be the <code>localhost</code> address, not
                the one the phones use. If the top of their screen says anything
                other than a list of phones, that is the problem.
              </div>
              <p className="clue-meta" style={{ margin: 0 }}>
                Nothing to do here — this screen changes on its own the moment
                their screen connects. It has been {quiet < 120
                  ? `${quiet} seconds`
                  : `${Math.floor(quiet / 60)} minutes`}.
              </p>
            </div>
          </Panel>
        </div>
      );
    }

    return (
      <div className="join">
        <Panel title={gathering ? "The table is gathering" : "Waiting for the Warden"}>
          <div className="stack">
            <p style={{ margin: 0 }}>
              {status !== "open"
                ? "Looking for the table…"
                : gathering
                  ? "Build a character now. It goes to the Warden for a look, and the game starts once everyone's in."
                  : "Connected. The Warden hasn't opened the table yet — this screen will change on its own when they do."}
            </p>

            {lobby.length > 0 && (
              <div className="note-box">
                Already in: {lobby.map((c) => c.name).join(" · ")}
              </div>
            )}

            <div className="btn-grid">
              {onBuild && (
                <Btn kind={gathering ? "accent" : "primary"} onClick={onBuild}>
                  Build a character
                </Btn>
              )}
              {onLocker && <Btn kind="ghost" onClick={onLocker}>Bring one of your own</Btn>}
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="join">
      <Panel title="Pick your character">
        {/* Still here, compactly. The person who picks up the sixth
            phone twenty minutes late has read nothing. */}
        <Masthead mod={mod} compact />
        {crew.map((c) => {
          const owner = taken[c.id];
          const dead = c.alive === false;
          const mine = claiming === c.id;
          // While a claim is in the air every row is locked, not just the
          // one tapped: the answer might be that somebody beat you to it.
          const locked = !!owner || dead || !!claiming;
          return (
            <button
              key={c.id}
              className={`join-pc${locked ? " is-taken" : ""}${mine ? " is-claiming" : ""}`}
              disabled={locked}
              onClick={() => onClaim(c.id)}
            >
              <span className="join-pc-name">{c.name}</span>
              <span className="join-pc-cls">{c.cls}</span>
              <span className="join-pc-state">
                {mine ? "claiming…" : dead ? "deceased" : owner ? `taken by ${owner}` : "free"}
              </span>
            </button>
          );
        })}
        <div className="btn-row" style={{ marginTop: 10 }}>
          {onBuild && <Btn kind="ghost" onClick={onBuild}>Build a new one</Btn>}
          {onLocker && <Btn kind="ghost" onClick={onLocker}>Bring one of your own</Btn>}
        </div>
      </Panel>
    </div>
  );
}
