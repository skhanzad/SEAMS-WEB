/* main.js — boots every figure, wires the equation term highlighter,
   the contents rail, the reading-progress bar and the mobile contents sheet. */
(function (root) {
  'use strict';
  const UI = root.UI;
  const App = (root.App = root.App || {});

  function initFigures() {
    document.querySelectorAll('[data-fig]').forEach((fig) => {
      const name = fig.getAttribute('data-fig');
      const fn = root.Figs[name];
      const body = fig.querySelector('.fig-body');
      if (!fn || !body) return;
      try {
        fn(body, fig);
      } catch (e) {
        console.error('Figure "' + name + '" failed:', e);
        body.appendChild(UI.h('p', { class: 'status bad', text: 'This figure could not start (' + e.message + '). The rest of the page still works.' }));
      }
    });
  }

  // Hovering or focusing a row under an equation lights up the matching term
  function initAnatomy() {
    document.querySelectorAll('.eqx').forEach((box) => {
      const eq = box.querySelector('.eq');
      if (!eq) return;
      box.querySelectorAll('.an[data-t]').forEach((row) => {
        const cls = 'hl-' + row.getAttribute('data-t');
        const on = () => { eq.classList.add(cls); row.classList.add('on'); };
        const off = () => { eq.classList.remove(cls); row.classList.remove('on'); };
        row.addEventListener('mouseenter', on);
        row.addEventListener('mouseleave', off);
        row.addEventListener('focus', on);
        row.addEventListener('blur', off);
      });
    });
  }

  function initContents() {
    const rail = document.getElementById('toc');
    const mob = document.getElementById('toc-mobile');
    if (rail && mob) mob.appendChild(rail.querySelector('ol').cloneNode(true));
    const links = Array.from(document.querySelectorAll('.toc a'));
    const secs = Array.from(document.querySelectorAll('section.sec[id]'));
    const crumb = document.getElementById('crumb');
    const prog = document.getElementById('progress');
    let current = null;
    function update() {
      const y = 110;
      let cur = secs[0];
      for (const s of secs) {
        if (s.getBoundingClientRect().top <= y) cur = s; else break;
      }
      if (cur && cur !== current) {
        current = cur;
        const href = '#' + cur.id;
        links.forEach((a) => {
          const on = a.getAttribute('href') === href;
          a.classList.toggle('on', on);
          if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
        });
        if (crumb) crumb.textContent = cur.getAttribute('data-crumb') || '';
        const ra = rail && rail.querySelector('a[href="' + href + '"]');
        if (ra && rail.scrollHeight > rail.clientHeight) {
          const top = ra.offsetTop - rail.clientHeight / 2;
          rail.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
        }
      }
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (prog) prog.style.width = (max > 0 ? Math.min(100, (100 * window.scrollY) / max) : 0) + '%';
    }
    window.addEventListener('scroll', UI.throttle(update), { passive: true });
    window.addEventListener('resize', UI.throttle(update));
    update();

    const sheet = document.getElementById('toc-sheet');
    const openB = document.getElementById('toc-open');
    const closeB = document.getElementById('toc-close');
    if (!sheet || !openB || !closeB) return;
    const close = () => { sheet.hidden = true; openB.setAttribute('aria-expanded', 'false'); };
    openB.addEventListener('click', () => { sheet.hidden = false; openB.setAttribute('aria-expanded', 'true'); closeB.focus(); });
    closeB.addEventListener('click', () => { close(); openB.focus(); });
    sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });
    mob.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) { close(); openB.focus(); } });
  }

  // Typesetting changes heights; re-anchor a deep link once the math is in place
  App.afterMath = function () {
    const id = (location.hash || '').slice(1);
    if (id && /^[A-Za-z0-9._~-]+$/.test(id)) {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ block: 'start' });
    }
  };

  function boot() {
    initFigures();
    initAnatomy();
    initContents();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
