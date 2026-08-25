# Colour system

Kit is a night-time product. The ground is always the same navy floor, light comes from amber, and the only other colours are the ones that mean something. This section fixes the palette as tokens, shows the contrast maths behind every pairing, and says where each colour may and may not go.

Three decisions sit above everything here and are not up for debate in this document: amber is primary, lavender is secondary, green is tertiary; the orange tile exists only where Kit sits on someone else's ground; and the night grounds are the existing `--kit-bg-*` tokens. Everything below is specification. Nothing in the repo has been edited.

Evidence conventions: `index.html` means `api/ui/index.html`, `main.js` means `api/ui/src/main.js`, `tailwind.config.js` means `api/ui/tailwind.config.js`, `Resources/` means `deploy/personal/macos/Resources/`. Audit files are in the sibling `audit/` folder (`AUDIT.md`, `colour-type-tokens.md`, `glyph-web.md`, `glyph-app-comms.md`, `nodes-fireflies-reference.md`, `nodes-elsewhere.md`, `surfaces-inventory.md`). The machine-readable token list is `tokens.json` next to this file; the contrast numbers come from `contrast.py`, also next to this file, and can be re-run.

## 1. Tokens

The existing `--kit-*` RGB-triplet family (`index.html:145-174`) is the canonical palette. It already covers every hue Kit needs; what is missing is a named ink scale, one warm white, one firefly colour, one raised ground and a tile spec. Those are the only new tokens proposed (seven, plus the tile gradient spec and its three stops). The dead "Family A" hex tokens at `index.html:126-136` (`--bg-deep`, `--ink-*`, `--accent-*`) retire; their replacements are in the table in section 1.9.

Triplet convention stays as it is today: opaque use is `rgb(var(--kit-amber))`, tinted use is `rgba(var(--kit-amber), var(--kit-soft))` (`index.html:141-144`). Tailwind utilities reach the same values through the remapped `amber` scale (`tailwind.config.js:25-36`).

### 1.1 Grounds

| Token | Hex | RGB | Role | Exists at |
|---|---|---|---|---|
| `--kit-bg-980` | `#020617` | 2, 6, 23 | Page floor, aurora floor, Lantern window ground, email body ground | `index.html:157` (comment already says "page background, aurora floor") |
| `--kit-bg-950` | `#0a0f1a` | 10, 15, 26 | Deepest surface: app bar, panels, settings panel, composer, onboarding card | `index.html:156` |
| `--kit-bg-900` | `#0f172a` | 15, 23, 42 | Card body, popover, widget panel, email card | `index.html:155`; `api/ui/manifest.webmanifest:10`; `mcp/src/widgets/shell.ts:46` |
| `--kit-bg-850` | `#1e293b` | 30, 41, 59 | Raised or hovered surface, inline code ground, input hover | New token; the value is already used raw at `index.html:1518, 1565, 1600, 2368` |
| `--kit-black` | `#000000` | 0, 0, 0 | Shadows, and the Fireflies canvas clear colour | `index.html:159`; `main.js:24019` |

Notes on the grounds.

- The rendered floor today is `#020409` (`index.html:788, 1241`; Swift `NSColor(srgbRed: 2/255, 4/255, 9/255)` at `KitPersonalApp.swift:3298`). The decision is that the floor is the token, `#020617`. The two differ by a few units of blue; the change is visible only side by side and removes the one-off.
- The Fireflies WebGL canvas stays pure black (`main.js:24019`, rule in the comment at `main.js:23840-23845`: additive halos dissolve cleanest against zero). The canvas is opaque and full-bleed in its tab, so the floor never meets it at a seam.
- The other dark grounds found in the estate (`#0a0e1a`, `#050816`, `#05060f`, `#060913`, `#060b16`, `#06080f`, `#0b0c10`, `#0d1318`, `#0f1729`, `#050a18`, `colour-type-tokens.md:152`) all map to one of the four above: anything within a few units of `#0a0f1a` becomes bg-950, `#0f1729` becomes bg-900, the rest become the floor.

### 1.2 Ink

Text stays on the slate scale the UI already uses. The three decided steps are `#f1f5f9`, `#cbd5e1`, `#94a3b8`; two supporting steps are added for placeholders and for labels on amber, plus the warm white that belongs to light, not to text.

| Token | Hex | RGB | Role | Exists at |
|---|---|---|---|---|
| `--kit-ink` | `#f1f5f9` | 241, 245, 249 | Headings, the wordmark, primary reading text | New token; value is Tailwind slate-100 (`text-slate-100` x404 across `index.html` and partials), `index.html:1593, 2767` |
| `--kit-ink-soft` | `#cbd5e1` | 203, 213, 225 | Body and secondary text, chat bubbles, field labels | New token; value is Tailwind slate-300, raw at `index.html:1091, 1191, 1204` (x29), `main.js` x65 (`colour-type-tokens.md:114`) |
| `--kit-ink-muted` | `#94a3b8` | 148, 163, 184 | Tertiary text, eyebrows, metadata, timestamps | Alias of `--kit-slate`, `index.html:153` |
| `--kit-ink-faint` | `#64748b` | 100, 116, 139 | Placeholders and decorative hairline text only, never body copy | New token; value is Tailwind slate-500, `index.html:1580` (placeholder); `text-slate-500` x770 |
| `--kit-ink-on-amber` | `#1a1207` | 26, 18, 7 | The label colour on amber, firefly and tile fills | New token; value at `api/services/email.py:205, 315` and `Resources/onboarding-shell.html:1299` |
| `--kit-warm-white` | `#fff3df` | 255, 243, 223 | Firefly cores and emitted light only; never UI text | New token; value is the super-node core lerp target at `main.js:25623` |

Notes on ink.

- `text-slate-500` (`#64748b`) is the single most used text utility in the web UI (770 occurrences against 404 for slate-100 and 332 for slate-400). It measures 4.24:1 on the floor and 3.75:1 on bg-900 (matrix A), below AA for normal text everywhere. It is kept as `--kit-ink-faint` for placeholders and is otherwise replaced by `--kit-ink-muted`.
- The body colour set at `index.html:788` (`#e2e8f0`, slate-200) collapses into `--kit-ink-soft` for running text and `--kit-ink` for headings; both pass AAA on every ground.
- The renderer's per-firefly core target is `#fffdf4` (`main.js:24434`) and the super-node core target is `#fff3df` (`main.js:25623`). One named warm white is enough; `#fff3df` is the token and the per-firefly lerp should converge on it (already flagged as an internal inconsistency in `nodes-fireflies-reference.md` section 10).

### 1.3 Primary: the amber ramp

The ramp is the remapped Tailwind `amber` scale (`tailwind.config.js:25-36`). Step 400 is the primary and is the same value as `--kit-amber`.

| Token | Hex | RGB | Role | Exists at |
|---|---|---|---|---|
| `amber-50` | `#fdf5ea` | 253, 245, 234 | Lightest amber; light-context wash and paper tint | `tailwind.config.js:26` |
| `amber-100` | `#fbe9d2` | 251, 233, 210 | Light-context chip ground | `tailwind.config.js:27` |
| `amber-200` | `#f5d0a3` | 245, 208, 163 | Amber text on amber chips; inline code accent; mood accent text | `tailwind.config.js:28` |
| `amber-300` | `#f0bd82` | 240, 189, 130 | Amber text and links on dark grounds; secondary button label | `tailwind.config.js:29` |
| `--kit-amber` (amber-400) | `#e8a55c` | 232, 165, 92 | Primary. The one UI accent: primary button fill, active tab, focus ring, eyebrow, hub corona, working-memory ring | `index.html:147, 134`; `tailwind.config.js:30`; `main.js:24620` |
| `amber-500` | `#d4904a` | 212, 144, 74 | Pressed state of the primary fill | `tailwind.config.js:31` |
| `amber-600` | `#b87738` | 184, 119, 56 | Amber large text on white (light context) | `tailwind.config.js:32` |
| `amber-700` | `#8f5a2a` | 143, 90, 42 | Amber body text and links on white (light context) | `tailwind.config.js:33` |
| `amber-800` | `#6b4320` | 107, 67, 32 | Light-context headings in amber | `tailwind.config.js:34` |
| `amber-900` | `#4a2e16` | 74, 46, 22 | Deepest amber; light-context ink alternative | `tailwind.config.js:35` |
| `--kit-firefly` | `#ffc46b` | 255, 196, 107 | Light-emitting things: firefly halos, the glowing mark, live glow, the "lit" state of a progress track | New token; the renderer's halo lerp target is `#ffc36b` at `main.js:24435`, one unit of green away, and should adopt the token |

### 1.4 Secondary: lavender

| Token | Hex | RGB | Role | Exists at |
|---|---|---|---|---|
| `--kit-purple` | `#a78bfa` | 167, 139, 250 | Secondary accent. The sleep, dream and consolidation state: dream pill, dreaming dot, dream overlay motes and text | `index.html:145` |
| `--kit-violet` | `#8b5cf6` | 139, 92, 246 | Heavy violet for fills and blooms: aurora bloom, sleeping banner, dream scrim, always at `--kit-fill` or below when text sits on it. Not a text colour on bg-900 or lighter (matrix A) | `index.html:146` |
| `--kit-purple-soft` | `#c4b5fd` | 196, 181, 253 | Lavender sheens, dream weave lines, light text on violet fills | `index.html:160` |

### 1.5 Tertiary: green

| Token | Hex | RGB | Role | Exists at |
|---|---|---|---|---|
| `--kit-emerald` | `#34d399` | 52, 211, 153 | Health, fresh, success, the live pip. Nothing else | `index.html:150`; `main.js:1885` (`healthStatusColor ok`) |

### 1.6 Semantic others

These keep the roles their comments already give them. None of them is ever decorative (section 3.4).

| Token | Hex | RGB | Role | Exists at |
|---|---|---|---|---|
| `--kit-teal` | `#5eead4` | 94, 234, 212 | Calm, observability | `index.html:151` |
| `--kit-rose` | `#f472b6` | 244, 114, 182 | Relationship, people, personal-scope tint | `index.html:152` |
| `--kit-blue` | `#60a5fa` | 96, 165, 250 | Edge, recall tier | `index.html:161` |
| `--kit-red` | `#f87171` | 248, 113, 113 | Error, down, supersedes edge | `index.html:162`; `main.js:1888` |
| `--kit-yellow` | `#fcd34d` | 252, 211, 77 | Core tier | `index.html:149` |
| `--kit-orange` | `#fb923c` | 251, 146, 60 | Overdue, hotter alarm, caused_by edge | `index.html:148` |
| `--kit-slate` | `#94a3b8` | 148, 163, 184 | Default neutral, unknown state, archival tier | `index.html:153`; `main.js:1886` |
| `--kit-slate-deep` | `#475569` | 71, 85, 105 | Deep neutral tints and hairlines on raised surfaces; light-context secondary text | `index.html:154` |
| `--kit-white` | `#ffffff` | 255, 255, 255 | Sheens, highlights, the mark on the tile | `index.html:158` |

### 1.7 The tile (foreign ground only)

| Token | Spec | Exists at |
|---|---|---|
| `--kit-tile` | `radial-gradient(circle at 48% 42%, #ff9a23 0%, #ff850f 58%, #fa7103 100%)` with the mark in `--kit-white` | `img/kit-logo-dark-background.svg:6-8` (identical copy at `api/ui/img/`); described in `glyph-app-comms.md` section 0 |
| `--kit-tile-orange-0` | `#ff9a23` (255, 154, 35) | `img/kit-logo-dark-background.svg:6` |
| `--kit-tile-orange-58` | `#ff850f` (255, 133, 15) | `img/kit-logo-dark-background.svg:7` |
| `--kit-tile-orange` | `#fa7103` (250, 113, 3), the 100% stop and the value to quote as "tile orange" | `img/kit-logo-dark-background.svg:8` |

The tile is an export colour, not a UI colour. It is consumed by the icon build scripts (`deploy/personal/build-app.sh:256-331`, a corrected `scripts/build-pwa-icons.py`), the Telegram avatar, the email tile image, PWA and home-screen icons and the MCP host icon. It does not appear in `index.html`, the partials, `main.js`, `Resources/*.html`, email HTML bodies or the website. White on the tile measures 2.12 to 2.83:1 (matrix F); that is acceptable only because the tile is a logo (exempt under WCAG 1.4.3 and 1.4.11) and never carries text.

### 1.8 Alpha scale

The six steps at `index.html:169-174` stay exactly as they are. What changes is that their use is now ruled by measured contrast (matrices D and E).

| Token | Alpha | Use | Measured note (amber over bg-950) |
|---|---|---|---|
| `--kit-tint` | 0.06 | Card body tint, hover wash, mood ellipse behind the galaxy | 1.08:1, invisible as a boundary, fine as a wash |
| `--kit-faint` | 0.10 | Faint border, divider, mood tint ellipse in the Fireflies container | 1.16:1, decorative only |
| `--kit-soft` | 0.18 | Soft border, pip outline, chip ground, progress track | 1.36:1, decorative only; an input whose only boundary is a `--kit-soft` border must also change fill or show the focus ring |
| `--kit-fill` | 0.40 | Filled segment, badge ground, link underline, disabled primary fill | 2.36:1, still below the 3:1 non-text floor; never the only indicator of a state |
| `--kit-strong` | 0.60 | Strong outline, focus ring, secondary button border | 3.90:1, the first step that passes 3:1 non-text contrast; the focus ring lives here |
| `--kit-solid` | 0.92 | Scrims and overlays (settings scrim `index.html:5169`), near-opaque washes | 7.81:1; the primary button should be fully opaque rather than `--kit-solid` so its colour does not shift with what is behind it (section 2.4) |

Rules for the scale: a colour at `--kit-soft` or below is atmosphere, at `--kit-fill` it is a hint that must be paired with another cue, at `--kit-strong` and above it can carry meaning on its own. Alpha is applied to hue tokens only; ink is never tinted with alpha (use the ink step instead), so text colour stays predictable over the aurora.

### 1.9 Retire and replace

The values below are the ones the audits found carrying brand or state meaning outside the token set. Each maps to exactly one token.

| Today | Where | Becomes |
|---|---|---|
| `#fbbf24`, `#f59e0b`, `rgba(245,158,11, x)` (stock Tailwind amber) | `scripts/build-pwa-icons.py:26-28`; `main.js:1887, 21897-21903`; `tailwind.config.js:38` (`tier.core.ring`); `index.html:1023`; partials x38 (`colour-type-tokens.md:114`); `kit-website/styles/base.css:279`, `favicon.svg` | `--kit-amber` |
| `#f97316`, `#fb923c` as the end of a mark tile | `index.html:2749` (`to-orange-500`), `:1487`; `partials/dashboard.html:1274` | No tile inside Kit; mark on the night ground. `--kit-orange` keeps only its overdue meaning |
| `#fde68a` (stock amber-200, x21) | `index.html:1600, 1619, 1933` and 18 more | `amber-200` `#f5d0a3` |
| `#fcd34d` written raw (x33) | `partials/dashboard.html:54, 535`, `memories.html:80` | `--kit-yellow` when it means core tier, otherwise `amber-300` |
| `#eeb066` to `#db8a3c` CTA gradient | `api/services/email.py:203, 313`; `Resources/onboarding-shell.html:1299` | `--kit-amber` solid fill, `--kit-ink-on-amber` label |
| `#f6b64b`, `#f0a02b` | `index.html:1023, 1046` | `--kit-amber` |
| `#f0b84d` | `mcp/src/widgets/wake.ts:105`; widget mockups | `--kit-amber` (offline state at `--kit-strong`) |
| `#f5b942` | `docs/federation.html:16` and the other docs pages | `--kit-amber` |
| `#c4b9f8`, `#8f7be8`, `#f7d49a`, `#ffe0a3`, `245,201,122` | `Resources/updating-page.html:10-30` | `--kit-purple-soft`, `--kit-purple`, `--kit-firefly`, `--kit-firefly`, `--kit-firefly` |
| `#9d7fe8` (`--accent-memory`, `--memory`, `--green`) | `index.html:135`; `Resources/onboarding-shell.html:22-23`; `api/ui/static/dream-overlay.js:19` | `--kit-purple` (and `--green` as a success colour becomes `--kit-emerald`) |
| `#7fe89d`, `#80e89e` approx | `index.html:136`; `KitPersonalApp.swift:615` | `--kit-emerald` |
| `#6bbfff` (`--accent-glow`) | `index.html:133`; `kit-website/styles/tokens.css`; `index.html:1718-1733` (tab live dot) | As an edge colour `--kit-blue`; as a live dot `--kit-emerald`; as a brand accent, retired |
| `#e8a65c`, `#9e80e8`, `#f06b5e` approx (Mac status dots) | `KitPersonalApp.swift:605-617` | `--kit-amber`, `--kit-purple`, `--kit-red` exact |
| `rgba(67,56,202)` to `rgba(109,40,217)` sleeping banner | `index.html:712-716` | `rgba(var(--kit-violet), var(--kit-fill))` with `--kit-ink` text |
| `#5a4fd0`, `#b4a9ff`, `#b8a2f0`, `#c084fc`, `#7c3aed` | `main.js:23092-23162`; `index.html:739-748` | `--kit-violet`, `--kit-purple-soft`, `--kit-purple-soft`, `--kit-purple`, `--kit-violet` |
| `#e8ebf2`, `#b6bdd0`, `#8b95af` (`--ink-*`) | `index.html:130-132`; website; onboarding | `--kit-ink`, `--kit-ink-soft`, `--kit-ink-muted` |
| `#0a0e1a` (`--bg-deep`) | `index.html:126`; `Resources/onboarding-shell.html:12`; `load-html.html:11`; website | `--kit-bg-950` |
| `#020409` | `index.html:788, 1241, 1346`; `KitPersonalApp.swift:3298` | `--kit-bg-980` |
| `#0f1729`, `#060b16` | `api/services/email.py:171, 177` | `--kit-bg-900`, `--kit-bg-980` |
| `#e2e8f0` body text | `index.html:788` | `--kit-ink-soft` (body), `--kit-ink` (headings) |
| `kitAccentText()` stock tints `rgb(254,215,170)` etc. | `main.js:12730-12746` | `amber-200` for warm states, `--kit-purple-soft` for dream states, `--kit-ink-soft` otherwise |
| `0xfde047` super-node working-memory tint | `main.js:25667` | `--kit-amber`, matching the firefly ring at `main.js:24620` |
| `#fa7103` as a link colour on light | `api/services/outbound/mailbox.py:50, 52` | `amber-700` |

## 2. Contrast

### 2.1 Method

WCAG 2.1 relative luminance and contrast ratio, sRGB, computed by `contrast.py` in this folder. Thresholds: AA normal text 4.5:1, AA large text and non-text 3:1, AAA 7:1. Tinted colours are alpha-blended over the named ground before measuring (matrices D and E). Numbers are rounded to two decimals.

### 2.2 Matrix A: text and accent colours on grounds and fills

| Colour | hex | floor #020617 | bg-950 #0a0f1a | bg-900 #0f172a | bg-850 #1e293b | white #ffffff | tile mid #fa7103 | amber-400 fill #e8a55c |
|---|---|---|---|---|---|---|---|---|
| ink | `#f1f5f9` | 18.41 AAA | 17.49 AAA | 16.30 AAA | 13.35 AAA | 1.10 fail | 2.58 fail | 1.92 fail |
| ink-soft | `#cbd5e1` | 13.59 AAA | 12.90 AAA | 12.02 AAA | 9.85 AAA | 1.48 fail | 1.90 fail | 1.42 fail |
| ink-muted | `#94a3b8` | 7.87 AAA | 7.47 AAA | 6.96 AA | 5.71 AA | 2.56 fail | 1.10 fail | 1.22 fail |
| ink-faint | `#64748b` | 4.24 AA large | 4.03 AA large | 3.75 AA large | 3.07 AA large | 4.76 AA | 1.68 fail | 2.26 fail |
| warm-white | `#fff3df` | 18.38 AAA | 17.46 AAA | 16.27 AAA | 13.33 AAA | 1.10 fail | 2.58 fail | 1.92 fail |
| amber-200 | `#f5d0a3` | 13.87 AAA | 13.17 AAA | 12.27 AAA | 10.05 AAA | 1.45 fail | 1.94 fail | 1.45 fail |
| amber-300 | `#f0bd82` | 11.82 AAA | 11.23 AAA | 10.46 AAA | 8.57 AAA | 1.71 fail | 1.66 fail | 1.23 fail |
| amber-400 (primary) | `#e8a55c` | 9.58 AAA | 9.09 AAA | 8.47 AAA | 6.94 AA | 2.11 fail | 1.34 fail | 1.00 fail |
| amber-500 | `#d4904a` | 7.58 AAA | 7.20 AAA | 6.71 AA | 5.49 AA | 2.66 fail | 1.06 fail | 1.26 fail |
| firefly | `#ffc46b` | 12.83 AAA | 12.19 AAA | 11.36 AAA | 9.31 AAA | 1.57 fail | 1.80 fail | 1.34 fail |
| lavender | `#a78bfa` | 7.41 AAA | 7.04 AAA | 6.56 AA | 5.38 AA | 2.72 fail | 1.04 fail | 1.29 fail |
| lavender-soft | `#c4b5fd` | 10.93 AAA | 10.38 AAA | 9.67 AAA | 7.92 AAA | 1.85 fail | 1.53 fail | 1.14 fail |
| violet | `#8b5cf6` | 4.76 AA | 4.52 AA | 4.22 AA large | 3.45 AA large | 4.23 AA large | 1.50 fail | 2.01 fail |
| emerald | `#34d399` | 10.49 AAA | 9.97 AAA | 9.29 AAA | 7.61 AAA | 1.92 fail | 1.47 fail | 1.10 fail |
| teal | `#5eead4` | 13.64 AAA | 12.95 AAA | 12.07 AAA | 9.89 AAA | 1.48 fail | 1.91 fail | 1.42 fail |
| rose | `#f472b6` | 7.62 AAA | 7.23 AAA | 6.74 AA | 5.52 AA | 2.65 fail | 1.07 fail | 1.26 fail |
| blue | `#60a5fa` | 7.93 AAA | 7.54 AAA | 7.02 AAA | 5.75 AA | 2.54 fail | 1.11 fail | 1.21 fail |
| red | `#f87171` | 7.29 AAA | 6.93 AA | 6.45 AA | 5.29 AA | 2.77 fail | 1.02 fail | 1.31 fail |
| yellow | `#fcd34d` | 13.99 AAA | 13.29 AAA | 12.38 AAA | 10.15 AAA | 1.44 fail | 1.96 fail | 1.46 fail |
| orange | `#fb923c` | 8.91 AAA | 8.46 AAA | 7.89 AAA | 6.46 AA | 2.26 fail | 1.25 fail | 1.07 fail |
| slate | `#94a3b8` | 7.87 AAA | 7.47 AAA | 6.96 AA | 5.71 AA | 2.56 fail | 1.10 fail | 1.22 fail |
| slate-deep | `#475569` | 2.66 fail | 2.53 fail | 2.36 fail | 1.93 fail | 7.58 AAA | 2.68 fail | 3.60 AA large |

What the matrix says in one breath: on the four night grounds every hue token except `--kit-violet`, `--kit-slate-deep` and `--kit-ink-faint` is AA or better as text; nothing light is readable on amber or the tile; and nothing in the dark palette except `--kit-slate-deep` is readable on white.

### 2.3 Matrix B: dark labels on warm and state fills

| Label | hex | amber-400 #e8a55c | amber-500 #d4904a | firefly #ffc46b | tile mid #fa7103 | lavender #a78bfa | emerald #34d399 | white |
|---|---|---|---|---|---|---|---|---|
| ink-on-amber | `#1a1207` | 8.79 AAA | 6.96 AA | 11.79 AAA | 6.55 AA | 6.81 AA | 9.64 AAA | 18.53 AAA |
| page floor #020409 (current button label, `index.html:1570`) | `#020409` | 9.74 AAA | 7.70 AAA | 13.05 AAA | 7.25 AAA | 7.54 AAA | 10.67 AAA | 20.51 AAA |
| floor #020617 | `#020617` | 9.58 AAA | 7.58 AAA | 12.83 AAA | 7.14 AAA | 7.41 AAA | 10.49 AAA | 20.17 AAA |
| bg-900 | `#0f172a` | 8.47 AAA | 6.71 AA | 11.36 AAA | 6.31 AA | 6.56 AA | 9.29 AAA | 17.85 AAA |

### 2.4 Matrix C: light context (white paper, email signature, website light sections)

| Colour | hex | on white #ffffff | on amber-50 #fdf5ea |
|---|---|---|---|
| amber-400 | `#e8a55c` | 2.11 fail | 1.95 fail |
| amber-500 | `#d4904a` | 2.66 fail | 2.46 fail |
| amber-600 | `#b87738` | 3.66 AA large | 3.39 AA large |
| amber-700 | `#8f5a2a` | 5.73 AA | 5.30 AA |
| amber-800 | `#6b4320` | 8.58 AAA | 7.93 AAA |
| tile orange (current signature links, `mailbox.py:50, 52`) | `#fa7103` | 2.83 fail | 2.62 fail |
| signature ink (`mailbox.py:47`) | `#1a1a1a` | 17.40 AAA | 16.10 AAA |
| ink-on-amber | `#1a1207` | 18.53 AAA | 17.14 AAA |
| floor | `#020617` | 20.17 AAA | 18.66 AAA |
| slate-deep | `#475569` | 7.58 AAA | 7.01 AAA |
| slate | `#94a3b8` | 2.56 fail | 2.37 fail |
| violet | `#8b5cf6` | 4.23 AA large | 3.92 AA large |
| lavender | `#a78bfa` | 2.72 fail | 2.52 fail |
| emerald | `#34d399` | 1.92 fail | 1.78 fail |
| red | `#f87171` | 2.77 fail | 2.56 fail |

### 2.5 Matrix D: the alpha scale, amber blended over each ground, measured against that ground

| Step | alpha | over floor #020617 | over bg-950 #0a0f1a | over bg-900 #0f172a |
|---|---|---|---|---|
| `--kit-tint` | 0.06 | `#10101b` 1.07 fail | `#17181e` 1.08 fail | `#1c202d` 1.10 fail |
| `--kit-faint` | 0.10 | `#19161e` 1.13 fail | `#201e21` 1.16 fail | `#25252f` 1.18 fail |
| `--kit-soft` | 0.18 | `#2b2323` 1.31 fail | `#322a26` 1.36 fail | `#363133` 1.39 fail |
| `--kit-fill` | 0.40 | `#5e4633` 2.30 fail | `#634b34` 2.36 fail | `#66503e` 2.36 fail |
| `--kit-strong` | 0.60 | `#8c6540` 3.91 AA large | `#8f6942` 3.90 AA large | `#916c48` 3.79 AA large |
| `--kit-solid` | 0.92 | `#d69856` 8.16 AAA | `#d69957` 7.81 AAA | `#d79a58` 7.33 AAA |

### 2.6 Matrix E: lavender, emerald and violet over bg-950 at each alpha step (non-text 3:1 check)

| Step | alpha | lavender #a78bfa | emerald #34d399 | violet #8b5cf6 |
|---|---|---|---|---|
| `--kit-tint` | 0.06 | `#131627` 1.07 fail | `#0d1b22` 1.09 fail | `#121427` 1.05 fail |
| `--kit-faint` | 0.10 | `#1a1b30` 1.14 fail | `#0e2327` 1.17 fail | `#171730` 1.09 fail |
| `--kit-soft` | 0.18 | `#262542` 1.31 fail | `#123231` 1.40 fail | `#211d42` 1.20 fail |
| `--kit-fill` | 0.40 | `#494174` 2.08 fail | `#1b5d4d` 2.49 fail | `#3e2e72` 1.67 fail |
| `--kit-strong` | 0.60 | `#6859a0` 3.23 AA large | `#238566` 4.19 AA large | `#573d9e` 2.35 fail |
| `--kit-solid` | 0.92 | `#9a81e8` 6.11 AA | `#31c38f` 8.54 AAA | `#8156e4` 4.00 AA large |

Violet never reaches 3:1 below `--kit-solid`, which is why it is a bloom and fill colour and lavender is the line and text colour of the secondary family.

### 2.7 Matrix F: status dots and the mark on the tile

Status dots are non-text and need 3:1 against the ground they sit on.

| Dot | hex | floor #020617 | bg-950 | bg-900 | bg-850 |
|---|---|---|---|---|---|
| emerald (live, ok) | `#34d399` | 10.49 AAA | 9.97 AAA | 9.29 AAA | 7.61 AAA |
| amber (degraded, due, starting) | `#e8a55c` | 9.58 AAA | 9.09 AAA | 8.47 AAA | 6.94 AA |
| lavender (dreaming, importing) | `#a78bfa` | 7.41 AAA | 7.04 AAA | 6.56 AA | 5.38 AA |
| red (down, stopped) | `#f87171` | 7.29 AAA | 6.93 AA | 6.45 AA | 5.29 AA |
| slate (unknown) | `#94a3b8` | 7.87 AAA | 7.47 AAA | 6.96 AA | 5.71 AA |
| orange (overdue) | `#fb923c` | 8.91 AAA | 8.46 AAA | 7.89 AAA | 6.46 AA |

The mark on the tile and the amber-on-amber cases:

| Pair | Ratio |
|---|---|
| white on tile 0% `#ff9a23` | 2.12 fail |
| white on tile 58% `#ff850f` | 2.44 fail |
| white on tile 100% `#fa7103` | 2.83 fail |
| amber-400 `#e8a55c` on tile mid `#fa7103` | 1.34 fail |
| amber-400 `#e8a55c` on the auth tile end `#fb923c` (the Fireflies loader, `partials/fireflies-sunburst.html:257`, `glyph-web.md` 2.4) | 1.07 fail |
| firefly `#ffc46b` on tile mid `#fa7103` | 1.80 fail |
| warm-white `#fff3df` on tile mid `#fa7103` | 2.58 fail |
| stock `#fde68a` on the floor (the value used x21 today) | 16.20 AAA |
| current body `#e2e8f0` on the floor | 16.36 AAA |

White on the tile is a logo and is exempt; it is also the only thing that ever sits on the tile. Every other row in that table is a "never" (section 2.9).

### 2.8 Recommended pairs

| Use | Foreground | Ground or fill | Ratio (on bg-950 unless noted) | Today |
|---|---|---|---|---|
| Headings, wordmark, primary reading text | `--kit-ink` `#f1f5f9` | any night ground | 17.49 AAA | `text-slate-100`; wordmark `index.html:2767` |
| Body and secondary text | `--kit-ink-soft` `#cbd5e1` | any night ground | 12.90 AAA | `#e2e8f0` at `index.html:788`; raw `#cbd5e1` x29 |
| Tertiary text, eyebrows, metadata | `--kit-ink-muted` `#94a3b8` | any night ground | 7.47 AAA (6.96 AA on bg-900) | `text-slate-400` x332 |
| Placeholders only | `--kit-ink-faint` `#64748b` | night grounds | 4.03 AA large (fails AA for body) | `index.html:1580`; `text-slate-500` x770 misused as body text |
| Links in running copy | `amber-300` `#f0bd82`, underline `rgba(var(--kit-amber), var(--kit-fill))`; hover underline at `--kit-solid` | any night ground | 11.23 AAA | `.kit-bubble a` and `.memory-content a` are amber-400 `#e8a55c` (`index.html:1605, 1643`, 9.09 AAA). Either passes; amber-300 keeps amber-400 for the one primary action on the screen |
| Primary button | fill `rgb(var(--kit-amber))` opaque, label `--kit-ink-on-amber` `#1a1207`; hover fill `amber-300`, pressed fill `amber-500`; disabled fill at `--kit-fill` with label `--kit-ink-muted` (inactive controls are exempt) | | label 8.79 AAA (amber-300 hover 10.9, amber-500 pressed 6.96 AA); fill against bg-950 9.09 | `.bg-gray-900` is `rgba(var(--kit-amber), var(--kit-solid))` with label `#020409` (`index.html:1570-1572, 5085`), 9.74 AAA; email CTA `#eeb066` to `#db8a3c` with `#1a1207` (`email.py:203-205`) |
| Secondary button | transparent fill, border `rgba(var(--kit-amber), var(--kit-strong))`, label `amber-300`; hover fill `rgba(var(--kit-amber), var(--kit-faint))` | | label 11.23 AAA; border 3.90 AA large (non-text pass) | `border-amber-500/50 text-amber-300 hover:bg-amber-500/10` (`index.html:1781, 1909`) |
| Tertiary (text) button | label `--kit-ink-soft`; hover label `--kit-ink` on `rgba(var(--kit-white), var(--kit-tint))` | | 12.90 AAA | mixed slate utilities |
| Destructive | label `--kit-red`, border `rgba(var(--kit-red), var(--kit-fill))`, fill `rgba(var(--kit-red), var(--kit-faint))` | | 6.93 AA | `text-rose-400`, `text-red-400` ad hoc |
| Focus ring | `outline: 2px solid rgba(var(--kit-amber), var(--kit-strong)); outline-offset: 2px` | blended over bg-950 `#8f6942` | 3.90 AA large (non-text pass) | `ring-amber-400` and `focus:ring-amber-400/50` remap to amber `--kit-strong` (`index.html:1540-1541`); checkbox outline amber 0.75 (`:401-402`); `focus:ring-amber-400/40` (`:3627-3657, 5074`) is not remapped and resolves to amber at 0.40, 2.36:1, a fail |
| Active tab or selected item | text `--kit-amber`, underline or bar `--kit-amber` at full | | 9.09 AAA | amber eyebrows and active chips |
| Amber chip (tag, count) | text `amber-200` `#f5d0a3` on `rgba(var(--kit-amber), var(--kit-soft))`, border `rgba(var(--kit-amber), var(--kit-fill))` | blended chip `#322a26` | 9.66 AAA | `#fde68a` on `rgba(15,23,42,.96)` (`index.html:1933`) |
| Eyebrow label | `--kit-amber` at 10 to 11 px | any night ground | 9.09 AAA | `text-amber-400` eyebrows in partials (sentence case per the type rules) |
| Status dot, live | `--kit-emerald` 7 to 9 px, 1 px ring in the ground colour when over the aurora | any night ground | 9.97 AAA | `main.js:1885`; wake card `.dot` (`shell.ts:75-76`) |
| Status dot, degraded, due, starting | `--kit-amber` | | 9.09 AAA | web `#fbbf24` (`main.js:1887`), Mac `0.91,0.65,0.36` (`Swift:605, 614`) |
| Status dot, dreaming, importing | `--kit-purple` | | 7.04 AAA | `Swift:609`; dream pill `#a78bfa` (`index.html:7691-7695`) |
| Status dot, down | `--kit-red` | | 6.93 AA | `main.js:1888`; `Swift:613, 617` |
| Status dot, unknown | `--kit-slate` | | 7.47 AAA | `main.js:1886` |
| Sleep, dream, consolidation surfaces | text `--kit-purple-soft`, lines `--kit-purple`, fills and the sleeping banner `rgba(var(--kit-violet), var(--kit-fill))` with `--kit-ink` text (or `--kit-purple-soft` for secondary text). Never a violet fill above `--kit-fill` under text | blended `#3e2e72` over bg-950 | purple-soft on bg-950 10.38 AAA; ink on the violet fill 10.43 AAA, purple-soft on it 6.19 AA; for comparison ink on violet at `--kit-solid` (`#8156e4`) is only 4.37, AA large | `dream-overlay.js:19-21`; banner `rgba(67,56,202)` to `rgba(109,40,217)` at 0.92 (`index.html:712-716`) |
| Success, fresh | `--kit-emerald` text or dot; fill `rgba(var(--kit-emerald), var(--kit-faint))` | | 9.97 AAA | `text-emerald-400` |
| Error | `--kit-red` text; fill `rgba(var(--kit-red), var(--kit-faint))` | | 6.93 AA | `text-red-400`, `text-rose-400` |
| Inline code | `--kit-ink` on `--kit-bg-850` | | 13.35 AAA | `#fde68a` on `rgba(30,41,59,.85)` (`index.html:1600`) |
| Firefly core and halo (renderer and 2D ports) | core `mix(hue, --kit-warm-white, .88)`, halo `mix(hue, --kit-firefly, .56)`, hub corona `--kit-amber` | `--kit-black` canvas | n/a (light, not text) | `main.js:24434-24435, 24620`; super-nodes `:25623-25624` |
| Light context body text | `--kit-ink-on-amber` `#1a1207` or `--kit-bg-980` | white or `amber-50` | 18.53 AAA | signature `#1a1a1a` (`mailbox.py:47`) |
| Light context secondary text | `--kit-slate-deep` `#475569` | white | 7.58 AAA | `#8a8577` (`mailbox.py:48`) |
| Light context links and amber body text | `amber-700` `#8f5a2a` | white | 5.73 AA | `#fa7103` (`mailbox.py:50, 52`), 2.83 fail |
| Light context large amber text (24 px, or 18.66 px bold) | `amber-600` `#b87738` | white | 3.66 AA large | none |
| Light context primary button | fill `--kit-amber`, label `--kit-ink-on-amber` | white page | label 8.79 AAA | email CTA gradient (`email.py:203`) |
| The mark on light | mono silhouette in `--kit-ink-on-amber` or `--kit-bg-980` | white | 18.5 AAA | none exists; `img/kit-logo-light-background.svg` is orange on transparent |
| Theme colour and manifest background | `--kit-bg-980` `#020617` for `theme-color` and `background_color` | | n/a | `#e8a55c` (`index.html:18`, `manifest.webmanifest:9`), `#0f172a` (`:10`), website `#0a0e1a` (`colour-type-tokens.md:153`): three answers today, one proposed |

### 2.9 Never pairs

| Never | Why | Found today |
|---|---|---|
| Amber on amber: `--kit-amber` or `--kit-firefly` on the tile, on `amber-400` fills, or on `--kit-orange` | 1.00 to 1.80:1; the mark vanishes | Fireflies loader paints the mark `#e8a55c` on the `#e8a55c` to `#fb923c` tile, 1.07:1 (`partials/fireflies-sunburst.html:257`; `glyph-web.md` 2.4, 10.5) |
| Any text on the tile | best case 2.83:1 | none; keep it that way (email tile and wordmark are adjacent, not overlaid, `email.py:149-152, 184`) |
| Light ink (`--kit-ink`, `--kit-ink-soft`, `--kit-warm-white`, white) on amber or firefly fills | 1.42 to 1.92:1 | `text-white` on amber buttons would fail; the current label `#020409` is correct |
| State colours on the primary fill (lavender, emerald, red on amber-400) | 1.10 to 1.31:1 | none |
| `--kit-amber` or `amber-500` as text on white | 2.11 and 2.66:1 | website blog `#d8a657`/`#f0b56a` class of values (`colour-type-tokens.md:95`) |
| `--kit-tile-orange` as a link or text colour on light | 2.83:1 | `mailbox.py:50, 52` |
| `--kit-ink-faint` as body copy on any ground | 3.75 to 4.24:1, below AA | `text-slate-500` x770 |
| `--kit-violet` as text on bg-900 or bg-850 | 4.22 and 3.45:1 | purple CTA text is dark on a violet fill today (`onboarding-shell.html:297`), which is fine; violet text would not be |
| Light text on a violet fill at `--kit-solid` or opaque | ink on `#8156e4` is 4.37:1 and on `#8b5cf6` 4.23:1, AA large only; violet fills under text stay at `--kit-fill` (ink 10.43:1) | sleeping banner at 0.92 (`index.html:712-716`) |
| `--kit-slate-deep` as text on a night ground | 2.36 to 2.66:1 | `#475569` metadata in email footers (`email.py:225`) sits on `#0f1729`, 2.36:1 |
| An input or card whose only boundary is a border at `--kit-soft` or below | 1.36:1; not perceivable as a boundary | inputs at `index.html:1575-1579` (border `rgba(slate, .18)`), acceptable only because the inset fill also changes |
| A focus ring below `--kit-strong` | 2.36:1 at `--kit-fill` | `focus:ring-amber-400/40` (`index.html:3627-3657, 5074`) |
| Lavender, emerald or any state colour as a CTA fill | wrong meaning, and emerald on white is 1.92:1 | purple CTAs on the Mac (`onboarding-shell.html:297, 436, 541, 795, 879, 1122, 1252`; `load-html.html:60`); emerald wake card accent (`mcp/src/widgets/shell.ts:47`) |
| Two primaries on one screen (two opaque amber fills, or amber fill plus violet fill) | the eye has nowhere to land | onboarding purple CTA beside amber eyebrow (`onboarding-shell.html:177, 297`) |
| The tile gradient anywhere inside a Kit surface | the tile is for foreign ground | `mockups/kit-app-menu.html:90`; onboarding `.kit-glyph` shows the tiled SVG inside the Lantern (`Resources/onboarding-shell.html:208-218`) |

## 3. Usage rules

### 3.1 One primary per screen

Exactly one opaque amber-400 fill is visible in any view: the primary action (Ask Kit, Save, Send, Continue). Every other use of amber is a line, a text colour or a tint at or below `--kit-strong`. The hub corona and working-memory ring in the galaxy count as the primary of that view (`main.js:24620-24645`), so the Fireflies tab carries no amber button over the canvas. When a view has no primary action, it has no opaque amber fill.

Amber is Kit's identity on every surface, not only the web. The Mac onboarding, updater, load pages and dreaming window currently run purple as their primary (`AUDIT.md` section 3, drift 2); they move to amber for actions and keep purple for the dream meaning only.

### 3.2 Lavender is secondary, and is the colour of sleep

`--kit-purple` does two jobs and no others. As the secondary accent it marks the second-most-important thing in a view where amber is already spoken for (a secondary chip, a second data series, the lens colour for Kit's own memories, `main.js:23869-23877`). As a state it owns sleep, dream and consolidation: the dream pill (`index.html:7678-7700`), the sleeping banner (`:712-716`), the dreaming dot in the Lantern (`KitPersonalApp.swift:609`), the dream overlay (`dream-overlay.js:19-21`) and the mood aura when `rest_state` is dreaming (`main.js:12767`). Lavender never fills a button and never marks success.

Within the family: `--kit-purple` for lines, dots and text; `--kit-purple-soft` for text on violet fills and for sheens; `--kit-violet` for blooms, scrims and large fills only (it fails 3:1 as a line below `--kit-solid`, matrix E).

### 3.3 Green is health, fresh, success and the live pip

`--kit-emerald` appears when something is alive, healthy, fresh or done: the health dot (`main.js:1885`), the live pip on the wake card (`shell.ts:75-76`), "fresh" rest state, success toasts, tick marks. It is not a brand accent, not a mark colour, not a card border by default. The wake card and the MCP saved and recall cards currently use it as the brand (`mcp/src/widgets/shell.ts:47, 61`; `saved.ts:58-66`; `recall.ts:69-72`); they move to amber for identity and keep emerald for the live pip only. The `--green: #9d7fe8` alias in onboarding (`Resources/onboarding-shell.html:23`) becomes `--kit-emerald` where it means done and `--kit-purple` where it means dreaming.

### 3.4 State colours are never decorative

Teal, rose, blue, red, yellow and orange appear only when they mean what the token says. Data encodings count as meaning: the project, person, concept, edge-type and tier palettes in the galaxy and sunburst (`main.js:23869-23895, 25294-25349, 25295`) are allowed and stay as they are. What is not allowed is a state colour chosen for variety: a rose card border because amber was used nearby, a blue live dot (`index.html:1718-1733`, which becomes emerald), a teal gradient on a button.

The sky follows the same rule. The static aurora bloom today is violet 0.18, emerald 0.10, amber 0.06, blue 0.06 (`index.html:1285-1291`); the auth scene repeats it at 0.46, 0.28, 0.25 (`:1404-1407`). Proposal: the decorative bloom is amber and violet only (primary and secondary, both at or below `--kit-soft`), and emerald or orange enter the sky only through the mood layer that already maps `rest_state` to colour (`--kit-aura`, `--kit-mood-wash`, `kitFireflyTint`, `main.js:12663-12775`). Then a green sky means fresh and a violet sky means dreaming, every time.

### 3.5 Tile orange never inside the product

`#ff9a23`, `#ff850f`, `#fa7103` are export values. They are allowed in: the Dock and Finder icon (`deploy/personal/build-app.sh:256-331`), the PWA, favicon, apple-touch and maskable PNGs (a corrected `scripts/build-pwa-icons.py`, today on stock `#fbbf24` to `#f97316` at `:26-28`), the Telegram avatar (no asset exists, `glyph-app-comms.md` section 2), the email tile image (`email.py:149-152`, `mailbox.py:29, 44`) and an MCP host icon (none exists, `glyph-app-comms.md` section 7). They are not allowed in `index.html`, the partials, `main.js`, `Resources/*.html`, the Swift window chrome, email HTML bodies (the tile is an image, not a CSS colour), the website or the docs. Inside Kit's own surfaces the mark sits on the night ground with no tile; the amber that surrounds it is `--kit-amber` and `--kit-firefly`.

### 3.6 Light context

Where Kit must sit on white (the outbound mail signature, `mailbox.py:40-53`; any light section of the website or docs; print):

| Element | Token | Ratio on white |
|---|---|---|
| Ground | `#ffffff`, or `amber-50` `#fdf5ea` for a warm panel | n/a |
| Body text and headings | `--kit-ink-on-amber` `#1a1207` (warm) or `--kit-bg-980` `#020617` (cool); pick one per surface | 18.5 and 20.2 AAA |
| Secondary text | `--kit-slate-deep` `#475569` | 7.58 AAA |
| Links and amber body text | `amber-700` `#8f5a2a` | 5.73 AA |
| Large amber text (24 px, or 18.66 px bold) | `amber-600` `#b87738` | 3.66 AA large |
| Amber headings | `amber-800` `#6b4320` | 8.58 AAA |
| Primary button | fill `--kit-amber`, label `--kit-ink-on-amber` | label 8.79 AAA |
| The mark | mono silhouette in the page ink, never amber-400 (2.11:1) and never the tile inside the page | 18.5 AAA |
| Status colours | emerald, lavender, red are all below 3:1 on white; pair every dot with a text label and draw it with a 1 px ink ring | n/a |

The email tile image in the signature stays the orange tile because a mail client is foreign ground; the signature text and links move from `#fa7103` (2.83:1) to `amber-700`.

### 3.7 Fireflies colour rule

The renderer is the reference and the tokens are named from it. Canvas clear colour `--kit-black` (`main.js:24019`). Per node: core `mix(hue, --kit-warm-white, 0.88)`, halo `mix(hue, --kit-firefly, 0.56)` (`main.js:24434-24435`; super-nodes use `#fff3df` 0.80 and `#ffb066` 0.34 at `:25623-25624` and should adopt the same two targets). Hub corona and working-memory ring `--kit-amber` (`main.js:24620-24645`); the super-node working-memory tint `0xfde047` (`:25667`) becomes `--kit-amber`. Mood ellipse behind the canvas at `--kit-tint` or `--kit-faint` in the rest-state colour (`main.js:12764-12775`). Every 2D port of fireflies (onboarding canvas, dream motes, wake firefly, the mark itself when rendered as fireflies) uses the same two mix targets over a night ground; that is what makes the mark and the galaxy one thing.

### 3.8 Brand-warm gradients: what maps to what

The audit counted six gradients carrying the mark (`AUDIT.md` section 3, counts) and several more carrying a call to action. One survives.

| # | Gradient today | Where | Becomes |
|---|---|---|---|
| 1 | `#e8a55c` to `#f97316` (amber-400 to stock orange-500), linear 135 deg | App bar tile `index.html:2749`; chat panel header `partials/dashboard.html:1274` | No tile inside Kit. The mark as fireflies on the night ground; the accent is `--kit-amber` |
| 2 | `#e8a55c` to `#fb923c` (amber to `--kit-orange`), linear 135 deg | Auth, invite, pair, welcome, demo cards `index.html:1487` (copies at `:1747, 2129, 2169, 6460, 6577, 6650`); Fireflies loader `fireflies-sunburst.html:257` | Same as 1 |
| 3 | `#fbbf24` to `#f97316` (stock amber-400 to orange-500), linear | PWA, favicon, apple-touch, maskable, notification and email tile PNGs `scripts/build-pwa-icons.py:26-28`; `mockups/desktop-parity.html:45` | The tile: `--kit-tile` radial `#ff9a23` to `#ff850f` to `#fa7103`, white mark, on foreign ground |
| 4 | `#ff9a23` to `#ff850f` to `#fa7103` radial | `img/kit-logo-dark-background.svg:6-8`; Dock icon; onboarding `.kit-glyph` `Resources/onboarding-shell.html:208-218`; `mockups/kit-app-menu.html:90` | Survives as `--kit-tile` for Dock, Finder, Telegram, email tile, PWA and MCP host icons. Leaves the onboarding glyph, which is inside the Lantern and shows the mark on the night ground |
| 5 | Lavender `#c4b9f8` (solid, with violet glow; gold `#f7d49a` when woken) | Updater glyph `Resources/updating-page.html:10-15, 25-30` | The mark in its standard fireflies colouring (warm white cores, firefly halos); the woken flash is `--kit-firefly`; lavender is not the updater's colour unless Kit is dreaming |
| 6 | White (hard, non-template) | Menu bar glyph `KitPersonalApp.swift:1084` | Stays mono: a template silhouette so it follows the menu bar appearance; the status dot is the only colour |
| 7 | `#eeb066` to `#db8a3c` | Email CTA `email.py:203, 313`; birth recovery button `Resources/onboarding-shell.html:1299` | `--kit-amber` opaque, label `--kit-ink-on-amber` |
| 8 | `#fbbf24` to `#f0a02b`, 140 deg | Composer send `index.html:1023` | `--kit-amber` opaque |
| 9 | `#8b5cf6` to `#c4b5fd`, 135 deg | Mac onboarding CTAs `onboarding-shell.html:297, 436, 541, 795, 879, 1122, 1252`; `load-html.html:60` | `--kit-amber` opaque, label `--kit-ink-on-amber` |
| 10 | `#8f7be8` to `#c4b9f8` bar; `#8b5cf6` to `#c4b5fd` to `#e8a55c` install bar | `updating-page.html:20`; `onboarding-shell.html:744-752` | Progress fill `--kit-amber` on a `rgba(var(--kit-amber), var(--kit-soft))` track; lavender fill only when the progress is a dream |
| 11 | `rgba(67,56,202)` to `rgba(109,40,217)` | Sleeping banner `index.html:712-716` | `rgba(var(--kit-violet), var(--kit-fill))` flat, text `--kit-ink` (10.43 AAA over bg-950) |
| 12 | Solid `#fbbf24` with drop shadow | Website nav mark and favicon `kit-website/styles/base.css:279`, `favicon.svg` | The mark as fireflies (`--kit-firefly` halos, warm-white cores) at 48 px and up; mono silhouette in `--kit-ink` below |

So: one tile (radial orange, foreign ground only), one UI accent (`--kit-amber`, opaque for the single primary action, tinted everywhere else), and the mark itself never needs a gradient of its own because its colour comes from the firefly mix.

### 3.9 Meta colours

`theme-color` and the manifest `background_color` are the browser's and the phone's idea of Kit's ground, not of Kit's accent. Proposal: both become `--kit-bg-980` `#020617` (today `#e8a55c` at `index.html:18` and `manifest.webmanifest:9`, `#0f172a` at `:10`, website `#0a0e1a`). The PWA splash then shows the tile icon on the night floor, which is the same picture as the Lantern waking.
