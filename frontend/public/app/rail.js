/*
 * rail.js — the "lit glass" left menu (pages/Rail.dc.html) and the soft cursor light on the page.
 *
 *   Glass card    frosted, slightly see-through panel with warm gold light from the top
 *   Current page  a glowing gold pill (pure CSS on aria-current, so it works without this script too)
 *   Hover         a soft highlight slides up and down to the item under the cursor (or keyboard focus),
 *                 and slides back to the current page when the cursor leaves the menu
 *   Badge         the hovered item shows its shortcut key, 1–9 (keys.js)
 *   Page light    a faint gold glow follows the cursor across the page
 *
 * Mouse and trackpad only: on touch screens there is no hover highlight and no page light.
 * With "reduce motion" switched on nothing moves: no sliding, no page light.
 *
 * The page renderer rebuilds the menu's DOM, so this script never adds elements or attributes inside it:
 * it only sets CSS variables on <html> (--rhl-y, --rhl-h, --rhl-o) that the menu's highlight reads.
 */
(function () {
  'use strict';
  var root = document.documentElement;
  var css = '' +
    // the menu column and its glass card
    '.grv-rail{background:radial-gradient(120% 38% at 50% 0%,rgba(229,176,74,.10),transparent 70%)}' +
    'html.light .grv-rail{background:radial-gradient(120% 38% at 50% 0%,rgba(143,91,0,.08),transparent 70%)}' +
    '.grv-glass{position:relative;flex:1;min-height:0;display:flex;flex-direction:column;gap:18px;padding:14px 10px 12px;border-radius:20px;overflow-y:auto;' +
    'border:1px solid rgba(229,176,74,.20);' +
    'background:linear-gradient(180deg,rgba(229,176,74,.12) 0%,rgba(38,29,17,.72) 26%,rgba(27,21,12,.62) 100%);' +
    '-webkit-backdrop-filter:blur(18px) saturate(140%);backdrop-filter:blur(18px) saturate(140%);' +
    'box-shadow:inset 0 1px 0 rgba(255,236,190,.14),inset 0 0 0 1px rgba(255,255,255,.02),0 18px 44px rgba(0,0,0,.32)}' +
    '.grv-glass::before{content:"";position:absolute;left:0;right:0;top:0;height:140px;pointer-events:none;border-radius:20px 20px 0 0;' +
    'background:radial-gradient(90% 100% at 50% 0%,rgba(240,197,102,.24),rgba(240,197,102,0) 72%)}' +
    'html.light .grv-glass{border-color:rgba(143,91,0,.20);' +
    'background:linear-gradient(180deg,rgba(240,197,102,.30) 0%,rgba(255,253,247,.78) 28%,rgba(255,253,247,.66) 100%);' +
    'box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 16px 38px rgba(110,70,0,.14)}' +
    'html.light .grv-glass::before{background:radial-gradient(90% 100% at 50% 0%,rgba(229,176,74,.30),rgba(229,176,74,0) 72%)}' +
    // items sit above the sliding highlight
    '.grv-nav .rail-a,.grv-nav .rail-sec{position:relative;z-index:1}' +
    '.grv-nav .rail-a{color:var(--fg);transition:color .2s}' +
    '.grv-nav .rail-a[aria-current="page"]{color:var(--gold);' +
    'background:linear-gradient(90deg,rgba(229,176,74,.30),rgba(229,176,74,.12)) !important;' +
    'box-shadow:inset 0 0 0 1px rgba(229,176,74,.45),0 0 22px rgba(229,176,74,.22),inset 0 1px 0 rgba(255,236,190,.18)}' +
    'html.light .grv-nav .rail-a[aria-current="page"]{background:linear-gradient(90deg,rgba(143,91,0,.16),rgba(143,91,0,.06)) !important;' +
    'box-shadow:inset 0 0 0 1px rgba(143,91,0,.35),0 0 18px rgba(229,176,74,.30)}' +
    // the sliding highlight: a soft lit pane that follows the cursor
    '.rail-hl{position:absolute;left:0;right:0;top:0;z-index:0;pointer-events:none;border-radius:10px;' +
    'height:var(--rhl-h,0px);transform:translateY(var(--rhl-y,0px));opacity:var(--rhl-o,0);' +
    'background:linear-gradient(90deg,rgba(246,236,216,.09),rgba(246,236,216,.04));box-shadow:inset 0 0 0 1px rgba(246,236,216,.08);' +
    'transition:transform .32s cubic-bezier(.22,.9,.24,1),height .32s cubic-bezier(.22,.9,.24,1),opacity .25s}' +
    'html.light .rail-hl{background:linear-gradient(90deg,rgba(35,24,9,.07),rgba(35,24,9,.03));box-shadow:inset 0 0 0 1px rgba(35,24,9,.06)}' +
    // shortcut badge on the hovered (or keyboard-focused) item
    '.rail-k{margin-left:auto;min-width:20px;height:20px;box-sizing:border-box;display:inline-grid;place-items:center;padding:0 5px;border-radius:6px;' +
    'border:1px solid var(--line);background:var(--raised);color:var(--gold);font:600 11px "Geist Mono",ui-monospace,monospace;' +
    'opacity:0;transform:translateX(-4px);transition:opacity .18s,transform .18s}' +
    '.grv-nav .rail-a:hover .rail-k,.grv-nav .rail-a:focus-visible .rail-k{opacity:1;transform:none}' +
    // footer: data date and key hints
    '.rail-foot{display:flex;flex-direction:column;gap:8px;padding:10px 4px 2px;border-top:1px solid var(--line);font-size:12px;line-height:1.4;color:var(--muted)}' +
    '.rail-dot{width:8px;height:8px;flex:none;border-radius:50%;background:var(--up);box-shadow:0 0 0 3px color-mix(in srgb,var(--up) 22%,transparent)}' +
    '.rail-hints kbd{font:600 11px "Geist Mono",ui-monospace,monospace;color:var(--fg);border:1px solid var(--line);background:var(--raised);border-radius:5px;padding:1px 5px}' +
    // the cursor light over the page
    '.grv-light{position:fixed;inset:0;z-index:1;pointer-events:none;opacity:0;transition:opacity .4s;' +
    'background:radial-gradient(520px circle at var(--gx,50%) var(--gy,50%),rgba(229,176,74,.065),rgba(229,176,74,0) 70%)}' +
    'html.light .grv-light{background:radial-gradient(520px circle at var(--gx,50%) var(--gy,50%),rgba(229,176,74,.10),rgba(229,176,74,0) 70%)}' +
    '.grv-light.on{opacity:1}' +
    // touch screens: no hover effects; reduce motion: nothing moves
    '@media (hover:none),(pointer:coarse){.rail-hl,.grv-light{display:none}.rail-k{display:none}}' +
    '@media (prefers-reduced-motion:reduce){.rail-hl{transition:none}.rail-k{transition:none;transform:none}.grv-nav .rail-a{transition:none}.grv-light{display:none}}' +
    '@media (forced-colors:active){.rail-hl,.grv-light,.grv-glass::before{display:none}}' +
    // Gold RV logo: a 3D gold ingot and a raised, polished wordmark with a slow light sweep (defs added below)
    'svg.grv-wm{filter:drop-shadow(0 1px 0 rgba(255,238,196,.18)) drop-shadow(0 0 12px rgba(229,176,74,.10))}' +
    'html.light svg.grv-wm .wm-text{fill:url(#grvTextLight);filter:drop-shadow(0 1px 0 rgba(255,255,255,.9)) drop-shadow(0 1px .6px rgba(90,55,0,.25))}' +
    'html.light svg.grv-wm{filter:drop-shadow(0 1px 0 rgba(255,255,255,.8))}' +
    'svg.grv-wm .grv-shine{pointer-events:none;mix-blend-mode:screen}' +
    'html.light svg.grv-wm .grv-shine{mix-blend-mode:soft-light}' +
    '@media (prefers-reduced-motion:reduce),(forced-colors:active){svg.grv-wm .grv-shine{display:none}}' +
    // short laptop screens (768-860 px tall): tighten the menu so it fits without its own scroll bar
    '@media (max-height:860px){.grv-rail{gap:12px !important;padding-top:16px !important;padding-bottom:12px !important}.grv-glass{gap:10px;padding-top:10px}' +
    '.grv-nav{gap:8px !important}.grv-nav .rail-a{padding-top:7px !important;padding-bottom:7px !important}' +
    '.grv-glass button{min-height:34px !important}.rail-note{display:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var fine = window.matchMedia ? matchMedia('(hover: hover) and (pointer: fine)') : { matches: true };
  var calm = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---- sliding highlight
  function nav() { var n = document.querySelectorAll('.grv-nav'); for (var i = 0; i < n.length; i++) if (n[i].offsetParent) return n[i]; return null; }
  function current(n) { return n && n.querySelector('.rail-a[aria-current="page"]'); }
  var shown = null;
  function place(a) {
    if (!a) { root.style.setProperty('--rhl-o', '0'); shown = null; return; }
    root.style.setProperty('--rhl-y', a.offsetTop + 'px');
    root.style.setProperty('--rhl-h', a.offsetHeight + 'px');
    root.style.setProperty('--rhl-o', '1');
    shown = a;
  }
  function home() { var n = nav(); place(current(n)); }

  document.addEventListener('pointerover', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    var a = e.target.closest && e.target.closest('.grv-nav .rail-a');
    if (a && a !== shown) place(a);
  });
  document.addEventListener('pointerout', function (e) {
    var n = e.target.closest && e.target.closest('.grv-nav');
    if (n && !(e.relatedTarget && n.contains(e.relatedTarget))) home();
  });
  document.addEventListener('focusin', function (e) { var a = e.target.closest && e.target.closest('.grv-nav .rail-a'); if (a) place(a); });
  document.addEventListener('focusout', function (e) { if (e.target.closest && e.target.closest('.grv-nav') && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.grv-nav'))) home(); });

  // the renderer builds a new menu on every page: put the highlight back on the current page when it does
  var queued = false, lastCur = null, lastTop = -1;
  function check() {
    queued = false;
    var n = nav(), c = current(n);
    if (!c) return;
    if (c !== lastCur || c.offsetTop !== lastTop) { lastCur = c; lastTop = c.offsetTop; if (!shown || !document.contains(shown) || !n.contains(shown)) place(c); else if (shown === lastCur) place(c); }
  }
  new MutationObserver(function () { if (!queued) { queued = true; setTimeout(check, 30); } }).observe(document.body, { childList: true, subtree: true });
  addEventListener('resize', function () { if (shown && document.contains(shown)) place(shown); else home(); });

  // ---- page light that follows the cursor
  var light = null, raf = 0, gx = 0, gy = 0;
  function lightOn() { return fine.matches && !calm.matches; }
  addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' || !lightOn()) return;
    if (!light) { light = document.createElement('div'); light.className = 'grv-light'; light.setAttribute('aria-hidden', 'true'); document.body.appendChild(light); }
    gx = e.clientX; gy = e.clientY;
    if (!raf) raf = requestAnimationFrame(function () { raf = 0; light.style.setProperty('--gx', gx + 'px'); light.style.setProperty('--gy', gy + 'px'); light.classList.add('on'); });
  }, { passive: true });
  document.addEventListener('pointerleave', function () { if (light) light.classList.remove('on'); });
  document.documentElement.addEventListener('mouseleave', function () { if (light) light.classList.remove('on'); });
  function onPref() { if (light && !lightOn()) light.classList.remove('on'); }
  if (calm.addEventListener) { calm.addEventListener('change', onPref); fine.addEventListener('change', onPref); }

  window.GRVRail = { home: home };

  // gradients and the raised-letter filter for the Gold RV logo (svg.grv-wm in the menu and phone headers)
  (function addWordmarkDefs() {
    if (document.getElementById('grv-wm-defs')) return;
    var NS = 'http://www.w3.org/2000/svg', d = document.createElementNS(NS, 'svg');
    d.id = 'grv-wm-defs'; d.setAttribute('aria-hidden', 'true'); d.setAttribute('focusable', 'false');
    d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    d.innerHTML =
      '<defs>' +
      '<linearGradient id="grvFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF3CF"/><stop offset=".22" stop-color="#F6CF6B"/><stop offset=".5" stop-color="#D99E36"/><stop offset=".78" stop-color="#8E5C12"/><stop offset="1" stop-color="#C9922E"/></linearGradient>' +
      '<linearGradient id="grvTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF6DA"/><stop offset=".45" stop-color="#F8D57A"/><stop offset="1" stop-color="#C98E26"/></linearGradient>' +
      '<linearGradient id="grvText" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF0C4"/><stop offset=".3" stop-color="#F3C862"/><stop offset=".55" stop-color="#D49A33"/><stop offset=".78" stop-color="#9A6516"/><stop offset="1" stop-color="#E4B24E"/></linearGradient>' +
      '<linearGradient id="grvTextLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C08A22"/><stop offset=".35" stop-color="#9A6608"/><stop offset=".62" stop-color="#6F4500"/><stop offset=".82" stop-color="#5A3700"/><stop offset="1" stop-color="#A9761A"/></linearGradient>' +
      '<linearGradient id="grvShine" x1="0" y1="0" x2="1" y2=".35" gradientTransform="translate(-1.4 0)">' +
        '<stop offset=".38" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#FFF7DF" stop-opacity=".85"/><stop offset=".62" stop-color="#fff" stop-opacity="0"/>' +
        '<animateTransform attributeName="gradientTransform" type="translate" values="-1.4 0;1.4 0;1.4 0" keyTimes="0;.22;1" dur="7s" begin="1.2s" repeatCount="indefinite"/></linearGradient>' +
      '<filter id="grvEmboss" x="-10%" y="-20%" width="120%" height="150%"><feGaussianBlur in="SourceAlpha" stdDeviation="1.1" result="b"/>' +
        '<feSpecularLighting in="b" surfaceScale="3" specularConstant=".9" specularExponent="22" lighting-color="#FFF4D6" result="s"><feDistantLight azimuth="235" elevation="48"/></feSpecularLighting>' +
        '<feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/><feComposite in="SourceGraphic" in2="s2" operator="arithmetic" k1="0" k2="1" k3=".55" k4="0" result="lit"/>' +
        '<feDropShadow in="lit" dx="0" dy="2" stdDeviation="1.6" flood-color="#000" flood-opacity=".55"/></filter>' +
      '</defs>';
    (document.body || document.documentElement).appendChild(d);
    try { if (matchMedia('(prefers-reduced-motion: reduce)').matches && d.pauseAnimations) d.pauseAnimations(); } catch (e) {}
  })();
})();
