const puppeteer = require('puppeteer-core');
const fs = require('fs');

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const routes = [
  { name: 'Overview', path: '#/overview', expectedText: 'Executive Relative-Value Overview' },
  { name: 'Market Analysis', path: '#/market-analysis', expectedText: 'Market Structure & Spread Regimes' },
  { name: 'Signals', path: '#/signals', expectedText: 'Signal Intelligence & Gate Verification' },
  { name: 'Backtesting', path: '#/backtesting', expectedText: 'Walk-Forward Verification & Attribution' },
  { name: 'Methodology', path: '#/methodology', expectedText: 'Data Provenance, Pipeline Architecture & Integrity' },
];

async function main() {
  console.log(`Using browser at: ${CHROME_PATH}`);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const errors = [];
  page.on('pageerror', (err) => {
    console.error(`[PAGE ERROR]: ${err.message}`);
    errors.push(`PAGE ERROR: ${err.message}`);
  });

  page.on('response', (res) => {
    if (res.status() >= 400) {
      console.error(`[HTTP ${res.status()}]: ${res.url()}`);
      errors.push(`HTTP ${res.status()}: ${res.url()}`);
    }
  });

  page.on('requestfailed', (req) => {
    console.error(`[REQUEST FAILED]: ${req.url()} (${req.failure()?.errorText})`);
    errors.push(`REQUEST FAILED: ${req.url()}`);
  });

  const baseUrl = 'http://localhost:4173';
  let allPassed = true;

  for (const route of routes) {
    const url = `${baseUrl}/${route.path}`;
    console.log(`\nTesting ${route.name} (${url})...`);
    const routeErrorsBefore = errors.length;

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
    // Additional wait to let react render and state settle
    await new Promise((r) => setTimeout(r, 1500));

    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasExpectedText = bodyText.includes(route.expectedText);
    const isBlank = bodyText.trim().length === 0;

    const newErrors = errors.slice(routeErrorsBefore);

    if (isBlank) {
      console.error(`❌ FAILED: ${route.name} page is blank!`);
      allPassed = false;
    } else if (!hasExpectedText) {
      console.error(`❌ FAILED: ${route.name} missing expected text "${route.expectedText}"!`);
      console.log(`Page text preview: ${bodyText.slice(0, 300)}...`);
      allPassed = false;
    } else if (newErrors.length > 0) {
      console.error(`❌ FAILED: ${route.name} had ${newErrors.length} console/page error(s)!`);
      allPassed = false;
    } else {
      console.log(`✅ PASSED: ${route.name} rendered cleanly with 0 errors.`);
      console.log(`   Text sample: ${bodyText.slice(0, 150).replace(/\n/g, ' ')}...`);
    }
  }

  await browser.close();

  if (!allPassed || errors.length > 0) {
    console.error(`\n❌ VERIFICATION FAILED with ${errors.length} total error(s).`);
    process.exit(1);
  } else {
    console.log('\n🎉 ALL 5 PAGES VERIFIED WITH ZERO ERRORS!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
