# Website navigation

`partials/navigation.html` is the canonical main menu. All public site pages that
load `styles/base.css` carry generated static copies, so links work without
JavaScript. Embedded design specimens and social image templates retain their
own purpose-specific chrome.

After editing the partial or adding a page, run:

```sh
node scripts/sync-navigation.mjs
node scripts/sync-navigation.mjs --check
```

The production build checks these copies before publishing. Keep page-specific
navigation (article contents, previous/next notes) separate. Compact-screen menu
behaviour lives in `scripts/site-navigation.js`; its layout is in `styles/base.css`.

Homepage destinations use local section links. See proof leads to `/#proof`;
Architecture leads to `/#arch`, opening its containing disclosure before scrolling.
The shared navigation script owns current-section tracking and deep links.
Do not add a second scroll spy or animate an entire expandable disclosure:
its open height can exceed any viewport-based reveal threshold.
The homepage note card uses a short, complete summary in `.post-card__body`;
keep spacing on that wrapper and do not line-clamp its paragraph.
