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
   for four and a half minutes. MP3 rather than Opus or AAC
   because it is the one container every phone that will ever be
   pointed at your host tab can already play.

   BITRATE. These were 64 kbps mono and are now 40 kbps mono at
   16 kHz. That is not a compromise: the source is 8-bit at
   16 kHz, so its usable bandwidth is about 8 kHz and its noise
   floor is enormous. 64 kbps was spending most of its budget
   encoding hiss with great fidelity. The three tapes together
   went from 2.27 MB to 1.4 MB with no audible change, because
   you cannot lose what the source never had.

   WHEN THEY LOAD. This is the part that mattered more than the
   bitrate. Bundled as `?url` assets they were fetched at the
   moment a tape was *found* — which is to say over the Warden's
   laptop wifi, in front of everyone, at the exact instant the
   table has stopped to listen to a dead man. A megabyte on a
   congested hotspot is a ten-second hole in the best scene in
   the module.

   So they are prefetched at session start instead, when nobody
   is waiting and the network is idle. See `prefetchTapes` below.
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

/* ---------------- prefetch ----------------

   Pulled with `fetch` rather than by constructing Audio elements,
   for two reasons. An Audio element with a src is a decode and a
   media-session entry on some handsets — expensive, and visible in
   the notification shade on Android, which is a strange thing to
   show someone who has not found a tape yet. A plain fetch lands
   the bytes in the HTTP cache, which is where the media element
   will look for them later, and does nothing else.

   Deliberately quiet about failure. A prefetch that does not
   complete costs nothing at all — the tape is fetched normally
   when it is played, exactly as it always was — so there is
   nothing here worth interrupting a Warden's session setup for.

   `priority: "low"` is honoured where it exists and ignored
   harmlessly where it does not. It matters because this fires
   during session start, which is also when the app is loading
   everything it actually needs first. */
let started = false;

export function prefetchTapes({ force = false } = {}) {
  if (started && !force) return Promise.resolve(false);
  started = true;
  if (typeof fetch !== "function") return Promise.resolve(false);

  const all = Object.values(tapeAudio).map(({ src }) =>
    fetch(src, { cache: "force-cache", priority: "low" }).catch(() => null)
  );
  return Promise.all(all).then(() => true, () => false);
}

export default tapeAudio;
