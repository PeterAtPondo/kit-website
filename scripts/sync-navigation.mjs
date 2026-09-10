#!/usr/bin/env node
// The static HTML remains complete without JavaScript. Change the shared partial,
// then run this script; --check refuses drift during the production build.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const template = fs.readFileSync(path.join(root, 'partials/navigation.html'), 'utf8').trim();
const check = process.argv.includes('--check');
const script = '<script src="/scripts/site-navigation.js" defer></script>';
let count = 0;
const errors = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    if (entry.name.startsWith('.') || ['node_modules', 'partials'].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (entry.name !== 'index.html') continue;
    const html = fs.readFileSync(file, 'utf8');
    // Embedded brand/component specimens have their own chrome, not the site shell.
    if (!/<link\b[^>]*href="[^"]*styles\/base\.css"/.test(html)) continue;
    const route = '/' + path.relative(root, path.dirname(file)).split(path.sep).filter(Boolean).join('/');
    const active = route.startsWith('/blog') ? '/blog/' : route.startsWith('/evaluate') ? '/evaluate/' : route.startsWith('/install') ? '/#install' : null;
    const nav = active ? template.replace(`href="${active}"`, `href="${active}" class="is-current" aria-current="${active.includes('#') ? 'location' : 'page'}"`) : template;
    const pattern = /<nav class="nav"[^>]*>[\s\S]*?<\/nav>/;
    if (!pattern.test(html)) { errors.push(`${route}: missing site navigation`); continue; }
    let updated = html.replace(pattern, nav);
    if (!updated.includes(script)) updated = updated.replace('</head>', `  ${script}\n</head>`);
    count++;
    if (check && updated !== html) errors.push(`${route}: navigation differs; run node scripts/sync-navigation.mjs`);
    else if (!check && updated !== html) fs.writeFileSync(file, updated);
  }
}
walk(root);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`${check ? 'Checked' : 'Synced'} shared navigation on ${count} pages.`);
