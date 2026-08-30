/* ============================================================
   GENERATED FILE — do not edit by hand.

   Written by `node tools/voice-manifest.mjs`. Committed empty so
   that the import in `ui/voiceClips.js` always resolves: a build
   that fails because nobody has recorded anything yet would be a
   worse outcome than a table with no voices, and a missing file
   under Vite is a hard error rather than a shrug.

   WHY A JS MODULE AND NOT JSON OVER THE WIRE. Fetching a manifest
   would be a fourth same-origin call in `src/`, would need an
   entry in the allowlist in `tests/offline.test.js`, and would be
   one more thing that can be slow at the moment a scene starts.
   Bundled, it is a few hundred bytes in the entry chunk, it is
   there before the first line is spoken, and the offline promise
   needs no new exception. The audio itself is in `public/voice/`
   and is fetched by the media element when a line is actually
   said, which is the same shape as the cassettes.

   `clips` is a list of keys; see `ui/voiceKey.js` for what a key
   is. The path of a clip is:

     <base>voice/<module>/<npcId>/<key>.mp3
   ============================================================ */

export const voiceManifest = {
  version: 1,
  generated: null,
  modules: {},
};

export default voiceManifest;
