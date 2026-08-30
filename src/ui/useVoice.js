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

   ------------------------------------------------------------
   RECORDED LINES, WHEN THERE ARE ANY

   One synthesised voice for a whole cast is the weakest thing
   about this feature: ten people and a cat, all of them read in
   the same flat register, and the table has to keep reading the
   name to know who spoke.

   `tools/voice-spec.mjs` and `tools/voice-generate.py` cut every
   line a module's NPCs can say into an mp3 in a voice chosen per
   person, ahead of time, on somebody's own machine. When a clip
   for this exact line by this exact person exists, it plays.
   When it does not — no pack installed, a line edited since, a
   phone that will not decode it — the synthesiser says it, as it
   always did. The recorded path can only ever be an improvement
   on the fallback, never a way for a line to go unread.

   The clip is the line without the speaker's name in front of it,
   because a different voice has already answered the question the
   name was there to answer.
   ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { speakable, stripSpeaker, lineKey } from "./voiceKey.js";
import { clipUrl, playClip, stopClip } from "./voiceClips.js";

/** The kinds worth speaking. Everything else on the feed is
    bookkeeping — dice totals, `[oracle · likely · rolled 34]`,
    system markers — and a voice reading those aloud is the
    fastest way to make a table turn the voice off. */
export const SPOKEN_KINDS = new Set(["room", "warden", "npc", "horror", "interject", "say", "good"]);

export { speakable };

/** Is the API actually here? Node, jsdom and a locked-down browser
    all say no, and every one of those has to be a silent no rather
    than a crash. */
export const voiceAvailable = () =>
  typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";

/**
 * @param {{enabled?:boolean, rate?:number, pitch?:number, voiceURI?:string, moduleId?:string, clips?:boolean}} opts
 */
export default function useVoice({
  enabled = false,
  rate = 0.95,
  pitch = 0.9,
  voiceURI = null,
  moduleId = null,
  clips = true,
} = {}) {
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
    stopClip();
    if (available) window.speechSynthesis.cancel();
  }, [available]);

  /** The synthesiser, on its own. Split out so the recorded path
      has something to fall back to that is exactly the old
      behaviour and not a reimplementation of it. */
  const synth = useCallback((clean) => {
    if (!available || !clean) return;
    const u = new window.SpeechSynthesisUtterance(clean);
    u.rate = rate; u.pitch = pitch;
    if (chosen) u.voice = chosen;
    window.speechSynthesis.speak(u);
  }, [available, rate, pitch, chosen]);

  /**
   * Say one line.
   *
   * @param {string} text  what the feed is showing
   * @param {{npc?:string}} [meta] `extra` off the feed line, which
   *        carries the NPC id for anything anyone said.
   */
  const speak = useCallback((text, meta) => {
    if (!enabled) return;
    const npcId = meta && meta.npc;

    if (clips && npcId) {
      const spoken = speakable(stripSpeaker(text));
      const url = spoken ? clipUrl(npcId, lineKey(text), moduleId) : null;
      if (url) {
        playClip(url).then((ok) => { if (!ok) synth(spoken); });
        return;
      }
    }

    const clean = speakable(text);
    if (!clean) return;
    synth(clean);
  }, [enabled, clips, moduleId, synth]);

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
      speak(line.text, line.extra);
    }
    if (!seeded) spokenIds.current.add("__seeded__");
  }, [speak]);

  return { available, voices, voice: chosen, speak, speakFeed, cancel };
}
