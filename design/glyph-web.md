# Glyph audit: web UI + repo assets (key: glyph-web)

Scope: every occurrence of the Kit mark / logo / icon / wordmark in `api/ui/**`, `mcp/src/widgets/**` (rendered inside the web chat panel), `img/**`, `scripts/build-pwa-icons.py`, `docs/**`, `mockups/**`, plus the three sibling repos for cross-reference. Read-only; all paths relative to the worktree root unless absolute. Line numbers are from the files as they stand on branch `kit/visual-consistency-design-867c62` (HEAD c46415a).

Reference aesthetic (for comparison): the Fireflies galaxy sprites in `api/ui/src/main.js:23922-23998` (`makeFireflyTexture`). A 512/768 px canvas alpha map with an organic rim (`Math.sin(theta*5.0+0.4)*0.055 + Math.sin(theta*9.0+1.8)*0.035 + ...`), a "city sparkle" (`0.90 + 0.10*sin(x*0.21+y*0.17)*sin(x*0.07)`), steep core falloff (`exp(-3.2 r^2) * env^4`), dithered alpha, a separate bloom layer (`exp(-1.7 r^2) * env^1.75`), additive blending. Colour derivation at `main.js:24434-24435`: core = lens hue lerped 0.88 toward `#fffdf4` (near-white), halo = lens hue lerped 0.56 toward `#ffc36b`; hub corona `#e8a55c` (`main.js:24487`, `24620`). None of the marks below share any of that: every mark in the product is a crisp vector circle on a flat or gradient tile.

---

## 0. Design tokens the marks should agree on (and do not)

| Token | Value | Where |
|---|---|---|
| `--kit-amber` | `232,165,92` = `#e8a55c` | `api/ui/index.html:147` |
| `--kit-orange` | `251,146,60` = `#fb923c` | `api/ui/index.html:148` |
| Tailwind `amber-400` (remapped to brand) | `#e8a55c` | `api/ui/tailwind.config.js:26` |
| Tailwind `amber-300` | `#f0bd82` | `api/ui/tailwind.config.js:25` |
| Tailwind `orange-500` | NOT remapped, so default `#f97316` | (absent from `tailwind.config.js`) |
| `theme-color` meta / manifest | `#e8a55c` | `api/ui/index.html:18`, `api/ui/manifest.webmanifest:9` |
| `--font-display` | `'Fraunces', Georgia, 'Times New Roman', serif` | `api/ui/index.html:137` |
| `--font-body` | `'Manrope', ...` | `api/ui/index.html:138`; but overridden by `body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }` at `api/ui/index.html:789` (later rule wins over `:176`) |
| kit-website `--accent-warm` | `#e8a55c` | `<repo>/kit-website/styles/tokens.css:19` |

So the in-app tile is `#e8a55c -> #f97316` (brand amber to default Tailwind orange), while the PNG icons and the website favicon/nav mark use default Tailwind `#fbbf24` (see sections 3 and 8).

---

## 1. `api/ui/index.html` (app shell)

### 1.1 Favicon / PWA links (`index.html:17-31`)
- `:17` `<link rel="manifest" href="/ui/manifest.webmanifest">`
- `:18` `<meta name="theme-color" content="#e8a55c">`
- `:25` `<link rel="apple-touch-icon" href="/ui/static/icons/kit-apple-touch-180.png">`
- `:30` `<link rel="icon" type="image/png" sizes="32x32" href="/ui/static/icons/kit-32.png">`
- `:31` `<link rel="icon" type="image/png" sizes="16x16" href="/ui/static/icons/kit-16.png">`
- No SVG favicon; no `mask-icon`. (PNG details in section 3.)

### 1.2 App-bar brand mark, STATIC (`index.html:2749-2767`)
- Technique: inline SVG inside a CSS-drawn tile.
- Tile: `:2749` `div.relative.w-11.h-11.rounded-xl.bg-gradient-to-br.from-amber-400.to-orange-500`, i.e. 44x44 px, radius 12 px (`rounded-xl`), gradient `#e8a55c -> #f97316` (amber-400 remapped, orange-500 default). Extra glow from `:1609` `.bg-gradient-to-br.from-amber-400 { box-shadow: 0 0 22px rgba(var(--kit-amber), var(--kit-fill)); }` (= `rgba(232,165,92,0.40)`).
- SVG: `:2754` `svg.w-5.h-5.text-white fill="none" viewBox="0 0 24 24"`, 20x20 px white.
- Geometry (hub + 4 satellites): 4 lines from (12,12) to (5,5), (19,6), (5,19), (19,17), `stroke-width="1.3" stroke-opacity="0.55"`; satellites r = 1.9 / 1.6 / 1.6 / 1.9 at the same points (classes `kit-sat-1..4`); core `cx=12 cy=12 r=3.2`. All `fill="currentColor"`.
- Satellite opacity is forced to 0.85 by `:522` `.kit-sat-1, .kit-sat-2, .kit-sat-3, .kit-sat-4 { opacity: 0.85; }`.
- Animation: none on this tile (no `kit-alive` class). The comment at `:2743-2748` says the aliveness treatment + pip were retired as "a needless per-frame repaint". The CSS still exists (`:506`) and is still applied elsewhere (1.4, 2.1).
- The HTML comment at `:2751-2753` still says "Satellites each breathe on their own period"; stale.
- Wordmark: `:2767` `<h1 class="font-serif text-xl font-medium text-slate-100 tracking-tight whitespace-nowrap" x-text="kitBrand()">Kit</h1>`, i.e. Fraunces 20 px / 500 / `#f1f5f9`, hidden below `md` (`:2766 hidden md:flex`). Mixed case "Kit".

### 1.3 "Ask Kit" button glyph, a THIRD geometry (`index.html:3012-3024`)
- `svg.w-4.h-4 fill="none" viewBox="0 0 24 24"` (16 px), colour `var(--kit-accent-text)` via `currentColor`.
- Lines: same endpoints, `stroke-width="1.3"` but `stroke-opacity="0.6"` (not 0.55).
- Satellites r = 1.6 / 1.4 / 1.4 / 1.6, `fill-opacity="0.85"/"0.75"/"0.75"/"0.85"`; core r = 2.6 (not 3.2). No `kit-sat-*` classes.
- Comment `:3012` "Kit constellation icon, scaled to match the new bigger logo": it is a different drawing, not a scale.

### 1.4 Auth / invite / pair / welcome / demo-welcome cards, ANIMATED (6 copies)
All share CSS at `index.html:1479-1509`:
- `.kit-auth-logo` `:1479-1485`: 52x52 px, `border-radius: 16px`, `box-shadow: 0 12px 34px rgba(232,165,92,0.30), 0 0 0 1px rgba(255,255,255,0.12) inset`.
- `.kit-auth-logo-live` `:1486-1492`: `color:#ffffff; background: linear-gradient(135deg, rgb(var(--kit-amber)), rgb(var(--kit-orange)))` = `#e8a55c -> #fb923c` (token orange, NOT Tailwind `#f97316` as in the app bar).
- `.kit-auth-logo-live svg` `:1493-1497`: `1.55rem` (24.8 px), `filter: drop-shadow(0 2px 5px rgba(0,0,0,0.24))`.
- `.kit-auth-wordmark` `:1498-1504`: `font-family: var(--font-display)` (Fraunces), `28px`, `font-weight: 500`, `color:#f8fafc`. Mobile `:1506-1509`: logo 46 px / radius 14 px, wordmark 25 px.
- Every copy carries `class="kit-auth-logo kit-auth-logo-live kit-alive kit-rested"`, so they BREATHE via `:506` `.kit-alive { animation: kitBreath 4.6s ease-in-out infinite; }` (`:495-505`: box-shadow `0 0 14px rgba(232,165,92,.40)` to `0 0 32px 2px rgba(232,165,92,.60) + 0 0 52px 8px rgba(251,146,60,.18)`, `scale(1)` to `1.04`).
- Occurrences (all the same 24-unit SVG as 1.2 unless noted):
  - `:1747-1760` `#invite-static-fallback` (static no-JS invite page).
  - `:2129-2142` public-demo welcome card: satellite circles LACK the `kit-sat-*` classes, so they render at opacity 1.0 instead of 0.85 (the one copy that differs).
  - `:2169-2182` sign-in overlay.
  - `:6460-6473` pair-device overlay.
  - `:6577-6590` invite-redeem overlay.
  - `:6650-6663` welcome ("You're all set") overlay.

### 1.5 Retired state classes still live in CSS (`index.html:477-665`)
- `.kit-alive.kit-dreaming` `:540` (violet pulse 2.8 s + `kitDreamSpin 72s` rotation of the SVG `:542`), `.kit-fresh` `:559`, `.kit-overdue` `:576`, `.kit-unslept` `:584`; rest-state pip `.kit-state-pip*` `:616-650` (no markup references the pip any more; `grep kit-state-pip` only hits CSS). These are dead for the app bar but still fire on the chat-panel header (2.1) because it binds `'kit-' + rest_state`.

### 1.6 Compact / Lantern chrome: NO mark at all (`index.html:3681-3720`)
- Comment `:3683-3686`: "The gradient identity mark left with the old chrome (Lantern restyle, 2026-08-07) ... kit's presence now shows as the heart icon's status dot instead." The compact bar shows worded tabs + a chat-bubble path icon (`:3721-3724`) + heart; no constellation, no wordmark.

### 1.7 Auth scene backdrop (`index.html:~1418-1465`)
- `.kit-auth-scene` paints a fixed "night sky" of CSS radial-gradient stars (`2px`, `1px`, `1.4px` ... dots in `rgba(255,255,255,.78)`, `rgba(232,165,92,.70)`, `rgba(199,210,254,.86)`, `rgba(125,211,252,.78)`, `rgba(252,211,77,.82)`, `rgba(196,181,253,.72)`). Crisp hard-edged CSS dots: the closest thing the app has to the Fireflies language on a first-impression screen, but drawn as vector points, not soft sprites.

### 1.8 Other "Kit" wordmark typography in index.html
- `:2857` `h3.font-serif.text-base` "Kit health"; `:3868` `h2.font-serif.text-2xl` "Kit health"; `:4946` inline `font-family: 'Fraunces', Georgia, serif` for source titles. Fraunces/500 is consistent where used; sizes vary 16 to 28 px.
- `:230` one rogue `font-family: 'EB Garamond', Georgia, serif` (a 14 px italic badge). EB Garamond is not loaded anywhere (`:119` loads only Fraunces, Manrope, JetBrains Mono).

---

## 2. `api/ui/partials/*.html`

### 2.1 Chat panel header (`partials/dashboard.html:1274-1288`): ANIMATED + state-coloured, smaller
- Tile `:1274` `div.w-8.h-8.rounded-lg.bg-gradient-to-br.from-amber-400.to-orange-500 ... kit-alive` with `:class="'kit-' + (kitState?.rest_state || 'rested')"`, i.e. 32x32 px, radius 8 px, STILL breathes and still switches to violet/emerald/orange/slate auras per state (CSS 1.5). So the desktop app bar is static while the chat panel next to it pulses: two behaviours for the same mark on one screen.
- SVG `:1276` `w-4 h-4 text-white` (16 px), same 24-unit geometry as 1.2 incl. `kit-sat-*`.
- Wordmark `:1288` `h2.font-serif.text-lg.font-medium.text-slate-100.tracking-tight` "Kit" (18 px, vs 20 px in the app bar, 28 px on auth cards).

### 2.2 Composer "thinking" glyph (`partials/dashboard.html:2021-2027`): a FOURTH geometry
- `svg.kit-composer-thinking viewBox="0 0 24 24"` inside the 38 px round send button (`index.html:1003-1017`, svg 17 px). NO connecting lines; core `r=3`, satellites r = 1.8 / 1.5 / 1.5 / 1.8 (same positions), classes `kit-sat-*`. Colour `#f6b64b` from `.kit-composer.is-busy .kit-composer-send` (`index.html:1042-1046`) on `rgba(232,165,92,0.13)`.
- The comment says "the constellation pulses while thinking" but `kitSatBreath` is no longer applied (`index.html:519-522` retired it), so it does not pulse; only the capsule box-shadow breathes (`index.html:1034-1041 kitComposerBreath`).

### 2.3 Fireflies "Universe" button (`partials/fireflies-sunburst.html:17-24`): a FIFTH geometry
- `svg.w-3.5.h-3.5 viewBox="0 0 24 24"` (14 px). Core `r=2.2`, satellites r = 1.2 / 1.0 / 1.0 / 1.2 with `fill-opacity` 0.7 / 0.6 / 0.6 / 0.7, NO lines. Colour `#e8a55c` when active, `#cbd5e1` otherwise.

### 2.4 Fireflies initial-load loader (`partials/fireflies-sunburst.html:257-269`)
- Reuses `.kit-auth-logo kit-auth-logo-live kit-alive kit-rested` with inline `style="width:54px;height:54px;color:#e8a55c;"`, so the SVG is AMBER ON AMBER GRADIENT (currentColor overridden from white to `#e8a55c` on the `#e8a55c -> #fb923c` tile). Low contrast, breathing 4.6 s. Paired with a 140x2 px shimmer bar (`:274-275`), no wordmark.

### 2.5 Wake card in the chat empty state (`partials/dashboard.html:1383-1390`, mounted by `api/ui/src/lib/wake-card.js`)
- Byte-identical iframe of the MCP widget (`mcp/src/widgets/wake.ts`, vendored at `api/ui/src/vendor/kit-widgets/wake.ts`; `diff` shows only the generated-file header). See section 5 for that mark: a DIFFERENT constellation (4-node quadrilateral, no hub) in EMERALD.

### 2.6 Studio run "constellation" (`partials/studio-runs.html:926-938`, `src/main.js:4147-4215`)
- A d3 force graph named "mini fireflies": nodes = three stacked circles r 16 (opacity .10) / r 8 (.9) / r 2.4 `#fff7ed`, all under `feGaussianBlur stdDeviation=6`; edges `rgba(148,163,184,0.22)` 1.1 px with `stdDeviation 1.4` blur; node colours `#f0bd82` (created) / `#6ee7b7` (both) / `#7dd3fc` (referenced). Closer to the Fireflies language than any logo, but still crisp circles + blur, not sprites.

### 2.7 `partials/where-kit-lives.html`: no Kit mark; only generic line icons (`:52`, `:74`, `:91`, `:114`).

---

## 3. PWA icons: `api/ui/static/icons/*.png`, `api/ui/manifest.webmanifest`, `scripts/build-pwa-icons.py`

- Generator `scripts/build-pwa-icons.py` (PIL, not the SVG): docstring `:3-7` "Reproduces the same SVG that lives in the app-bar header". Colours hard-coded at `:26-28`: `AMBER = (251,191,36)` (#FBBF24), `ORANGE = (249,115,22)` (#F97316) with the comment `:22-24` "Tailwind from-amber-400 to-orange-500 ... amber-400 = #FBBF24". WRONG for this codebase, where amber-400 is remapped to `#e8a55c` (`tailwind.config.js:26`). Verified by pixel sampling: `kit-512.png` near-TL = `#fab822`, near-BR = `#f97917`; `kit-32.png` = `#ffc524 -> #ff8018`. The app tile is `#e8a55c -> #f97316`. The home-screen icon is a visibly yellower, more saturated tile than the app bar.
- Geometry `:64-103`: same 24-unit hub+4 (lines 1.3 units at alpha 140/255 = 0.55, sats 1.9/1.6/1.6/1.9, core 3.2), mapped with `pad = size*0.18`, so the constellation fills ~64% of the tile (vs 20/44 = 45% in the app bar tile, 24.8/52 = 48% on auth cards).
- Rounded square `:38-44` radius `0.22*size` (225 px at 1024); the app bar is `rounded-xl` (12/44 = 27%), auth card 16/52 = 31%.
- Outputs `:125-135`: 192, 512, 180 (apple-touch), 512 "maskable", 32, 16. `kit-maskable-512.png` is BYTE-IDENTICAL to `kit-512.png` (md5 `d4faf603...` both); it has transparent rounded corners, so Android maskable crops will show the corners; the script comment `:131-133` acknowledges "For now just a copy".
- `kit-apple-touch-180.png` also has alpha (corner `(0,0)` = `#000000 a=0`); iOS fills transparent regions with black, so the rounded-corner gap shows as black on the home screen.
- Manifest `manifest.webmanifest:9-10`: `theme_color #e8a55c`, `background_color #0f172a`; icons `:13-15`.
- Service worker precaches `/ui/img/kit-logo-dark-background.svg` (`api/ui/service-worker.js:21`) and uses `kit-192.png` / `kit-32.png` as notification icon/badge (`:172-173`). The SVG is precached but referenced nowhere in the UI.

---

## 4. Repo SVG logos: `img/*.svg`, `api/ui/img/*.svg`

### 4.1 `img/kit-logo-dark-background.svg` == `api/ui/img/kit-logo-dark-background.svg` == kit-film `public/kit-logo.svg` (diff: identical)
- 1024x1024, full-bleed SQUARE (no rounded corners): `<rect fill=url(#bg)>` radial `#ff9a23 -> #ff850f -> #fa7103` (`:5-9`) + warm haze `#ffbd60@.38` (`:11-14`). These oranges are NOT `#e8a55c`/`#fb923c`/`#f97316`/`#fbbf24`: a fifth orange family.
- Mark (`<g id="fireflies-mark" transform="... scale(1.72)">` `:52`): 12 NODES (core r 48 + 11 satellites r 22 down to 8) with gradient fills `#ffffff -> #fff8f1 -> #f3d2bf` and `stroke #fffaf5`, plus 16 dust dots r 5 to 2.8 at opacity .65 to .42, 12 curved quadratic links (stroke-width 7 down to 3.0, opacity .92 down to .28) with drop shadows, 3 faint bezier arcs, and 3 highlight arcs. This is the richest, most "firefly" mark in the system and the only one with depth/shadow.
- Titles literally say "app icon" (`:2`) but it is not used as the app icon anywhere in this repo (the PNGs come from PIL, section 3). It IS used by kit-film as `kit-app-icon.png` (1024 sq, rendered at 84 px / 132 px with `borderRadius 19/30`, `<repo>/kit-film/src/scenes/index.tsx:487,768`).

### 4.2 `img/kit-logo-light-background.svg`
- Same geometry, transparent background, nodes in orange gradients `#fff7ec -> #ffbf6a -> #ff8214 -> #f56800` (`:12-17`), links `#ff8a16/#ff7907/#e95f00` (`:25-29`), dust `#ff8614`. Not referenced by any HTML in this repo.

---

## 5. MCP widgets rendered in the web chat panel: `mcp/src/widgets/*.ts` (vendored to `api/ui/src/vendor/kit-widgets/`)

### 5.1 Wake card mark (`wake.ts:264-272`, offline variant `:110-118`)
- `svg.kw-glyph width=34 height=34 viewBox="0 0 34 34" fill=none stroke=currentColor`.
- Geometry: 4 EQUAL nodes r=2.4 at (9,11), (20,8), (25,20), (12,24) joined as a CLOSED QUADRILATERAL (edges 9,11 to 20,8 to 25,20 to 12,24 to 9,11), `stroke-opacity 0.22` (offline: 0.18). NO hub node. Default stroke-width 1.
- Colour: `.mark { color: var(--accent) }` with `--accent: #34d399` (EMERALD, `shell.ts:47,61`); offline `.mark { color:#f0b84d; opacity:.55 }` (`wake.ts:105`), yet another amber (`#f0b84d`).
- Animation `wake.ts:250-257`: `.kw-glyph` breathes 3.8 s (`scale 1 to 1.06`, opacity .9 to 1); `.kw-star` twinkles 2.8 s (opacity .35 to 1) with 0.5 s stagger.
- Typography `shell.ts:52`: `font-family: Inter, ui-sans-serif, system-ui, ...`. Inter, which the product does not load (the UI uses Manrope/Fraunces); title 15 px/600. No wordmark; the name appears as "Kit is awake".
- Card chrome `shell.ts:58-59`: `border-radius 10px`, `1px solid rgba(52,211,153,.24)`, gradient `rgba(52,211,153,.07)` over `#0f172a`, plus a pulsing 8 px emerald `.dot` (`kit-card-pulse` 2.4 s).

### 5.2 Saved card (`saved.ts:58-66`): 3 nodes r=2 at opacity .5 + a NEW star r=2.6 `#34d399` at (27,13), edges .28; different topology again.
### 5.3 Recall card (`recall.ts:69-72`): a "lens" of concentric circles r 15 (.28) / 9.5 (.55) / filled 3.5. Not a constellation.

---

## 6. `docs/**`

- `docs/federation.html`, `docs/flows-and-triggers.html`, `docs/memory-pipeline.html`: no mark, no wordmark; their own palette `--amber: #f5b942` (`federation.html:16`), body `--sans: "Inter", system-ui...` (`:22`). Another amber, another font.
- `docs/personas/*.html` + `persona.css`: footer `<span class="wordmark">Kit</span>` (`anti-the-craftsman.html:94`) styled `.wordmark { font-weight: 800; font-size: 20px; color: var(--ink); }` in SYSTEM SANS (`persona.css:22,181`). Heavy sans "Kit", no Fraunces, no glyph. Light theme.
- `api/ui/docs/*.html` are copies of the three docs above (same content, same absence of a mark).
- `api/ui/static/dreaming.html` / `dream-overlay.js`: no mark; titles in `Georgia,'Times New Roman',serif` (`dream-overlay.js:57,70`), not Fraunces.

---

## 7. `mockups/*.html`

| File:line | Mark | Notes |
|---|---|---|
| `mockups/desktop-parity.html:92,108` + CSS `:43-47` | hub+4 in 24-unit box (core 3.2, sats 1.9/1.6, lines 1.3@.55), 14 px white SVG on 24 px tile `border-radius:7px`, `linear-gradient(135deg,#fbbf24,#f97316)` (`:45`) | Wordmark `<b>Kit</b>` in Manrope 620/13 px `#b6bdd0` (`:47`): sans, not Fraunces. Tile uses default-Tailwind yellow like the PNGs. |
| `mockups/kit-app-menu.html:150-158,216` | NEW 4-node "Y" constellation in `viewBox 0 0 48 48`: nodes (14,28) r3, (25,13) r4, (37,23) r2.8, (27,37) r2.4; 3 lines from (25,13), `#e8ebf2`, stroke 1.5 to 1.6 @ .42 to .45. Rendered 58 px and 20 px (menu bar) with an 8 px status dot. | Labelled "Constellation, chosen for the menu bar". Also a "Single firefly" option (`:166-176`: concentric rings `#e8a55c` + core `#e8ebf2`) and an "App tile" option (`:180-193`) using ANOTHER 4-node arrangement ((16,34) r3, (29,21) r3.8, (44,28) r2.6, (32,40) r2.2, one bezier link) on `.tile` `radial-gradient(circle at 48% 40%,#ff9a23,#fa7103)` radius 16/64 (`:90`); this tile colour matches `img/kit-logo-*.svg`, not the app. |
| `mockups/kit-app-window.html:142,229` | same 48-unit "Y" constellation at 17 px (`#cdd4e6` lines, `#e8ebf2` nodes) next to `<b>Kit</b>` in the title bar; 3-node version (no lines, `#fff`) at 14 px in the "Chat with Kit" button. | |
| `mockups/lantern-housing.html:55-57` | menu-bar glyph is a PURE radial-gradient firefly (16 px circle, `rgba(255,248,225,.98) -> rgba(232,165,92,.4) -> transparent`, glow `0 0 10px rgba(232,165,92,.55)`); NO constellation. | Closest mock to the Fireflies aesthetic. Menu header `<b>Kit</b>` `:117`. |
| `mockups/lantern-loading.html:80-89` | `.firefly` 120 px CSS radial-gradient sprite (`rgba(255,248,225,.95)` core -> `rgba(232,165,92,.16)` ... transparent 78%), breathing 2.6 s scale 1 to 1.14. | Same family as lantern-housing; no mark, no wordmark. |
| `mockups/kit-app-onboarding.html:49` | `.eyebrow .glyph` = 8 px amber dot `var(--warm)=#e8a55c` with `0 0 12px rgba(232,165,92,.7)` glow. | Loads Fraunces + Manrope locally (`:8-9,17-18`). |
| `mockups/kit-widget-library.html:113-126,334-335,352` | `.mark` = TEXT "Kit" in a 30 px box (`border 1px rgba(55,217,157,.42)`, `border-radius 9px`, green gradient, 11.5 px / 720). | Emerald "text tile", same family as the MCP widgets' accent, but the real widget uses the quadrilateral glyph. |

---

## 8. Sibling repos (cross-reference only)

- kit-website `favicon.svg`: hub+4 in 24 units but its OWN numbers: lines `stroke-width 1.5 @ .6`, sats r 2 / 1.7 / 1.7 / 2 with fill-opacity .85/.75, core 3.2, all `#fbbf24` (default Tailwind amber), transparent background. Nav mark `index.html:141-151`: 22 px, lines 1.2@.6, sats 1.8/1.5/1.5/1.8 @ .85/.75, core r 3, colour `#fbbf24` + `drop-shadow(0 0 6px rgba(251,191,36,.45))`, breathing 6 s scale 1 to 1.06 (`styles/base.css:278-295`). Wordmark via `.nav__brand` = Fraunces 500 / 1.125 rem (`base.css:264-272`). Comment `:138-140` claims "the real logo from the brain UI ... same mark used in the product"; the numbers differ from every product copy. Unused asset `assets/img/kit-glyph.png` (200 sq, the 12-node orange render).
- kit-film: `public/kit-logo.svg` is byte-identical to `img/kit-logo-dark-background.svg`; `kit-app-icon.png` 1024 sq shown with `borderRadius 19/30`; plus an in-film `KitGlyph` (`src/scenes/index.tsx:215-236`) = 5 SATELLITES ON A PENTAGON (R = 0.34*size, sat r 0.07*size, core 0.13*size with drop-shadow) in `BRAND.node = #6bbfff` (BLUE, `src/theme.ts:17`).
- kit-deck `src/components/Hub/DeckMark.tsx`: wordmark-only, "Kit" in Fraunces 500 / 56 units, letter-spacing -1.5, with a single accent dot r 6 `#fcb24d` at top-right (yet another amber). Comment: "No glyph, no logo grid: the type does the work."

---

## 9. Distinct variants table (web surface + repo assets)

| # | Variant | Geometry / colour | Where used |
|---|---|---|---|
| A | Hub+4 "X" on warm tile, STATIC | 24-unit: core 3.2, sats 1.9/1.6/1.6/1.9 @ .85, 4 lines 1.3@.55, white on `#e8a55c -> #f97316` 44 px `rounded-xl` + 22 px amber glow; Fraunces 20/500 "Kit" | `index.html:2749-2767` app bar (desktop) |
| A' | Same SVG, BREATHING, on `#e8a55c -> #fb923c`, 52 px r16 (46/r14 mobile), Fraunces 28/500 | 6 auth/invite/pair/welcome/demo cards `index.html:1747, 2129 (sats @1.0), 2169, 6460, 6577, 6650` |
| A'' | Same SVG, 32 px r8 tile, BREATHING + rest-state colour auras (violet/emerald/orange/slate), Fraunces 18/500 | chat panel header `partials/dashboard.html:1274-1288` |
| A''' | Same SVG, AMBER ON AMBER (`color:#e8a55c` on the gradient), 54 px, breathing | Fireflies loader `partials/fireflies-sunburst.html:257-269` |
| B | Hub+4, lighter: core 2.6, sats 1.6/1.4 @ .85/.75, lines 1.3@.6, 16 px, accent colour, no tile | "Ask Kit" button `index.html:3013-3024` |
| C | Hub+4 NO lines: core 3, sats 1.8/1.5, 17 px `#f6b64b` in a 38 px round button | composer thinking `partials/dashboard.html:2021-2027` |
| D | Hub+4 NO lines, tiny: core 2.2, sats 1.2/1.0 @ .7/.6, 14 px | Fireflies "Universe" button `partials/fireflies-sunburst.html:18-24` |
| E | PNG tile of A but in default-Tailwind `#fbbf24 -> #f97316`, radius 22%, mark fills ~64%, transparent corners (apple-touch + "maskable" = same file) | favicon 16/32, PWA 192/512, apple-touch 180, notification icon/badge (`static/icons/*`, `build-pwa-icons.py`) |
| F | 12-node firefly illustration with curved links, dust, shadows, on full-bleed square `#ff9a23 -> #fa7103` (dark) / transparent with orange nodes (light) | `img/*.svg`, `api/ui/img/*.svg` (only precached by SW, never displayed); kit-film app icon; website `kit-glyph.png` (unused) |
| G | 4-node closed quadrilateral, NO hub, r 2.4, edges @.22, EMERALD `#34d399`, breathing + twinkle, Inter type | MCP wake card, rendered inside the web chat empty state `partials/dashboard.html:1383-1390` via `mcp/src/widgets/wake.ts:264-272`; offline variant in `#f0b84d` @.55 |
| G' | 3 grey nodes + 1 new emerald star (saved card); concentric "lens" (recall card) | `mcp/src/widgets/saved.ts:58-66`, `recall.ts:69-72` |
| H | 4-node "Y" constellation in 48-unit box (`#e8ebf2`), 17 to 58 px, + status dot | mockups `kit-app-menu.html:150-216`, `kit-app-window.html:142,229` |
| H' | Alt 4-node arrangement on `#ff9a23 -> #fa7103` tile r16 | `kit-app-menu.html:180-193` "App tile" direction |
| I | Single soft firefly (pure radial gradient, no nodes), `rgba(255,248,225)` -> `#e8a55c` glow, breathing | mockups `lantern-housing.html:55-57` (menu bar), `lantern-loading.html:80-89` (wake), onboarding eyebrow dot `kit-app-onboarding.html:49` |
| J | Text tile "Kit" in a 30 px emerald-bordered box, 11.5 px/720 | `mockups/kit-widget-library.html:113-126,335,352` |
| K | Wordmark only, sans 800/20 px | `docs/personas/*.html` footer (`persona.css:181`) |
| L | Website hub+4 variants (`#fbbf24`, lines 1.5@.6 / 1.2@.6, sats 2/1.7 or 1.8/1.5, core 3.2 or 3, breathing 6 s) | kit-website `favicon.svg`, `index.html:141-151` |
| M | 5-satellite pentagon in blue `#6bbfff` | kit-film `src/scenes/index.tsx:215-236` |
| N | Fraunces wordmark + single `#fcb24d` dot | kit-deck `DeckMark.tsx` |

Counting only what a user of the WEB UI can see on screen: A, A', A'', A''', B, C, D, E, G (+G') = at least 8 visually different drawings of "the Kit mark" across one product surface, in four different amber/orange families (`#e8a55c/#fb923c`, `#e8a55c/#f97316`, `#fbbf24/#f97316`, `#f6b64b`, plus emerald `#34d399` for the wake card), at five tile radii (7, 8, 12, 14/16, 22%), with three animation behaviours (static / 4.6 s breath / breath + state aura) and three wordmark sizes (18/20/28 px Fraunces 500) plus a sans/800 outlier in docs. None of them use the soft, irregular, haloed sprite language of the Fireflies view that is meant to be the reference; the only artefacts that do are un-shipped mockups (`lantern-*.html`) and the orphaned 12-node illustration (`img/*.svg`).

---

## 10. Specific defects worth fixing independent of the redesign

1. `scripts/build-pwa-icons.py:26-28` uses default-Tailwind `#FBBF24/#F97316`; the app uses `#e8a55c`. Home-screen icon differs from the in-app tile.
2. `kit-maskable-512.png` is a byte copy of `kit-512.png` with transparent corners (`build-pwa-icons.py:131-135`); apple-touch also has alpha, giving black corners on iOS.
3. `.kit-alive` animation (`index.html:506`) is "retired" per comments (`:2743-2748`, `:519-521`) but still runs on 7 logo instances (6 auth cards + chat header) and the chat header still binds rest-state auras (`dashboard.html:1275`).
4. Demo-welcome card (`index.html:2135-2138`) is the only copy without `kit-sat-*` classes, so satellites render at 1.0 vs 0.85 everywhere else.
5. Fireflies loader paints the white-on-gradient mark in `#e8a55c` (`fireflies-sunburst.html:257`): amber glyph on amber tile.
6. `/ui/img/kit-logo-dark-background.svg` is precached by the service worker (`service-worker.js:21`) but never displayed.
7. `index.html:789` `body { font-family: -apple-system... }` overrides the declared `--font-body` Manrope at `:176`; `:230` asks for unloaded `EB Garamond`.
8. Wake card (`shell.ts:52`) uses Inter and emerald; nothing else in the UI does either for brand.
9. Stale comments: `index.html:2751-2753` ("satellites breathe"), `:3012` ("scaled to match"), `dashboard.html:2015` ("constellation pulses"), kit-website `index.html:138-140` ("same mark used in the product").
