/*
 * explain.js — "Explain mode" for first-time visitors.
 * Turn it on, then tap any box or chart: Goldie explains it in one or two plain sentences.
 * It only reads the page (never changes #app), so page re-renders cannot break it.
 * Links, buttons and inputs keep working normally while it is on.
 */
(function () {
  'use strict';
  // [pattern matched against the start of a box's text, title, note]
  var NOTES = [
    // Home
    [/^Same gold\.\s*Four prices\./, 'Same gold, four prices', 'MCX sells the same gold in four sizes: a 100 g bar, a 10 g bar, an 8 g coin and a 1 g piece. We check whether they all cost the same per gram.'],
    [/^GOLD(M|TEN|GUINEA|PETAL)\n(Gold|GOLD)/, 'One gold contract', 'The big number is this contract\'s price; the wavy line is how it moved this year. The bottom number turns it into the price of 10 g of pure gold, so all four cards can be compared.'],
    [/^Is any gap between them worth trading today\?/, 'Today\'s answer', 'Each bar is how far apart two contracts are. The gold line is the cost of trading. No bar crosses it, so the answer today is "No".'],
    [/^Gold price, per 10 g of pure gold/, 'Gold\'s price', 'This is simply the price of gold over time. Use 1M, 3M, 1Y or 3Y to look at a shorter or longer stretch.'],
    [/^Want to go deeper\?/, 'Where to go next', 'Shortcuts to the other pages. Pick whichever you are curious about.'],
    [/^11,954\s*\n\s*daily settlements checked/, 'The project in four numbers', 'How many prices we checked, over how long, and how the test went, in one line.'],
    // Today
    [/^Is any gap worth trading today\?/, 'Today', 'This page answers one question every day: is any price gap big enough to be worth trading?'],
    [/^Pairs above the cost line/, 'Pairs above the line', 'How many of the six pairs have a gap bigger than the cost of trading. When it is 0, we wait.'],
    [/^Biggest gap from normal/, 'Biggest gap', 'The largest difference we found today. It is still smaller than the cost line.'],
    [/^Cost line/, 'The cost line', 'Trading costs money, like a ticket. We ask for a gap twice as big as the ticket, to be safe.'],
    [/^The hurdle/, 'The hurdle', 'Think of a high-jump bar. Each grey bar is a gap and the gold line is the bar it must clear. None clear it today.'],
    [/^Replay three years/, 'Time machine', 'Press play or drag the slider to travel back and watch the gaps week by week since October 2023.'],
    [/^All six pairs, in numbers/, 'The full table', 'The same six pairs with every number, and which of the five checks each one failed.'],
    // Market
    [/^Same gold, four prices/, 'Comparing the four', 'All four contracts are the same gold, so their lines should sit on top of each other. This page shows how close they really are.'],
    [/^Price of 10 g of pure gold, by contract/, 'Four lines, one gold', 'One coloured line per contract. They almost overlap, because it is the same gold.'],
    [/^Gap to GOLDTEN today/, 'Gaps today', 'How much more each contract costs than GOLDTEN today, before we adjust for their different end dates.'],
    [/^How far each contract sits from GOLDM/, 'Cheap or expensive?', 'Zero means "same price as GOLDM"; above zero means dearer. See GOLDPETAL switch from cheap to dear around early 2025.'],
    [/^Normal is not fixed/, 'Normal moves', 'The usual gap changes over time, so we keep updating what "normal" means instead of using one fixed number.'],
    [/^The four contracts/, 'ID cards', 'Each contract\'s size, purity, end date and how much it is traded.'],
    [/^How we make them comparable/, 'The conversion', 'The small sum that turns every price into the price of 10 g of pure gold, with two worked examples.'],
    // Pair Explorer
    [/^Pair Explorer/, 'Pair Explorer', 'Pick any two contracts and see their whole story since 2023.'],
    [/^GOLD\S+ · GOLD\S+\ngap today/, 'Pick a pair', 'Tap a pair to switch everything below to it.'],
    [/^GOLD\S+ · GOLD\S+: \w+ \d{4} to/, 'The gap over time', 'The brown line is the gap between the two contracts. Each dot is a trade: green made money, red lost money.'],
    [/^Every trade the model took/, 'Trade list', 'Every trade: when it started, why it ended, and how much it made or lost after costs.'],
    [/^On the 12 unseen months/, 'Test-year score', 'The score for the year the model had never seen. With so few trades, it could easily be luck.'],
    // Signals
    [/^Why is it quiet\?/, 'Why quiet?', 'A signal is like a green traffic light. It only turns green when all five checks pass at once. Today they do not.'],
    [/^GOLD\S+ · GOLD\S+\nQuiet/, 'Pick a pair', 'Tap a pair to see its five checks.'],
    [/^GOLD\S+ · GOLD\S+ · contracts/, 'Short answer', 'How many of the five checks this pair failed today. One failed check is enough to stay quiet.'],
    [/^Check \d/, 'One of the five checks', '"Pass" means this part is fine; "Fail" says what is missing.'],
    [/^Does the gap beat the cost\?/, 'Gap vs cost', 'The grey bar is today\'s gap; the gold line is what we need. The bar is too short, so no trade.'],
    [/^What one round trip costs/, 'All the fees', 'Every fee for buying and selling once, added up. The biggest part is slippage: the small price you lose each time you trade.'],
    [/^Work out your own cost/, 'Your own cost', 'Type in your own fees to see whether any pair would be worth it for you. Try the buttons to see how much costs matter.'],
    [/^After an alert, does the gap close\?/, 'Do alerts work?', 'After an alert, did the gap really shrink? Green means it shrank by more than the cost.'],
    [/^Every trade the backtest took for this pair/, 'Past trades', 'All the practice trades this pair made in the past, with the result of each.'],
    // Backtesting
    [/^Did it make money\?/, 'The test', 'We practised on two years of real prices, froze the rules, then tested on one year the model had never seen.'],
    [/^The verdict|^No persistent edge proven after costs/, 'The final answer', 'We could not prove the idea makes money reliably. Saying "no" honestly, with proof, is a real result.'],
    [/^Take out one crash and it loses/, 'The storm', 'Gold bars are trades during the Jan–Mar 2026 gold crash; grey bars are all the others. At our 5 bps cost, everything outside the crash adds up to a loss.'],
    [/^How sure can we be\?/, 'Luck check', 'We reshuffled the trades 10,000 times to see how much luck matters. A long bar means "not sure".'],
    [/^One rule for alerts and backtest/, 'One rule', 'The same five checks decide today\'s alerts and the past test, so nothing is hidden.'],
    [/^GOLDM · GOLDPETAL\nGOLDM · GOLD/, 'Choose what to test', 'Pick a pair and a slippage level. Every number below changes.'],
    [/^(Trades in the unseen year|Won\n|Average per trade|Total after costs|t-statistic)/, 'Score card', 'The test-year score in five numbers. Read them together: few trades means the score is shaky.'],
    [/^GOLD\S+ · GOLD\S+ at \d+ bps slippage/, 'Money over time', 'The running total, trade after trade. The shaded part is the year the model had never seen.'],
    [/^Same trades, different costs/, 'Cheaper or dearer trading', 'The same trades with cheaper or dearer trading. More slippage means less profit.'],
    [/^Where the result came from/, 'Where the money came from', 'Did it come from the gap closing (what we bet on) or from gold\'s price moving? Almost all of it came from the gap.'],
    [/^Settings for /, 'The frozen settings', 'The exact rules this pair used, fixed before the test year started.'],
    // Data
    [/^Where the numbers come from/, 'Our data', 'Every number on this site comes from MCX\'s official end-of-day price files.'],
    [/^(11,954|138|768|0)\s*\n\s*(daily settlements|contracts|trading days|mismatches)/, 'Data in numbers', 'Quick facts about our data. "0 mismatches" means our copy matches MCX\'s files exactly.'],
    [/^How we cleaned it/, 'Cleaning', 'Days with no trading were removed, thin days were flagged, and special weekend sessions were kept.'],
    [/^From raw files to this website/, 'Eight steps', 'The eight steps our Python code follows, from MCX files to the charts you see.'],
    [/^How we avoid peeking at the future/, 'A fair exam', 'The model only uses past days, never tomorrow\'s answers, like an exam without the answer key.'],
    [/^What this data cannot tell you/, 'Honest limits', 'What our data cannot show. Good research says what it does not know.'],
    [/^Download log/, 'Receipts', 'A record of every file we downloaded, so anyone can check our work.'],
    [/^Check it yourself/, 'Check it yourself', 'All our code and data are public on GitHub, so anyone can run it again.']
  ];

  var GOLDIE = '<svg viewBox="0 0 48 40" width="40" height="34" aria-hidden="true"><path d="M6 14L9 5H35L38 14Z" fill="#F2A93B"/><path d="M12 33L15 24H41L44 33Z" fill="#C9821F"/>' +
    '<circle cx="18" cy="10" r="3.2" fill="#fff"/><circle cx="26" cy="10" r="3.2" fill="#fff"/><circle cx="18.8" cy="10.4" r="1.5" fill="#070D14"/><circle cx="26.8" cy="10.4" r="1.5" fill="#070D14"/></svg>';

  var css = '' +
    '.xp-btn{position:fixed;left:20px;bottom:74px;z-index:40;min-height:44px;padding:0 16px 0 8px;border-radius:999px;border:1px solid rgba(242,169,59,.55);' +
    'background:#0F1822;color:#EAF0F6;font:600 14px Geist,system-ui,sans-serif;display:flex;align-items:center;gap:6px;cursor:pointer;box-shadow:0 10px 30px rgba(7,13,20,.35)}' +
    '.xp-btn[aria-pressed="true"]{background:#F2A93B;color:#1A1204;border-color:#F2A93B}' +
    '.xp-btn:focus-visible,.xp-x:focus-visible{outline:2px solid #F2A93B;outline-offset:2px}' +
    '@media (max-width:899px){.xp-btn{left:auto;right:14px;bottom:calc(138px + env(safe-area-inset-bottom,0px));padding:0 8px}.xp-btn span{display:none}}' +
    'body.xp-on #app main{cursor:help}' +
    '.xp-ring{position:fixed;z-index:45;pointer-events:none;border:2px solid #F2A93B;border-radius:18px;box-shadow:0 0 0 4px rgba(242,169,59,.18);transition:all .15s ease}' +
    '.xp-tip{position:fixed;z-index:50;width:min(330px,calc(100vw - 32px));box-sizing:border-box;background:#0F1822;color:#EAF0F6;border:1px solid #F2A93B;border-radius:16px;' +
    'padding:12px 14px 14px;box-shadow:0 18px 50px rgba(7,13,20,.45);font-family:Geist,system-ui,sans-serif;display:flex;gap:10px;align-items:flex-start}' +
    '.xp-tip .xp-body{flex:1;min-width:0}.xp-tip .xp-t{font-weight:600;font-size:15px;color:#F2A93B;margin:2px 0 4px}' +
    '.xp-tip .xp-d{font-size:14px;line-height:1.55;color:#DCE4EC}' +
    '.xp-x{flex:none;min-width:36px;min-height:36px;border-radius:10px;border:1px solid #1E2B38;background:#18232F;color:#EAF0F6;font-size:18px;cursor:pointer}' +
    '.xp-hint{position:fixed;z-index:44;left:50%;transform:translateX(-50%);top:14px;background:#F2A93B;color:#1A1204;font:600 13px Geist,system-ui,sans-serif;' +
    'padding:8px 14px;border-radius:999px;box-shadow:0 8px 24px rgba(7,13,20,.3);max-width:calc(100vw - 32px);text-align:center}' +
    '@media (prefers-reduced-motion:reduce){.xp-ring{transition:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var on = false, ring = null, tip = null, hint = null;
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'xp-btn'; btn.setAttribute('aria-pressed', 'false');
  btn.innerHTML = GOLDIE.replace('width="40" height="34"', 'width="30" height="26"') + '<span>Explain like I\'m new</span>';
  btn.setAttribute('aria-label', 'Explain mode: tap any box to have it explained');
  document.body.appendChild(btn);

  function clearTip() { if (tip) { tip.remove(); tip = null; } if (ring) { ring.remove(); ring = null; } }
  function setOn(v) {
    on = v; btn.setAttribute('aria-pressed', v ? 'true' : 'false');
    document.body.classList.toggle('xp-on', v);
    clearTip();
    if (hint) { hint.remove(); hint = null; }
    if (v) {
      hint = document.createElement('div'); hint.className = 'xp-hint'; hint.setAttribute('role', 'status');
      hint.textContent = innerWidth < 600 ? 'Explain mode on: tap any box.' : 'Explain mode is on: tap any box or chart. Tap Goldie again to turn it off.';
      document.body.appendChild(hint);
      setTimeout(function () { if (hint) { hint.remove(); hint = null; } }, 4500);
    }
    try { sessionStorage.setItem('grv-explain', v ? '1' : '0'); } catch (e) {}
  }
  btn.addEventListener('click', function () { setOn(!on); });

  function find(el) {
    var main = document.querySelector('#app main');
    for (; el && el !== document.body; el = el.parentElement) {
      if (main && !main.contains(el)) return null;
      var txt = (el.innerText || '').trim().slice(0, 200);
      if (!txt) continue;
      for (var i = 0; i < NOTES.length; i++) if (NOTES[i][0].test(txt)) return { el: el, title: NOTES[i][1], text: NOTES[i][2] };
      if (el === main) break;
    }
    return null;
  }

  function show(hit, x, y) {
    clearTip();
    var r = hit.el.getBoundingClientRect();
    ring = document.createElement('div'); ring.className = 'xp-ring';
    ring.style.left = (r.left - 4) + 'px'; ring.style.top = (r.top - 4) + 'px';
    ring.style.width = (r.width + 8) + 'px'; ring.style.height = (r.height + 8) + 'px';
    document.body.appendChild(ring);
    tip = document.createElement('div'); tip.className = 'xp-tip'; tip.setAttribute('role', 'dialog'); tip.setAttribute('aria-live', 'polite');
    tip.setAttribute('aria-label', hit.title);
    tip.innerHTML = GOLDIE + '<div class="xp-body"><div class="xp-t"></div><div class="xp-d"></div></div><button type="button" class="xp-x" aria-label="Close">×</button>';
    tip.querySelector('.xp-t').textContent = hit.title;
    tip.querySelector('.xp-d').textContent = hit.text;
    tip.querySelector('.xp-x').addEventListener('click', function (e) { e.stopPropagation(); clearTip(); });
    document.body.appendChild(tip);
    var w = tip.offsetWidth, h = tip.offsetHeight, vw = innerWidth, vh = innerHeight;
    var left = Math.min(Math.max(16, x + 14), vw - w - 16);
    var top = y + 18 + h > vh - 16 ? y - h - 18 : y + 18;
    top = Math.min(Math.max(16, top), vh - h - 16);
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
  }

  document.addEventListener('click', function (e) {
    if (!on) return;
    if (tip && tip.contains(e.target)) return;
    if (e.target.closest('.xp-btn, .gl-btn, .gl-back')) return;
    // Links, buttons and form fields keep working as normal
    if (e.target.closest('a, button, input, select, textarea, label, [role="slider"]')) { clearTip(); return; }
    var hit = find(e.target);
    if (!hit) { clearTip(); return; }
    e.preventDefault(); e.stopPropagation();
    show(hit, e.clientX, e.clientY);
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && (tip || on)) { if (tip) clearTip(); else setOn(false); } });
  window.addEventListener('scroll', clearTip, { passive: true });
  window.addEventListener('hashchange', clearTip);
  try { if (sessionStorage.getItem('grv-explain') === '1') setOn(true); } catch (e) {}
  window.GRVExplain = { setOn: setOn, notes: NOTES, find: find };
})();
