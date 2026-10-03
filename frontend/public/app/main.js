/*
 * main.js — routes the URL hash to a page file and mounts it with dc.js.
 *   #/            Home        #/today     Today       #/market    Market
 *   #/pairs       Pairs       #/signals   Signals     #/backtesting  Backtesting
 *   #/data        Data
 */
(function () {
  'use strict';
  var ROUTES = {
    '': 'Home', home: 'Home', today: 'Today', market: 'Market', pairs: 'Pairs',
    signals: 'Signals', backtesting: 'Backtesting', data: 'Data'
  };
  var NAMES = {};
  Object.keys(ROUTES).forEach(function (k) { if (k) NAMES[ROUTES[k]] = k; });

  // Links between page files ("Today.dc.html") become routes ("#/today")
  DC.setHref(function (h) {
    var m = /^([A-Za-z]+)\.dc\.html(#.*)?$/.exec(h);
    if (!m) return h;
    var route = NAMES[m[1]];
    if (!route) return h;
    return route === 'home' ? '#/' : '#/' + route;
  });

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
    if (current === p.name) return;
    current = p.name;
    DC.load(p.name).then(function (def) {
      if (current !== p.name) return;
      host.mount(def, {});
      document.title = def.title || 'Gold RV Intelligence';
      window.scrollTo(0, 0);
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
    ['Today', 'Market', 'Pairs', 'Signals', 'Backtesting', 'Data'].forEach(function (n) { DC.load(n).catch(function () {}); });
  }, 1500);
})();
