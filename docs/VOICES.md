# VOICES

Recorded lines for a module's NPCs, cut ahead of time, played by the app when they
exist and quietly ignored when they do not.

## Why

`ui/useVoice.js` reads the feed aloud through the browser's own speech synthesiser.
At a wardenless table that is the difference between a performance and six people
skimming a TV at six different speeds, and it is the right default: it runs on the
device, calls nothing, and pronounces words a module author already wrote.

It is also one voice for ten people and a cat. Sonya, Jerome and Giovanni are read
in the same flat register, so the table has to read the name on the screen to know
who spoke — which is the thing the voice was there to avoid.

This gives each of them their own. Giovanni is slow and slightly bright, because
pleasant-at-the-wrong-speed is the whole character. Dana is slow and flat, because
the pauses *are* the character. You can tell who is talking with your eyes shut.

## The promise it does not break

Nothing is generated at run time and nothing new is fetched from anywhere.

The mp3s are cut on your machine, by you, on purpose, from sentences already in the
module — the same standing as a font or a cassette. What ships is audio files in
`public/`, served by the same origin as the app, exactly like the three tapes in
`modules/ypsilon14/audio.js`. A table on a LAN with no uplink plays them as well as
one with fibre.

`INV-1` is about where a sentence came from. Every sentence here came from
`npcs.js`. The recorder has no opinion about the words and no way to acquire one.

The manifest is a bundled JS module rather than a JSON file fetched at boot, so
`src/` gains no new network call and `tests/offline.test.js` needs no new entry in
its allowlist. That was a deliberate choice and it is worth keeping.

## Running it

Double-click **`Voices.bat`** on Windows, or **`voices.command`** on a Mac —
right-click ▸ Open the first time, because macOS blocks downloaded scripts until
you do. If it has never run: `chmod +x voices.command`.

It needs Node (already a hard requirement) and Python. It installs `edge-tts` the
first time and never again.

Take option 1 the first time. Eight lines, thirty seconds, and you will know
immediately whether you like the casting before committing to all eighty.

By hand, if you prefer:

```
node   tools/voice-spec.mjs ypsilon14        # what is there to say
python tools/voice-generate.py ypsilon14     # say it
node   tools/voice-manifest.mjs              # tell the app what exists
```

Useful flags on the recorder:

```
--npc sonya          just this person, repeatable
--limit 8            stop after this many files
--dry-run            list it, write nothing
--force              re-record over what is there (after changing a voice)
--list-voices        every voice edge-tts actually offers
--only knows         knows | deflection | script, repeatable
```

`--prune` on the manifest tool deletes orphans — clips whose line has been edited
since, which are harmless but are dead weight in the build and in git. Counted by
default, deleted only when asked.

## What gets recorded

Three sources, all of them written by the module author:

| | |
|---|---|
| `knows` | The dialogue script, and the hard limit on what the person may say — the same list `npcReply` and the director's NPC rung are bound by. |
| `deflections` | What they say when they have nothing. Someone who declares none borrows the engine's, read out of `oracle.js`, in that person's own voice — the table hears a deflection far more often than any single fact. |
| `npcSay(…)` | The handful of lines a module's simulation puts in somebody's mouth at a scripted moment, found by reading the module's source, because there is nowhere else they are declared. |

Ypsilon 14 comes out as **9 speaking parts, 80 lines, 5,728 characters**:

```
giovanni   9      sonya     13      rosa       9
dana       9      kantaro    8      jerome     8
ashraf     8      morgan     8      rie        8
```

Mike and Prince are excluded on purpose. A cat should not inherit generic
deflections and neither should a man who vanished the night before play starts.
Lines that are pure stage direction — `[she keeps working]` — drop out too, because
there is nothing in them to say.

## How a clip finds its line

A clip's filename is a hash of the words it contains. `src/ui/voiceKey.js` computes
it and both sides of the system call that one function, so the recorder and the
player can never disagree about what a file is.

```
public/voice/<module>/<npcId>/<key>.mp3
```

Indexes would have been shorter and would have been wrong the first time somebody
inserted a sentence: every clip after the insertion would quietly belong to the
wrong line, and nothing would report it, because an mp3 is not type-checked. A
content hash cannot drift. Change a sentence and its clip stops matching, gets
rebuilt on the next run, and shows up in the coverage count meanwhile.

The key ignores case, curly versus straight quotes, dashes and punctuation
generally — those are the edits a module gets between sessions, and re-recording
eighty lines over a smart apostrophe is how a feature ends up unused. Change a
*word* and you get a new key, because that is a different performance.

## Casting

`tools/voice-cast.json` is the casting session and it is meant to be argued with.
One entry per NPC id, with a voice, a rate, a pitch and a note saying why.

The casting there is character-led, not name-led: a voice is picked for how the
person behaves, and the accents are spread out mainly so that ten people in one
corridor are distinguishable. Change any of it. `--force` re-cuts, and hearing it
is the only way to know.

A typo in a voice name is caught in about a second — the recorder checks your cast
against the live list before it cuts anything, rather than letting you find out at
the table.

## Failure is silence, then the synthesiser

Every path out of `ui/voiceClips.js` is either a clip or `false`. A missing key, a
404, a phone that will not decode mp3, an autoplay policy refusing the first sound
before the first tap — all of them fall back to the browser voice, which is exactly
what happened before any of this existed.

A half-finished run is a half-improved table. A voice pack must never be able to
make a line go unread.

## Committing it

The mp3s belong in git alongside `src/voice/manifest.js`. `.gitattributes` already
pins `*.mp3` as binary. Ypsilon 14's eighty lines are small — comparable to one of
the cassettes — but the recorder is resumable, so if you stop halfway you can
commit what you have and finish later.

## Files

**New**

```
Voices.bat                  Windows launcher (CRLF, no PowerShell — see Play.bat)
voices.command              Mac/Linux launcher
tools/voice-spec.mjs        step 1 — what is there to say
tools/voice-generate.py     step 2 — say it
tools/voice-manifest.mjs    step 3 — tell the app what exists
tools/voice-cast.json       who sounds like who
src/ui/voiceKey.js          one name for a line, shared by tools and app
src/ui/voiceClips.js        find a clip, play it, fall back
src/voice/manifest.js       generated; committed empty so the import resolves
```

**Replaced**

```
src/ui/useVoice.js          tries a clip before the synthesiser
```

`useVoice` keeps its signature, so `App.jsx` needs no change. It gains two optional
options — `moduleId` for a lookup hint and `clips: false` to force the synthesiser
— and `speakFeed` now passes each line's `extra` through, which is where the NPC id
already lived.

`tools/spec/` is written by step 1. Committing it is harmless and makes the
manifest tool able to spot orphans on a fresh checkout; ignoring it is equally
fine.

## Verified

Against a clean checkout: `npm run lint` clean on all new files,
`tests/offline.test.js` 8/8, `tests/ui.test.jsx` 15/15, and a full `vite build`
with the clips shipping into `dist/voice/` and the manifest bundled into the entry
chunk.

Three failures on that checkout are older than this work and unrelated to it:
`vite build` stops on `deadweight/index.js` having no default export,
`tests/boot.test.jsx` fails 4 of 5, and `tests/smoke.test.jsx` flags the stray
files named `test` and the two applied `.patch` files sitting in the tree.
