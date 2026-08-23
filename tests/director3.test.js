/* ============================================================
   THE 2.8 LADDER.

   Four new rungs, one changed one, and — first, because everything
   else in this file was unreachable without it — the defect that
   meant none of 2.7.0's director work had ever run at a table.
   ============================================================ */
import { describe, it, expect } from "vitest";
import {
  directorPlan, safeMove, LADDER,
  rungPending, rungBreather, rungCallback, rungAttack,
  PENDING_PATIENCE_MS, PENDING_GIVEUP_MS,
  BREATHER_WINDOW_MS, BREATHER_HARSH_COUNT, BREATHER_MS, BREATHER_GAP_MS,
  CALLBACK_MIN_AGE_MS, CALLBACK_GAP_MS, CALLBACK_PREFIX, NUDGE_TEXT,
} from "../src/engine/director.js";
import { defineModule } from "../src/engine/defineModule.js";
import { autoDirector, directorGaps, rateFor } from "../src/engine/autoDirector.js";
import ypsilon from "../src/modules/ypsilon14/index.js";

const NOW = 1_700_000_000_000;

const world = (over = {}) => ({
  room: "hab", clock: 0, visited: { hab: true }, flags: {}, threats: {},
  npcs: {}, clues: [], oracleMemory: {}, tempo: {},
  ...over,
});

const crew = [{ id: "riley", name: "Riley", alive: true, room: "hab", cls: "marine" }];

const baseMod = (over = {}) => ({
  id: "t", title: "T", rooms: { hab: { name: "Hab" } }, items: {},
  npcs: {}, threats: {}, endings: {}, ...over,
});

/* ============================================================
   0 — THE BLOCK THAT NEVER ARRIVED
   ============================================================ */

describe("defineModule carries the director block", () => {
  /* THE REGRESSION THIS FILE EXISTS FOR.

     `defineModule` assembles an explicit object rather than
     spreading `raw`, and `director` was not on the list. So
     `mod.director` was undefined for every module in the repo and
     the five rungs that open with `if (!d) return null` — escalate,
     aftermath, ending, callRoll, pressure — had never fired outside
     a unit test in their lives.

     It survived 771 passing tests because every director test built
     its module object inline and therefore always had one. This is
     the assertion that goes through the real door. */
  it("survives the trip through defineModule", () => {
    const mod = defineModule(baseMod({
      director: { escalate: [{ atClock: 10, label: "x", effects: [] }] },
    }));
    expect(mod.director).toBeTruthy();
    expect(mod.director.escalate).toHaveLength(1);
  });

  it("and does so for the one shipped module", () => {
    expect(ypsilon.director).toBeTruthy();
    expect(ypsilon.director.escalate.length).toBeGreaterThan(0);
    expect(ypsilon.director.rolls.length).toBeGreaterThan(0);
  });

  it("leaves the shipped module with no problems and no warnings", () => {
    expect(ypsilon.problems).toEqual([]);
    expect(ypsilon.warnings).toEqual([]);
  });
});

/* ============================================================
   A.2 — THE VALIDATOR, AND THE FLOOR
   ============================================================ */

describe("the validator names what an author has not written", () => {
  const warnings = (raw) => defineModule(baseMod(raw)).warnings;

  it("says so when there is no director block at all", () => {
    const w = warnings({});
    expect(w.some((x) => x.includes("no \"director\" block"))).toBe(true);
  });

  it("names each missing list separately", () => {
    const w = warnings({ director: { escalate: [{ atClock: 5, effects: [] }] } });
    expect(w.some((x) => x.includes("\"rolls\""))).toBe(true);
    expect(w.some((x) => x.includes("\"onFail\""))).toBe(true);
    expect(w.some((x) => x.includes("\"attacks\""))).toBe(true);
    // Written, so not named.
    expect(w.some((x) => x.includes("\"escalate\""))).toBe(false);
  });

  it("treats an empty list as a decision rather than an omission", () => {
    /* Ypsilon 14's `attacks: []` is the real case: its only threat
       is `unseen`, safeMove would refuse every entry, and warning an
       author about a decision they documented is how a validator
       teaches people to ignore it. */
    const w = warnings({ director: { attacks: [] } });
    expect(w.some((x) => x.includes("\"attacks\""))).toBe(false);
  });
});

describe("the validator catches the mistakes that fail as silence", () => {
  const problems = (raw) => defineModule(baseMod(raw)).problems;

  it("an escalate beat with no trigger, which could never be due", () => {
    const p = problems({ director: { escalate: [{ label: "x", effects: [] }] } });
    expect(p.some((x) => x.includes("can never be due"))).toBe(true);
  });

  it("a called roll with no reason, which safeMove drops every time", () => {
    const p = problems({ director: { rolls: [{ id: "r", stat: "fear" }] } });
    expect(p.some((x) => x.includes("safeMove will refuse it"))).toBe(true);
  });

  it("a director ending naming an ending the module does not have", () => {
    const p = problems({ director: { endings: [{ id: "nope", when: "flag:x" }] } });
    expect(p.some((x) => x.includes("unknown ending"))).toBe(true);
  });

  it("an attack on a threat that does not exist", () => {
    const p = problems({ director: { attacks: [{ threatId: "ghost", when: "flag:x" }] } });
    expect(p.some((x) => x.includes("unknown threat"))).toBe(true);
  });

  it("a pressure hook the module never declared", () => {
    const p = problems({ director: { pressure: "nothingHere" } });
    expect(p.some((x) => x.includes("does not declare"))).toBe(true);
  });
});

describe("the generic floor derives, and never composes", () => {
  it("lifts an ending that declares its own when", () => {
    const d = autoDirector({
      length: "One shot",
      endings: { out: { when: "flag:left", title: "Out" }, other: { title: "Other" } },
    });
    expect(d.endings).toHaveLength(1);
    expect(d.endings[0].id).toBe("out");
    expect(d.generated).toBe(true);
  });

  it("wires the pressure hook only when the module declares it", () => {
    expect(autoDirector({ hooks: { directorPressure: () => {} }, endings: {} }).pressure)
      .toBe("directorPressure");
    expect(autoDirector({ endings: { a: { when: "flag:x" } } }).pressure).toBeUndefined();
  });

  it("never invents a called roll or an attack, because both need a sentence", () => {
    const d = autoDirector({
      length: "One shot",
      rooms: { a: { name: "A" } },
      threats: { dog: { name: "Dog" } },
      endings: { out: { when: "flag:left" } },
    });
    expect(d.rolls).toBeUndefined();
    expect(d.attacks).toBeUndefined();
    expect(d.escalate).toBeUndefined();
  });

  it("returns null when there is nothing to derive, rather than a rate wearing a hat", () => {
    expect(autoDirector({ length: "One shot", endings: {} })).toBe(null);
  });

  it("reads a rate off the declared length", () => {
    expect(rateFor("One shot")).toBe(1);
    expect(rateFor("Campaign")).toBe(2);
    expect(rateFor(undefined)).toBe(1);
  });

  it("still tells an author the floor is a floor", () => {
    const derived = autoDirector({ endings: { out: { when: "flag:left" } } });
    const gaps = directorGaps({ endings: { out: { when: "flag:left" } } }, derived);
    expect(gaps.some((g) => g.includes("escalate"))).toBe(true);
    expect(gaps.some((g) => g.includes("endings"))).toBe(false);
  });
});

/* ============================================================
   A.5 — THE PROMPT SOMEBODY WALKED AWAY FROM
   ============================================================ */

describe("a pending prompt no longer holds the table forever", () => {
  const pending = { kind: "roll", req: { pcId: "riley" } };

  it("waits, quietly, while somebody is reading", () => {
    const m = rungPending({ pending, now: NOW, pendingSince: NOW - 10_000, lastNudgeAt: 0 });
    expect(m).toEqual({ kind: "wait", rung: "pending" });
  });

  it("says their name once, after ninety seconds", () => {
    const since = NOW - PENDING_PATIENCE_MS - 1000;
    const m = rungPending({ pending, now: NOW, pendingSince: since, lastNudgeAt: 0 });
    expect(m.kind).toBe("nudge");
    expect(m.pcId).toBe("riley");
    expect(m.text).toBe(NUDGE_TEXT);
  });

  it("and only once — a second is nagging somebody who is thinking", () => {
    const since = NOW - PENDING_PATIENCE_MS - 1000;
    const m = rungPending({ pending, now: NOW, pendingSince: since, lastNudgeAt: since + 500 });
    expect(m).toEqual({ kind: "wait", rung: "pending" });
  });

  it("then stands down so the rest of the ladder can run", () => {
    const since = NOW - PENDING_GIVEUP_MS - 1000;
    expect(rungPending({ pending, now: NOW, pendingSince: since, lastNudgeAt: since + 500 })).toBe(null);
  });

  it("but never answers the prompt on their behalf", () => {
    /* The line that must not move. A director that can roll for you
       when you are slow has taken your character off you, and no
       amount of pacing is worth that. Nothing rungPending can return
       resolves anything. */
    const since = NOW - PENDING_GIVEUP_MS - 1000;
    const m = rungPending({ pending, now: NOW, pendingSince: since, lastNudgeAt: 0 });
    expect(m && m.kind).not.toBe("roll");
    expect(m && m.kind).not.toBe("resolve");
  });
});

/* ============================================================
   A.1 — THE BREATHER
   ============================================================ */

describe("the ratchet can be released", () => {
  const harsh = (n, ago = 60_000) =>
    Array.from({ length: n }, (_, i) => NOW - ago - i * 1000);

  it("does nothing until the director has actually been cruel", () => {
    expect(rungBreather({ w: world(), now: NOW, harshAt: harsh(BREATHER_HARSH_COUNT - 1) })).toBe(null);
  });

  it("offers five minutes after three screws in eight minutes", () => {
    const m = rungBreather({ w: world(), now: NOW, harshAt: harsh(BREATHER_HARSH_COUNT) });
    expect(m.kind).toBe("breather");
    expect(m.ms).toBe(BREATHER_MS);
  });

  it("ignores harshness that has aged out of the window", () => {
    const old = harsh(BREATHER_HARSH_COUNT, BREATHER_WINDOW_MS + 60_000);
    expect(rungBreather({ w: world(), now: NOW, harshAt: old })).toBe(null);
  });

  it("does not offer a second one straight after the first", () => {
    expect(rungBreather({
      w: world(), now: NOW, harshAt: harsh(BREATHER_HARSH_COUNT),
      lastBreatherAt: NOW - BREATHER_GAP_MS + 1000,
    })).toBe(null);
  });

  it("stands down entirely while the table is already resting", () => {
    const w = world({ tempo: { breather: { since: NOW } } });
    expect(rungBreather({ w, now: NOW, harshAt: harsh(BREATHER_HARSH_COUNT) })).toBe(null);
  });
});

describe("whose breather it was decides whether it ends", () => {
  const mod = baseMod();

  it("a breather the director called ends by itself", () => {
    /* Otherwise the empty chair can stop the game and cannot start
       it again, because nobody is holding the button. */
    const w = world({ tempo: { breather: { since: NOW - BREATHER_MS - 1000, by: "director", ms: BREATHER_MS } } });
    const m = directorPlan({ mod, w, crew, now: NOW });
    expect(m).toEqual({ kind: "resume", rung: "breather" });
  });

  it("a breather a person called never does", () => {
    /* Somebody put the game down for a reason. The reason is not the
       software's to overrule, and this assertion is the whole of
       that promise. */
    const w = world({ tempo: { breather: { since: NOW - 6 * 60 * 60 * 1000 } } });
    const m = directorPlan({ mod, w, crew, now: NOW });
    expect(m).toEqual({ kind: "wait", rung: "safety" });
  });

  it("and a hold is never touched by either", () => {
    const w = world({ tempo: { held: { since: NOW - 6 * 60 * 60 * 1000 } } });
    expect(directorPlan({ mod, w, crew, now: NOW })).toEqual({ kind: "wait", rung: "safety" });
  });
});

/* ============================================================
   A.4 — THE CALLBACK
   ============================================================ */

describe("the callback reaches backwards, and only for the crew's own words", () => {
  const clue = (over = {}) => ({
    id: "c1", text: "The pump was running with nothing to pump.",
    at: NOW - CALLBACK_MIN_AGE_MS - 60_000, secret: false, resolved: false, ...over,
  });
  const args = (clues, over = {}) => ({
    w: world({ clues }), now: NOW, lastLineAt: NOW - 10 * 60 * 1000, ...over,
  });

  it("brings up something old and unresolved", () => {
    const m = rungCallback(args([clue()]));
    expect(m.kind).toBe("callback");
    expect(m.text).toBe(clue().text);
  });

  it("never a secret clue — that is one player's, and this is the shared screen", () => {
    expect(rungCallback(args([clue({ secret: true })]))).toBe(null);
  });

  it("never a resolved one, which is what makes the label true", () => {
    expect(rungCallback(args([clue({ resolved: true })]))).toBe(null);
    expect(CALLBACK_PREFIX).toBeTruthy();
  });

  it("nothing recent — that is a transcript, not a callback", () => {
    expect(rungCallback(args([clue({ at: NOW - 60_000 })]))).toBe(null);
  });

  it("does not mine the same clue twice", () => {
    expect(rungCallback(args([clue()], { calledBack: { c1: true } }))).toBe(null);
  });

  it("holds off while the table is talking", () => {
    expect(rungCallback(args([clue()], { lastLineAt: NOW - 5_000 }))).toBe(null);
  });

  it("and waits between callbacks", () => {
    expect(rungCallback(args([clue()], { lastCallbackAt: NOW - CALLBACK_GAP_MS + 1000 }))).toBe(null);
  });

  it("reaches for the oldest thing still hanging over the table", () => {
    const older = clue({ id: "c0", text: "Older.", at: NOW - 60 * 60 * 1000 });
    const m = rungCallback(args([clue(), older]));
    expect(m.clueId).toBe("c0");
  });
});

/* ============================================================
   A.3 — IT COMES THROUGH THE DOOR
   ============================================================ */

describe("the director may choose the moment, from moments an author allowed", () => {
  const dog = { name: "Dog", combat: 40 };
  const mod = baseMod({
    threats: { dog },
    director: { attacks: [{ threatId: "dog", when: "flag:barking", reason: "It has been circling for ten minutes." }] },
  });
  const w = world({ flags: { barking: true }, threats: { dog: { loc: "hab" } } });

  it("fires when the module's own condition is true", () => {
    const m = rungAttack({ mod, w, crew });
    expect(m.kind).toBe("combat");
    expect(m.threatId).toBe("dog");
  });

  it("not before it", () => {
    expect(rungAttack({ mod, w: world({ threats: { dog: { loc: "hab" } } }), crew })).toBe(null);
  });

  it("not twice", () => {
    const fired = world({ flags: { barking: true, directorAttacks: { dog: true } }, threats: { dog: { loc: "hab" } } });
    expect(rungAttack({ mod, w: fired, crew })).toBe(null);
  });

  it("and not into an empty room", () => {
    expect(rungAttack({ mod, w, crew: [{ id: "riley", alive: true, room: "elsewhere" }] })).toBe(null);
  });
});

describe("safeMove guards a fight harder than anything else", () => {
  const move = (over = {}) => ({
    kind: "combat", rung: "attack", threatId: "dog", room: "hab",
    reason: "It has been circling.", ...over,
  });
  const mod = baseMod({ threats: { dog: { name: "Dog" } } });
  const w = world({ threats: { dog: { loc: "hab" } } });

  it("lets a seen threat in the room through", () => {
    expect(safeMove(move(), { w, mod, crew })).toBeTruthy();
  });

  it("refuses a threat that is not in the world yet — no spawning", () => {
    expect(safeMove(move(), { w: world(), mod, crew })).toBe(null);
  });

  it("refuses an unseen threat, always", () => {
    /* An invisible thing may be moved and must never be narrated,
       and "it attacks you now" is the purest form of narrating it.
       This is why Ypsilon 14 ships `attacks: []`. */
    const unseen = baseMod({ threats: { dog: { name: "Dog", unseen: true } } });
    expect(safeMove(move(), { w, mod: unseen, crew })).toBe(null);
  });

  it("refuses a threat that is somewhere else", () => {
    const away = world({ threats: { dog: { loc: "vents" } } });
    expect(safeMove(move(), { w: away, mod, crew })).toBe(null);
  });

  it("refuses a dead one", () => {
    const dead = world({ threats: { dog: { loc: "hab", dead: true } } });
    expect(safeMove(move(), { w: dead, mod, crew })).toBe(null);
  });

  it("refuses one that cannot say why", () => {
    expect(safeMove(move({ reason: "" }), { w, mod, crew })).toBe(null);
  });
});

/* ============================================================
   THE LADDER ITSELF
   ============================================================ */

describe("the ladder", () => {
  it("puts letting up above pushing", () => {
    /* If the room has gone quiet shortly after three bad things,
       that quiet is a table reeling and not a table bored. Answering
       it by moving the creature is exactly the wrong read. */
    expect(LADDER.indexOf("breather")).toBeLessThan(LADDER.indexOf("pressure"));
  });

  it("puts a fight above everything except the module's own business", () => {
    expect(LADDER.indexOf("attack")).toBeLessThan(LADDER.indexOf("roll"));
    expect(LADDER.indexOf("scripted")).toBeLessThan(LADDER.indexOf("attack"));
  });

  it("puts the callback above wallpaper and below the clock", () => {
    expect(LADDER.indexOf("pacing")).toBeLessThan(LADDER.indexOf("callback"));
    expect(LADDER.indexOf("callback")).toBeLessThan(LADDER.indexOf("atmosphere"));
  });

  it("ends in silence, which is still a legitimate output", () => {
    expect(LADDER[LADDER.length - 1]).toBe("silence");
  });
});
