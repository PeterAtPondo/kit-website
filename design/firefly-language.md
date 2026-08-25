# Firefly language

How Kit draws a point of light, a field of them, the traces between them, and the mark's colour form, anywhere in 2D. Everything here is derived from the one renderer that already gets it right, the Fireflies galaxy (`api/ui/src/main.js:23729-28620`, sprites at `:23925-23996`, colour rule at `:24450-24451`, edges at `:24773-24871`, motion at `:28184-28260`), and from the audit of every other node drawing in the estate (`audit/nodes-fireflies-reference.md`, `audit/nodes-elsewhere.md`). It is a specification. Nothing here has been implemented; the shared module in section 7 is a proposal for the component-library stage.

Paths are relative to the worktree unless absolute. `main.js` means `api/ui/src/main.js`, `index.html` means `api/ui/index.html`, `Resources/` means `deploy/personal/macos/Resources/`.

## 1. Principles

1. Light, not ink. A node is an emission drawn additively (`globalCompositeOperation = 'lighter'`) on a near-black ground. It is never a filled disc with a glow painted around it (`main.js:24058`, `:24013-24021`).
2. Hot core, warm halo. Every hue is pushed 88% toward warm white at the centre and 56% toward amber in the halo; the colour lives in the bloom, not in the point (`main.js:24450-24451`).
3. Irregular by construction. The sprites are slightly oval, have a lobed inner rim, a per-texel sparkle and a dithered tail that dissolves into dust; there are no perfect circles and no stepped colour stops (`main.js:23904-23913`, `:23955-23974`).
4. Few bright, many faint. Radius and brightness are drawn from long-tailed, independent distributions, so most of any field is specks and a handful of nodes carry the light (reference size formula `main.js:24488-24521`, tier opacities `:24455-24463`).
5. Wobble, not twinkle. Position drifts slowly with random phase; brightness breathes only on hubs; everything stills under the pointer and under `prefers-reduced-motion` (`main.js:28184-28190`, `:28218-28220`, `:28436-28445`).

## 2. The two sprites

Two white alpha sprites, generated once at runtime from formulas (never shipped as PNGs, so every surface is bit-identical), then tinted and composited additively. The reference builds them at 512 px (core) and 768 px (bloom) (`main.js:23927`); for 2D canvas 256 and 384 px with the same formulas are enough (`audit/nodes-fireflies-reference.md` section 11, item 2).

### 2.1 Alpha formulas

With `dx, dy` measured from the sprite centre, `maxR = SIZE / 2`, `theta = atan2(dy, dx)`, `circularR = sqrt(dx² + dy²) / maxR`, `env = 1 - r`, and `smooth01(t) = u²(3 - 2u)` for `u = clamp(t, 0, 1)` (`main.js:23935-23974`):

| Ingredient | Core sprite | Bloom (halo) sprite | Source |
|---|---|---|---|
| Resolution (reference / 2D port) | 512 / 256 px | 768 / 384 px | `main.js:23927` |
| Oval | `r² = dx²·1.08 + dy²·0.94` (wider than tall) | `dx²·1.02 + dy²·0.98` | `:23960` |
| Rim wobble amplitudes (5 lobe, 9 lobe, diagonal ripple) | `sin(5θ + 0.4)·0.055 + sin(9θ + 1.8)·0.035 + sin(0.091x + 0.073y)·0.018` | `0.018 / 0.012 / 0.006` | `:23955-23959` |
| Wobble damping window (`rimDamp = 1 - smooth01((circularR - a) / b)`) | a 0.30, b 0.30 (fades out over r 0.30 to 0.60) | a 0.20, b 0.26 (r 0.20 to 0.46) | `:23954` |
| Normalised radius | `r = sqrt(oval) / (maxR · organicRim)` | same | `:23960` |
| Edge fade | `edgeFade = clamp((1 - circularR) / 0.32)` | `clamp((1 - circularR) / 0.46)` | `:23961` |
| Alpha (inside `circularR < 1`, `r < 1.06`) | `exp(-3.2r²) · env⁴ · citySparkle · edgeFade²` | `[exp(-1.7r²) · env^1.75 + 0.22·exp(-10.5r²)] · edgeFade^2.8` | `:23963-23974` |
| City sparkle | `0.90 + 0.10·sin(0.21x + 0.17y)·sin(0.07x)` | none | `:23970` |
| Quantisation | stochastic dither: `base + (hash(x,y) < frac ? 1 : 0)` | same | `:23942-23947` |
| RGB | 255 where alpha > 0, else 0 | same | `:23980-23983` |

Port notes for 256 / 384 px: the two ripple terms (`0.091x + 0.073y` and the sparkle `0.21x`, `0.17y`, `0.07x`) are in texel units, so at half resolution multiply `x` and `y` inside those sines by 2 (i.e. by `512 / SIZE`) to keep the same grain. Everything else is in normalised `r` and ports unchanged. Keep the dither; an 8 bit tail without it prints the ring the reference comment warns about (`main.js:23904-23906`).

### 2.2 Drawing them in 2D canvas

| Rule | Spec | Why |
|---|---|---|
| Ground | Opaque canvas, or paint the ground first (`#000` for a viz container, `#020617` or the surface's night token on a page), then draw with `'lighter'` | Additive tails on a transparent canvas accumulate into a composited alpha mask (`main.js:24013-24016`) |
| Tinting | Draw the white sprite to an offscreen canvas, `source-in` fill with the colour, cache per (sprite, hex). The website already uses this cache pattern (`<repo>/kit-website/index.html:1453-1466`), but with a 4 stop gradient; the cache stays, the gradient goes | Colour is applied per instance, never baked into the sprite |
| Opacity | `ctx.globalAlpha` per draw | Matches the shader's `texel.a · vOpacity` (`main.js:24050-24052`) |
| Scaling | Keep three pre-scaled copies of each tinted sprite (full, 1/4, 1/16) and draw from the smallest that is still larger than the target; `imageSmoothingQuality = 'high'`; never upscale the 1/16 copy | Stands in for "no mipmaps, linear filter" (`main.js:23987-23990`) without the aliasing a 384 to 6 px downscale produces |
| Orientation | Never rotate sprites; the oval stays wider than tall | One grain across every surface |
| Pixel ratio | Backing store at `min(devicePixelRatio, 2)` | `main.js:24019` |
| Per node, in order | bloom sprite tinted `halo` at radius `rad · haloScale`, then core sprite tinted `core` at radius `rad`; hubs add a bloom sprite in `#e8a55c` at `rad · 5.0 to 7.5` drawn first | Render order corona, halo, core (`main.js:24406-24560`) |

## 3. The colour rule

Per node, from a base hue:

```
core = mix(hue, #fffdf4, 0.88)
halo = mix(hue, #ffc36b, 0.56)
```

`mix` is a component-wise sRGB lerp. That is exactly what the reference does: `baseColor.clone().lerp(new THREE.Color('#fffdf4'), 0.88)` and `.lerp('#ffc36b', 0.56)` (`main.js:24450-24451`) on three r128 (`index.html:110`), which has no colour management, so the maths is plain sRGB. The reference applies a tier tint first (`multiplyScalar` 1.08 core tier / 1.12 recall / 1.0 archival, `main.js:24413`); decorative fields skip it. Computed with `guide/mix.py`:

| Hue | Base | Core `mix(hue, #fffdf4, .88)` | Halo `mix(hue, #ffc36b, .56)` | Reads as |
|---|---|---|---|---|
| Amber (`--kit-amber`, primary) | `#e8a55c` | `#fcf2e2` (252,242,226) | `#f5b664` (245,182,100) | warm white point, golden bloom |
| Firefly (light-emitting things) | `#ffc46b` | `#fff6e4` (255,246,228) | `#ffc36b` (255,195,107) | the mark's own colour; the halo is the target itself |
| Lavender (`--kit-purple`, secondary, sleep and dream) | `#a78bfa` | `#f4eff5` (244,239,245) | `#d8aaaa` (216,170,170) | cool white point, dusty rose bloom |
| Emerald (`--kit-emerald`, tertiary, live and fresh) | `#34d399` | `#e7f8e9` (231,248,233) | `#a6ca7f` (166,202,127) | mint point, sage bloom |
| Slate (`--kit-slate`, neutral) | `#94a3b8` | `#f2f2ed` (242,242,237) | `#d0b58d` (208,181,141) | paper white point, sand bloom |
| Violet (`--kit-violet`) | `#8b5cf6` | `#f1eaf4` | `#cc96a8` | |
| Soft lavender (`--kit-purple-soft`) | `#c4b5fd` | `#f8f4f5` | `#e5bdab` | |
| Teal (`--kit-teal`) | `#5eead4` | `#ecfbf0` | `#b8d499` | |
| Rose (`--kit-rose`) | `#f472b6` | `#feeced` | `#fa9f8c` | |
| Blue (`--kit-blue`) | `#60a5fa` | `#ecf2f5` | `#b9b6aa` | |
| Red (`--kit-red`) | `#f87171` | `#feece4` | `#fc9f6e` | |
| Yellow (`--kit-yellow`) | `#fcd34d` | `#fff8e0` | `#feca5e` | |
| Orange (`--kit-orange`) | `#fb923c` | `#fff0de` | `#fdad56` | |

Three consequences worth stating plainly:

1. The rule is what makes a mixed field read as city lights from orbit rather than a colour chart: every halo is pulled toward the same amber, so lavender, emerald and blue nodes sit in one warm family (the comment at `main.js:24443-24449` names the intent). This is correct for any field that mixes hues.
2. For a single-hue state field, where the hue itself is the message (the dream overlay is lavender because Kit is dreaming), 0.56 toward amber leaves lavender as `#d8aaaa` and emerald as `#a6ca7f`, which no longer read as lavender or emerald. Proposal: one named knob, `hueForward`, that lowers the halo mix to 0.30 (lavender halo `#c19ccf`, emerald `#71ce8b`, slate `#b4ada1`), never below 0.20; the core mix stays 0.88. Default off. This is the one decision in this section that needs the operator's confirmation.
3. The reference also carries a second target pair for super-nodes (`#fff3df` at 0.80, `#ffb066` at 0.34, `main.js:25620-25621`) and no lerp at all on concept sub-supers (`:25783-25792`). The language has one pair. Retire the others when the galaxy is touched (listed as reference inconsistency 2 in `audit/nodes-fireflies-reference.md` section 10).

Where a core colour has to be written as a single CSS token with no per-hue maths (a status dot, a glint), use warm white `#fff3df`; the computed cores for the warm hues (`#fcf2e2`, `#fff6e4`) sit within a few units of it, and the colour decisions reserve `#fff3df` for firefly cores and light.

## 4. Size and brightness in decorative fields

These are fields with no data behind them (onboarding backdrop, auth backdrop, dream motes, loading). Data-backed fields (the galaxy, the Studio run constellation) keep the reference's size formula `rad = 0.12 + 0.022·soul + 0.012·sqrt(degree) + sqrt(importance·0.014 + hits·0.004 + access·0.003 + log10(1 + length)·0.004)` (`main.js:24488-24521`); only the rendering rules below apply to them.

Units are CSS px at 1x. `rad` is the core sprite radius; the halo is drawn at `rad · 2.6` for ordinary nodes and `rad · 3.2` for landmarks. 2.6 is not arbitrary: the shipped galaxy draws the default tier halo at `1.9 · 1.38` (halo scale times the `halo` tuning multiplier, `main.js:24514`, `:24709-24745`) which is 2.62, and the mark's companions use the same ratio (section 8).

### 4.1 Radius, long-tailed

| Bucket | Share of nodes | `rad` (px) | Halo | Draw |
|---|---|---|---|---|
| Specks | 65% | 0.6 to 1.3 | none | core sprite only |
| Field | 25% | 1.3 to 2.6 | `rad · 2.6` | halo + core |
| Bright | 8% | 2.6 to 4.2 | `rad · 2.6` | halo + core |
| Landmarks | 2%, at least 1, at most 4 per mount | 3.4 to 5.0 | `rad · 3.2` plus an amber `#e8a55c` corona at `rad · 5.0` (up to 7.5 for the largest) | corona + halo + core |

A continuous stand-in for engineers who prefer one line: `rad = 0.6 + 4.4·u⁵` with `u` uniform in [0, 1) gives roughly 69% specks, 17% field, 10% bright and 4% at or above 4.2 px; clamp landmarks to the cap. Compare the unshipped mockup that came closest: field `0.9 + rnd·1.4`, clusters `1.2 + rnd·2.1`, four landmarks `3.4 + rnd·1.6` (`mockups/lantern-loading.html:207-261`, cited in `audit/nodes-fireflies-reference.md` 9a), and the onboarding canvas today, `1.4 + rnd·2.6` with no specks and no landmarks (`Resources/onboarding-shell.html:1373-1379`).

### 4.2 Brightness, independent of size

Halo alpha (`b`) is drawn separately from radius; a large node can be faint and a speck can be bright.

| Bucket | Share | Halo alpha `b` | Core alpha |
|---|---|---|---|
| Faint | 60% | 0.20 to 0.35 | `0.35 · b` |
| Mid | 32% | 0.40 to 0.60 | `0.35 · b` |
| Bright | 8% | 0.70 to 0.87 | `0.35 · b` (cap 0.30) |
| Specks (no halo) | as drawn | n/a | 0.18 to 0.45 |

0.87 is the shipped core-tier halo (`0.632 · 1.38`), 0.60 the default tier, 0.31 archival (`main.js:24455-24463`, `:24709-24745`). The core alpha ratio is a proposal: the shipped galaxy sets `brightness 0.01`, which turns the core sprite off and contradicts the "white-hot point" comment at `main.js:24443-24449` (reference inconsistency 4). In 2D, at 1 to 4 px, the hot point is what makes a node read as a light rather than a smudge, so the language keeps it at 0.35 of the halo.

### 4.3 Density and hue mix

| Density | Nodes | Typical use |
|---|---|---|
| Sparse | 1 per 40,000 px², min 24 | behind text: auth backdrop, wake card, load pages |
| Normal | 1 per 20,000 px², min 34 (today's onboarding count, `Resources/onboarding-shell.html:1373`) | onboarding shell, updater |
| Dense | 1 per 9,000 px², cap 400 | dream overlay, website hero, loading cascade |

Default hue mix for a night field, by weight (the warm-first weighting of the lantern mockup, `mockups/lantern-loading.html:208-214`, re-expressed in tokens): firefly `#ffc46b` 0.50, slate `#94a3b8` 0.27, lavender `#a78bfa` 0.11, blue `#60a5fa` 0.07, emerald `#34d399` 0.05. State fields (dreaming, fresh) replace the first weight with the state hue and keep the rest; see section 3 item 2.

## 5. Traces

Edges are drawn as traces, never as straight lines. Per edge (`main.js:24773-24871`, curve at `:25172-25197`):

| Element | Spec | Source |
|---|---|---|
| Path | Quadratic Bezier; midpoint displaced perpendicular to the chord by `len · lift`, `lift = 0.145 to 0.22` (reference `0.12 + strength·0.10`, plus `min(0.08, len·0.025)`); the side is fixed per edge from the seed | `:24779-24781`, `:25172-25197` |
| Core pass | 1 px stroke, alpha 0.18, brightness gradient 1.0 at source to 0.35 at target (uniform 0.9 when undirected) | `:24806-24825` |
| Glow pass | same path, 2.5 px stroke, alpha 0.06 (WebGL lines are 1 px, `:28389-28390`; 2D gets its width back here) | `:24795-24798` |
| Sprite dots | core sprites along the curve: `N = clamp(round(len / 8 px), 6, 24)` dots at `rad` 0.7 to 1.2 px, alpha `0.22 + strength·0.28` (0.29 to 0.50) | `:24835-24843`, `:24752` |
| Colour | data-backed: the edge type colour (`extends #34d399, supersedes #f87171, related_to #60a5fa, implements #a78bfa, caused_by #fb923c, references #9ca3af`, `main.js:23889-23892`); decorative: the halo colour of the brighter endpoint | |
| Blend | all three passes `'lighter'` | `:24795`, `:24806`, `:24838` |
| Hover (interactive fields only) | edge to `0.88 + 0.12·sin(6t)`, others to 0.06 / 0.02 / 0.04 | `:28397-28420` |
| Decorative linking | each node links to at most its 2 nearest neighbours inside `linkDist` (120 px normal, 90 sparse, 150 dense); total edges at most `0.6 · nodes` | replaces distance-fade straight lines (`Resources/onboarding-shell.html:1505-1516`) |

## 6. Motion

Time `t` in seconds. All values from the reference animate loop (`main.js:28184-28260`, `:28436-28445`).

| Behaviour | Spec | Source |
|---|---|---|
| Wobble | `x += sin(0.8t + p)·A`, `y += cos(0.9t + 1.1p)·A`, `p` random in [0, 2π), `A` per node uniform in 0.35 to 0.9 px (reference `0.010 + rnd·0.018` world units, `:24531`); landmarks `A · 0.6` | `:28218-28220` |
| Breath | hubs and landmarks only: halo and corona alpha `· (1 + 0.20·sin(0.8t + 0.5p))` (reference corona `0.42 + 0.10·sin`), period 7.9 s | `:28436-28445` |
| No twinkle | ordinary nodes never modulate brightness on their own | reference has none (`audit/nodes-fireflies-reference.md` section 6, note) |
| Easing | any opacity change (reveal, state, hover) eases 8% per frame at 30 fps, about 0.4 s to settle | `:28240-28250` |
| Reveal on mount | nodes fade in with that easing, staggered 0 to 900 ms by distance from the origin (default the canvas centre); no overshoot | replaces the mockup's 1.15 overshoot (`mockups/lantern-loading.html:377-382`) |
| Pause on pointer | pointer over the canvas freezes wobble and breath in place (no fade); resumes on leave | `:28184-28190` |
| Frame cap | 30 fps (`FIREFLIES_TARGET_FPS = 30`, `:24105`); the Lantern wake runs at 40 today (`main.js:30856`) and comes down to 30; loop stops when the tab is hidden or the canvas is offscreen | |
| Reduced motion | `prefers-reduced-motion: reduce` renders one still frame at a seed-derived `t` and never starts the loop; one opacity fade-in is allowed, no positional motion (today: wake firefly fades in centred `main.js:30866-30870`, wake card kills animations `api/ui/src/vendor/kit-widgets/wake.ts:266`, `index.html:1376-1378`) | |

Data-backed extras (working-memory ring `sin(1.3t)`, selection `sin(4t)`, edge hover `sin(6t)`, `main.js:28253-28260`, `:28547-28549`, `:28397`) stay with the galaxy and do not appear in decorative fields.

## 7. The shared module

### 7.1 Name and shape

`kit-fireflies-2d`, one ES module, no dependencies, target under 12 KB minified. Source of truth at `api/ui/src/lib/kit-fireflies-2d.js` (proposed location next to `api/ui/src/lib/wake-card.js`), with a build step that inlines it where there is no bundler, the way the widgets are already vendored from `mcp/src/widgets` to `api/ui/src/vendor/kit-widgets` and the fonts are embedded in `Resources/*.html`.

| Export | Signature | Notes |
|---|---|---|
| `mount(canvas, options)` | returns `{ setDensity, setPalette, setMotion, setEnergy, pause, resume, still(), destroy }` | `options`: `density` (`'sparse' \| 'normal' \| 'dense'` or a number of px² per node), `palette` (array of `[hue, weight]` or a preset `'night' \| 'dream' \| 'fresh' \| 'attention'`), `seed` (integer; same seed, same field), `motion` (`'auto' \| 'still' \| 'off'`), `layers` (`{ stars, field, traces, landmarks }` booleans), `ground` (`'transparent'` only when the host paints the night ground underneath, else a hex), `hueForward` (section 3), `origin` (reveal origin), `fps` (default 30), `maxNodes` (default 400) |
| `renderMark(ctx, options)` | draws the mark's colour form from the same sprites | `options`: `x, y, size` (px), `level` (`'full' \| 'mid' \| 'small'`, default chosen from `size` per the reduction thresholds), `hue` (default firefly `#ffc46b`), `t` (seconds, for the hub breath), `alpha` |
| `fireflyColours(hue, { hueForward })` | returns `{ core, halo }` hex | section 3 |
| `drawNode(ctx, x, y, rad, hue, { haloScale, haloAlpha, coreAlpha, corona })` | one node | section 4 |
| `drawTrace(ctx, a, b, { lift, strength, colour, dots })` | one trace | section 5 |
| `sprites()` | returns the two white sprites (for a host that wants to draw its own) | section 2 |
| `spriteDataURL(hue, px)` | a tinted halo + core PNG data URI for CSS `background-image` | status dots, section 7.3 |

Sprites are generated on first use and shared per document. `renderMark` is the only sanctioned way to draw the logo's colour form in 2D; the silhouette form is an SVG symbol owned by the mark section and is not this module's job.

### 7.2 Where it loads

| Host | How | Notes |
|---|---|---|
| Web UI and Lantern compact | imported by `api/ui/src/main.js` into the `app.js` bundle (`index.html:95`) | auth backdrop, wake firefly, aurora stars, status dots |
| Lantern Resources pages | inlined as a `<script>` into `Resources/onboarding-shell.html`, `updating-page.html`, `load-html.html` by `deploy/personal/build-app.sh` | these pages are file URLs with no bundler; fonts are already embedded the same way (`audit/colour-type-tokens.md` section 2) |
| Dream overlay | imported by `api/ui/static/dream-overlay.js` (served static, loaded by `static/dreaming.html` and the in-app overlay) | |
| MCP widget shell | inlined as a string into `mcp/src/widgets/shell.ts` alongside the widget CSS, vendored to `api/ui/src/vendor/kit-widgets/shell.ts` | widgets are `srcdoc` iframes, so nothing can be fetched |
| kit-website | copied into `<repo>/kit-website` at build | hero canvas (`index.html:1429-1475`) |

### 7.3 Per-surface adoption

| Surface | File:line today | Draws today | Will draw |
|---|---|---|---|
| Onboarding canvas (every Lantern first-run step) | `Resources/onboarding-shell.html:1338`, `:1349-1620`, node at `:1553-1563` | 3 stop `createRadialGradient` (0 / 0.34 / 1) plus a crisp pure-white `arc` core, four flat hues `232,165,92 / 157,127,232 / 127,232,157 / 107,191,255` round-robin, `source-over`, straight 1 px `rgba(232,235,242)` lines, unthrottled rAF | `mount(canvas, { density: 'normal', palette: 'night', layers: { field, traces }, seed: per install })`; Swift's `energy` (`KitPersonalApp.swift:2633`) maps to `setEnergy`, which raises trace density and halo alpha, not hue |
| Birth constellation and woken-ready ("I am Kit") | `Resources/onboarding-shell.html:1399-1413`, `:1587-1600`; `Resources/woken-ready-script.html:18` (`setAct(3, 12)`) | 12 single-violet `157,127,232` 3 stop glows with `238,236,255` cores, straight `196,181,253` weave, nodes lerp in from the screen edge | the same mount's `landmarks` layer: the 12 memory nodes arrive on the wake curl path (the `kitWake` glide, `main.js:30884-30893`), hue firefly with lavender only while the act is "dreaming", traces as section 5, wakeBreath becomes the hub breath |
| Dream overlay motes | `api/ui/static/dream-overlay.js:223-228`, `:279-286`, edges `:265-278`, orb `:296-304` | 18 violet 3 stop motes plus `arc` cores on circular orbits, `lighter`, 0.8 px weave lines and 0.5 px tethers; a warm central orb from a 4 stop gradient with a crisp `arc` core | `mount(canvas, { density: 'sparse', palette: 'dream', hueForward: true, motion: 'auto' })` with the slow orbit kept as the field's drift; the central orb becomes one landmark drawn with `drawNode` (firefly hue, corona on, breath on) |
| Updater | `Resources/updating-page.html:10-15`, `:25-35`, `:50-61`, `:71-86` | lavender `#c4b9f8` hub+4 SVG with `drop-shadow`, a CSS radial `.glow` div, sat twinkle, ripple ring, six sparks; wave canvas in violet `lighter` bands with a woken gold bloom | `renderMark(ctx, { size: 66, level: 'mid' })` in firefly amber on the night ground (66 px is in the colour range); the woken state lifts the hub breath and fades in a `#e8a55c` corona, no sparks, no ripple; the wave canvas keeps `lighter` but takes amber and lavender from tokens |
| Auth backdrop | `index.html:1394-1440`, stars `:1419-1426`, blur `:1432-1440` | nine CSS pinpoint stars with a hard 60% stop, four washes under `filter: blur(18px)` | `mount(canvas, { density: 'sparse', palette: 'night', layers: { stars, field }, motion: 'auto' })` behind the card; the blooms stay CSS without the blur filter (the main aurora removed blurred layers for performance, `index.html:1318-1330`) |
| Aurora stars (page and `#kit-wake`) | `index.html:1249-1283`, `:1340-1348` | 32 hand-placed CSS `radial-gradient` pinpoints, white, cream `254,243,199`, periwinkle `199,210,254` | the module's `stars` layer: core sprite only, `rad` 0.5 to 1.1 px, alpha 0.18 to 0.45, tinted from the field's core colours; or, where a canvas is unwanted, a CSS `background-image` built from `spriteDataURL` |
| Wake card | `mcp/src/widgets/wake.ts:264-272`, motion `:250-257`; `shell.ts:47`, `:75-76`; vendored `api/ui/src/vendor/kit-widgets/wake.ts:270-282`, `shell.ts:73-77` | emerald `#34d399` closed quad of four equal `r2.4` discs, no hub, 0.22 straight strokes, scale breathe 3.8 s and per-star twinkle 2.8 s; an 8 px `.dot` with a `box-shadow` ring pulse | the mark's mid silhouette SVG (hub + 3) at 40 px in amber (`currentColor #e8a55c`), since 34 to 40 px is below the colour threshold; the `.dot` becomes the firefly dot (below); the widget shell gets `spriteDataURL` inline for it |
| Lantern wake firefly | `index.html:1350-1364`; driver `main.js:30776-30924` | one 120 px div, 7 stop CSS radial `255,248,225` to `232,165,92` plus a `::after` hot spot breathing 2.6 s; epicycle wander, 900 ms glide, 40 fps | one `drawNode` on a small canvas: firefly hue, `rad` 18 px, halo `rad · 3.2`, corona on, hub breath; same wander and glide maths, 30 fps, reduced motion still and centred |
| Status dots | `KitPersonalApp.swift:603-617`, `:1104-1107` (menu bar); `index.html:774-779` (live indicator), `:1718-1733` (tab live dot `#6bbfff`), `:7689-7696` (dream pill `#a78bfa`), `:739-748` (sleeping banner); `shell.ts:75-76` (card dot); `Resources/onboarding-shell.html:285-290` (`.dreaming-orb`), `:318-330` (`.signal::before`) | 7 to 11 px `border-radius: 50%` divs with `box-shadow` glows or expanding-ring keyframes, in at least four recipes; the menu-bar dot is a crisp disc with a black 0.55 ring | one "firefly dot" component: 8 px core, halo `2.6 ·` (a 21 px box), `background-image` from `spriteDataURL(hue)`, hue from the state token (emerald live, lavender dreaming, amber attention, red error); motion is the hub breath (alpha `1 ± 0.20` at 0.8 rad/s), never a ring pulse; reduced motion still. Exception: inside the menu bar (template or mono context) the dot stays a crisp disc, per the silhouette rule |

## 8. The mark's firefly form

The geometry is fixed by the mark section ("the bones": hub at (47,52) r10; companions (76,30) r5.5, (21,62) r4.5, (60,80) r4.0, (34,26) r3.0, (84,58) r2.8 in a 100 unit box; traces hub to the first four, first to fifth). This section only says how those bones are lit. Colour form applies at 48 px and up wherever there is colour; below 48 px or in mono the mark is the crisp silhouette and nothing here applies.

| Element | Spec |
|---|---|
| Hue | firefly `#ffc46b`: core `#fff6e4`, halo `#ffc36b` (section 3). On a state-coloured surface the mark still uses firefly; the state shows elsewhere |
| Hub | core sprite at r10, halo at `3.2 ·` (r32); no separate corona (the 3.2 halo is the corona; a 5 to 7.5 corona would spill past the box) |
| Companions | core at their radius, halo at `2.6 ·` (r14.3, 11.7, 10.4, 7.8, 7.3); all halos stay inside the 100 box (hub halo spans 15 to 79 by 20 to 84; the widest companion reaches 91.3) |
| Brightness ramp | halo alpha `0.87 · ramp`, core alpha `0.30 · ramp`, ramp 1 / .95 / .8 / .7 / .6 / .5 in the order hub, (76,30), (21,62), (60,80), (34,26), (84,58): halo 0.87, 0.83, 0.70, 0.61, 0.52, 0.44; core 0.30, 0.29, 0.24, 0.21, 0.18, 0.15 |
| Traces | quadratic, bowed 5 units at the midpoint (which is 0.14 to 0.18 of each chord: chords are 36.4, 27.9, 30.9, 29.1, 29.1 units, so the fixed bow sits inside the field rule's 0.145 to 0.22); stroke 1.6 units at alpha 0.34 in the halo colour, minimum 1 px on screen; bow side: anticlockwise around the hub for the four hub traces, away from the hub for the (76,30) to (84,58) trace (proposal for the mark section to confirm); no glow pass, sprite dots along the trace only at the full level, 8 per trace at alpha 0.29 |
| Specks | full level only, 5 to 7, core sprite only, r 1.2 to 1.8 units, alpha 0.45, positions owned by the mark section; never inside a halo, never on a trace |
| Levels | full (hub + 5 companions + traces + specks) at 128 px and up; mid (hub + (76,30), (21,62), (60,80), three traces) at 48 to 127 px in colour; 40 to 47 px and 32 px and below are silhouette levels, not colour |
| Scale check | at 48 px: hub r 4.8 px, halo r 15.4 px, smallest mid companion (60,80) r 1.9 px, trace 1 px; at 128 px: hub r 12.8, halo r 41, trace 2 px, specks r 1.8 px; at 512 px: hub halo r 164 px |
| Ground | the night ground of the surface (`#020617`, `--kit-bg-950`, `--kit-bg-900`); never a tile; the canvas is opaque or painted first |
| Motion | still by default. In wake moments only (Lantern wake, updater woken, onboarding glyph): hub halo breath `1 ± 0.10` at 0.8 rad/s, companions wobble at most 0.4 units at 0.7 to 0.9 rad/s, no twinkle, stills under the pointer and reduced motion |

## 9. Don'ts

| Don't | Why | Seen today |
|---|---|---|
| Three-stop radial gradients with a crisp core | a stepped tail "paints a visible circle of brightness" (`main.js:23904-23906`); the core is a hot point inside the bloom, not a disc on top of it | `Resources/onboarding-shell.html:1553-1563`, `:1587-1600`; `api/ui/static/dream-overlay.js:279-286`, orb `:296-304`; website hero 4 stop sprite `kit-website/index.html:1453-1466` |
| `box-shadow` or `drop-shadow` glows as nodes | a blurred disc has no core, no grain and no additive tail; it is ink with fog | `shell.ts:75-76`; `index.html:774-779`, `:1718-1733`, `:7689-7696`; `Resources/onboarding-shell.html:285-290`, `:318-330`; `Resources/updating-page.html:10-11`; `kit-film/src/scenes/primitives.tsx:48-88` |
| `shadowBlur` on `arc` fills, or a full-screen `filter: blur()` to soften a sky | same failure, plus a per-frame filter cost the main aurora already removed | `mockups/kit-app-onboarding.html:392-396`; `index.html:1432-1440` vs `:1318-1330` |
| Flat violet (or flat anything) nodes | an unlerped saturated hue reads grey at low alpha on navy and never reads as light; lavender is a state, not a node colour | `Resources/onboarding-shell.html:1353`, `:1587-1600` (the grey-dot "I am Kit" constellation, `audit/nodes-elsewhere.md` (h)); `dream-overlay.js:19-21`; `updating-page.html:11` |
| Straight full-strength lines between nodes | traces are bowed, layered at 0.18 and 0.06 and carry sprite dots; a straight 1 px line is a wireframe | `Resources/onboarding-shell.html:1505-1516`, `:1570-1585`; `dream-overlay.js:265-273`; `wake.ts:264-268`; `KitPersonalApp.swift:1089-1096` |
| Uniform twinkle | brightness modulation on every node reads as noise; the reference has none and breathes only its hubs | `wake.ts:250-257` (`kw-twinkle` 2.8 s); `updating-page.html:25-35` (sat twinkle); `mockups/lantern-loading.html:384` (14% twinkle); `kit-website/index.html` hero `tw = .6 + .4·sin`; `kit-deck/src/components/Hub/UniverseFireflies.tsx:366-385` |
| Additive drawing onto a transparent canvas | tails accumulate into a composited alpha mask (`main.js:24013-24016`) | any new surface that passes `ground: 'transparent'` without painting the night underneath |
| Baked per-hue sprites, or PNG sprites | colour is applied at draw time from one white pair; baked pairs drift the moment a token changes | `mockups/lantern-loading.html:242-261` (core/halo baked per hue) |
| Perfect circles anywhere in a field | the oval, the lobed rim and the dither are the grain; a circle is a different material | every `ctx.arc` node and `NSBezierPath(ovalIn:)` in `audit/nodes-elsewhere.md` |
| Size tied to brightness | big and bright together flattens the field into a few blobs; draw them independently (section 4.2) | `Resources/onboarding-shell.html:1553-1563` (`bright` feeds both radius and alpha) |
