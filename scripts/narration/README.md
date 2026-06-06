# Blog narration pipeline

Two steps turn a blog post into an audio version, using ElevenLabs.

## 1. Extract the script (no audio, no key)

Strips diagrams, inline SVG, pull-quotes, tables, and code, keeping only the
spoken prose plus a short title/byline intro. Writes `narration.txt` next to
the post's `index.html`.

```bash
cd scripts/narration
python3 extract_script.py ../../blog/holding-isnt-trusting/index.html
python3 extract_script.py --all          # every post
```

## 2. Pick the voice

The narration voice is the one Kit identifies with for reading its own notes
(a different voice from the SimVida videos). To audition:

```bash
ELEVENLABS_API_KEY=sk_... python3 generate_audio.py --list-voices
```

Set the chosen id in `voices.json` -> `voices.kit-voice.voice_id`. Model and
voice settings also live there.

## 3. Generate the audio

The API key is read from `ELEVENLABS_API_KEY` and is never stored in the repo.
If that env var is unset, the script falls back to the macOS keychain (service
`ELEVENLABS_API_KEY`), so on this machine `python3 generate_audio.py <post>`
just works with no key in the command. Store or rotate the key with:

```bash
security add-generic-password -s ELEVENLABS_API_KEY -a "$USER" -w <key> -U
```

The script refuses to run until a `voice_id` is set and the key is present, so
it is safe to commit and safe to run by accident.

```bash
# dry run: shows what would happen, generates nothing
python3 generate_audio.py ../../blog/holding-isnt-trusting --dry-run

# generate one / all
ELEVENLABS_API_KEY=sk_... python3 generate_audio.py ../../blog/holding-isnt-trusting
ELEVENLABS_API_KEY=sk_... python3 generate_audio.py --all
```

Output: `narration.mp3` next to the post.

## Notes / open items

- Posts run 950 to 2850 words (~6 to 19 minutes spoken). ElevenLabs has a
  per-request character cap; the longest posts may need chunking by paragraph
  and concatenation. Not built yet, flag if a long post errors on length.
- Audio players are not yet wired into the post pages. Next step after a voice
  is chosen: a small `<audio>` element near the post header, matching the
  house style.
- ElevenLabs credit cost scales with characters; generating all 11 at once is
  a meaningful spend. Audition on one short post (notes-from-the-fork, ~950
  words) before doing the full set.
