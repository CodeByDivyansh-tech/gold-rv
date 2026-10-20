/*
 * keys.js — keyboard shortcuts and a quick menu.
 *   1-9            jump to a page (Home, Today, Market, Pair Explorer, Signals, Backtesting, Try your own rule, Data, The brief)
 *   Ctrl/Cmd + O   open the quick menu (Ctrl/Cmd + K works too)
 *   Ctrl/Cmd + P   PDF: opens Download with PDF chosen; pressed again while it is open, the PDF downloads
 *                  (this replaces the browser's own Print shortcut on this site; Print stays in the browser menu)
 *   ?              Words explained (glossary.js). Double-click any box: Goldie explains it (explain.js)
 * Shortcuts are ignored while typing in a box, so the calculator and search still work.
 */
(function () {
  'use strict';
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');
  var PAGES = [
    ['1', 'Home', '#/', 'Same gold, four prices: today\'s answer'],
    ['2', 'Today', '#/today', 'Is any gap worth trading today?'],
    ['3', 'Market', '#/market', 'The four contracts on one chart'],
    ['4', 'Pair Explorer', '#/pairs', 'Every pair\'s history and trades'],
    ['5', 'Signals', '#/signals', 'The five checks and your own cost'],
    ['6', 'Backtesting', '#/backtesting', 'Did it make money?'],
    ['7', 'Try your own rule', '#/explore', 'Change the settings, see every year since 2011'],
    ['8', 'Data', '#/data', 'Where the numbers come from'],
    ['9', 'The brief, answered', '#/brief', 'Each line of the problem statement and the page that proves it']
  ];
  var TOOLS = [
    ['?', 'Words explained', 'Plain meanings of bps, z-score, carry…', function () { window.GRVGlossary && window.GRVGlossary.open(''); }],
    ['', 'Download as PDF', 'Statements, prices, backtest or the full report (' + (isMac ? '⌘' : 'Ctrl') + ' P)', function () { pdf(); }],
    ['', 'Ask Goldie', 'Double-click any box and Goldie explains it', function () { toast('Double-click (or double-tap) any box and Goldie explains it', 3500); }],
    ['', 'Watch the intro', 'The problem and our answer, in 3D', function () { location.href = 'intro/'; }],
    ['', '3D pitch', 'The 17-slide pitch for the judges', function () { location.href = 'pitch/'; }],
    ['', 'Code and data on GitHub', 'github.com/CodeByDivyansh-tech/gold-rv', function () { window.open('https://github.com/CodeByDivyansh-tech/gold-rv', '_blank', 'noopener'); }]
  ];

  var css = '' +
    '.km-back{position:fixed;inset:0;z-index:70;background:rgba(18,12,4,.55);display:flex;align-items:flex-start;justify-content:center;padding:12vh 16px 16px}' +
    '.km{width:min(560px,100%);max-height:76vh;box-sizing:border-box;background:var(--grv-panel,#1B150C);color:var(--grv-fg,#F6ECD8);border:1px solid var(--grv-line,#3A2D1A);border-radius:18px;' +
    'box-shadow:0 30px 80px rgba(18,12,4,.5);display:flex;flex-direction:column;font-family:Geist,system-ui,sans-serif;overflow:hidden}' +
    '.km-q{border:0;border-bottom:1px solid var(--grv-line,#3A2D1A);background:transparent;color:var(--grv-fg,#F6ECD8);font:500 17px Geist,system-ui,sans-serif;padding:18px 20px;outline:none}' +
    '.km-q::placeholder{color:var(--grv-muted,#BBA987)}' +
    '.km-list{list-style:none;margin:0;padding:8px;overflow-y:auto}' +
    '.km-h{font:600 11px "Geist Mono",ui-monospace,monospace;letter-spacing:.14em;color:var(--grv-muted,#BBA987);padding:10px 12px 6px}' +
    '.km-i{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;cursor:pointer}' +
    '.km-i[aria-selected="true"]{background:rgba(229,176,74,.14)}' +
    '.km-k{flex:none;min-width:26px;height:26px;display:inline-grid;place-items:center;border-radius:7px;border:1px solid var(--grv-line,#3A2D1A);background:var(--grv-raised,#261D11);' +
    'font:600 13px "Geist Mono",ui-monospace,monospace;color:var(--grv-gold,#E5B04A)}' +
    '.km-k.blank{visibility:hidden}' +
    '.km-t{display:flex;flex-direction:column;min-width:0}.km-n{font-weight:600;font-size:15px}.km-d{font-size:13px;color:var(--grv-muted,#BBA987)}' +
    '.km-cur{margin-left:auto;font:500 11px "Geist Mono",ui-monospace,monospace;color:var(--grv-gold,#E5B04A);letter-spacing:.08em}' +
    '.km-foot{border-top:1px solid var(--grv-line,#3A2D1A);padding:10px 16px;font-size:12px;color:var(--grv-muted,#BBA987);display:flex;flex-wrap:wrap;gap:6px 16px}' +
    '.km-foot b{font-family:"Geist Mono",ui-monospace,monospace;color:var(--grv-fg,#F6ECD8);font-weight:600}' +
    '.km-toast{position:fixed;z-index:65;left:50%;top:16px;transform:translateX(-50%);background:var(--grv-panel,#1B150C);color:var(--grv-fg,#F6ECD8);border:1px solid var(--grv-gold,#E5B04A);' +
    'border-radius:999px;padding:8px 16px;font:600 13px Geist,system-ui,sans-serif;box-shadow:0 10px 30px rgba(18,12,4,.35);pointer-events:none}' +
    '.grv-tool{position:relative}.grv-tool:hover{border-color:var(--grv-gold,#E5B04A) !important}.grv-tool:focus-visible{outline:2px solid var(--grv-gold,#E5B04A);outline-offset:2px}' +
    '.grv-k::before{content:"Ctrl O"}.grv-mac .grv-k::before{content:"\\2318  O"}' +
    '@media (hover:hover){.grv-tool[data-label]:hover::after{content:attr(data-label);position:absolute;top:calc(100% + 8px);right:0;z-index:70;white-space:nowrap;' +
    'background:var(--grv-panel,#1B150C);color:var(--grv-fg,#F6ECD8);border:1px solid var(--grv-line,#3A2D1A);border-radius:8px;padding:6px 10px;font:600 12px Geist,system-ui,sans-serif;pointer-events:none;box-shadow:0 8px 24px rgba(18,12,4,.3)}' +
    '[data-grv="search"]:not(.pbtn):hover::after{display:none}}' +
    '@media (max-width:430px){.phonebar .pbtn,.phonebar button{width:40px !important;height:40px !important}.phonebar .pb-sub{max-width:96px}.phonebar{gap:6px !important;padding-left:14px !important;padding-right:14px !important}}' +
    '.km-tip{position:fixed;right:20px;bottom:20px;z-index:45;max-width:300px;background:var(--grv-gold,#E5B04A);color:var(--grv-ongold,#1B1305);border-radius:14px;padding:12px 14px;' +
    'font:500 13px/1.5 Geist,system-ui,sans-serif;box-shadow:0 12px 34px rgba(18,12,4,.35)}' +
    '@media (max-width:899px){.km-tip{left:16px;right:16px;bottom:88px;max-width:none}}' +
    '.km-tip b{font-weight:700}.km-tip button{margin-top:8px;min-height:32px;padding:0 12px;border-radius:8px;border:0;background:var(--grv-ongold,#1B1305);color:var(--grv-gold,#E5B04A);font:600 12px Geist,system-ui,sans-serif;cursor:pointer}' +
    '';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function typing() {
    var el = document.activeElement, t = el && el.tagName;
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || (el && el.isContentEditable);
  }
  function currentHash() { var h = (location.hash || '#/').split(/[?]/)[0]; return h === '#' || h === '' ? '#/' : h; }

  var toastT = null;
  function toast(msg, ms) {
    var t = document.querySelector('.km-toast');
    if (!t) { t = document.createElement('div'); t.className = 'km-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; clearTimeout(toastT);
    toastT = setTimeout(function () { t.remove(); }, ms || 1400);
  }
  // Ctrl/Cmd+P: the Download panel with PDF chosen; if it is already open, download the PDF now
  function pdf() {
    if (document.querySelector('[aria-labelledby="dl-h"]')) {
      window.dispatchEvent(new Event('grv:pdf'));   // the panel says what happened in its own status line
      return;
    }
    var btn = Array.prototype.filter.call(document.querySelectorAll('[data-dl]'), function (b) { return b.offsetParent !== null; })[0];
    if (!btn) { toast('Open a page of the site to download a PDF', 2400); return; }
    window.GRVWantPdf = true;
    btn.click();
  }
  function go(p) {
    if (currentHash() !== p[2]) location.hash = p[2];
    toast(p[0] + ' · ' + p[1]);
  }

  var back = null, items = [], sel = 0, lastFocus = null;
  function close() {
    if (!back) return;
    back.remove(); back = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  var openedAt = 0;
  function open() {
    openedAt = Date.now();
    if (back) return;
    lastFocus = document.activeElement;
    back = document.createElement('div'); back.className = 'km-back';
    back.addEventListener('click', function (e) { if (e.target === back) close(); });
    var box = document.createElement('div'); box.className = 'km';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Quick menu');
    box.innerHTML = '<label for="km-q" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Go to a page or tool</label>' +
      '<input id="km-q" class="km-q" type="text" placeholder="Go to a page or tool…" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="km-list">' +
      '<ul id="km-list" class="km-list" role="listbox"></ul>' +
      '<div class="km-foot"><span><b>1</b>–<b>9</b> pages</span><span><b>↑ ↓</b> move</span><span><b>Enter</b> open</span><span><b>?</b> words</span><span><b>' + (isMac ? '⌘' : 'Ctrl') + ' P</b> PDF</span><span><b>Double-click</b> a box: Goldie explains</span><span><b>Esc</b> close</span></div>';
    back.appendChild(box); document.body.appendChild(back);
    var q = box.querySelector('.km-q'), list = box.querySelector('.km-list');
    function draw() {
      var v = q.value.trim().toLowerCase(); list.innerHTML = ''; items = [];
      function section(title, rows, kind) {
        var shown = rows.filter(function (r) { return !v || (r[1] + ' ' + (kind === 'page' ? r[3] : r[2])).toLowerCase().indexOf(v) >= 0 || r[0].toLowerCase() === v; });
        if (!shown.length) return;
        var h = document.createElement('li'); h.className = 'km-h'; h.setAttribute('role', 'presentation'); h.textContent = title; list.appendChild(h);
        shown.forEach(function (r) {
          var li = document.createElement('li'); li.className = 'km-i'; li.setAttribute('role', 'option'); li.id = 'km-o' + items.length;
          var isCur = kind === 'page' && currentHash() === r[2];
          li.innerHTML = '<span class="km-k"></span><span class="km-t"><span class="km-n"></span><span class="km-d"></span></span>' + (isCur ? '<span class="km-cur">YOU ARE HERE</span>' : '');
          var k = li.querySelector('.km-k'); k.textContent = r[0]; if (!r[0]) k.classList.add('blank');
          li.querySelector('.km-n').textContent = r[1];
          li.querySelector('.km-d').textContent = kind === 'page' ? r[3] : r[2];
          var act = kind === 'page' ? function () { close(); go(r); } : function () { close(); r[3](); };
          li.addEventListener('click', function () { if (Date.now() - openedAt > 350) act(); });
          li.addEventListener('mousemove', function () { setSel(items.indexOf(entry)); });
          var entry = { el: li, act: act }; items.push(entry); list.appendChild(li);
        });
      }
      section('PAGES', PAGES, 'page');
      section('TOOLS', TOOLS, 'tool');
      if (!items.length) { var e = document.createElement('li'); e.className = 'km-h'; e.textContent = 'Nothing matches "' + q.value + '"'; list.appendChild(e); }
      setSel(0);
    }
    function setSel(i) {
      if (!items.length) return;
      sel = (i + items.length) % items.length;
      items.forEach(function (it, j) { it.el.setAttribute('aria-selected', j === sel ? 'true' : 'false'); });
      q.setAttribute('aria-activedescendant', items[sel].el.id);
      items[sel].el.scrollIntoView({ block: 'nearest' });
    }
    q.addEventListener('input', draw);
    q.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel(sel + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(sel - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); if (items[sel]) items[sel].act(); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Tab') { e.preventDefault(); }
      else if (/^[1-9]$/.test(e.key) && !q.value) { e.preventDefault(); close(); go(PAGES[+e.key - 1]); }
    });
    draw(); q.focus();
  }

  document.addEventListener('keydown', function (e) {
    var mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && !e.altKey && (e.key === 'o' || e.key === 'O' || e.key === 'k' || e.key === 'K')) {
      e.preventDefault(); if (back) close(); else open(); return;
    }
    if (mod && !e.shiftKey && !e.altKey && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault(); if (back) close(); pdf(); return;
    }
    if (mod || e.altKey || back || typing()) return;
    if (document.querySelector('.gl-back')) return;       // glossary open: let it handle keys
    if (/^[1-9]$/.test(e.key)) { e.preventDefault(); go(PAGES[+e.key - 1]); return; }
  });

  // The Search and Words explained buttons sit in each page's top bar (data-grv="...")
  if (isMac) document.documentElement.classList.add('grv-mac');
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-grv]');
    if (!t) return;
    var act = t.getAttribute('data-grv');
    if (act === 'search') { if (back) close(); else open(); }
    else if (act === 'words' && window.GRVGlossary) window.GRVGlossary.open('');
  });

  // One-time tip on a visitor's first visit (per browser); sits in a corner, never over the content
  var seen = false;
  try { seen = localStorage.getItem('grv-keys-tip') === '1'; } catch (e) { seen = true; }
  if (!seen) {
    var touch = !matchMedia('(pointer: fine)').matches;
    setTimeout(function () {
      var tip = document.createElement('div'); tip.className = 'km-tip'; tip.setAttribute('role', 'note');
      tip.innerHTML = touch
        ? 'Tip: <b>double-tap</b> any box and Goldie explains it.<br><button type="button">Got it</button>'
        : 'Tip: <b>double-click</b> any box and Goldie explains it. Press <b>' + (isMac ? '⌘' : 'Ctrl') + ' O</b> to search, <b>' + (isMac ? '⌘' : 'Ctrl') + ' P</b> for a PDF, or <b>1–9</b> to jump between pages.<br><button type="button">Got it</button>';
      var done = function () { tip.remove(); try { localStorage.setItem('grv-keys-tip', '1'); } catch (e) {} };
      tip.querySelector('button').addEventListener('click', done);
      // a small popup in the bottom corner (above the tab bar on phones), so it never covers the page's content
      document.body.appendChild(tip);
      setTimeout(function () { if (tip.isConnected) done(); }, 9000);
    }, 1200);
  }
  window.GRVKeys = { open: open, close: close, pdf: pdf, pages: PAGES };
})();
