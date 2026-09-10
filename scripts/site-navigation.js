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
})();
