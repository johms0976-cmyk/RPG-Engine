/* ============================================================
   HOUSE RULES — the optional-rules switchboard.

   Every toggle here is read by exactly one or two places in the
   engine. Adding a rule means adding an entry plus one `if`.
   Defaults are Rules As Written.
   ============================================================ */

export const HOUSE_RULES = {
  advTieBreak: {
    name: "Advantage tie-break",
    kind: "choice",
    options: [
      ["high", "Keep the higher roll (Opposed Checks read)"],
      ["low", "Keep the lower roll (the Abel example read)"],
    ],
    def: "high",
    blurb:
      "When both dice land in the same outcome band, the rules are ambiguous. Pick a lane and stick to it.",
  },
  armorDegradation: {
    name: "Armor degradation",
    kind: "bool", def: false,
    blurb: "Armor Points drop by 1 whenever excess Damage is dealt. The suit is destroyed at 0.",
  },
  criticalStressRelief: {
    name: "Critical stress relief",
    kind: "bool", def: false,
    blurb: "Any Critical Success also relieves 1 Stress.",
  },
  exhaustibleSkills: {
    name: "Exhaustible skills",
    kind: "bool", def: false,
    blurb: "Each Skill can be used to auto-succeed one Check per session, then it is spent.",
  },
  lightAmmo: {
    name: "Light ammo tracking",
    kind: "bool", def: false,
    blurb: "Don't count shots. When it matters, you have 1d5 left.",
  },
  optInStress: {
    name: "Opt-in stress",
    kind: "bool", def: false,
    blurb: "You decide when to take Stress and when to roll Panic.",
  },
  playerFacingRolls: {
    name: "Player-facing rolls",
    kind: "bool", def: false,
    blurb: "Enemies never roll. A failed attack means you are hit instead.",
  },
  rapidSkillLearning: {
    name: "Rapid skill learning",
    kind: "bool", def: false,
    blurb: "Skills train in 3/5/7 sessions instead of the usual long haul.",
  },
  oneTimeAdvancement: {
    name: "One-time advancement",
    kind: "bool", def: false,
    blurb: "Survive your first session and add 10 to any one Stat or Save.",
  },
  wounds: {
    name: "Wounds",
    kind: "bool", def: false,
    blurb: "Every weapon deals at least 1 Wound. Health tracks the bleeding; Wounds kill you.",
  },
  autoPanicOnCritFail: {
    name: "Panic on critical failure",
    kind: "bool", def: true,
    blurb: "A Critical Failure on any Save forces a Panic Check. (Rules as written.)",
  },
  trackAmmoStrictly: {
    name: "Ammunition gates firing",
    kind: "bool", def: true,
    blurb: "An empty weapon cannot be fired. Turn this off for a looser game.",
  },
};

export const defaultHouseRules = () =>
  Object.fromEntries(Object.entries(HOUSE_RULES).map(([k, v]) => [k, v.def]));

export const withDefaults = (hr = {}) => ({ ...defaultHouseRules(), ...hr });
