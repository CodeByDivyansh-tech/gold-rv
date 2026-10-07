// Runs every page's logic against the real site-data.json in many UI states.
// No dependencies: `node tests/pages.test.mjs` (or `npm test`) from frontend/.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const D = JSON.parse(readFileSync('public/data/site-data.json', 'utf8'))
const R = JSON.parse(readFileSync('public/data/robustness.json', 'utf8'))
const H = JSON.parse(readFileSync('public/data/history.json', 'utf8'))
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
  Today: [{}, { ri: 0 }, { ri: 60 }, { ri: 120, speed: 2 }],
  Market: [{}, { range: '3M', hover: 10 }, { range: '3Y', hover: 150 }, { H, range: '10Y', hover: 100 }, { H, range: 'All', hover: 1000 }, { range: '10Y' }],
  Pairs: PAIRS.flatMap((pair) => [{ pair }, { pair, hover: 20, allTrades: true }]),
  Signals: PAIRS.map((pair) => ({ pair, allPast: true })).concat([{ R }, { R, cs: '0', cb: '0', cz: '1' }, { R, cs: '', cb: 'abc', cz: '0' }, { cs: '10', cb: '50', cz: '25' }]),
  Backtesting: PAIRS.flatMap((pair) => SLIPS.map((slip) => ({ pair, slip, hover: 0 }))).concat([{ R }, { R, H }, { H, pair: 'GUINEA_TEN', slip: '10' }]),
  Data: [{}, { all: true }, { H }, { H, all: true }],
  DownloadPanel: ['today', 'prices', 'trades', 'backtest', 'report'].flatMap((what) =>
    ['3m', 'all'].map((period) => ({ what, period, pair: 'ALL' }))),
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
  assert.ok(v.ft.show && v.ft.rows.length === 4)
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
  assert.match(w.hx.intro, /Parity team/)
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
