/* ============================================================
   READING IT OUT

   With a Warden, somebody reads the room description aloud and
   THAT IS THE PERFORMANCE. The prose in this engine is written to
   be heard: the atmosphere pools are paced for a speaking voice,
   `cinema` puts the last line up as a lower third, the whole
   thing reads like a script.

   With the chair empty nobody was reading it. Six people skimmed
   a TV at six different speeds and the timing the module author
   wrote was thrown away.

   This is the smallest honest fix: the browser's own speech
   synthesiser, saying the lines the table screen is already
   showing.

   WHAT IT IS NOT. It is not a voice model, it does not call
   anything, and it does not touch the network — `speechSynthesis`
   ships with the browser and runs on the device. INV-1 is about
   generated *content*; nothing here generates a word, it only
   pronounces words a human author already wrote. The offline
   test greps for inference calls and there is nothing here for it
   to find.

   OFF BY DEFAULT, and deliberately. A table that did not ask for
   a robot voice must never get one.
   ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** The kinds worth speaking. Everything else on the feed is
    bookkeeping — dice totals, `[oracle · likely · rolled 34]`,
    system markers — and a voice reading those aloud is the
    fastest way to make a table turn the voice off. */
export const SPOKEN_KINDS = new Set(["room", "warden", "npc", "horror", "interject", "say", "good"]);

/** Square-bracketed working, dice notation and the engine's own
    typographic markers, stripped before speaking. The screen wants
    them; an ear does not. */
function speakable(text) {
  return String(text || "")
    .replace(/\[[^\]]*\]/g, " ")        // [oracle · likely · rolled 34 vs 60]
    .replace(/^—\s*|\s*—$/g, " ")       // — 10 minutes pass —
    .replace(/\b(\d+)d(\d+)\b/gi, "$1 d $2")
    .replace(/\s+/g, " ")
    .trim();
}

/** Is the API actually here? Node, jsdom and a locked-down browser
    all say no, and every one of those has to be a silent no rather
    than a crash. */
export const voiceAvailable = () =>
  typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";

/**
 * @param {{enabled?:boolean, rate?:number, pitch?:number, voiceURI?:string}} opts
 */
export default function useVoice({ enabled = false, rate = 0.95, pitch = 0.9, voiceURI = null } = {}) {
  const [voices, setVoices] = useState([]);
  const spokenIds = useRef(new Set());
  const available = voiceAvailable();

  /* Voice lists arrive asynchronously in most browsers and are
     empty on the first synchronous read, which is why this is an
     effect and not a getter. */
  useEffect(() => {
    if (!available) return undefined;
    const read = () => setVoices(window.speechSynthesis.getVoices() || []);
    read();
    window.speechSynthesis.addEventListener?.("voiceschanged", read);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", read);
  }, [available]);

  /* Prefer an English voice that is not the chirpy default. Purely
     cosmetic, and it falls back to whatever exists. */
  const chosen = useMemo(() => {
    if (!voices.length) return null;
    if (voiceURI) { const v = voices.find((x) => x.voiceURI === voiceURI); if (v) return v; }
    return voices.find((v) => /en-GB/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang)) || voices[0];
  }, [voices, voiceURI]);

  const cancel = useCallback(() => {
    if (available) window.speechSynthesis.cancel();
  }, [available]);

  const speak = useCallback((text) => {
    if (!available || !enabled) return;
    const clean = speakable(text);
    if (!clean) return;
    const u = new window.SpeechSynthesisUtterance(clean);
    u.rate = rate; u.pitch = pitch;
    if (chosen) u.voice = chosen;
    window.speechSynthesis.speak(u);
  }, [available, enabled, rate, pitch, chosen]);

  /* Turning it off mid-sentence has to stop the sentence. A voice
     that keeps talking after the table pressed the button is worse
     than one that never started. */
  useEffect(() => { if (!enabled) cancel(); }, [enabled, cancel]);
  useEffect(() => cancel, [cancel]);

  /**
   * Speak whatever is new on the feed since the last call.
   *
   * ONLY EVER FORWARD. On a reconnect the feed arrives whole, and
   * a screen that reads forty lines of backlog at a table that has
   * already played them is the thing that gets this feature
   * switched off permanently. Ids already seen are never spoken,
   * and the first call after mounting seeds the set silently.
   */
  const speakFeed = useCallback((feed) => {
    if (!Array.isArray(feed)) return;
    const seeded = spokenIds.current.size > 0;
    for (const line of feed) {
      if (line.id == null || spokenIds.current.has(line.id)) continue;
      spokenIds.current.add(line.id);
      if (!seeded) continue;                       // backlog: mark, do not read
      if (!SPOKEN_KINDS.has(line.kind)) continue;
      speak(line.text);
    }
    if (!seeded) spokenIds.current.add("__seeded__");
  }, [speak]);

  return { available, voices, voice: chosen, speak, speakFeed, cancel };
}
