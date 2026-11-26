/* =========================================================
   ZLR — main.js
   - Language toggle (EN/PT) with localStorage persistence
   - Mobile nav toggle
   - Sticky-header shadow on scroll
   - ESIA modal (open / close / esc / backdrop)
   - Smooth-scroll offset for fixed header (close menu on click)
   - Year stamp in footer
   ========================================================= */

(function () {
  'use strict';

  const T = window.ZLR_TRANSLATIONS || {};
  const STORAGE_KEY = 'zlr_lang';

  // ---------- Language ----------
  function applyLang(lang) {
    if (!T[lang]) return;
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const val = T[lang][key];
      if (typeof val === 'string') el.innerHTML = val;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      const val = T[lang][key];
      if (typeof val === 'string') el.setAttribute('placeholder', val);
    });
    document.querySelectorAll('.lang-btn').forEach((btn) => {
      const isActive = btn.dataset.lang === lang;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    document.dispatchEvent(new CustomEvent('zlr:langchange', { detail: { lang: lang } }));
  }

  function detectLang() {
    let saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (saved && T[saved]) return saved;
    const nav = (navigator.language || 'en').toLowerCase();
    if (nav.startsWith('pt')) return 'pt';
    return 'en';
  }

  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => applyLang(btn.dataset.lang));
  });

  applyLang(detectLang());

  // ---------- Mobile nav ----------
  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('mainNav');
  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      const open = mainNav.classList.toggle('is-open');
      navToggle.classList.toggle('is-open', open);
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    mainNav.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => {
        mainNav.classList.remove('is-open');
        navToggle.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ---------- Sticky header shadow ----------
  const header = document.getElementById('siteHeader');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ---------- Modal ----------
  function openModal(id) {
    const m = document.getElementById('modal-' + id);
    if (!m) return;
    m.hidden = false;
    document.body.style.overflow = 'hidden';
    const focusable = m.querySelector('.modal-close');
    if (focusable) focusable.focus();
  }
  function closeModal() {
    document.querySelectorAll('.modal').forEach((m) => (m.hidden = true));
    document.body.style.overflow = '';
  }
  document.querySelectorAll('[data-modal]').forEach((b) => {
    b.addEventListener('click', () => openModal(b.dataset.modal));
  });
  document.querySelectorAll('[data-modal-close]').forEach((b) => {
    b.addEventListener('click', closeModal);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // ---------- Smooth scroll offset for fixed header ----------
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const headerH = header ? header.offsetHeight : 0;
      const top = target.getBoundingClientRect().top + window.pageYOffset - headerH + 1;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  // ---------- Year ----------
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // ---------- Stat counters (count-up on scroll into view) ----------
  const counters = document.querySelectorAll('.counter[data-count]');
  if (counters.length) {
    const animateCounter = (el) => {
      if (el.dataset.animated === '1') return;
      el.dataset.animated = '1';
      const target = parseFloat(el.dataset.count) || 0;
      const decimals = parseInt(el.dataset.decimals || '0', 10);
      const prefix = el.dataset.prefix || '';
      const duration = 1800;
      const startedAt = performance.now();

      const tick = (now) => {
        const elapsed = now - startedAt;
        const progress = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const value = target * eased;
        el.textContent = prefix + (el.dataset.sep
          ? Math.round(value).toLocaleString('en-US')
          : value.toFixed(decimals));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.4 });
      counters.forEach((c) => obs.observe(c));
    } else {
      counters.forEach(animateCounter);
    }
  }

})();

/* ---------- Interactive corridor map (overview section) ---------- */
(function () {
  const stages = document.querySelectorAll('.map-stage');
  if (!stages.length) return;

  const STATION_KEYS = ['lobito','luacano','kanongesha','mwinilunga','kalumbila','chisasa','lumwana','manyama','solwezi','kashamata','chingola','dar'];

  function tr(key) {
    const lang = document.documentElement.lang || 'en';
    const T = window.ZLR_TRANSLATIONS || {};
    const dict = T[lang] || T.en || {};
    return dict[key] || '';
  }

  stages.forEach(initStage);

  function initStage(stage) {
  const stations = stage.querySelectorAll('.station');
  const info = stage.querySelector('.map-info');
  const infoEyebrow = info && info.querySelector('.map-info-eyebrow');
  const infoTitle = info && info.querySelector('.map-info-title');
  const infoBody = info && info.querySelector('.map-info-body');
  const infoClose = info && info.querySelector('.map-info-close');
  let activeKey = null;

  function positionInfo(stationEl) {
    if (!stationEl || !info) return;
    // On small screens, let CSS handle (anchored to bottom of map)
    if (window.matchMedia('(max-width: 720px)').matches) {
      info.style.left = '';
      info.style.top = '';
      info.style.right = '';
      info.removeAttribute('data-side');
      return;
    }

    const stageRect = stage.getBoundingClientRect();
    const sRect = stationEl.getBoundingClientRect();
    const stationCx = (sRect.left + sRect.right) / 2 - stageRect.left;
    const stationCy = (sRect.top + sRect.bottom) / 2 - stageRect.top;

    // Measure the card (temporarily reveal-with-offscreen if needed)
    const wasHidden = info.hidden;
    if (wasHidden) {
      info.style.visibility = 'hidden';
      info.hidden = false;
    }
    const cardW = info.offsetWidth;
    const cardH = info.offsetHeight;
    if (wasHidden) {
      info.hidden = true;
      info.style.visibility = '';
    }

    const margin = 16;
    const gap = 24; // gap between station and card
    const stageW = stageRect.width;
    const stageH = stageRect.height;

    // Default: place to the RIGHT of the station, vertically centred
    let side = 'right';
    let left = stationCx + gap;
    let top  = stationCy - cardH / 2;

    // If it would overflow right, place to the LEFT
    if (left + cardW > stageW - margin) {
      side = 'left';
      left = stationCx - cardW - gap;
    }
    // If still no room left of station, place ABOVE or BELOW
    if (left < margin) {
      if (stationCy > stageH / 2) {
        side = 'top';
        left = Math.min(Math.max(stationCx - cardW / 2, margin), stageW - cardW - margin);
        top  = stationCy - cardH - gap;
      } else {
        side = 'bottom';
        left = Math.min(Math.max(stationCx - cardW / 2, margin), stageW - cardW - margin);
        top  = stationCy + gap;
      }
    }

    // Clamp vertical to stage
    top = Math.min(Math.max(top, margin), stageH - cardH - margin);

    info.style.left = left + 'px';
    info.style.top = top + 'px';
    info.style.right = 'auto';
    info.setAttribute('data-side', side);
  }

  function showInfo(key) {
    if (!info || STATION_KEYS.indexOf(key) === -1) return;
    infoEyebrow.textContent = tr('map.' + key + '.eyebrow');
    infoTitle.textContent   = tr('map.' + key + '.title');
    infoBody.textContent    = tr('map.' + key + '.body');
    const stationEl = stage.querySelector('.station[data-key="' + key + '"]');
    positionInfo(stationEl);
    info.hidden = false;
    stations.forEach((s) => s.classList.toggle('is-active', s.dataset.key === key));
    activeKey = key;
  }

  // Refresh visible card when the language changes
  document.addEventListener('zlr:langchange', () => {
    if (activeKey) {
      infoEyebrow.textContent = tr('map.' + activeKey + '.eyebrow');
      infoTitle.textContent   = tr('map.' + activeKey + '.title');
      infoBody.textContent    = tr('map.' + activeKey + '.body');
    }
  });

  function hideInfo() {
    if (!info) return;
    info.hidden = true;
    info.style.left = '';
    info.style.top = '';
    info.style.right = '';
    info.removeAttribute('data-side');
    stations.forEach((s) => s.classList.remove('is-active'));
    activeKey = null;
  }

  stations.forEach((s) => {
    const key = s.dataset.key;
    s.addEventListener('click', () => {
      if (activeKey === key) hideInfo(); else showInfo(key);
    });
    s.addEventListener('mouseenter', () => {
      // Preview on hover but don't override an actively clicked-and-pinned station
      if (!activeKey) showInfo(key);
    });
    s.addEventListener('mouseleave', () => {
      if (!activeKey) hideInfo();
    });
    s.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (activeKey === key) hideInfo(); else showInfo(key);
      }
    });
  });

  // Reposition on resize if a card is open
  window.addEventListener('resize', () => {
    if (activeKey) {
      const stationEl = stage.querySelector('.station[data-key="' + activeKey + '"]');
      positionInfo(stationEl);
    }
  }, { passive: true });

  if (infoClose) infoClose.addEventListener('click', hideInfo);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !info.hidden) hideInfo();
  });

  // Trigger line-drawing animation when the map enters view
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          stage.classList.add('is-animated');
          obs.unobserve(stage);
        }
      });
    }, { threshold: 0.25 });
    obs.observe(stage);
  } else {
    stage.classList.add('is-animated');
  }
  } // end initStage
})();

/* ---------- Scroll-driven fade-up reveal (generic) ---------- */
(function () {
  // Auto-tag major text/CTA elements on the home page so they animate on scroll
  // without having to mark every single element in the HTML.
  if (document.body && document.body.classList.contains('page-home')) {
    const autoSel = [
      '.section .eyebrow', '.section h2', '.section h3', '.section .section-lead',
      '.section .overview-intro', '.section .overview-body p', '.section .overview-body__visual',
      '.section .timeline-group', '.section .map-info', '.section .status-cards .card',
      '.section .mv-card', '.section .partners-detail',
      '.section .impact-grid .impact-card', '.section .section-cta',
      '.section .bullets li', '.section p:not(.eyebrow):not(.hero-eyebrow):not(.hero-lead)',
      '.section .map-card', '.stats .stat'
    ].join(', ');
    const skip = (el) => el.classList.contains('anim-up')
      || el.classList.contains('scroll-up')
      || el.closest('.hero')
      || el.closest('.map-stage'); // map has its own reveal pipeline
    let i = 0;
    document.querySelectorAll(autoSel).forEach((el) => {
      if (skip(el)) return;
      el.classList.add('scroll-up');
      // small stagger within a group
      if (!el.style.getPropertyValue('--d')) {
        el.style.setProperty('--d', ((i++ % 4) * 0.08) + 's');
      }
    });
  }

  const els = document.querySelectorAll('.scroll-up');
  if (!els.length) return;
  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -10% 0px' });
  els.forEach((el) => obs.observe(el));
})();

/* ---------- Cookies consent banner ---------- */
(function () {
  function init() {
    var banner = document.getElementById('cookiesBanner');
    if (!banner) return;
    var KEY = 'zlr_cookies_ok';
    var accepted = false;
    try { accepted = localStorage.getItem(KEY) === '1'; } catch (e) {}
    if (accepted) return;
    banner.hidden = false;
    // Force reflow so the transition runs from the initial state.
    void banner.offsetHeight;
    banner.classList.add('is-visible');
    var btn = document.getElementById('cookiesAccept');
    if (btn) {
      btn.addEventListener('click', function () {
        try { localStorage.setItem(KEY, '1'); } catch (e) {}
        banner.classList.remove('is-visible');
        setTimeout(function () { banner.hidden = true; }, 350);
      });
    }
  }
  // Banner is appended after the script tag, so wait for the DOM to finish parsing.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ---------- Footer enquiry form ---------- */
(function () {
  const form = document.getElementById('footerEnquiryForm');
  if (!form) return;
  const msg = document.getElementById('footerFormMsg');

  function tr(key, fallback) {
    const lang = document.documentElement.lang || 'en';
    const T = window.ZLR_TRANSLATIONS || {};
    return (T[lang] || T.en || {})[key] || fallback;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.className = 'form-msg';
    msg.textContent = '';

    const data = new FormData(form);
    if (!data.get('name') || !data.get('email') || !data.get('message')) {
      msg.className = 'form-msg is-error';
      msg.textContent = tr('con.msg.required', 'Please fill in your name, email and message.');
      return;
    }

    const submitBtn = form.querySelector('.site-footer__submit');
    submitBtn.disabled = true;
    submitBtn.textContent = tr('con.msg.sending', 'Sending…');

    // Try the backend; ignore failures so the visitor always gets a thank-you.
    try {
      await fetch(form.action, { method: 'POST', body: data, headers: { 'Accept': 'application/json' } });
    } catch (_) {}

    // Replace the entire form with a large display-font thank-you message.
    const successText = tr('con.msg.success', 'Thank you for your enquiry, a member of our team will be in touch shortly.');
    const card = document.createElement('div');
    card.className = 'form-thanks';
    card.setAttribute('role', 'status');
    card.setAttribute('aria-live', 'polite');
    card.textContent = successText;
    form.replaceWith(card);
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
})();

/* ---------- Logo grid: fall back to text when image is missing ---------- */
(function () {
  var imgs = document.querySelectorAll('.logo-grid__img');
  imgs.forEach(function (img) {
    var markBroken = function () { img.classList.add('is-broken'); };
    if (img.complete && img.naturalWidth === 0) markBroken();
    else img.addEventListener('error', markBroken);
  });
})();

/* ---------- Logo fader: cycle tiles through the full logo pool ---------- */
(function () {
  var fader = document.getElementById('logoFader');
  if (!fader) return;
  var POOL = [
    { src: '/assets/img/logos/afc.svg', alt: 'Africa Finance Corporation', name: 'Africa Finance Corporation' },
    { src: '/assets/img/logos/gov-zambia.svg', alt: 'Government of Zambia', name: 'Government of Zambia' },
    { src: '/assets/img/logos/gov-angola.svg', alt: 'Government of Angola', name: 'Government of Angola' },
    { src: '/assets/img/logos/european-union.svg', alt: 'European Union', name: 'European Union' },
    { src: '/assets/img/logos/gov-italy.svg', alt: 'Government of Italy', name: 'Government of Italy' },
    { src: '/assets/img/logos/afdb.svg', alt: 'African Development Bank', name: 'African Development Bank' },
    { src: '/assets/img/logos/pwc.svg', alt: 'PwC', name: 'PwC' },
    { src: '/assets/img/logos/insuco.webp', alt: 'Insuco', name: 'Insuco' },
    { src: '/assets/img/logos/global-infrastructure-advisors.png', alt: 'Global Infrastructure Advisors', name: 'Global Infrastructure Advisors' },
    { src: '/assets/img/logos/linklaters.svg', alt: 'Linklaters', name: 'Linklaters' },
    { src: '/assets/img/logos/amw.png', alt: 'AMW Law Firm', name: 'AMW Law Firm' },
    { src: '/assets/img/logos/prime-advogados.png', alt: 'Prime Advogados', name: 'Prime Advogados' },
    { src: '/assets/img/logos/dar.png', alt: 'DAR', name: 'DAR' },
    { src: '/assets/img/logos/rh-rail.jpeg', alt: 'R&H Rail', name: 'R&H Rail' },
    { src: '/assets/img/logos/armitage.webp', alt: 'Armitage Consulting', name: 'Armitage Consulting' },
    { src: '/assets/img/logos/eng-consult.png', alt: 'ENG Consult', name: 'ENG Consult' },
    { src: '/assets/img/logos/abs.svg', alt: 'ABS', name: 'ABS' },
    { src: '/assets/img/logos/cresco.jpg', alt: 'Cresco', name: 'Cresco' },
    { src: '/assets/img/logos/cpcs.svg', alt: 'CPCS', name: 'CPCS' },
    { src: '/assets/img/logos/zutari.svg', alt: 'Zutari', name: 'Zutari' }
  ];

  var tiles = Array.prototype.slice.call(fader.querySelectorAll('.logo-grid__item'));
  if (!tiles.length) return;
  var slotCount = tiles.length;
  var POOL_LEN = POOL.length;
  // Track which logo index is showing in each slot; init from the order in HTML.
  var slotIdx = tiles.map(function (_, i) { return i % POOL_LEN; });

  function applyEntry(tile, entry) {
    var img = tile.querySelector('.logo-grid__img');
    var name = tile.querySelector('.logo-grid__name');
    if (!img || !name) return;
    img.onerror = function () { img.classList.add('is-broken'); };
    img.classList.remove('is-broken');
    img.src = entry.src;
    img.alt = entry.alt;
    name.textContent = entry.name;
  }

  function cycleTile(i) {
    var tile = tiles[i];
    tile.classList.add('is-fading');
    setTimeout(function () {
      // Pick the next index not currently displayed elsewhere.
      var visible = {};
      slotIdx.forEach(function (v, k) { if (k !== i) visible[v] = true; });
      var next = (slotIdx[i] + slotCount) % POOL_LEN;
      var tries = 0;
      while (visible[next] && tries < POOL_LEN) {
        next = (next + 1) % POOL_LEN;
        tries++;
      }
      slotIdx[i] = next;
      applyEntry(tile, POOL[next]);
      // Force reflow before removing the fading class to ensure the new logo fades in.
      void tile.offsetWidth;
      tile.classList.remove('is-fading');
    }, 500);
  }

  // Stagger first fire across all slots, then keep each tile cycling on its own interval.
  var STAGGER = 750;        // ms between adjacent tiles' first fades
  var PERIOD  = slotCount * STAGGER; // each tile cycles every PERIOD ms (~6s for 8 slots)
  tiles.forEach(function (_, i) {
    setTimeout(function () {
      cycleTile(i);
      setInterval(function () { cycleTile(i); }, PERIOD);
    }, i * STAGGER + 1500); // initial 1.5s pause so the first 8 are readable on load
  });

  // Wire the existing is-broken handler too — error event for the initial img src
  tiles.forEach(function (tile) {
    var img = tile.querySelector('.logo-grid__img');
    if (img && img.complete && img.naturalWidth === 0) img.classList.add('is-broken');
  });
})();

/* ---------- Partners map reveal on scroll ---------- */
(function () {
  const map = document.getElementById('partnersMap');
  if (!map) return;
  if (!('IntersectionObserver' in window)) {
    map.classList.add('is-revealed');
    return;
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        map.classList.add('is-revealed');
        obs.unobserve(map);
      }
    });
  }, { threshold: 0.2 });
  obs.observe(map);
})();

/* ---------- KPI grid reveal on scroll ---------- */
(function () {
  const grids = document.querySelectorAll('.kpi-grid');
  if (!grids.length) return;
  if (!('IntersectionObserver' in window)) {
    grids.forEach((g) => g.classList.add('is-revealed'));
    return;
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.25 });
  grids.forEach((g) => obs.observe(g));
})();

/* ---------- Status cards reveal on scroll ---------- */
(function () {
  const groups = document.querySelectorAll('.status-cards');
  if (!groups.length) return;
  if (!('IntersectionObserver' in window)) {
    groups.forEach((g) => g.classList.add('is-revealed'));
    return;
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });
  groups.forEach((g) => obs.observe(g));
})();

/* ---------- Route map animation trigger ---------- */
(function () {
  const maps = document.querySelectorAll('.route-map');
  if (!maps.length) return;
  if (!('IntersectionObserver' in window)) {
    maps.forEach((m) => m.classList.add('is-animated'));
    return;
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-animated');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.25 });
  maps.forEach((m) => obs.observe(m));
})();

/* ---------- Corridor map reveal on scroll ---------- */
(function () {
  const maps = document.querySelectorAll('.corridor-map');
  if (!maps.length) return;
  if (!('IntersectionObserver' in window)) {
    maps.forEach((m) => m.classList.add('is-revealed'));
    return;
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.25 });
  maps.forEach((m) => obs.observe(m));
})();

/* ---------- Page identifier — adds body class so per-page CSS can target ---------- */
(function () {
  const path = window.location.pathname;
  const m = path.match(/\/([^/]+?)(?:\.html?)?\/?$/);
  let name = m && m[1] ? m[1] : 'home';
  if (name === 'index' || name === 'home') {
    name = path.includes('/home') ? 'home' : 'holding';
  }
  if (document.body) document.body.classList.add('page-' + name);
})();
