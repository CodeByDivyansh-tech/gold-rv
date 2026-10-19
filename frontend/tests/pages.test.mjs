// Runs every page's logic against the real site-data.json in many UI states.
// No dependencies: `node tests/pages.test.mjs` (or `npm test`) from frontend/.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

globalThis.window = globalThis; new Function(readFileSync('public/app/theme.js', 'utf8'))()   // shared themes, as in the browser
const D = JSON.parse(readFileSync('public/data/site-data.json', 'utf8'))
const R = JSON.parse(readFileSync('public/data/robustness.json', 'utf8'))
const H = JSON.parse(readFileSync('public/data/history.json', 'utf8'))
const HC = JSON.parse(readFileSync('public/data/history_charts.json', 'utf8'))
const E = JSON.parse(readFileSync('public/data/explore.json', 'utf8'))
const PAIRS = ['M_TEN', 'M_PETAL', 'M_GUINEA', 'TEN_PETAL', 'GUINEA_TEN', 'GUINEA_PETAL']
const SLIPS = ['0', '2', '5', '10']

class DCLogic { setState(o) { this.state = { ...(this.state || {}), ...(typeof o === 'function' ? o(this.state) : o) } } }

function load(name) {
  const src = readFileSync(`public/pages/${name}.dc.html`, 'utf8')
  const code = src.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1]
  assert.ok(!/_blob\//.test(src), `${name}: still points at a design-canvas data file`)
  return new Function('DCLogic', code + '\nreturn Component;')(DCLogic)
}

const states = {
  Home: [{}, { range: '1M', hover: 5 }, { range: '3Y', hover: 100 }, { dark: false }, { H, range: '10Y', hover: 200 }, { H, range: 'All', hover: 900 }, { range: 'All' }],
  Today: [{}, { ri: 0 }, { ri: 60 }, { ri: 120, speed: 2 }, { HC }, { HC, ri: 0 }, { HC, ri: 400 }, { HC, rspan: 'ours', ri: 10 }],
  Market: [{}, { range: '3M', hover: 10 }, { range: '3Y', hover: 150 }, { H, range: '10Y', hover: 100 }, { H, range: 'All', hover: 1000 }, { range: '10Y' }, { HC }, { HC, vspan: 'ours' }],
  Pairs: PAIRS.flatMap((pair) => [{ pair }, { pair, hover: 20, allTrades: true }, { pair, HC, allTrades: true }, { pair, HC, span: 'ours' }, { pair, HC, story: D.pairs[pair].trades.length ? D.pairs[pair].trades[0].sig + '|' + D.pairs[pair].trades[0].e : null }]),
  Signals: PAIRS.map((pair) => ({ pair, allPast: true })).concat([{ R }, { R, cs: '0', cb: '0', cz: '1' }, { R, cs: '', cb: 'abc', cz: '0' }, { cs: '10', cb: '50', cz: '25' }]),
  Backtesting: PAIRS.flatMap((pair) => SLIPS.map((slip) => ({ pair, slip, hover: 0 }))).concat([{ R }, { R, H }, { H, pair: 'GUINEA_TEN', slip: '10' }]).concat(PAIRS.flatMap((pair) => SLIPS.map((slip) => ({ pair, slip, HC })))).concat([{ HC, espan: 'ours' }]),
  Data: [{}, { all: true }, { H }, { H, all: true }],
  Explore: [{ E }, { E, xpair: 'M_TEN' }, { E, xpair: 'GUINEA_PETAL', slip: '0' }, { E, pub: '0', ze: '3.0', W: '10', mh: '20', h: '0' },
    { E, xpair: 'ALL', pub: '0', ze: '1.5' }, ...PAIRS.flatMap((xpair) => ['0', '10'].map((slip) => ({ E, xpair, slip, pub: '0' })))],
  DownloadPanel: ['today', 'prices', 'trades', 'backtest', 'report'].flatMap((what) =>
    ['3m', 'all', 'test'].map((period) => ({ what, period, pair: 'ALL', H, HC }))),
}

let runs = 0
for (const [name, list] of Object.entries(states)) {
  const C = load(name)
  for (const st of list) {
    const c = new C()
    c.props = name === 'DownloadPanel' ? { dark: true, onClose: () => {} } : {}
    c.state = { D, ...st }
    const v = c.renderVals()
    assert.ok(v && v.ready !== false, `${name} ${JSON.stringify(st)} did not reach the ready state`)
    const text = JSON.stringify(v, (k, x) => (typeof x === 'function' ? undefined : x))
    assert.ok(!/\bNaN\b|undefined|\[object Object\]/.test(text), `${name} ${JSON.stringify(st)} shows NaN/undefined`)
    runs++
  }
  // loading and failed states draw too
  const c = new C(); c.props = {}; c.state = {}
  assert.ok(c.renderVals(), `${name} loading state`)
}

// The headline answer follows all five checks, not just the cost line
{
  const C = load('Home'); const c = new C(); c.props = {}; c.state = { D }
  const signals = D.today.filter((p) => p.status === 'SIGNAL').length
  assert.equal(c.renderVals().answer.word === 'No.', signals === 0)
}
// The cost calculator reproduces the site's own round trip at our defaults
{
  const C = load('Signals'); const c = new C(); c.props = {}; c.state = { D, R }
  const v = c.renderVals()
  assert.equal(v.calc.rt, D.costTotal.toFixed(2))
  assert.equal(v.calc.count, D.today.filter((p) => p.dev >= 2 * D.rt).length + ' of ' + D.today.length)
  assert.ok(v.ft.show && v.ft.rows.length === 5 && /clean test/.test(v.ft.rows[0].name), 'follow-through starts with the clean test')
}
// Shared menus: exactly one item is marked as the current page, on every page
for (const name of ['Rail', 'TabBar']) {
  const C = load(name)
  for (const cur of ['Home', 'Today', 'Market', 'Pairs', 'Signals', 'Backtesting', 'Data']) {
    const c = new C(); c.props = { current: cur }; c.state = {}
    const v = c.renderVals()
    assert.deepEqual(Object.keys(v.nav).filter((k) => v.nav[k].cur === 'page'), [cur], `${name} highlights ${cur}`)
    runs++
  }
}
// Every page uses the shared menus instead of its own copy
for (const name of ['Home', 'Today', 'Market', 'Pairs', 'Signals', 'Backtesting', 'Explore', 'Data']) {
  const src = readFileSync(`public/pages/${name}.dc.html`, 'utf8')
  assert.ok(src.includes(`<dc-import name="Rail" current="${name}">`) && src.includes(`<dc-import name="TabBar" current="${name}">`), `${name} uses the shared menus`)
  assert.ok(!src.includes('<aside class="rail"') && !src.includes('<nav class="tabbar"'), `${name} still has its own menu copy`)
}
console.log(`pages ok: ${runs} page states rendered against site-data.json`)

// The long-history section shows the history file's own numbers, and the Data page credits the source
{
  const C = load('Backtesting'); const c = new C(); c.props = {}; c.state = { D, H }
  const v = c.renderVals(), s5 = H.result.by_slip['5']
  assert.equal(v.hist.show, true)
  assert.equal(v.hist.kpis[0].value, String(s5.n))
  assert.equal(v.hist.years.length, H.result.years.length)
  assert.equal(v.hist.pairs.length, 3)
  const D2 = new (load('Data'))(); D2.props = {}; D2.state = { D, H }
  const w = D2.renderVals()
  assert.equal(w.hx.show, true)
  assert.equal(w.hx.facts[2].value, String(H.check.mismatches))
  assert.match(w.hx.intro, /data-book team/)
}

// Long charts: All starts at the first week of the shared book, 10Y about ten years back, and both end on our last day
{
  const first = (s) => { const [y, m, d] = s.split('-'); return +d + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1] + ' ' + y }
  const Hm = new (load('Home'))(); Hm.props = {}; Hm.state = { D, H, range: 'All' }
  const a = Hm.renderVals().chart
  assert.equal(a.start, first(H.long.d[0])); assert.equal(a.end, first(D.asOf)); assert.equal(a.hasNote, true)
  const Mk = new (load('Market'))(); Mk.props = {}; Mk.state = { D, H, range: '10Y' }
  const f = Mk.renderVals().four
  assert.ok(+f.start.slice(-4) === +D.asOf.slice(0, 4) - 10, '10Y starts ten years back: ' + f.start)
  assert.equal(f.end, first(D.asOf))
  const M0 = new (load('Market'))(); M0.props = {}; M0.state = { D, range: 'All' }
  assert.equal(M0.renderVals().ranges.length, 3)   // without the history file the long ranges are hidden
}

// Full-history views: every chart that has a 2011-2023 part starts on the book's first day and ends on our last day,
// and the clean-test part adds up to the published clean-test result
{
  const L = D.longrun
  let total = 0
  for (const pair of ['M_PETAL', 'M_GUINEA', 'GUINEA_PETAL']) {
    const p = new (load('Pairs'))(); p.props = {}; p.state = { D, HC, pair }
    const ch = p.renderVals().chart
    assert.equal(ch.dates[0], HC.pairs[pair].d[0]); assert.equal(ch.dates[ch.dates.length - 1], D.asOf)
    assert.equal(ch.markers.length, HC.pairs[pair].trades['5'].length + D.pairs[pair].trades.length)
    const b = new (load('Backtesting'))(); b.props = {}; b.state = { D, HC, pair, slip: '5' }
    const eq = b.renderVals().eq
    assert.equal(eq.dates[0], HC.from)
    const clean = HC.pairs[pair].trades['5'].reduce((a, t) => a + t[5], 0)
    const ours = D.backtest[pair]['5'].curve.reduce((a, c) => a + c[2], 0)
    assert.ok(Math.abs(eq.series[0].values[eq.series[0].values.length - 1] - (clean + ours)) < 2, pair + ' running total carries on from the clean test')
    total += clean
  }
  assert.ok(Math.abs(total - L.net) < 80, 'clean-test trades add up to the published result: ' + total + ' vs ' + L.net)
  const g = new (load('Pairs'))(); g.props = {}; g.state = { D, HC, pair: 'M_TEN' }
  const gv = g.renderVals().chart
  assert.equal(gv.hasSpans, false); assert.match(gv.spanNote, /first trading day/)
  const m = new (load('Market'))(); m.props = {}; m.state = { D, HC }
  const vs = m.renderVals().vsm
  assert.ok(vs.dates[0] <= '2011-04-19' && vs.dates[vs.dates.length - 1] === D.asOf)
  assert.ok(vs.series[0].values.slice(0, 100).every((v) => v == null), 'GOLDTEN has no line before it was listed')
  const t = new (load('Today'))(); t.props = {}; t.state = { D, HC }
  const r = t.renderVals().replay
  assert.equal(r.max, HC.replay.d.length + D.replay.d.length - 1)
  assert.match(r.title, /Replay 15 years/)
}
console.log('full-history charts ok')

// Try your own rule: the published setting for all pairs adds up to the published results, period by period
{
  const x = new (load('Explore'))(); x.props = {}; x.state = { D, E }
  const v = x.renderVals()
  const cur = D.rule.current['5'], L = D.longrun
  const want = L.net + Object.keys(D.backtest).reduce((a, p) => a + D.backtest[p]['5'].train.net_rs + D.backtest[p]['5'].test.net_rs, 0)
  const got = +v.res.total.replace(/[^0-9]/g, '') * (v.res.total.startsWith('−') ? -1 : 1)
  assert.ok(Math.abs(got - want) <= 12, 'published total ' + got + ' vs ' + want)
  assert.equal(v.modeLabel, 'Published rule')
  assert.match(v.periods[0].detail, new RegExp('^' + L.n + ' trades'))
  assert.equal(v.years.n, E.years.length)
  const c = new (load('Explore'))(); c.props = {}; c.state = { D, E, pub: '0', ze: '3.0' }
  const w = c.renderVals()
  assert.equal(w.modeLabel, 'Your settings'); assert.match(w.res.compare, /published rule/)
  const g = new (load('Explore'))(); g.props = {}; g.state = { D, E, xpair: 'M_TEN' }
  assert.equal(g.renderVals().periods[0].net, 'GOLDTEN not listed yet')
}
console.log('explorer ok')

// ---------------------------------------------------------------------------------------------
// Guard: a part of the study must never stand in for the whole (Oct-2026 review, twice reported).
// The study runs 2011 to today. The 12-month test year and our own 3-year MCX download are parts of it:
// they may be shown, but always named as parts, never as the headline result or the dataset size.
{
  const PAGES = ['Home', 'Today', 'Market', 'Pairs', 'Signals', 'Backtesting', 'Explore', 'Data', 'DownloadPanel']
  // 1) phrases that presented a part as the whole, in the page files themselves
  const BANNED = [/On the 12-month test year/, /Trades in the test year/, /Results on the test year/, /Training period, for comparison/,
    /tested it on the next twelve months/, /'daily settlements checked'/, /'Everything'\]/, /Backtest on the test year/]
  for (const name of PAGES) {
    const src = readFileSync(`public/pages/${name}.dc.html`, 'utf8')
    for (const re of BANNED) assert.ok(!re.test(src), `${name}: still says ${re}`)
  }
  // 2) rendered text: our download's row count may appear only where it is named as our download / the raw MCX file
  const ours = D.meta.rows.toLocaleString('en-IN'), L = D.longrun
  const S = { D, H, HC, R, E }
  for (const name of PAGES) {
    const c = new (load(name))(); c.props = name === 'DownloadPanel' ? { dark: true, onClose: () => {} } : {}; c.state = { ...S }
    const strs = []
    JSON.stringify(c.renderVals(), (k, x) => { if (typeof x === 'string') strs.push(x); return typeof x === 'function' ? undefined : x })
    for (const t of strs) {
      if (t === ours || t.includes(ours + ' daily') || t.includes(ours + ' rows')) {
        assert.ok(/download|MCX file|raw MCX|history book|our own|Oct 2023/i.test(t), `${name}: shows ${ours} (our download only) without saying so: "${t.slice(0, 120)}"`)
      }
      assert.ok(!/^\d+ trades in the test year$/.test(t), `${name}: test-year trade count used as a headline: "${t}"`)
    }
  }
  // 3) the headline numbers themselves cover every year
  const dv = new (load('Data'))(); dv.props = {}; dv.state = { D, H }
  const dvals = dv.renderVals()
  assert.equal(dvals.big[0].value, L.allRows.toLocaleString('en-IN'), 'Data page leads with every daily price since 2011')
  assert.equal(dvals.big[2].value, L.allDays.toLocaleString('en-IN'))
  assert.match(dvals.big[0].note, new RegExp(L.rows.toLocaleString('en-IN') + '.*' + ours))
  for (const pair of ['M_PETAL', 'M_GUINEA', 'GUINEA_PETAL']) {
    const pg = new (load('Pairs'))(); pg.props = {}; pg.state = { D, HC, pair }
    const v = pg.renderVals()
    assert.match(v.sumTitle, /^This pair, Apr 2011 – Oct 2026$/)
    const n = HC.pairs[pair].trades['5'].length + D.pairs[pair].trades.length
    assert.equal(v.testKpis[0].value, String(n), pair + ': headline trade count covers every year')
    assert.equal(v.periods[0].name, 'Clean test')
    const b = new (load('Backtesting'))(); b.props = {}; b.state = { D, HC, pair, slip: '5' }
    const k = b.renderVals().kpis
    assert.equal(k[0].label, 'Trades, 2011–2026'); assert.equal(k[0].value, String(HC.pairs[pair].trades['5'].length + D.backtest[pair]['5'].train.n_trades + D.backtest[pair]['5'].test.n_trades))
  }
  // without the 2011-2023 file the totals wait ("…"); they never fall back to the test year alone
  const pw = new (load('Pairs'))(); pw.props = {}; pw.state = { D, pair: 'M_PETAL' }
  assert.equal(pw.renderVals().testKpis[0].value, '…')
  const bw = new (load('Backtesting'))(); bw.props = {}; bw.state = { D, pair: 'M_PETAL' }
  assert.equal(bw.renderVals().kpis[0].value, '…')
  console.log('partial-period guard ok')
}

// New features: trade story, compare periods, compare pairs, next step, how we know
{
  const pg = new (load('Pairs'))(); pg.props = {}; pg.state = { D, HC, pair: 'M_PETAL' }
  const t0 = HC.pairs.M_PETAL.trades['5'][0]
  pg.state.story = t0[0] + '|' + t0[1]
  const sv = pg.renderVals().story
  assert.equal(sv.on, true); assert.equal(sv.steps.length, 4); assert.ok(sv.dates.length > 10 && sv.markers.length === 2)
  assert.match(sv.sub, /clean test/)
  const ours = D.pairs.M_PETAL.trades[0]; pg.state.story = ours.sig + '|' + ours.e
  assert.equal(pg.renderVals().story.on, true)
  const b = new (load('Backtesting'))(); b.props = {}; b.state = { D, HC, R, cmpA: 'clean', cmpB: 'exc', mpSel: 'M_PETAL,M_TEN' }
  const v = b.renderVals()
  assert.equal(v.cmp.rows[0].a, String(L_N()))
  assert.equal(v.cmp.nameB, 'Test year without the crash')
  assert.equal(v.cmp.rows[0].b, String(D.rule.current['5'].ex_crash_n))
  assert.equal(v.mp.series.length, 2); assert.equal(v.mp.dates[0], HC.from)
  const mpl = v.mp.series[0].values; assert.ok(Math.abs(mpl[mpl.length - 1] - (HC.pairs.M_PETAL.trades['5'].reduce((a, t) => a + t[5], 0) + D.backtest.M_PETAL['5'].curve.reduce((a, c) => a + c[2], 0))) < 3)
  const tv = new (load('Today'))(); tv.props = {}; tv.state = { D, HC }
  const nx = tv.renderVals().next
  assert.match(nx.fresh, /not a live feed/); assert.match(nx.text, /Since Apr 2011/)
  const dv = new (load('Data'))(); dv.props = {}; dv.state = { D, H }
  const hw = dv.renderVals().how
  assert.equal(hw[0].value, D.longrun.allRows.toLocaleString('en-IN')); assert.ok(hw.length >= 5)
  console.log('new features ok')
}
function L_N() { return D.longrun.n }
