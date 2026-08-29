/* ============================================================
   TRANSCRIPT — the session record.

   A play aid's most valuable output is the story it produced.
   This turns the feed plus the roll log into markdown you can
   keep, paste into a campaign journal, or hand to your table.
   ============================================================ */
import { fmtClock, STAT_LABEL } from "./rules.js";
import { pad } from "./dice.js";
import { rulingsMarkdown } from "./ruling.js";

const TONE_PREFIX = {
  you: "> ", npc: "> ", room: "", warden: "", system: "_", item: "**", search: "",
  move: "### ", horror: "**", dmg: "**", good: "", stress: "", roll: "`",
  rollgood: "`", rollbad: "`", panic: "**", alarm: "**", handout: "",
};

function line(entry) {
  const t = entry.text.replace(/\n/g, "\n  ");
  switch (entry.kind) {
    case "move": return `\n### ${t}\n`;
    case "you": return `> **${t}**`;
    case "npc": return `> ${t}`;
    case "system": return `_${t}_`;
    case "item": return `- **${t}**`;
    case "roll": case "rollgood": case "rollbad":
      return "`" + t.replace(/\n/g, " ") + "`";
    case "panic": return `> [!WARNING]\n> ${t.replace(/\n/g, "\n> ")}`;
    case "alarm": return `> [!CAUTION]\n> ${t.replace(/\n/g, "\n> ")}`;
    case "horror": return `**${t}**`;
    case "dmg": return `**${t}**`;
    case "handout": return `> ${t.replace(/\n/g, "\n> ")}`;
    default: return t;
  }
}

/**
 * @param {object}  o
 * @param {string|null} [o.viewerPcId] whose copy this is. A player
 *        exporting from their own phone passes their pcId and gets
 *        their own rulings; `null` is the shared-screen reader and
 *        sees only the public ones.
 * @param {boolean} [o.isWarden] the Warden's copy, which carries the
 *        private rulings and the ones that were taken back.
 */
export function toMarkdown({ mod, world, crew, feed, endedAt, viewerPcId = null, isWarden = false }) {
  const out = [];
  out.push(`# ${mod.title}`);
  if (mod.byline) out.push(`_${mod.byline}_`);
  out.push("");
  out.push(`**Elapsed:** ${fmtClock(world.clock)} · **Session:** ${world.session} · **Recorded:** ${new Date().toLocaleString()}`);
  out.push("");

  out.push("## The crew");
  out.push("");
  out.push("| Name | Class | Health | Stress | Resolve | Status |");
  out.push("|---|---|---|---|---|---|");
  for (const c of crew) {
    const status = c.alive === false ? "**Dead**" : c.unconscious ? "Unconscious" : "On their feet";
    out.push(`| ${c.name} | ${c.cls} | ${c.health}/${c.maxHealth} | ${c.stress} | ${c.resolve} | ${status} |`);
  }
  out.push("");

  if (world.ended && mod.endings[world.ended]) {
    const e = mod.endings[world.ended];
    out.push(`## Ending — ${e.title}`);
    out.push("");
    out.push(e.text);
    out.push("");
  }

  out.push("## The record");
  out.push("");
  for (const entry of feed) out.push(line(entry));
  out.push("");

  if (world.rollLog && world.rollLog.length) {
    out.push("## Every roll");
    out.push("");
    out.push("| Time | Who | Roll | Target | Result |");
    out.push("|---|---|---|---|---|");
    for (const r of world.rollLog) {
      const res = r.critHit ? "CRIT SUCCESS" : r.critFail ? "CRIT FAILURE" : r.success ? "success" : "failure";
      /* Where the number came from. A reader working out why Riley
         died wants to know whether the 97 was the engine's or the
         room's, and a log that cannot say has claimed the engine
         produced a number it did not. See engine/declared.js. */
      const src = r.declared ? " · table dice" : "";
      out.push(`| ${fmtClock(r.clock)} | ${r.who} | ${r.label} ${pad(r.value)}${r.mode && r.mode !== "none" ? ` [${r.mode === "advantage" ? "+" : "−"}]` : ""} | ${r.target} | ${res}${src} |`);
    }
    out.push("");
  }

  /* WHAT THE TABLE MADE UP, IN ONE PLACE.

     Rulings are already in `## The record` as the lines they were
     said as, which is how they happened and is not how anybody wants
     to find them again. Gathered here they are the most interesting
     page of the document: the facts this evening added to a module
     that did not ship them. A reader wants to be able to tell those
     apart from the author's, and interleaving destroys exactly that
     distinction. See engine/ruling.js.

     Redaction is the same bargain endcard.js makes. A player's copy
     is built from their own feed and gets their own rulings; the
     Warden's carries everything, including what was taken back. */
  const ruled = rulingsMarkdown(world, { viewerPcId, isWarden });
  if (ruled) {
    out.push(ruled);
    out.push("");
  }

  out.push("---");
  out.push("");
  out.push("_Recorded by the offline engine. No network was involved in producing this session._");
  return out.join("\n");
}

/** Compact roll statistics, for the debrief screen. */
export function rollStats(world) {
  const log = world.rollLog || [];
  const n = log.length;
  if (!n) return { n: 0 };
  const succ = log.filter((r) => r.success).length;
  const crit = log.filter((r) => r.critHit).length;
  const fumble = log.filter((r) => r.critFail).length;
  const worst = log.reduce((a, b) => (a && a.margin < b.margin ? a : b), log[0]);
  const best = log.reduce((a, b) => (a && a.margin > b.margin ? a : b), log[0]);
  return {
    n, succ, crit, fumble,
    rate: Math.round((succ / n) * 100),
    worst, best,
  };
}

export const filename = (mod, world) =>
  `${mod.id}-${new Date().toISOString().slice(0, 10)}-${fmtClock(world.clock).replace(":", "")}.md`;

export { STAT_LABEL };
