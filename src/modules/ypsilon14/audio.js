/* ============================================================
   YPSILON 14 — THE TAPES, AS ACTUAL SOUND

   ui/audio.js synthesises everything and fetches nothing, and
   that is still true of every ambience bed and every one-shot.
   This file is the one deliberate exception, and it is worth
   being clear about why.

   A cassette is not ambience. It is a prop the crew found, in a
   room, on a body, in a duct — the single most physical thing in
   the module. "The tape plays and you hear a dead man" is a
   sentence the Warden has to perform. Handing the player the
   actual recording is the difference between being told about
   evidence and holding it.

   The offline promise survives intact: these are bundled assets
   served by the same origin as the app. A table on a LAN with no
   uplink plays them exactly as well as one with fibre. Nothing
   leaves the room, and nothing is fetched from anywhere else.

   Imported with `?url` rather than referenced by string path so
   Vite fingerprints them, emits them into dist/ and cache-busts
   them. Referencing them by literal path would work in dev and
   then silently 404 on GitHub Pages, which is the worst kind of
   bug: one that only appears at the table.

   SOURCE FORMAT. The uploads are 8-bit 16 kHz PCM .wav — 9 MB
   for four and a half minutes. Re-encoded to 64 kbps mono MP3
   they are 2.2 MB and audibly identical, because you cannot
   lose what an 8-bit source never had. MP3 rather than Opus or
   AAC because it is the one container every phone that will ever
   be pointed at your host tab can already play.
   ============================================================ */
import blue from "./assets/casettes/Blue-Cassette.mp3?url";
import yellow from "./assets/casettes/Yellow-Cassette.mp3?url";
import white from "./assets/casettes/White-Cassette.mp3?url";

/**
 * handout id -> the recording, and how long it runs.
 *
 * `secs` is declared rather than read off the file because the
 * deck draws its reels before the browser has downloaded enough
 * of the audio to know the duration, and a cassette whose spools
 * jump into position two seconds late looks broken. The real
 * duration replaces it as soon as metadata lands.
 */
export const tapeAudio = {
  tape1: { src: blue, secs: 180 },
  tape2: { src: yellow, secs: 39 },
  tape3: { src: white, secs: 65 },
};

export default tapeAudio;
