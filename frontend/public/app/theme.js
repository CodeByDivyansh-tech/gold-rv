/*
 * theme.js — the site's two gold-tinted themes, in one place.
 *
 *   GRVTheme.tokens(dark)  -> colour tokens a page puts on its root element (--bg, --panel, …, --c1…--c4)
 *   GRVTheme.apply(dark)   -> the same tokens as --grv-* on <html>, so overlays outside a page
 *                             (search, glossary, Goldie) follow the theme; also sets html.light / html.dark
 *
 * Dark "vault": warm black-brown surfaces, cream text, bright gold.
 * Light "champagne": warm ivory surfaces, dark brown text, deep gold.
 * Contract colours (c1 GOLDM, c2 GOLDTEN, c3 GOLDGUINEA, c4 GOLDPETAL) were checked with a colour-vision
 * validator on each mode's panel colour; text colours meet WCAG AA (4.5:1) on every surface.
 */
(function (root) {
  'use strict';
  var P = {
    dark: {
      bg: '#120D06', panel: '#1B150C', raised: '#261D11', line: '#3A2D1A', fg: '#F6ECD8', muted: '#BBA987',
      gold: '#E5B04A', glow: 'rgba(229,176,74,0.13)', ongold: '#1B1305', up: '#6FCF9A', down: '#FF8E7E',
      c1: '#BC8424', c2: '#2193E0', c3: '#CD6199', c4: '#7D4DAD',
      foil: 'linear-gradient(100deg, #F8DB97 0%, #E5B04A 38%, #B98428 62%, #F3D184 88%)',
      foilBtn: 'linear-gradient(180deg, #F0C566 0%, #DDA43C 55%, #C48A2A 100%)',
      area: 'rgba(229,176,74,0.16)', hover: 'rgba(229,176,74,0.07)', shadow: '0 1px 0 rgba(255,214,140,0.05) inset, 0 12px 28px rgba(0,0,0,0.35)',
      meta: '#120D06'
    },
    light: {
      bg: '#F8F2E4', panel: '#FFFDF7', raised: '#F1E7CF', line: '#E2D3AF', fg: '#231809', muted: '#6A583A',
      gold: '#8F5B00', glow: 'rgba(143,91,0,0.10)', ongold: '#FFFFFF', up: '#08704D', down: '#B42318',
      c1: '#9A6200', c2: '#2559B0', c3: '#8E357E', c4: '#8C79E0',
      foil: 'linear-gradient(100deg, #6E4300 0%, #9A6200 40%, #6A4000 68%, #8F5B00 100%)',
      foilBtn: 'linear-gradient(180deg, #A36C08 0%, #8F5B00 60%, #7A4C00 100%)',
      area: 'rgba(143,91,0,0.11)', hover: 'rgba(143,91,0,0.05)', shadow: '0 1px 0 rgba(255,255,255,0.7) inset, 0 10px 24px rgba(95,64,10,0.08)',
      meta: '#F8F2E4'
    }
  };

  var CSS =
    '.grv-foil{background:var(--foil);-webkit-background-clip:text;background-clip:text;color:transparent}' +
    '.grv-goldbtn{background:var(--foil-btn) !important;border:0 !important;color:var(--ongold) !important}' +
    '.grv-card{box-shadow:var(--card-shadow)}' +
    '::selection{background:var(--grv-glow2);}' +
    'html{scrollbar-color:var(--grv-line) var(--grv-bg)}' +
    '@keyframes grv-reveal{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}' +
    '@keyframes grv-fade{from{opacity:0}to{opacity:1}}' +
    '.grv-reveal{animation:grv-reveal .75s cubic-bezier(.2,.7,.2,1) both}' +
    '.grv-fade{animation:grv-fade .35s ease-out both}' +
    '@media (prefers-reduced-motion: reduce){.grv-reveal,.grv-fade{animation:none}}' +
    '@media (forced-colors: active){.grv-foil{background:none;color:CanvasText}.grv-goldbtn{background:ButtonFace !important;color:ButtonText !important}}' +
    // keyboard focus is always visible
    '#app a:focus-visible,#app button:focus-visible,#app input:focus-visible,#app select:focus-visible,#app [tabindex]:focus-visible{outline:2px solid var(--grv-gold);outline-offset:2px}' +
    // skip link: hidden until focused with the keyboard
    '.grv-skip{position:fixed;left:12px;top:-80px;z-index:70;background:var(--grv-gold);color:var(--grv-ongold);font:600 14px Geist,system-ui,sans-serif;padding:12px 16px;border-radius:12px;text-decoration:none}' +
    '.grv-skip:focus{top:12px}' +
    // loading placeholders shaped like the content that is coming
    '@keyframes grv-shim{0%{background-position:100% 0}100%{background-position:0 0}}' +
    '.grv-skel{display:block;border-radius:16px;background:linear-gradient(90deg,var(--grv-raised) 25%,var(--grv-line) 50%,var(--grv-raised) 75%);background-size:400% 100%;animation:grv-shim 1.6s ease-in-out infinite}' +
    '@media (prefers-reduced-motion: reduce){.grv-skel{animation:none}}' +
    // Simple view hides the technical deep-dives (marked grv-detail); everything else stays
    'html.grv-simple .grv-detail{display:none !important}' +
    // a small "?" next to a technical word opens its plain meaning
    '.grv-q{display:inline-grid;place-items:center;width:20px;height:20px;margin-left:6px;vertical-align:middle;border-radius:50%;border:1px solid var(--grv-line);background:var(--grv-raised);color:var(--grv-gold);font:700 12px Geist,system-ui,sans-serif;cursor:pointer;padding:0;position:relative}' +
    '.grv-q::after{content:"";position:absolute;inset:-12px}';

  function tokens(dark) {
    var p = P[dark ? 'dark' : 'light'];
    var t = {};
    for (var k in p) t[k] = p[k];
    return t;
  }

  var styled = false, last = null;
  function apply(dark) {
    if (typeof document === 'undefined') return;
    var key = dark ? 'dark' : 'light';
    if (!styled) {
      var st = document.createElement('style'); st.setAttribute('data-grv-theme', '1'); st.textContent = CSS;
      document.head.appendChild(st); styled = true;
    }
    if (last === key) return;
    last = key;
    var p = P[key], r = document.documentElement;
    r.className = r.className.replace(/\b(light|dark)\b/g, '').trim() + ' ' + key;
    ['bg', 'panel', 'raised', 'line', 'fg', 'muted', 'gold', 'glow', 'ongold', 'up', 'down'].forEach(function (k) {
      r.style.setProperty('--grv-' + k, p[k]);
    });
    r.style.setProperty('--grv-glow2', dark ? 'rgba(229,176,74,0.35)' : 'rgba(143,91,0,0.22)');
    r.style.setProperty('--foil', p.foil);
    r.style.setProperty('--foil-btn', p.foilBtn);
    r.style.setProperty('--card-shadow', p.shadow);
    r.style.colorScheme = key;
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', p.meta);
  }

  // Simple view: a per-browser choice (it changes how much is shown, not what the numbers are)
  var simpleOn = false;
  try { simpleOn = localStorage.getItem('grv-simple') === '1'; } catch (e) {}
  function setSimpleClass() { if (typeof document !== 'undefined') document.documentElement.classList.toggle('grv-simple', simpleOn); }
  setSimpleClass();
  function simple(v) {
    if (v === undefined) return simpleOn;
    simpleOn = !!v; setSimpleClass();
    try { localStorage.setItem('grv-simple', simpleOn ? '1' : '0'); } catch (e) {}
    return simpleOn;
  }

  root.GRVTheme = { tokens: tokens, apply: apply, palettes: P, simple: simple };
})(typeof window !== 'undefined' ? window : globalThis);
