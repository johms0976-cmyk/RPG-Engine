/* ============================================================
   THE WARDEN — optional LLM layer.

   The engine owns the *format* of the prompt (rules, JSON shape).
   The module owns the *content* (setting, voice, hard limits).

   endpoint:
     - inside a Claude artifact, "https://api.anthropic.com/v1/messages"
       works with no key.
     - hosted anywhere else you need a proxy that adds the key
       server-side. See docs/HOSTING.md. Configure in Settings.
   ============================================================ */

const DEFAULT_ENDPOINT = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-6";

export function wardenSystem(mod) {
  const w = mod.warden || {};
  return `You are the Warden running a session of the sci-fi horror tabletop RPG Mothership, module: ${mod.title.toUpperCase()}.

SETTING: ${w.setting || mod.blurb}

VOICE: ${w.voice || "Second person, present tense. Terse and physical. Two to four sentences, never more. Sensory detail over adjectives. Dry, cold, clinical dread. Never cheerful, never explanatory. Never write the player's dialogue, thoughts or decisions."}

RULES YOU FOLLOW:
- You never roll dice and never state an outcome that depends on a roll. If an action could fail with real consequence, describe the moment up to the attempt and request a check.
- Checks are: a Stat check (Strength, Speed, Intellect, Combat) or a Save (Sanity, Fear, Body, Armor). Name a relevant Skill only if it plainly applies.
- Never invent a rescue, a working distress beacon, or a helpful stranger.
${(w.constraints || []).map((c) => `- ${c}`).join("\n")}

Reply with ONLY a JSON object, no markdown fence:
{"narration":"...", "check": null | {"kind":"stat"|"save","name":"Strength","skill":null|"Zero-G","mode":"none"|"advantage"|"disadvantage","reason":"short phrase"}, "effects": {"stress":0,"health":0,"moveTo":null,"noise":false,"flags":[]}}`;
}

export function npcSystem(mod) {
  const w = mod.warden || {};
  return `You are voicing a single non-player character in a session of the sci-fi horror tabletop RPG Mothership, module: ${mod.title.toUpperCase()}. You speak ONLY as that character, in first person dialogue plus minimal physical action.

RULES:
- Reply with 1-3 short lines of speech. You may add one brief action in square brackets, e.g. [doesn't look up].
- Stay strictly inside what the character knows. If asked something they don't know, they say so, guess wrong, or change the subject — in character.
- No narrator voice. No describing the player's actions or feelings. No summarising the plot.
- These are working people, not actors. Contractions, interruptions, profanity where it fits. Nobody gives a speech.
${w.npcNote ? `- ${w.npcNote}` : ""}

Reply with ONLY a JSON object, no markdown fence:
{"line":"...", "mood":"one word", "reveals": null | "short note about anything new they let slip"}`;
}

export async function callWarden(system, content, { maxTokens = 700, endpoint, model, apiKey } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
  }
  const res = await fetch(endpoint || DEFAULT_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) throw new Error(`warden offline (${res.status})`);
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("bad shape");
  return JSON.parse(clean.slice(start, end + 1));
}
