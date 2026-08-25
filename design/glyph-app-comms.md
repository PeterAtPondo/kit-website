# Audit: Kit mark / logo / icon / wordmark outside the web UI

Key: `glyph-app-comms`. Read-only. Worktree: `<repo>/kit/.claude/worktrees/infallible-colden-d041cb` (paths below are relative to it unless absolute). Sibling repos read: `kit-website`, `kit-film`, `kit-deck`. Shipped app inspected at `<repo>/kit/deploy/personal/dist/Kit.app` and `/Applications/Kit.app` (byte-identical icon assets).

## 0. The canonical reference (what everything is compared against)

`img/kit-logo-dark-background.svg` (6,646 B) and `img/kit-logo-light-background.svg` (6,813 B), both 1024x1024, `#fireflies-mark` group scaled 1.72 about centre.

| Element | Dark SVG | Light SVG |
|---|---|---|
| Tile | full-bleed square `<rect>` radial `#ff9a23` 0% to `#ff850f` 58% to `#fa7103` 100% (cx48% cy42% r78%) + warm overlay `#ffbd60`@.38 to `#ff8b18`@0 | none (transparent) |
| Haze | ellipse 248x168 white @.10, blur 24 | same ellipse, `#ff8a16` .13 to 0 |
| Orbit arcs | 3 cubic paths, white @.23, sw 4 / 3.2 / 2.4 | `#ff8a16` @.15 |
| Links | 12 quadratic paths from hub/satellites, gradient white to `#fff7ef` to `#f6d9c8` (.62/.86/.44), sw 7 down to 3.0, opacity .92 down to .28, drop shadow `#983900` | gradient `#ff8a16`/`#ff7907`/`#e95f00` |
| Specks | 16 circles r 2.8 to 5, white @.42 to .65 | `#ff8614` @.34 to .52 |
| Nodes | hub (512,512) **r48** + **11 satellites** r 21, 22, 18, 17, 15, 12, 11, 10, 10, 9, 8; fill radial `#ffffff` to `#fff8f1` to `#f3d2bf`, stroke `#fffaf5`; shadows `#a13d00`/`#743000` | fill `#fff7ec` to `#ffbf6a` to `#ff8214` to `#f56800` (large) / `#fff4e4` to `#ffa545` to `#fb7105` (small), stroke `#fff4e9` |
| Highlights | 3 small arcs white @.45 | `#fff9f0` @.38 |

So the canonical mark is: 12 nodes, curved links, specks, orange radial tile, no corner radius baked in.

## 1. Mac app "Lantern" (`deploy/personal/macos/`)

### 1.1 Menu-bar icon (NSStatusItem)
- `KitPersonalApp.swift:569` `NSStatusBar.system.statusItem(withLength: .squareLength)`; `:1019-1029 configureStatusButton` sets `image = kitMenuBarGlyphImage()`, `image.size = 20x20`, **`image.isTemplate = false`** ("the status dot needs to keep its colour"), `imagePosition = .imageOnly`, `title = ""`.
- `KitPersonalApp.swift:1080-1112 kitMenuBarGlyphImage()` draws a **22x22 NSImage in code** with `NSBezierPath`, `NSColor.white` stroke + fill:
  - nodes `(10,15) r2.0` (hub), `(5,8) r1.5`, `(16,12) r1.4`, `(11,4) r1.2` (NSImage coordinates, origin bottom-left, so the hub sits upper-centre);
  - 3 straight links hub to each, `lineWidth 1.3`, round caps;
  - status dot bottom-right at `(18,4)`: ring `NSColor.black@0.55` r3.3 under colour r2.4.
- Dot colours `KitPersonalApp.swift:603-617 statusDotColor`: starting/degraded amber `calibratedRed 0.91,0.65,0.36` (approx `#e8a65c`); importing/dreaming purple `0.62,0.50,0.91` (approx `#9e80e8`); down/stopped red `0.94,0.42,0.37` (approx `#f06b5e`); healthy green `0.50,0.91,0.62` (approx `#80e89e`). These map to the website tokens (`--warm #e8a55c`, `--memory #9d7fe8`, edge green `#7fe89d`).
- **No appearance handling**: grep for `effectiveAppearance|NSAppearance|isDark` in the Swift returns nothing. A hard-white, non-template glyph is near-invisible on a light menu bar / light wallpaper.
- Text fallback `:1130-1135`: if `button.image == nil` the button title becomes the Kit name.
- Menu rows use SF Symbols (`menuIcon` `:650-666`), tinted for health rows (`:791, 933-936, 977-979`), same amber/red values.
- **Variant**: a 4-node, 3-spoke, asymmetric constellation that matches neither the 5-node web mark nor the 12-node canonical.

### 1.2 App icon (Dock / Finder / Sparkle)
- Source: `deploy/personal/build-app.sh:37-38` `APP_LOGO_DARK/LIGHT = img/kit-logo-*.svg`; `:220-221` copies both SVGs into `Contents/Resources/`.
- `:256-257` `sips -s format png -z 1024 1024 "$APP_LOGO_DARK" --out kit-app-icon.png` (sips SVG rasteriser; filters did render in the shipped PNG, soft shadows visible).
- `:259-315` inline Swift `round-kit-icon.swift`: clips the 1024 PNG to a **superellipse, exponent 4.9, artwork 824/1024 centred**, transparent outside, and overwrites `kit-app-icon.png`.
- `:321-331` iconset 16/32/128/256/512 @1x/@2x via sips, then `iconutil -c icns` to `KitPersonal.icns`; `Info.plist` `CFBundleIconFile = KitPersonal` (`:349`).
- `KitPersonalApp.swift:302` `NSApp.applicationIconImage = kitAppIconImage()`; `:1032-1045` loads `kit-app-icon.png` (squircle PNG), else `kit-logo-dark-background.svg`, else repo `img/` SVG.
- Shipped (`dist/Kit.app/Contents/Resources`, identical in `/Applications/Kit.app`): `KitPersonal.icns` 873,054 B (ic12 family, 16 to 1024 px); `kit-app-icon.png` 1024x1024 RGBA 501,406 B; `kit-logo-dark-background.svg` 6,646 B; `kit-logo-light-background.svg` 6,813 B.
- Visual check (extracted iconset): at 256+ px it is the canonical mark on the orange squircle; at 32x32 and 16x16@2x the constellation collapses into an orange tile with a white smudge (11 satellites + specks do not survive small sizes).
- `make-dmg.sh:40-50`: plain `hdiutil create -volname "Kit $VERSION"`, **no volume icon, no DMG background**. `release-app.sh`, `sign-notarize.sh`, `sparkle.env`: no icon references.

### 1.3 In-app mark (onboarding shell)
- `Resources/onboarding-shell.html:208-218` `.kit-glyph` 54x54; `img { border-radius: 16px; box-shadow: 0 0 28px rgba(232,165,92,0.28), 0 0 58px rgba(157,127,232,0.20) }`; `:1034-1038` `.breathing img` `breathe 4.2s` scale 1 to 1.045 with glow 26/56px to 38/78px.
- Source of the image: `KitPersonalApp.swift:2616-2619` `<img src="kit-logo-dark-background.svg">`, i.e. the **canonical dark SVG, full-bleed square, rounded by CSS to 16px (about 30%)**; a different silhouette from the app icon's 824/1024 superellipse.
- Shown when `glyph: true`: Welcome (`:2711`), First memories (`:3068`), Awake (`:3096`), Welcome back (`:4902`), First conversation (`:5643`); default only step 0 (`:2615`).
- Palette `onboarding-shell.html:10-26`: `--bg #0a0e1a`, `--warm #e8a55c`, `--memory #9d7fe8`, **`--green: #9d7fe8` (comment "Kit purple... was green")**.

### 1.4 Onboarding "fireflies" background canvas
- `onboarding-shell.html:1338` `<canvas class="fireflies">`, JS `:1349-1620`. 2D canvas, `COLORS = ['232,165,92','157,127,232','127,232,157','107,191,255']` (warm, purple, green, blue), `MEMORY_COLOR = '157,127,232'`.
- Points r 1.4 to 4.0; each drawn as **crisp white core** `rgba(255,255,255,0.5+pulse*0.4)` `ctx.arc` + radial halo radius `22 + r*3` (`:1568-1578`); links straight, `rgba(232,235,242,...)` `lineWidth 1` (`:1505-1513`); ripples/stars lavender `rgba(196,181,253)` / `rgba(199,184,255)`; birth nodes purple with `rgba(238,236,255)` cores. `globalCompositeOperation` default (no additive). The reference Fireflies galaxy (Three.js city-light sprites, warm whites/ambers/pinks/greens, additive trails) is not what this draws: crisp vector circles, purple/blue dominant.
- `ready-celebration.html:153, 317` only drives `window.kitMesh.setAct/wakeBreath`; no own mark.

### 1.5 Other orbs / marks in Resources
- `.birth-pause-orb` `onboarding-shell.html:1269-1277`: 54px radial `#ffffff` to `#cbb8ff` 38% to `rgba(157,127,232,.35)` 66% to transparent 78%, `birthOrb 3.4s` scale .94 to 1.06 (used `birth-conversation-body.html:20`).
- `.dreaming-orb` `:285-290`: 11px circle, `background: var(--green)` (= purple `#9d7fe8`), pulse 1.6s.
- `updating-page.html:50-61`: **5-node 24-viewBox mark** (hub (12,12) r3.2; sats (5,5) r1.9, (19,6) r1.6, (5,19) r1.6, (19,17) r1.9; 4 straight lines sw1.2 @.5; `currentColor`), 66x66 (`:12`), colour **`#c4b9f8` lavender**, `drop-shadow rgba(167,139,250,.5)`, `breath 3.6s` (`:11`); on `.woken` it turns **`#f7d49a` pale gold**, `wakePop`, sat `twinkle`, ripple ring `rgba(245,201,122,.85)`, sparks `#ffe0a3` (`:14-15, 25-30`); page bg `#05060f` (`:6`); canvas wave bands purple `(167,139,250)/(196,181,253)/(157,127,232)` with `globalCompositeOperation='lighter'` (`:74-81`).
- `kit-welcome-body.html:21-25`: five step icons, generic line glyphs; step 4 "Import your memories" is a **3-node mini-constellation** (`circle (6.2,7) r1.6, (13.6,6.2) r1.4, (10.4,13.2) r1.7` + 2 short lines), colour `#b9b6cc`, active `#c4b5fd`.
- `welcome-body.html:21`, Swift `:1368`, `:2722`: circle-i info icon (not a brand mark).
- No mark at all in: `woken-ready-body`, `ready-body`, `soul-body`, `areas-body`, `selection-body`, `telegram-body`, `api-key-body`, `permission-notice`, `access-denied-card`, `terms-change-body`, `installing-body`, `surfaces-body`.

### 1.6 Window chrome
- Lantern window `KitPersonalApp.swift:3294-3299`: `fullSizeContentView`, `titlebarAppearsTransparent`, `titleVisibility .hidden`, `backgroundColor NSColor(srgbRed: 2/255, 4/255, 9/255)` = `#020409`. No titlebar/toolbar logo. Onboarding windows classic titlebar (`:3300-3305`). App menu is "Kit" / "Quit Kit" only (`:1047-1056`); no About panel; app runs as `.accessory` (no Dock tile) once resident (`:1121-1124`).

## 2. Telegram
- **No bot identity asset exists.** grep `setMyProfilePhoto|setChatPhoto|profile_photo|bot avatar|botpic` across `api/`, `mcp/`, `deploy/`, `docs/` returns nothing (only a log line in `docs/review/.../codex-seat.log`). `api/services/telegram_*.py`, `api/routes/telegram_inbound.py` contain no image/logo.
- Onboarding `Resources/telegram-body.html:1`: "Open BotFather... send /newbot. Any name works"; no avatar guidance, so the bot wears BotFather's default blank/initial avatar.
- Channel manifest icon is a Lucide name, not an asset: `api/services/channels/telegram/telegram.manifest.json:1` `"icon":"send"`; `api/services/channels/service.py:18`; `api/services/connections/service.py:342, 425`.

## 3. Email
### 3.1 Invite / reset emails (`api/services/email.py`)
- `:149-152` and `:261-264`: `<img src="{base}/ui/static/icons/kit-192.png" width="40" height="40" style="border-radius:11px">` (skipped when `base` is not `http...`, wordmark alone, `:145-153`).
- Wordmark `:184/294` "Kit" Georgia/Times 24px 600 `#f8fafc`; `BRAND_NAME` 11px `#e8a55c` tracking .14em (`:185/295`). Card `#0f1729`, border `rgba(232,165,92,.24)`, radius 18 (`:177`); page `#060b16` (`:171`); CTA `bgcolor #e8a55c` / `linear-gradient(135deg,#eeb066,#db8a3c)` text `#1a1207` (`:202-205`).
### 3.2 Kit's own outbound mail signature (`api/services/outbound/mailbox.py`)
- `:29` `SIG_LOGO_PATH = "/app/ui/static/icons/kit-192.png"`; inlined as `cid:kitmark` (`:44-45`, `:153-160`), **46x46, border-radius 11px**; "Kit" Georgia 19px `#1a1a1a`; links **`#fa7103`** (the canonical orange) on a light rule `#eceae4`; text sig `:31-37`.
### 3.3 What `kit-192.png` actually is
- Built by `scripts/build-pwa-icons.py:27-111`: reproduces the **web-UI app-bar SVG** (5 nodes: hub r3.2 + sats (5,5) r1.9, (19,6) r1.6, (5,19) r1.6, (19,17) r1.9; 4 straight spokes alpha 140/255), white, on a **diagonal linear gradient amber `#FBBF24` to orange `#F97316`** (Tailwind amber-400/orange-500), **22% rounded square**, 18% padding; 1024 master LANCZOS-downsampled. Sampled pixels in the shipped PNG: TL `#fab522`, TR/BL `#fa991d`, BR `#f97c17`, centre `#ffffff`.
- Same file feeds `api/ui/manifest.webmanifest:14-16`, `api/ui/index.html:25,31,32` (apple-touch-180, kit-32, kit-16), `api/ui/service-worker.js:172-173` (notification icon/badge). `api/ui/static/icons/`: kit-16/32/192/512/maskable-512/apple-touch-180 (maskable is a plain copy with transparent corners: `build-pwa-icons.py:130-133`).
- Versus canonical: 5 nodes vs 12; straight spokes vs curved links + specks; linear amber-yellow to orange vs radial `#ff9a23` to `#fa7103`; 22% rounded rect vs superellipse (app) vs CSS 16px/54px (onboarding) vs 11px/40px and 11px/46px (emails).

## 4. Website (`<repo>/kit-website`)
- `favicon.svg:1-11`: 24-viewBox 5-node mark, **solid `#fbbf24`**, sats r2/1.7/1.7/2 @.85/.75, hub r3.2, lines sw1.5 @.6, transparent bg. Linked by `index.html:36`, `blog/index.html:16`, `404.html:9`, `install/index.html:11`, `walkthrough/index.html:11`, `terms/index.html:10`, `supported/index.html:11`. No PNG favicon, no apple-touch-icon, no web manifest.
- Nav mark `index.html:141-151` (and `blog/index.html:26`, `install:78`, `walkthrough:101`, `terms:20`, `supported:44`; 33 pages carry `<circle cx="12" cy="12" r="3" ...>`): 22x22 `currentColor`, sats r1.8/1.5/1.5/1.8 @.85/.75, **hub r3 (favicon/web UI use r3.2)**, lines sw1.2 @.6. CSS `styles/base.css:278-299` `color #fbbf24`, `drop-shadow 0 0 6px rgba(251,191,36,.45)`, `kit-breath 6s` scale 1.06. Comment at `index.html:138-140`: "the real logo from the brain UI... same mark used in the product". Wordmark `[data-name]` Fraunces 500 1.125rem (`base.css:264-272`, `697-701`).
- `og:image` `index.html:18,24,101` points to `assets/img/background.png` 5090x2144 (Fireflies screenshot, no mark).
- `assets/img/kit-glyph.png` 200x200: the **canonical 12-node mark on orange, full-bleed square, no rounding** (TL `#fc7a08`, centre `#fff9f4`); **referenced nowhere** in the site.
- `assets/img/fireflies.png` 3194x2124: Fireflies screenshot, `index.html:575` figure and blurred background of every blog `og-image.html` (`blog/*/og-image.html:35`). OG cards carry no mark: kicker pip 12px `#9d7fe8` glow (`og-image.html:83-87`), byline "Kit, with the operator", url text.
- `media/wake-card.png` 1720x672 dark-navy wake card. `assets/icons/*.svg` are third-party surface logos (22px).
- `kit-website/api/*.mjs` (welcome, beta-invite, beta-mail...): no logo/image references.

## 5. kit-film (Remotion film, `<repo>/kit-film`)
- `public/kit-logo.svg` md5 `a2c8874c...` == canonical dark SVG; `public/kit-app-icon.png` md5 `805f6d52...` == shipped Kit.app squircle PNG (501,406 B).
- Used `src/scenes/index.tsx:487` (`width 84, borderRadius 19, boxShadow rgba(232,165,92,.3)`) and `:768` (`width 132, borderRadius 30, shadow rgba(232,165,92,.28)`); CSS radius applied over an already-squircled PNG. `kit-logo.svg` unused.
- `src/scenes/index.tsx:213-235` **`KitGlyph`**: hub `r=size*.13` + **5 satellites on a regular pentagon** at `R=size*.34`, `r=size*.07`, lines sw1.2 @.45, colour `BRAND.node #6bbfff` (blue), drop-shadow; default 52px. Exported, **no usages** (grep finds the definition only).
- Intro `:252-290`: single blue orb `BRAND.node` 20px + expanding rings. Palette `src/theme.ts:7-23`: node `#6bbfff`, warm `#e8a55c`, dream `#9d7fe8`, edge `#7fe89d` ("lifted verbatim from kit-website/styles/tokens.css").
- `src/WalkthroughIntro.tsx:24-40`: Telegram/Claude/OpenAI/Cursor/VS Code logos as single-path glyphs; no Kit mark.

## 6. kit-deck (`<repo>/kit-deck`)
- `src/components/Hub/DeckMark.tsx:12-42` **`KitMark`**: wordmark "Kit" Fraunces 500 56px `letterSpacing -1.5` + accent dot `circle (80,14) r6 #fcb24d`; comment `:4-7` "The Kit mark on the home site is just the word 'Kit'... No glyph, no logo grid" (contradicts kit-website, which uses a glyph). Used `HubTitle.tsx:42` at 38px white.
- `src/app/globals.css:7-12` "Kit brand dots": `#f04f42 #f47b4a #fcb24d #83c184 #007bc7` (client-brand palette, not Kit's).
- `src/app/favicon.ico` = default Next.js/Vercel triangle (4 icons 16/32, md5 `c30c7d42...`); `public/` only `next.svg`, `vercel.svg` etc. **No Kit mark in the pitch favicon.**

## 7. MCP / VS Code / AnythingLLM / Claude Desktop surfaces
- **No icon handed to any host.** `mcp/package.json` has no icon field; `mcp/src` has no icon/logo refs; no `server.json`, `manifest.json`, `.mcpb`, `.dxt`, `.vsix` in repo (only `demo/dataset/real/raw/manifest.json`, unrelated); `api/` surface installers pass no `icon`/`iconUrl` (grep finds only `mailbox.py`). Hosts therefore show their default server glyph / initial letter.
- MCP App cards (`mcp/src/widgets/`), rendered inside hosts:
  - `wake.ts:264-272` mark: 34x34, **4 equal nodes r2.4 at (9,11) (20,8) (25,20) (12,24), closed quad of links @.22, no hub**, `currentColor` = `--accent #34d399` (emerald, `shell.ts:47`), `kw-breathe 3.8s` + per-star `kw-twinkle` (`:250-256`). Offline variant `wake.ts:100-118`: same geometry, `#f0b84d` @.55, links @.18.
  - `saved.ts:59-67` `.con` 26px (`:35`): 3 nodes r2 @.5 + `new-star (27,13) r2.6 #34d399` with a green spur line.
  - `recall.ts:69-72` concentric lens r15/9.5/3.5 `#34d399` (`:49`).
  - Card panel `--panel #0f172a`, body transparent (`shell.ts:46-52`).

## 8. Distinct variants across these surfaces

| # | Variant | Geometry | Colours / tile | Anim | Where |
|---|---|---|---|---|---|
| V0 | Canonical 12-node | hub r48 + 11 sats (r8 to 22), 12 curved links, 16 specks, 3 orbit arcs, haze | white nodes on radial `#ff9a23` to `#ff850f` to `#fa7103` (light: orange nodes, no tile) | none | `img/*.svg`; Kit.app icon (superellipse 4.9, 824/1024); onboarding `.kit-glyph` (square, CSS r16/54); how-it-works `public/*`; kit-website `kit-glyph.png` (unused) |
| V1 | Web-UI 5-node | hub r3.2 + sats (5,5)1.9 (19,6)1.6 (5,19)1.6 (19,17)1.9, 4 straight spokes sw1.3 @.55 | white on linear `#fbbf24` to `#f97316`, 22% rounded square | none | `api/ui/index.html:2749-2763`; PWA icons kit-16 to 512; email tiles (40px r11, 46px r11); notification icon |
| V1b | 5-node, lavender/gold | same | `#c4b9f8` then `#f7d49a`, no tile, on `#05060f` | breath 3.6s, wakePop, twinkle, ripple, sparks | `updating-page.html:50-61` |
| V1c | 5-node, amber solid | sats r2/1.7, hub r3.2, sw1.5 | `#fbbf24`, transparent | none | `kit-website/favicon.svg` |
| V1d | 5-node, nav | sats r1.8/1.5, **hub r3**, sw1.2 | `currentColor #fbbf24`, drop-shadow | kit-breath 6s | kit-website nav, 33 pages |
| V2 | Menu-bar 4-node | hub (10,15) r2 + 3 sats, 3 spokes + status dot | hard white, non-template; dot amber/purple/red/green | none | `KitPersonalApp.swift:1080-1112` |
| V3 | MCP card 4-node quad | 4 equal r2.4, closed loop, no hub | `#34d399` (offline `#f0b84d`) | breathe + twinkle | `mcp/src/widgets/wake.ts` |
| V3b | MCP saved chain | 3 nodes + green new-star spur | `#34d399` | star-in, twinkle | `saved.ts:59-67` |
| V3c | MCP recall lens | concentric r15/9.5/3.5 | `#34d399` | breathe | `recall.ts:69-72` |
| V4 | Film `KitGlyph` pentagon | hub r.13s + 5 sats on regular pentagon | `#6bbfff` blue | none | how-it-works `index.tsx:213-235` (unused) |
| V5 | Wordmark + dot | "Kit" Fraunces + dot r6 | `#fcb24d` | none | kit-deck `DeckMark.tsx` |
| V6 | Step mini-constellation | 3 nodes + 2 lines | `#b9b6cc` / `#c4b5fd` | none | `kit-welcome-body.html:24` |
| V7 | Orbs | radial lavender orb 54px; 11px purple dot; blue orb + rings | `#cbb8ff/#9d7fe8`, `#6bbfff` | pulse | onboarding-shell `:1269`, `:285`; film intro |
| none | No mark | n/a | n/a | n/a | Telegram bot avatar; MCP host icon (VS Code / Claude Desktop / AnythingLLM); kit-deck favicon (Next default) |

### Comparison against canonical
- **Geometry**: only the app icon, the onboarding glyph and two unused files (`kit-website/assets/img/kit-glyph.png`, how-it-works `kit-logo.svg`) use the 12-node canonical. Everything else is a 3-, 4- or 5-node abstraction with straight spokes, and no two of them share node positions (V1 vs V2 vs V3 vs V4 vs V6).
- **Colour**: canonical is a radial red-orange `#ff9a23` to `#fa7103`; the V1 family uses Tailwind's yellower linear `#fbbf24` to `#f97316`; the website uses solid `#fbbf24`; the updater lavender `#c4b9f8`; MCP cards emerald `#34d399`; the film blue `#6bbfff`; the menu bar hard white. The email signature links use `#fa7103` (canonical) beside a `#fbbf24` to `#f97316` tile.
- **Tile / silhouette**: canonical SVG is a full-bleed square; the app icon masks it to a superellipse (exp 4.9, 824/1024); onboarding rounds the same SVG 16px at 54px; emails round the V1 PNG 11px at 40/46px; PWA icons bake 22% rounding; website favicon and nav have no tile; kit-glyph.png has no rounding.
- **Motion**: breath periods differ per surface (4.2s onboarding, 3.6s updater, 3.8s MCP, 6s website, none on icon/menu bar); MCP cards twinkle individual nodes, updater pops/twinkles/ripples, web-UI app bar is static by decision (`api/ui/index.html:2745-2748` "Plain, calm logo").
- **Fireflies aesthetic** (soft city-light sprites, warm whites/ambers/pinks/greens, additive trails): not present in any mark. The onboarding canvas is the nearest relative and it is crisp 2D arcs with purple/blue/green halos and straight 1px links.

## 9. Files written for this audit (scratch only)
- `scratchpad/audit/shipped-kit-app-icon.png`, `shipped-kit-app-icon-256.png` (copies of the shipped icon), `KitPersonal.iconset/` (extracted icns), `kit-deck-favicon.png` (ico to png).
