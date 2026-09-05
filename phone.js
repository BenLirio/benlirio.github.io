// The phone. No dependencies. Everything it touches is in index.html (built by build.mjs).
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const phone = $('#phone');
  const screen = $('#screen');
  const home = $('#home');
  const pages = $('#pages');
  const dots = $$('#dots .dot:not(.dot-search)');
  const lock = $('#lock');
  const frameApp = $('#app-frame');
  const frame = $('#frame');
  const PHONE_H = 776;

  // ---------- fit the phone to the window (desktop only) ----------
  const small = () => matchMedia('(max-width: 600px)').matches;
  const zoom = () => (small() ? 1 : parseFloat(phone.style.zoom) || 1);
  function fit() {
    if (small()) { phone.style.zoom = ''; return; }
    phone.style.zoom = clamp((innerHeight - 40) / PHONE_H, 0.55, 1.5).toFixed(3);
  }
  fit();
  addEventListener('resize', fit);

  // ---------- clock ----------
  function tick() {
    const d = new Date();
    let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    $$('[data-clock="status"]').forEach((el) => { el.textContent = `${h}:${m} ${ampm}`; });
    $$('[data-clock="lock"]').forEach((el) => { el.textContent = `${h}:${m}`; });
    $$('[data-date]').forEach((el) => { el.textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); });
  }
  tick(); setInterval(tick, 10000);

  // ---------- lock screen ----------
  const knob = $('#knob'); const track = $('#unlock-track'); const unlockText = $('#unlock-text');
  let unlocked = false;
  function unlockNow() {
    if (unlocked) return; unlocked = true;
    lock.classList.add('unlocked');
    try { sessionStorage.setItem('unlocked', '1'); } catch {}
    setTimeout(() => { lock.hidden = true; }, reduceMotion ? 0 : 460);
  }
  if (knob) {
    let drag = null;
    const maxX = () => track.clientWidth - knob.offsetWidth - 6;
    knob.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, moved: false };
      try { knob.setPointerCapture(e.pointerId); } catch {}
      knob.style.transition = 'none';
    });
    knob.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = clamp((e.clientX - drag.x) / zoom(), 0, maxX());
      if (dx > 3) drag.moved = true;
      knob.style.transform = `translateX(${dx}px)`;
      unlockText.style.opacity = String(clamp(1 - dx / maxX() * 1.6, 0, 1));
      if (dx >= maxX() * 0.92) { drag = null; unlockNow(); }
    });
    const release = () => {
      if (!drag) return;
      const wasTap = !drag.moved; drag = null;
      knob.style.transition = 'transform .25s ease-out';
      knob.style.transform = '';
      unlockText.style.opacity = '';
      if (wasTap) unlockNow(); // a click is fine on a desktop
    };
    knob.addEventListener('pointerup', release);
    knob.addEventListener('pointercancel', release);
    track.addEventListener('click', (e) => { if (e.target !== knob) unlockNow(); });
    lock.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); unlockNow(); } });
  }
  let skipLock = !!location.hash;
  try { skipLock = skipLock || sessionStorage.getItem('unlocked') === '1'; } catch {}
  if (skipLock) { unlocked = true; lock.hidden = true; }

  // ---------- home screen paging ----------
  const pageCount = $$('.page', pages).length;
  const pageIndex = () => clamp(Math.round(pages.scrollLeft / pages.clientWidth), 0, pageCount - 1);
  function updateDots() { const i = pageIndex(); dots.forEach((d, j) => d.classList.toggle('on', j === i)); }
  pages.addEventListener('scroll', updateDots, { passive: true });
  function goPage(i) {
    i = clamp(i, 0, pageCount - 1);
    pages.scrollTo({ left: i * pages.clientWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  // mouse drag to swipe (touch already does this natively)
  let pd = null; let suppressClick = false;
  pages.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    pd = { x: e.clientX, left: pages.scrollLeft, moved: false, start: pageIndex() };
    pages.classList.add('dragging');
  });
  addEventListener('pointermove', (e) => {
    if (!pd) return;
    const dx = (e.clientX - pd.x) / zoom();
    if (Math.abs(dx) > 5) pd.moved = true;
    pages.scrollLeft = pd.left - dx;
  });
  addEventListener('pointerup', (e) => {
    if (!pd) return;
    const dx = (e.clientX - pd.x) / zoom();
    const target = dx < -40 ? pd.start + 1 : dx > 40 ? pd.start - 1 : pd.start;
    if (pd.moved) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
    pd = null;
    goPage(target);
    setTimeout(() => pages.classList.remove('dragging'), reduceMotion ? 0 : 450);
  });

  // a vertical mouse wheel flips pages; a trackpad's horizontal swipe scrolls natively
  let wheelLock = 0;
  pages.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    const now = Date.now(); if (now < wheelLock || Math.abs(e.deltaY) < 12) return;
    wheelLock = now + 550;
    goPage(pageIndex() + (e.deltaY > 0 ? 1 : -1));
  }, { passive: false });

  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, iframe')) return;
    if (e.key === 'Escape') { goHome(); return; }
    if (current || !lock.hidden) return;
    if (e.key === 'ArrowRight') goPage(pageIndex() + 1);
    if (e.key === 'ArrowLeft') goPage(pageIndex() - 1);
  });

  // ---------- opening and closing apps ----------
  let current = null; // the open .app element
  let closeTimer = 0;

  function setOrigin(el, from) {
    let ox = '50%', oy = '50%';
    if (from) {
      const r = from.getBoundingClientRect(); const s = screen.getBoundingClientRect();
      ox = `${((r.left + r.width / 2 - s.left) / s.width * 100).toFixed(1)}%`;
      oy = `${((r.top + r.height / 2 - s.top) / s.height * 100).toFixed(1)}%`;
    }
    el.style.setProperty('--ox', ox); el.style.setProperty('--oy', oy);
  }

  function openApp(el, from) {
    if (current === el) return;
    if (current) closeApp(current, true);
    clearTimeout(closeTimer);
    setOrigin(el, from);
    el.classList.remove('closing');
    el.classList.add('opening');
    el.hidden = false;
    home.classList.add('zoomed');
    el.scrollTop = 0;
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('opening')));
    current = el;
    el.setAttribute('aria-hidden', 'false');
  }

  function closeApp(el, instant) {
    if (!el) return;
    el.setAttribute('aria-hidden', 'true');
    if (el === frameApp) { frame.src = 'about:blank'; }
    if (instant || reduceMotion) { el.hidden = true; el.classList.remove('opening', 'closing'); }
    else {
      el.classList.add('closing');
      closeTimer = setTimeout(() => { el.hidden = true; el.classList.remove('closing'); }, 330);
    }
    if (current === el) current = null;
  }

  function goHome(push = true) {
    if (!current) return;
    closeApp(current);
    home.classList.remove('zoomed');
    if (push) history.pushState(null, '', location.pathname + location.search);
  }

  $('#homebtn').addEventListener('click', () => { if (!lock.hidden) { unlockNow(); return; } goHome(); });

  // demos run in an iframe inside the screen
  function openDemo(a, from) {
    const title = a.dataset.demo || a.textContent.trim();
    const src = a.dataset.src || a.getAttribute('href');
    $('#frame-title').textContent = title;
    $('#frame-open').href = a.getAttribute('href');
    frame.title = title;
    if (frame.getAttribute('src') !== src) frame.src = src;
    openApp(frameApp, from);
  }

  // writing app: list view + one view per post
  const writing = $('#app-writing');
  function showPost(slug, animate = true) {
    const list = $('#writing-list'); const post = $(`#post-${CSS.escape(slug)}`);
    if (!post) return false;
    $$('.view.post', writing).forEach((v) => { if (v !== post) v.hidden = true; });
    post.hidden = false; post.scrollTop = 0;
    $('#writing-back').hidden = false;
    $('#writing-title').textContent = post.dataset.title || 'Writing';
    if (animate && !reduceMotion) {
      post.classList.add('push-in'); list.classList.add('push-out');
      requestAnimationFrame(() => requestAnimationFrame(() => { post.classList.remove('push-in'); }));
      setTimeout(() => { list.hidden = true; list.classList.remove('push-out'); }, 300);
    } else { list.hidden = true; }
    return true;
  }
  function showList() {
    const list = $('#writing-list');
    $$('.view.post', writing).forEach((v) => { v.hidden = true; v.classList.remove('push-in'); });
    list.hidden = false; list.classList.remove('push-out');
    $('#writing-back').hidden = true;
    $('#writing-title').textContent = 'Writing';
  }

  // ---------- routing ----------
  const appFor = (id) => $(`.app[data-app="${id}"]`);
  function route(from) {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    if (!h) { goHome(false); return; }
    const [head, ...rest] = h.split('/'); const tail = rest.join('/');
    if (head === 'demo' && tail) {
      const a = $(`[data-demo][data-slug="${CSS.escape(tail)}"]`);
      if (a) { openDemo(a, from || a); return; }
    }
    if (head === 'writing') {
      openApp(writing, from);
      if (tail) { if (!showPost(tail, false)) showList(); } else showList();
      return;
    }
    const app = appFor(head);
    if (app) { openApp(app, from); return; }
    goHome(false);
  }

  function navigate(hash, from) {
    if (location.hash !== hash) history.pushState(null, '', hash);
    route(from);
  }

  // one click handler for everything inside the screen
  screen.addEventListener('click', (e) => {
    const a = e.target.closest('a'); if (!a) return;
    if (suppressClick) { e.preventDefault(); return; }
    if (a.dataset.app) { e.preventDefault(); navigate(`#${a.dataset.app}`, a); return; }
    if (a.dataset.demo != null) { e.preventDefault(); navigate(`#demo/${a.dataset.slug}`, a); return; }
    if (a.dataset.post) { e.preventDefault(); navigate(`#writing/${a.dataset.post}`, a); return; }
    if (a.id === 'writing-back') { e.preventDefault(); navigate('#writing'); return; }
    // anything else that leaves the site opens in a new tab so the phone stays put
    if (/^https?:/.test(a.href) && a.host !== location.host) { a.target = '_blank'; a.rel = 'noopener'; }
  });

  addEventListener('popstate', () => route());
  route();
  updateDots();
})();
