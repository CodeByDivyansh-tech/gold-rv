/*
 * prefs.js — the choices a visitor makes (pair, slippage, period, …), kept in two places:
 *   the address bar   #/backtesting?pair=M_GUINEA&slip=2   so a copied link opens the same view
 *   browser storage   so the choice follows the visitor from page to page and visit to visit
 *
 *   GRVPrefs.get(key, allowed?)  the current value (address bar first, then storage), or null;
 *                                with an allowed list, anything else counts as no value
 *   GRVPrefs.set({key: value})   remember and put in the address bar (null removes)
 *   GRVPrefs.copyLink()          copy the address of the current view; resolves true when copied
 *   GRVPrefs.inUrl(key, value)   is the address bar already showing this value?
 *
 * Storage can be missing or throw (private windows, blocked site data): everything then still works
 * for the current visit, from memory.
 */
(function (root) {
  'use strict';
  var KEY = 'grv-prefs', mem = {};
  try { mem = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { mem = {}; }

  function parts() {
    var h = (root.location && root.location.hash) || '';
    var i = h.indexOf('?');
    return { route: i < 0 ? h : h.slice(0, i), q: new URLSearchParams(i < 0 ? '' : h.slice(i + 1)) };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {} }

  // A link someone shared wins over what this browser remembered: copy its values into memory once.
  function absorb() {
    var q = parts().q, changed = false;
    q.forEach(function (v, k) { if (mem[k] !== v) { mem[k] = v; changed = true; } });
    if (changed) save();
  }
  absorb();
  if (root.addEventListener) root.addEventListener('hashchange', absorb);

  function get(k, allowed) {
    var v = parts().q.get(k);
    if (v == null) v = mem[k] == null ? null : String(mem[k]);
    if (v != null && allowed && allowed.map(String).indexOf(v) < 0) return null;
    return v;
  }

  function set(obj) {
    var p = parts();
    Object.keys(obj).forEach(function (k) {
      var v = obj[k];
      if (v == null) { delete mem[k]; p.q.delete(k); } else { mem[k] = String(v); p.q.set(k, String(v)); }
    });
    save();
    var qs = p.q.toString();
    var hash = (p.route || '#/') + (qs ? '?' + qs : '');
    // replaceState changes the address without a hashchange, so the page does not reload
    try { if (root.history && root.history.replaceState) root.history.replaceState(null, '', hash); } catch (e) {}
  }

  function copyLink() {
    var url = String(root.location.href);
    if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
      return root.navigator.clipboard.writeText(url).then(function () { return true; }, function () { return fallback(url); });
    }
    return Promise.resolve(fallback(url));
  }
  function fallback(url) {
    try {
      var t = document.createElement('textarea');
      t.value = url; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(t);
      return !!ok;
    } catch (e) { return false; }
  }

  function inUrl(k, v) { return parts().q.get(k) === String(v); }

  root.GRVPrefs = { get: get, set: set, copyLink: copyLink, inUrl: inUrl };
})(typeof window !== 'undefined' ? window : globalThis);
