/* ============================================================
   MODIFIERS — one pipeline, every bonus.

   Before this existed, "Lockpick Set: +10% on rolls to open
   airlock doors" was a sentence in an item description and
   nothing else. Now it is:

       lockpicks: { grants: [{ tags: ["lockpick"], bonus: 10 }] }

   and any roll that declares the tag `lockpick` picks it up
   automatically, along with skills, armour, class abilities,
   conditions, crew assistance and situational calls — all
   collected, all shown to the player in a breakdown.

   A ROLL REQUEST looks like:
     { kind: "stat"|"save", name: "intellect", skill: "Hacking"|[..],
       tags: ["door","electronic"], mode: "advantage"|..,
       assist: pcId|null, why: "..." }

   A MODIFIER looks like:
     { source: "Lockpick Set", bonus: 10 }
     { source: "Crowbar", adv: true }
     { source: "Vaccsuit", dis: true }
   ============================================================ */

import { SKILL_BONUS, skillTier, SAVE_KEYS } from "./rules.js";

/** Does a grant apply to this roll? */
function grantMatches(g, req) {
  if (g.kind && g.kind !== "any" && g.kind !== req.kind) return false;
  if (g.name && String(g.name).toLowerCase() !== String(req.name).toLowerCase()) return false;
  if (g.tags && g.tags.length) {
    const want = new Set((req.tags || []).map((t) => String(t).toLowerCase()));
    if (!g.tags.some((t) => want.has(String(t).toLowerCase()))) return false;
  }
  if (g.skill && !(req.pc.skills || []).includes(g.skill)) return false;
  return true;
}

/** Best (highest) skill bonus among a list of skill names the PC actually has. */
export function skillBonusFor(pc, skill) {
  const list = Array.isArray(skill) ? skill : skill ? [skill] : [];
  let best = 0, name = null;
  for (const s of list) {
    if (!pc.skills || !pc.skills.includes(s)) continue;
    const t = skillTier(s);
    const b = t ? SKILL_BONUS[t] : 0;
    if (b > best) { best = b; name = s; }
  }
  return { bonus: best, skill: name };
}

/**
 * Collect every modifier that applies to a roll.
 * @param {object} req  { kind, name, skill, tags, pc, crew, items, world, mod, houseRules, situational }
 * @returns {{ bonus:number, mode:string, breakdown:Array, advCount:number, disCount:number }}
 */
export function collectModifiers(req) {
  const { pc, crew = [], items = {}, world, houseRules = {} } = req;
  const out = [];

  /* ---- skills ---- */
  const sk = skillBonusFor(pc, req.skill);
  if (sk.bonus) out.push({ source: sk.skill, bonus: sk.bonus, kind: "skill" });

  /* ---- carried gear ---- */
  for (const id of pc.items || []) {
    const it = items[id];
    if (!it || !it.grants) continue;
    for (const g of it.grants) {
      if (!grantMatches(g, req)) continue;
      // some grants only fire while the item is actively worn/on
      if (g.needsFlag && !(world && world.flags[g.needsFlag])) continue;
      if (g.bonus) out.push({ source: it.n, bonus: g.bonus, kind: "item" });
      if (g.adv) out.push({ source: it.n, adv: true, kind: "item" });
      if (g.dis) out.push({ source: it.n, dis: true, kind: "item" });
    }
  }

  /* ---- active drugs and timed effects on the character ---- */
  for (const b of pc.buffs || []) {
    if (world && b.until != null && world.clock >= b.until) continue;
    if (!grantMatches(b, req)) continue;
    if (b.bonus) out.push({ source: b.source || "drug", bonus: b.bonus, kind: "buff" });
    if (b.adv) out.push({ source: b.source || "drug", adv: true, kind: "buff" });
    if (b.dis) out.push({ source: b.source || "drug", dis: true, kind: "buff" });
  }

  /* ---- conditions ---- */
  const conds = pc.conditions || [];
  if (conds.some((c) => c.startsWith("Rattled"))) out.push({ source: "Rattled", dis: true, kind: "condition" });
  if (conds.some((c) => c.startsWith("Advantage ("))) out.push({ source: "Adrenaline", adv: true, kind: "condition" });
  if (conds.some((c) => c.startsWith("Injured")) && req.kind === "stat")
    out.push({ source: "Injured", dis: true, kind: "condition" });

  /* ---- class abilities that depend on the rest of the crew ---- */
  const others = crew.filter((c) => c.id !== pc.id && c.alive !== false && !c.unconscious);

  // A friendly Marine nearby steadies everyone: +5 Combat, +5 Fear.
  if (others.some((c) => c.cls === "marine")) {
    if (req.kind === "stat" && req.name === "combat")
      out.push({ source: "Marine nearby", bonus: 5, kind: "class" });
    if (req.kind === "save" && req.name === "fear")
      out.push({ source: "Marine nearby", bonus: 5, kind: "class" });
  }

  // Fear Saves in the presence of an Android are at Disadvantage.
  if (req.kind === "save" && req.name === "fear" && pc.cls !== "android" &&
      others.some((c) => c.cls === "android"))
    out.push({ source: "Android present", dis: true, kind: "class" });

  /* ---- assistance from another crew member (PSG 3.3) ---- */
  if (req.assist) {
    const helper = crew.find((c) => c.id === req.assist);
    if (helper && helper.alive !== false && !helper.unconscious && helper.id !== pc.id)
      out.push({ source: `${helper.name} assists`, adv: true, kind: "assist" });
  }

  /* ---- situational calls passed straight in ---- */
  for (const s of req.situational || []) out.push({ ...s, kind: s.kind || "situation" });

  /* ---- house rules ---- */
  if (houseRules.wounds && (pc.wounds || 0) > 0)
    out.push({ source: `Wounded x${pc.wounds}`, bonus: -10 * pc.wounds, kind: "houserule" });

  /* ---- resolve ---- */
  const bonus = out.reduce((a, m) => a + (m.bonus || 0), 0);
  const advCount = out.filter((m) => m.adv).length + (req.mode === "advantage" ? 1 : 0);
  const disCount = out.filter((m) => m.dis).length + (req.mode === "disadvantage" ? 1 : 0);

  // "Having Advantage and Disadvantage at the same time cancels each
  //  other out. Having more Disadvantages than Advantages leads to
  //  Disadvantage, and vice versa." (PSG 3.3)
  const mode = advCount > disCount ? "advantage" : disCount > advCount ? "disadvantage" : "none";

  return { bonus, mode, breakdown: out, advCount, disCount };
}

/** Format a breakdown for the feed: "+10 Hacking, +10 Lockpick Set, [+] Sonya assists" */
export function describeModifiers(breakdown) {
  if (!breakdown.length) return "";
  return breakdown
    .map((m) =>
      m.bonus ? `${m.bonus > 0 ? "+" : ""}${m.bonus} ${m.source}`
        : m.adv ? `[+] ${m.source}`
        : m.dis ? `[-] ${m.source}` : m.source
    )
    .join(", ");
}

export { SAVE_KEYS };
