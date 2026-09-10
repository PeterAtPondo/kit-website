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
