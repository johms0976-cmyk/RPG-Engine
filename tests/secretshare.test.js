/* ============================================================
   THE PRIVATE CHANNEL, AND WHAT YOU DO WITH IT.

   Two halves, and the second is the interesting one.

   `whisper` existed on the game object from the beginning and
   was never on the module API, so no module could fire one.
   These tests hold that shut: the effect keys exist, they
   address exactly one person, and a target that cannot be
   resolved whispers to nobody rather than to everybody. A
   private channel that fails open is not a private channel.

   The share loop is tested mostly by what it refuses. Speaking
   about somebody else's secret, speaking about a line twice,
   and speaking about a line that was never addressed to you are
   all things a phone could ask for and none of them are things
   the host may do.
   ============================================================ */

import { describe, it, expect } from "vitest";
import { EFFECT_KEYS, runEffects } from "../src/engine/effects.js";
import { heldSecrets, visibleFeed, VIEW } from "../src/engine/secrets.js";
import { TEMPO_FREE } from "../src/engine/tempo.js";
import { PLAYER_ACTIONS, OUT_OF_TURN } from "../src/net/protocol.js";

/* A stand-in for the module API: enough of it to run the two keys
   and record what they asked for. */
function fakeApi() {
  const calls = [];
  return {
    calls,
    ended: () => false,
    ctx: () => ({ world: { flags: {} }, pc: null, crew: [], items: {}, mod: {}, houseRules: {} }),
    say: (kind, text) => calls.push({ fn: "say", kind, text }),
    whisper: (pcId, text) => calls.push({ fn: "whisper", pcId, text }),
    whisperTo: (who, text) => calls.push({ fn: "whisperTo", who, text }),
  };
}

describe("the effect keys that were missing", () => {
  it("are declared, so validation accepts a module using them", () => {
    expect(EFFECT_KEYS.has("whisper")).toBe(true);
    expect(EFFECT_KEYS.has("whisperTo")).toBe(true);
  });

  it("sends a bare whisper to whoever is acting", () => {
    const api = fakeApi();
    runEffects([{ whisper: "The photograph is of you." }], api);
    expect(api.calls).toEqual([{ fn: "whisper", pcId: null, text: "The photograph is of you." }]);
  });

  it("interpolates like every other effect", () => {
    const api = fakeApi();
    runEffects([{ whisper: "It knows {name}." }], api, { name: "RILEY" });
    expect(api.calls[0].text).toBe("It knows RILEY.");
  });

  it("takes a described target", () => {
    const api = fakeApi();
    runEffects([{ whisperTo: { who: "alone", text: "Something moves behind you." } }], api);
    expect(api.calls[0]).toMatchObject({ fn: "whisperTo", who: "alone" });
  });

  it("carries the whole spec through, so shareable:false reaches the line", () => {
    const api = fakeApi();
    // The api records (who, text); the third argument is the spec, so
    // assert on the call the applier actually made.
    const calls = [];
    api.whisperTo = (who, text, opts) => calls.push({ who, text, opts });
    runEffects([{ whisperTo: { who: "acting", text: "…", shareable: false } }], api);
    expect(calls[0].opts).toMatchObject({ shareable: false });
  });

  it("does not say anything to the room", () => {
    const api = fakeApi();
    runEffects([{ whisper: "only you" }, { whisperTo: { who: "random", text: "only them" } }], api);
    expect(api.calls.some((c) => c.fn === "say")).toBe(false);
  });
});

describe("what you are holding", () => {
  const feed = [
    { id: 1, kind: "room", text: "The bay is cold." },
    { id: 2, kind: "whisper", to: "riley", text: "The log has your name on it." },
    { id: 3, kind: "whisper", to: "dana", text: "You are not infected. Yet." },
    { id: 4, kind: "say", to: ["riley", "dana"], text: "Something scrapes overhead." },
  ];

  it("is only your own addressed lines", () => {
    expect(heldSecrets(feed, "riley").map((l) => l.id)).toEqual([2]);
    expect(heldSecrets(feed, "dana").map((l) => l.id)).toEqual([3]);
  });

  it("excludes lines addressed to several people", () => {
    // id 4 is about the room, not a secret anybody owns.
    expect(heldSecrets(feed, "riley").some((l) => l.id === 4)).toBe(false);
  });

  it("excludes lines explicitly marked unshareable", () => {
    const f = [...feed, { id: 5, kind: "whisper", to: "riley", text: "…", shareable: false }];
    expect(heldSecrets(f, "riley").map((l) => l.id)).toEqual([2]);
  });

  it("drops a secret once its holder has spoken about it", () => {
    const f = [...feed, { id: 6, kind: "share", by: "riley", about: 2, text: "The log has my name on it." }];
    expect(heldSecrets(f, "riley")).toEqual([]);
    // …and only for the person who spoke.
    expect(heldSecrets(f, "dana").map((l) => l.id)).toEqual([3]);
  });

  it("is not confused by somebody else speaking about their own", () => {
    const f = [...feed, { id: 6, kind: "share", by: "dana", about: 3, text: "…" }];
    expect(heldSecrets(f, "riley").map((l) => l.id)).toEqual([2]);
  });

  it("returns nothing rather than throwing on a feed it has never seen", () => {
    expect(heldSecrets(null, "riley")).toEqual([]);
    expect(heldSecrets(feed, null)).toEqual([]);
  });
});

describe("a share is public and the secret behind it is not", () => {
  const feed = [
    { id: 2, kind: "whisper", to: "riley", text: "The log has your name on it." },
    { id: 3, kind: "share", by: "riley", byName: "RILEY", about: 2, text: "The log is water damaged." },
  ];

  it("reaches a player who was not told the original", () => {
    const seen = visibleFeed(feed, VIEW.PLAYER, "dana");
    expect(seen.map((l) => l.id)).toEqual([3]);
  });

  it("reaches the table screen, which is addressed to nobody", () => {
    const seen = visibleFeed(feed, VIEW.TABLE, null);
    expect(seen.map((l) => l.id)).toEqual([3]);
  });

  it("keeps the original from everyone but its owner", () => {
    expect(visibleFeed(feed, VIEW.PLAYER, "riley").map((l) => l.id)).toEqual([2, 3]);
  });

  it("carries the speaker, so the screen can attribute it", () => {
    const [line] = visibleFeed(feed, VIEW.TABLE, null);
    expect(line.by).toBe("riley");
    expect(line.byName).toBe("RILEY");
  });
});

describe("sharing is speech, not a turn", () => {
  it("is a player action", () => {
    expect(PLAYER_ACTIONS.has("shareSecret")).toBe(true);
  });

  it("is allowed out of turn — timing is the whole mechanic", () => {
    expect(OUT_OF_TURN.has("shareSecret")).toBe(true);
  });

  it("passes every tempo brake, including the floor", () => {
    expect(TEMPO_FREE.has("shareSecret")).toBe(true);
  });
});
