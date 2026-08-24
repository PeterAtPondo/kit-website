# Blog narration pipeline

Two steps turn a blog post into an audio version, using ElevenLabs.

## 1. Extract the script (no audio, no key)

Strips diagrams, inline SVG, pull-quotes, tables, and code blocks, keeping only
the spoken prose plus a short title/byline intro. Short inline identifiers are
turned into speakable words rather than silently removed. Writes
`narration.txt` next to the post's `index.html`.

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

## Performance pass

`narration.txt` is a performance script, not a published transcript. Review it
before synthesis. In particular, disambiguate every standalone `read` as
`reed` or `red`; River can choose the wrong tense from context. Those phonetic
spellings belong only in the ignored narration input, never in article prose.

Posts run roughly 6 to 20 minutes. Long posts are split on paragraph boundaries
under ElevenLabs' request cap and concatenated losslessly with ffmpeg. Credit
cost scales with characters, so render only missing or deliberately revised
posts rather than using `--all` by habit.
