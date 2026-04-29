// Mobile nav toggle + dropdown tap-open
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
    });
  }
  document.querySelectorAll('.nav-dropdown > button').forEach(btn => {
    btn.addEventListener('click', e => {
      if (window.innerWidth <= 960) {
        e.preventDefault();
        btn.parentElement.classList.toggle('open');
      }
    });
  });

  // Highlight active nav link by pathname
  const path = location.pathname.replace(/index\.html$/, '').replace(/\/$/, '');
  document.querySelectorAll('.main-nav a').forEach(a => {
    const href = a.getAttribute('href').replace(/index\.html$/, '').replace(/\/$/, '');
    if (href && (href === path || (href !== '' && path.endsWith(href)))) a.classList.add('active');
  });
});
