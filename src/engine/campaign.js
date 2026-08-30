/* ============================================================
   THE CAMPAIGN — the difference between a game they played and a
   game they play.

   ------------------------------------------------------------
   WHY THIS WAS DEFERRED, AND WHY IT IS NOT DEFERRED ANY MORE

   The roadmap put campaign persistence last and was right to. A
   campaign record with nowhere to spend anything is a table of
   numbers: it would have stored credits nobody could spend, a
   ship nobody could repair, and a roster nobody could carry
   anywhere, and every one of those would have been dead code of
   exactly the kind this file is written to avoid.

   Those surfaces exist now. `core/ship.js`, `core/downtime.js`,
   `screens/ShoreLeave.jsx`, `screens/Contractors.jsx` and
   `screens/Library.jsx` are all shipped and reachable. So the
   record has somewhere to go.

   ------------------------------------------------------------
   WHAT THIS IS NOT

   It is NOT a save. `storage.js` already does saves: a save is
   one session, mid-flight, restorable. This is the opposite end —
   it holds nothing about a session in progress and cannot restore
   one. It is what is left when the session is over.

   It is NOT a character store either. `locker.js` already does
   that, and does it on the right device: a character belongs to a
   PLAYER and lives on the player's phone, which is why it
   survives a table dissolving. This holds the names, so a
   campaign can say who was on it, and never the sheets.

   Three stores, three lifetimes, and no overlap:

     storage.js   one session, mid-flight     the table's device
     campaign.js  many sessions, between them  the table's device
     locker.js    one character, forever       the player's phone

   ------------------------------------------------------------
   WHY IT IS ADDITIVE AND NEVER AUTHORITATIVE

   Nothing in the engine reads this file to decide anything. No
   rung consults it, no module can gate on it, and a session
   started inside a campaign is byte-identical to a session
   started outside one. That is deliberate and it is the same
   argument the floor's rule 6 makes: a feature that quietly
   changes how the game plays, because of something that happened
   three weeks ago, is a feature nobody at the table can reason
   about.

   So a campaign is a LEDGER. It records what happened. It does
   not participate.

   ------------------------------------------------------------
   AND WHY IT IS ONE-OFF BY DEFAULT

   No campaign is selected until somebody selects one, and the
   lobby offers "just this session" first. A group of friends who
   want to play a ninety-minute module on a Tuesday and never
   think about it again should never have to name anything.
   ============================================================ */

import { harvest, addFacts } from "./continuity.js";
import { sessionReport, sessionDigest } from "./analytics.js";

const KEY = "mothership:campaigns:v1";
const ACTIVE = "mothership:campaign:active";

/* localStorage may be absent — SSR, a sandboxed iframe, a test —
   and this file is imported at module scope by screens. Same
   guard as storage.js and locker.js, for the same reason: a
   feature about remembering things must not be the reason the
   application fails to start. */
const ok = () => { try { return typeof localStorage !== "undefined"; } catch { return false; } };

function read() {
  if (!ok()) return {};
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
function write(d) {
  if (!ok()) return false;
  try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; }
}

export const CAMPAIGN_VERSION = 1;

/** Ids are derived from the name and then made unique, rather than
 *  random, so a campaign is recognisable in a localStorage dump and
 *  in an exported file. */
export function campaignId(name, taken = {}) {
  const base = String(name || "campaign")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "campaign";
  if (!taken[base]) return base;
  let n = 2;
  while (taken[`${base}-${n}`]) n += 1;
  return `${base}-${n}`;
}

export function listCampaigns() {
  return Object.values(read())
    .map((c) => ({ ...c, sessions: c.sessions || [] }))
    .sort((a, b) => (b.at || 0) - (a.at || 0));
}

export function getCampaign(id) {
  if (!id) return null;
  return read()[id] || null;
}

export function createCampaign(name) {
  const all = read();
  const id = campaignId(name, all);
  const c = {
    v: CAMPAIGN_VERSION,
    id,
    name: String(name || "Untitled campaign").slice(0, 60),
    started: Date.now(),
    at: Date.now(),
    sessions: [],
    /* Names only. The sheets live in each player's own locker —
       see the header. This exists so a campaign can say who was
       on it without claiming to own anybody's character. */
    crew: [],
    /* Facts this table made true — see engine/continuity.js. Empty
       is the normal state: most sessions invent nothing, and a
       campaign that never adds one behaves exactly as before. */
    facts: [],
  };
  all[id] = c;
  write(all);
  return c;
}

export function renameCampaign(id, name) {
  const all = read();
  if (!all[id]) return null;
  all[id] = { ...all[id], name: String(name || "").slice(0, 60) || all[id].name, at: Date.now() };
  write(all);
  return all[id];
}

export function forgetCampaign(id) {
  const all = read();
  delete all[id];
  write(all);
  if (activeCampaignId() === id) setActiveCampaign(null);
  return true;
}

/* ------------------------------------------------------------
   WHICH ONE IS RUNNING

   Held separately from the campaigns themselves so that clearing
   the selection cannot corrupt a record, and so that a table
   which has finished for the night leaves nothing selected.
   ------------------------------------------------------------ */
export function activeCampaignId() {
  if (!ok()) return null;
  try { return localStorage.getItem(ACTIVE) || null; } catch { return null; }
}
export function setActiveCampaign(id) {
  if (!ok()) return false;
  try {
    if (id) localStorage.setItem(ACTIVE, id);
    else localStorage.removeItem(ACTIVE);
    return true;
  } catch { return false; }
}
export const activeCampaign = () => getCampaign(activeCampaignId());

/* ------------------------------------------------------------
   RECORDING AN EVENING

   Called once, from the ending screen, with what the session
   actually produced. Idempotent on `sessionId`: an ending screen
   that re-renders — and it does, several times, because copying a
   transcript sets state — must not add the same evening twice.
   ------------------------------------------------------------ */
export function recordSession(id, session) {
  const all = read();
  const c = all[id];
  if (!c || !session || !session.sessionId) return null;

  const sessions = c.sessions || [];
  if (sessions.some((s) => s.sessionId === session.sessionId)) return c;

  const entry = {
    sessionId: session.sessionId,
    at: session.at || Date.now(),
    modId: session.modId || "",
    modTitle: session.modTitle || "",
    ending: session.ending || "",
    endingTitle: session.endingTitle || "",
    good: !!session.good,
    survivors: [...(session.survivors || [])],
    lost: [...(session.lost || [])],
    minutes: session.minutes || 0,
    /* WHAT THE MODULE DID, in counts. `engine/analytics.js` reads a
       finished world into a report and `sessionDigest` reduces that
       to ids and numbers — no prose, no player names, no typed
       sentences, because a campaign file gets pasted into chat
       windows and the miss backlog is verbatim things humans said.

       Absent `session.world` this is null and every existing caller
       is unaffected, exactly as `facts` is. */
    digest: session.mod && session.world
      ? sessionDigest(sessionReport(session.mod, session.world, session.feed || []))
      : null,
  };

  /* WHAT THEY INVENTED, kept alongside what they survived.
     `engine/continuity.js` harvests the keepable rulings out of the
     finished world — dropping the retired ones, which the table
     took back, and the private ones, which were never the whole
     table's to read. Absent `session.world` this is a no-op, so
     every existing caller keeps working unchanged. */
  const facts = session.world
    ? addFacts(c, harvest(session.world, { modId: entry.modId }))
    : (c.facts || []);

  /* The roster is the union of everybody who has ever been on
     it, and losses are marked rather than removed. A campaign
     that quietly deletes the dead is a campaign that cannot tell
     you what it cost. */
  const crew = [...(c.crew || [])];
  const seen = new Set(crew.map((p) => p.name));
  for (const name of entry.survivors) {
    if (!seen.has(name)) { crew.push({ name, alive: true, since: entry.at }); seen.add(name); }
  }
  for (const name of entry.lost) {
    const at = crew.findIndex((p) => p.name === name);
    if (at >= 0) crew[at] = { ...crew[at], alive: false, lost: entry.at };
    else crew.push({ name, alive: false, since: entry.at, lost: entry.at });
  }

  all[id] = { ...c, sessions: [...sessions, entry], crew, facts, at: Date.now() };
  write(all);
  return all[id];
}

/** Everything a screen wants to print about a campaign, computed
 *  rather than stored, so an old record cannot disagree with
 *  itself about its own totals. */
export function campaignSummary(c) {
  if (!c) return null;
  const sessions = c.sessions || [];
  const crew = c.crew || [];
  const modules = [...new Set(sessions.map((s) => s.modId).filter(Boolean))];
  return {
    id: c.id,
    name: c.name,
    sessions: sessions.length,
    modules: modules.length,
    standing: crew.filter((p) => p.alive).length,
    lost: crew.filter((p) => !p.alive).length,
    last: sessions.length ? sessions[sessions.length - 1] : null,
    since: c.started || c.at || 0,
  };
}

/** One line for a lobby list. Deliberately factual — a campaign
 *  with four dead characters should read as four dead characters
 *  and not as an achievement. */
export function campaignLine(c) {
  const s = campaignSummary(c);
  if (!s) return "";
  if (!s.sessions) return "No sessions yet.";
  const bits = [`${s.sessions} session${s.sessions === 1 ? "" : "s"}`];
  if (s.standing) bits.push(`${s.standing} still standing`);
  if (s.lost) bits.push(`${s.lost} lost`);
  return bits.join(" · ");
}

/* ------------------------------------------------------------
   OUT, AND BACK IN

   A campaign belongs to a table, and tables move — to somebody
   else's flat, to a different laptop, to a phone when the laptop
   dies. `portable.js` makes that true for characters and this
   makes it true for the record they accumulate. Plain JSON, on
   purpose, so it can be pasted into a chat window.
   ------------------------------------------------------------ */
export function exportCampaign(id) {
  const c = getCampaign(id);
  return c ? JSON.stringify({ ...c, exported: Date.now() }, null, 2) : null;
}

export function importCampaign(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { return { ok: false, error: "That is not a campaign file." }; }
  if (!parsed || !parsed.name || !Array.isArray(parsed.sessions)) {
    return { ok: false, error: "That file is missing the parts a campaign needs." };
  }
  const all = read();
  /* Imported under a fresh id ALWAYS. Overwriting a campaign of
     the same name with somebody else's copy is the one failure
     mode here that loses an evening nobody can get back. */
  const id = campaignId(parsed.name, all);
  const c = {
    v: CAMPAIGN_VERSION,
    id,
    name: parsed.name,
    started: parsed.started || Date.now(),
    at: Date.now(),
    sessions: parsed.sessions,
    crew: parsed.crew || [],
  };
  all[id] = c;
  write(all);
  return { ok: true, campaign: c };
}
