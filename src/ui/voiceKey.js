/* ============================================================
   ONE NAME FOR A LINE

   A recorded line and the line on the feed have to agree about
   what they are, without a database and without an id written by
   hand into every module. The agreement is a hash of the words
   themselves: `tools/voice-spec.mjs` names the file, `ui/
   voiceClips.js` looks the file up, and both get the name from
   here so there is exactly one place the rule lives.

   WHY NOT INDEXES. `knows[3]` would be shorter and it would be
   wrong the first time somebody inserts a sentence — every clip
   after the insertion would quietly belong to the wrong line, and
   nothing would report it, because a wav is not type-checked. A
   content hash cannot drift: change the words and the clip stops
   matching, which is the correct behaviour and is visible in the
   coverage count.

   WHAT THE KEY IGNORES. Case, curly versus straight quotes, en
   and em dashes, and punctuation generally. Those are the edits a
   module gets between sessions — a comma, a smart apostrophe from
   a paste — and re-recording ninety lines because of a comma is
   how a table ends up not using this at all. Change a *word* and
   you get a new key, because that is a different performance.
   ============================================================ */

/** Bracketed working, dice notation and the engine's own typographic
    markers, stripped before speaking. The screen wants them; an ear
    does not, and neither does a voice actor.

    This is the transform `useVoice` has always applied before
    handing text to the browser's synthesiser. It lives here now so
    that the recorded line and the spoken line are the same line. */
export function speakable(text) {
  return String(text || "")
    .replace(/\[[^\]]*\]/g, " ")        // [oracle · likely · rolled 34 vs 60]
    .replace(/^—\s*|\s*—$/g, " ")       // — 10 minutes pass —
    .replace(/\b(\d+)d(\d+)\b/gi, "$1 d $2")
    .replace(/\s+/g, " ")
    .trim();
}

/** The feed writes NPC lines as `SONYA: "Ask me something I can
    answer."` — the name is for the screen. A clip is one person
    saying one thing, so the prefix comes off before the key is
    taken and before the file is cut.

    Deliberately narrow: a name, a colon, a space, near the start.
    Anything longer than a name is left alone, because a line that
    happens to contain a colon is not a speaker prefix. */
export function stripSpeaker(text) {
  return String(text || "").replace(/^[^:\n]{1,48}:\s+/, "");
}

/** Lowercase, unify the quote and dash characters a paste brings
    in, drop everything that is not a letter, a digit or a space.
    See the header for why the key is this forgiving. */
function normalise(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* FNV-1a, run twice with different offsets and concatenated. Two
   32-bit halves rather than one because a single 32-bit hash over a
   few hundred lines is a one-in-ten-thousand collision, and a
   collision here means one NPC speaks in another's voice with no
   error anywhere — the exact kind of bug that gets noticed at the
   table and nowhere else. Sixty-four bits makes it not a concern.

   Not crypto.subtle: that is async, and the feed reader calls this
   synchronously while deciding what to do with a line. */
function fnv(str, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const hex8 = (n) => n.toString(16).padStart(8, "0");

/** The filename, without extension, for a piece of already-
    speakable text. */
export function voiceKey(text) {
  const n = normalise(text);
  if (!n) return "";
  return hex8(fnv(n, 0x811c9dc5)) + hex8(fnv(n, 0x9e3779b9));
}

/** The whole journey, for a raw feed line: drop the speaker, strip
    the stage directions, take the key. Both sides call this. */
export function lineKey(text) {
  return voiceKey(speakable(stripSpeaker(text)));
}

export default voiceKey;
