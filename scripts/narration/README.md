# Blog narration pipeline

Three steps turn a blog post into an audio version, using ElevenLabs. The
first two need no key and generate nothing; only the third spends credit.

## 1. Extract the script, and make it speakable (no audio, no key)

`extract_script.py` strips diagrams, inline SVG, pull-quotes, tables, footnote
markers and code blocks, keeping only the spoken prose plus the title, the
credit and the standfirst. Short inline identifiers are turned into speakable
words rather than silently removed. It writes `narration.txt` next to the
post's `index.html` and then hands that file to `speakable.py`, which rewrites
what is written for the eye into what is right for the ear.

```bash
cd scripts/narration
python3 extract_script.py ../../blog/you-are-in-control/index.html
python3 extract_script.py --all          # every post
python3 extract_script.py <post> --raw   # extract only, no speakable pass
```

### What the page contributes

- **The standfirst.** The byline reads "Written by Kit, with Peter." and then
  the standfirst. The credit is spoken by the intro, so the extractor drops it
  and keeps the sentences after it as the opening line of the read, which is
  what they are on the page.
- **`<h3>` inside a section.** On the page a short section is a card title with
  a paragraph under it. In the ear it is one paragraph, the title read as its
  first sentence, so the extractor folds the two together.
- **Footnote markers and sources.** `sup.post__ref` is dropped, and the
  numbered sources live in the post footer rather than the body, so they never
  reach the extractor at all. A narration that recites fourteen citations is
  not a narration.

### What `speakable.py` rewrites

Run in this order, on the extracted text:

| | Written for the eye | Read for the ear |
| --- | --- | --- |
| 1 | Dates: `31 August` | the thirty-first of August |
| 2 | Years: `2026` | twenty twenty-six |
| 3 | Money: `$4.5 billion`, `$300` | 4.5 billion dollars, three hundred dollars |
| 4 | Memory sizes: `512 gigabytes`, `512 GB` | five hundred and twelve gigs |
| 5 | Model names: `M5`, `27B`, `Qwen3.8-27B` | M five, twenty-seven B, Kwen three point eight, twenty-seven B |
| 6 | Big numbers: `1,024`, `290` | one thousand and twenty-four, two hundred and ninety |
| 7 | Pronunciation table | see below |
| 8 | Past-tense `read` | `red`, from a phrase list |
| 9 | Curly quotes and ellipses | plain ASCII |
| 10 | The extractor's 0.6s pause after a heading | 1.4s, so a section change lands |

**Break tags are never touched.** Every `<break …>` is swapped for a
letters-only placeholder before any rule runs and put back afterwards, so no
number rule can reach inside one and read the pause out loud.

**Pronunciation table** (`PRONUNCIATION` in `speakable.py`). Add names here
rather than spelling them phonetically in the article, which readers would see:

| Written | Spoken |
| --- | --- |
| Ollama | Oh-Lama |
| Qwen | Kwen |
| Pew | Pew |

**Past-tense read list** (`PAST_TENSE_READ`). River reads a bare `read` as the
present tense far more often than not, so past-tense phrases are spelt `red`
for the engine: `and read what comes back`, `we read it`, `had read`,
`have read`, `has read`. Keep each entry long enough to be unambiguous. These
spellings belong in `narration.txt` only, never in article prose.

The run prints a short report: how many digits are still standing outside a
break tag, how many heading pauses were lengthened, and every `read` in the
text with its context, so the tense can be checked by eye. `speakable.py` can
also be run on its own, and exits non-zero if digits remain:

```bash
python3 speakable.py ../../blog/you-are-in-control/narration.txt
```

Both steps are safe to run twice on the same file.

## 2. Pick the voice

The narration voice is the one Kit identifies with for reading its own notes
(a different voice from the SimVida videos). To audition:

```bash
ELEVENLABS_API_KEY=sk_... python3 generate_audio.py --list-voices
```

Set the chosen id in `voices.json` -> `voices.kit-voice.voice_id`. Model and
voice settings also live there.

The current settings, stability 0.55, similarity 0.75, style 0.2 and speed
0.95, are the ones the operator chose on 6 September 2026 after auditioning
the alternatives; they are what produced the approved take of Note No. 028.
Do not change them without a fresh audition, and do not re-render older notes
against them by habit: their MP3s were made under the previous settings and
still match their published text.

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
python3 generate_audio.py ../../blog/you-are-in-control --dry-run

# generate one / all
ELEVENLABS_API_KEY=sk_... python3 generate_audio.py ../../blog/you-are-in-control
ELEVENLABS_API_KEY=sk_... python3 generate_audio.py --all
```

Output: `narration.mp3` next to the post.

## Performance pass

`narration.txt` is a performance script, not a published transcript. Review it
before synthesis; the speakable pass does the mechanical work, not the
judgement. In particular, check every standalone `read` the report prints and
add the phrase to `PAST_TENSE_READ` if the tense is past.

Posts run roughly 6 to 20 minutes. Long posts are split on paragraph
boundaries under ElevenLabs' request cap and concatenated losslessly with
ffmpeg. Credit cost scales with characters, so render only missing or
deliberately revised posts rather than using `--all` by habit, and remember
that re-extracting a post overwrites a `narration.txt` its MP3 may already
have been made from.

## Duration label

The `post__audio-dur` label on a post is the real length of its MP3, rounded to
the nearest minute:

```bash
ffprobe -v error -show_entries format=duration \
  -of default=noprint_wrappers=1:nokey=1 blog/<slug>/narration.mp3
```
