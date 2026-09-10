// Progressive enhancement: every destination is visible when JavaScript is off.
(() => {
  const nav = document.querySelector('.nav');
  const button = nav?.querySelector('.nav__toggle');
  const links = nav?.querySelector('.nav__links');
  if (!button || !links) return;
  const compact = window.matchMedia('(max-width: 60rem)');
  const setOpen = (open) => {
    button.setAttribute('aria-expanded', String(open));
    nav.dataset.expanded = String(open);
    links.hidden = compact.matches && !open;
  };
  const resize = () => {
    const restoreFocus = compact.matches && links.contains(document.activeElement);
    button.hidden = !compact.matches;
    setOpen(false);
    if (restoreFocus) button.focus();
  };
  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('keydown', event => {
    if (event.key === 'Escape' && compact.matches && button.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      button.focus();
    }
  });
  links.addEventListener('click', event => {
    if (event.target.closest('a') && compact.matches) setOpen(false);
  });
  compact.addEventListener('change', resize);
  resize();

  // Page links retain the static current-page marker. On the homepage, read
  // all section positions each frame: observer callbacks contain only changed
  // intersections, so they cannot reliably select the section being read.
  if (location.pathname !== '/') return;
  const sectionLinks = [...links.querySelectorAll('a')].flatMap(link => {
    const url = new URL(link.href);
    if (url.origin !== location.origin || url.pathname !== '/' || !url.hash) return [];
    const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!target) return [];
    return [{link, target, region: target.closest('details') || target}];
  });
  const updateCurrent = () => {
    const readingLine = (button.hidden ? nav.getBoundingClientRect().bottom : button.getBoundingClientRect().bottom + 16) + 32;
    let current = null;
    let nearestTop = -Infinity;
    const atEnd = window.scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
    for (const item of sectionLinks) {
      const rect = item.region.getBoundingClientRect();
      if (!rect.height) continue;
      if ((rect.top <= readingLine || (atEnd && rect.top < innerHeight)) && rect.top > nearestTop) {
        current = item.link;
        nearestTop = rect.top;
      }
    }
    for (const {link} of sectionLinks) {
      link.classList.toggle('is-current', link === current);
      if (link === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  };
  let scheduled = false;
  const scheduleUpdate = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; updateCurrent(); });
  };
  const revealTarget = target => {
    for (let el = target; el; el = el.parentElement) {
      if (el.matches('details')) el.open = true;
      if (el.matches('[data-reveal]')) el.classList.add('is-visible');
    }
  };
  const followHash = () => {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = id && document.getElementById(id);
    if (!target) { scheduleUpdate(); return; }
    // Open ancestors before measuring or scrolling to a previously hidden node.
    revealTarget(target);
    requestAnimationFrame(() => {
      target.scrollIntoView({block:'start', behavior:'instant'});
      scheduleUpdate();
    });
  };
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search || !url.hash) return;
    let target;
    try { target = document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch { return; }
    if (!target) return;
    event.preventDefault();
    if (location.hash !== url.hash) history.pushState(null, '', url.hash);
    followHash();
  });
  window.addEventListener('scroll', scheduleUpdate, {passive:true});
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('hashchange', followHash);
  window.addEventListener('pageshow', scheduleUpdate);
  document.addEventListener('toggle', scheduleUpdate, true);
  if ('ResizeObserver' in window) new ResizeObserver(scheduleUpdate).observe(document.body);
  // The deferred script runs after the document is parsed. Do not jump back
  // later on media load: the reader may already have scrolled somewhere else.
  if (location.hash) followHash();
  scheduleUpdate();
})();
