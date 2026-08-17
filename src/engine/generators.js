/* ============================================================
   WARDEN TOOLS — prep generators.

   IMPORTANT, PLEASE READ:
   The Warden's Operations Manual has its own d100 tables for
   Horrors, jobs, pay and factions. Those entries are Tuesday
   Knight Games' creative work and are NOT reproduced here.

   What this file provides is the STRUCTURE the manual teaches -
   a Horror described by its Transgression, its Omens, its
   Manifestation, how it can be Banished and how it Slumbers;
   jobs described by sector, client, pay band and complication -
   populated with entries written for this engine.

   If you own the book, `mod.wardenTables` lets a module supply
   its own entries and they will be used in place of these. Roll
   on your own copy and put the results in there; the generator
   works the same way.
   ============================================================ */

const pick = (list, rng) => list[Math.floor(rng() * list.length)];

/* ---------------- the Horror ---------------- */

export const HORROR = {
  transgression: [
    "Breaking open a seam that was deliberately sealed",
    "Reading a name aloud that was written to be unreadable",
    "Salvaging from a wreck that was scuttled on purpose",
    "Continuing an experiment after its author killed themselves",
    "Taking a body off a world that was supposed to keep it",
    "Restarting a reactor that was shut down without a reason logged",
    "Trading for cargo nobody will name",
    "Answering a hail that arrived before it was sent",
    "Butchering something that was trying to communicate",
    "Refusing to bury the dead because it cost fuel",
    "Cutting a corner on a quarantine to make a delivery window",
    "Digging past the layer the survey said to stop at",
  ],
  omens: [
    "Machines complete tasks nobody assigned them",
    "The same stranger appears in unrelated photographs",
    "Small animals will not enter one particular corridor",
    "Sleepers report the identical dream, in shifts",
    "Written records change between readings",
    "A crew member's reflection lags by a fraction",
    "Comms carry a voice underneath the carrier signal",
    "Objects are found stacked, neatly, by nobody",
    "Personnel files list one more name than there are people",
    "Wounds heal in the wrong order",
    "Clocks in one section run measurably slow",
    "Someone has started leaving doors open who never did",
  ],
  manifestation: [
    "A predator that hunts by a sense you do not have",
    "A contagion that improves you before it finishes you",
    "An intelligence wearing the shape of a colleague",
    "A structure that is larger inside than the survey allows",
    "A swarm with one shared, patient mind",
    "A machine that has begun to want things",
    "A thing assembled from the crew it has already taken",
    "A signal that installs itself in whoever hears it",
    "A region of space that returns what enters it, altered",
    "A child who has been here far longer than the base has",
    "An organism that reproduces by being witnessed",
    "Something enormous, slow, and entirely uninterested in you",
  ],
  banishment: [
    "Returning what was taken, to exactly where it was taken from",
    "Completing the work its original author abandoned",
    "Total vacuum exposure, sustained, with nobody watching",
    "Naming every person it has taken, in order",
    "Severing it from the power it has quietly been drawing",
    "Convincing it that it has finished",
    "Fire, and a great deal of it",
    "Someone volunteering to take its place",
    "Destroying the record that describes it",
    "Cold below the point at which it can dream",
    "It cannot be banished, only outlived",
    "Giving it precisely what it has been asking for",
  ],
  slumber: [
    "Sleeps until the same transgression is repeated",
    "Waits inside whoever killed it",
    "Disperses into the dust and reassembles in a century",
    "Goes into the records and waits to be read",
    "Follows the ship home, quietly, for years",
    "Becomes a story that makes people go and look",
    "Splits, and both halves are patient",
    "Feigns destruction and does not move for a decade",
    "Retreats down, and keeps digging",
    "Learns, and will be harder next time",
    "Sleeps in the mind of the youngest witness",
    "Does not slumber. It has somewhere to be.",
  ],
};

export function rollHorror(rng = Math.random, tables = {}) {
  const T = { ...HORROR, ...tables };
  return {
    transgression: pick(T.transgression, rng),
    omens: [pick(T.omens, rng), pick(T.omens, rng)].filter((v, i, a) => a.indexOf(v) === i),
    manifestation: pick(T.manifestation, rng),
    banishment: pick(T.banishment, rng),
    slumber: pick(T.slumber, rng),
  };
}

/* ---------------- jobs & pay ---------------- */

export const JOBS = {
  sector: [
    "Industrial — mining, refining, terraformer maintenance, android troubleshooting",
    "Shipping — freight, escort, prisoner transport, sensitive cargo, smuggling",
    "Research — sample collection, site survey, specimen retrieval, field testing",
    "Risk management — sweep and clear, asset protection, quarantine enforcement",
    "Human resources — missing persons, suspicious death, evacuation, negotiation",
    "Acquisitions — appraisal, repossession, hostile inspection, claim disputes",
  ],
  task: [
    "Reach a site that has stopped answering and find out why",
    "Recover a specific object and ask nothing about it",
    "Escort an inspector who is lying about their remit",
    "Restart production at any cost the shareholders will tolerate",
    "Retrieve a body, intact, before anyone else does",
    "Verify that a facility is as empty as the paperwork says",
    "Deliver something that must not be opened",
    "Extract one named person from among many",
    "Install equipment and leave before it is switched on",
    "Confirm a competitor's claim is worthless",
  ],
  complication: [
    "The client has already sent one crew and will not discuss it",
    "Half the pay is contingent on a condition you are not told",
    "A second party is being paid for the opposite outcome",
    "The site's staff have not been informed you are coming",
    "The cargo manifest is wrong, deliberately",
    "Your contact will be dead before you arrive",
    "There is a legal reason nobody local will take the work",
    "The window is short enough to force a bad decision",
    "One of your own crew has been contacted separately",
    "The equipment provided is obsolete and known to be",
  ],
  pay: [
    { band: "Scraps", credits: "1d10x100", note: "Expenses not covered. Bring your own air." },
    { band: "Standard", credits: "1d10x1000", note: "Travel covered. No hazard clause." },
    { band: "Hazard", credits: "2d10x1000", note: "Travel and medical covered. Bonus on completion." },
    { band: "Payday", credits: "1d10x10000", note: "All expenses. Up to 1d10 contractors provided." },
    { band: "Jackpot", credits: "1d10x100000", note: "Whatever you need. Ask yourself why." },
  ],
};

export function rollJob(rng = Math.random, tables = {}) {
  const T = { ...JOBS, ...tables };
  return {
    sector: pick(T.sector, rng),
    task: pick(T.task, rng),
    complication: pick(T.complication, rng),
    pay: pick(T.pay, rng),
  };
}

/* ---------------- factions ---------------- */

export const FACTIONS = {
  kind: [
    "A subsidiary with a quota it cannot meet",
    "A research division operating past its funding",
    "A union local that has stopped being asked",
    "A salvage outfit with better information than it should have",
    "A colony administration protecting a lie",
    "A security contractor between contracts",
    "A religious order with a commercial arm",
    "A family that owns one very old ship",
  ],
  wants: [
    "to be first to the site",
    "to keep something buried",
    "to be paid what they were promised",
    "to prove a rival negligent",
    "to get their people out",
    "to acquire a working specimen",
    "to have the record corrected",
    "to be left completely alone",
  ],
  method: [
    "paperwork and delay",
    "money, quietly",
    "people who are good at their jobs",
    "an accident that will look like one",
    "leverage on someone in your crew",
    "getting there first and saying nothing",
    "the letter of a contract",
    "overwhelming, boring persistence",
  ],
  pressure: [
    "They have a deadline you do not know about",
    "They are being watched by someone larger",
    "They have already lost people doing this",
    "Their claim expires shortly",
    "They cannot be seen to be involved",
    "They are one bad quarter from liquidation",
  ],
};

export function rollFaction(rng = Math.random, tables = {}) {
  const T = { ...FACTIONS, ...tables };
  return {
    kind: pick(T.kind, rng),
    wants: pick(T.wants, rng),
    method: pick(T.method, rng),
    pressure: pick(T.pressure, rng),
  };
}

/* ---------------- NPC roles (the "what is this person to you" table) ---------------- */

export const NPC_ROLES = [
  "Expert — their knowledge is the only reason to keep them alive",
  "Coward — useless, loud, and will get someone killed",
  "Victim — cannot help you, and needs you most",
  "Drinking buddy — would do anything for you, badly",
  "Rival — wants what you want and got here first",
  "Handler — represents the people paying, and is not on your side",
  "Local — knows this place, and is not telling you everything",
  "Survivor — has already been through the thing you are walking into",
  "Loyalist — believes in the company, sincerely",
  "Opportunist — is already deciding what to take when this goes wrong",
];

export const rollNpcRole = (rng = Math.random) => pick(NPC_ROLES, rng);

/* ---------------- one-button session seed ---------------- */

export function rollScenario(rng = Math.random, tables = {}) {
  return {
    horror: rollHorror(rng, tables.horror),
    job: rollJob(rng, tables.jobs),
    faction: rollFaction(rng, tables.factions),
    role: rollNpcRole(rng),
  };
}

/** Render a generated scenario as markdown for the prep export. */
export function scenarioToMarkdown(s) {
  return [
    "# Session seed", "",
    "## The job",
    `- **Sector:** ${s.job.sector}`,
    `- **Task:** ${s.job.task}`,
    `- **Complication:** ${s.job.complication}`,
    `- **Pay:** ${s.job.pay.band} — ${s.job.pay.credits} credits. ${s.job.pay.note}`, "",
    "## The client",
    `- **Who:** ${s.faction.kind}`,
    `- **Wants:** ${s.faction.wants}`,
    `- **Method:** ${s.faction.method}`,
    `- **Under pressure because:** ${s.faction.pressure}`, "",
    "## The Horror",
    `- **Transgression:** ${s.horror.transgression}`,
    `- **Omens:** ${s.horror.omens.join("; ")}`,
    `- **Manifestation:** ${s.horror.manifestation}`,
    `- **Banishment:** ${s.horror.banishment}`,
    `- **Slumber:** ${s.horror.slumber}`, "",
    "## A face on the ground",
    `- ${s.role}`, "",
    "---",
    "_Generated by the offline Warden tools. Entries are original to this engine; roll on your own copy of the Warden's Operations Manual for the published tables._",
  ].join("\n");
}
