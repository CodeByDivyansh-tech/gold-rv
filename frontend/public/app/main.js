/*
 * main.js — routes the URL hash to a page file and mounts it with dc.js.
 *   #/            Home        #/today     Today       #/market    Market
 *   #/pairs       Pairs       #/signals   Signals     #/backtesting  Backtesting
 *   #/explore     Explore (try your own rule)      #/data        Data
 *   #/brief       The brief, answered (each line of the problem statement and where it is proved)
 *   A ?query after the route holds the visitor's choices (app/prefs.js); it never changes the page.
 *   A #section after the route ("#/backtesting#clean-test") scrolls to that section once it has drawn.
 */
(function () {
  'use strict';
  var ROUTES = {
    '': 'Home', home: 'Home', today: 'Today', market: 'Market', pairs: 'Pairs',
    signals: 'Signals', backtesting: 'Backtesting', explore: 'Explore', data: 'Data', brief: 'Brief'
  };
  var NAMES = {};
  Object.keys(ROUTES).forEach(function (k) { if (k) NAMES[ROUTES[k]] = k; });

  // Links between page files ("Today.dc.html", "Backtesting.dc.html#clean-test") become routes ("#/today")
  DC.setHref(function (h) {
    var m = /^([A-Za-z]+)\.dc\.html(#[A-Za-z0-9-]+)?$/.exec(h);
    if (!m) return h;
    var route = NAMES[m[1]];
    if (!route) return h;
    return (route === 'home' ? '#/' : '#/' + route) + (m[2] || '');
  });

  // the section named after the route, if any
  function sectionOf(hash) { var m = /^#\/?[A-Za-z]*#([A-Za-z0-9-]+)/.exec(hash || ''); return m ? m[1] : null; }
  var seekT = null;
  function seek(id) {
    clearTimeout(seekT);
    if (!id) return;
    var tries = 0;
    (function look() {
      var el = document.getElementById(id);
      // pages draw their sections once the data has loaded, so look again for a few seconds
      if (el && el.offsetParent !== null) {
        el.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        return;
      }
      if (++tries < 40) seekT = setTimeout(look, 100);
    })();
  }

  var app = document.getElementById('app');
  var host = new DC.Host(app);
  var current = null;

  function pageFor(hash) {
    var key = (hash || '').replace(/^#\/?/, '').split(/[?#]/)[0].toLowerCase();
    return ROUTES[key] ? { key: key, name: ROUTES[key] } : null;
  }

  function show() {
    var p = pageFor(location.hash);
    if (!p) { location.replace('#/'); return; }
    if (current === p.name) { seek(sectionOf(location.hash)); return; }
    current = p.name;
    DC.load(p.name).then(function (def) {
      if (current !== p.name) return;
      host.mount(def, {});
      document.title = def.title || 'Gold RV Intelligence';
      window.scrollTo(0, 0);
      seek(sectionOf(location.hash));
      var h = app.querySelector('h1');
      if (h && document.activeElement && document.activeElement !== document.body) {
        h.setAttribute('tabindex', '-1');
        h.focus({ preventScroll: true });
      }
    }).catch(function (e) {
      console.error(e);
      app.innerHTML = '';
      var box = document.createElement('div');
      box.setAttribute('role', 'alert');
      box.className = 'boot-error';
      box.innerHTML = '<strong>This page did not load.</strong><span>Check your connection and try again.</span>';
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = 'Try again';
      b.addEventListener('click', function () { location.reload(); });
      box.appendChild(b);
      app.appendChild(box);
    });
  }

  window.addEventListener('hashchange', show);
  show();

  // Warm the cache for the other pages once the first one is up
  setTimeout(function () {
    ['Today', 'Market', 'Pairs', 'Signals', 'Backtesting', 'Explore', 'Data', 'Brief'].forEach(function (n) { DC.load(n).catch(function () {}); });
  }, 1500);
})();
