// scripts/screenshot-opt-in.js
//
// Generates two PNGs of the SMS-consent block on the quote form for the
// Twilio A2P 10DLC (error 30909) campaign verification:
//
//   site/assets/sms-opt-in-step3-full.png       Full quote-form card on Step 3
//   site/assets/sms-opt-in-checkbox-closeup.png Tight crop of the consent block
//
// Spins up a small Node static-file server rooted at ./site on port 8080,
// drives the quote form through Steps 1 & 2 in Chromium, then captures
// Step 3 in its default (unchecked) state without submitting.
//
// Re-run with:  npm run screenshot:opt-in
//          or:  node scripts/screenshot-opt-in.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PORT = 8080;
const SITE_DIR = path.resolve(__dirname, '..', 'site');
const OUT_DIR = path.join(SITE_DIR, 'assets');
const FULL_PNG = path.join(OUT_DIR, 'sms-opt-in-step3-full.png');
const CLOSEUP_PNG = path.join(OUT_DIR, 'sms-opt-in-checkbox-closeup.png');

const MIME = {
  '.html': 'text/html;charset=utf-8',
  '.css':  'text/css;charset=utf-8',
  '.js':   'text/javascript;charset=utf-8',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',  '.jpeg': 'image/jpeg',
  '.ico':  'image/x-icon',
  '.xml':  'application/xml',
  '.txt':  'text/plain',
  '.woff2':'font/woff2',  '.woff': 'font/woff',
};

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
      const fp = path.normalize(path.join(SITE_DIR, urlPath));
      // Block path traversal outside the site directory
      if (!fp.startsWith(SITE_DIR)) { res.statusCode = 403; return res.end(); }
      fs.stat(fp, (err, st) => {
        if (err || !st.isFile()) { res.statusCode = 404; return res.end('Not found'); }
        const ext = path.extname(fp).toLowerCase();
        res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
        fs.createReadStream(fp).pipe(res);
      });
    });
    server.on('error', reject);
    server.listen(PORT, () => resolve(server));
  });
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const server = await startServer();
  console.log(`[serve] http://localhost:${PORT} → ${SITE_DIR}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // 2× for crisp Retina-quality screenshots
  });

  // The site-wide lead-capture popup (site/assets/site.js) opens 3s after
  // load and would obscure the form. It gates on this sessionStorage key,
  // so we set it before any page script runs.
  await context.addInitScript(() => {
    try { sessionStorage.setItem('rfs_lead_modal_dismissed_v1', '1'); } catch (e) {}
  });

  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/quote.html`, { waitUntil: 'networkidle' });

  // ---- STEP 1 ----
  // Service-type buttons are <button class="opt"> with data-val attributes.
  // data-val is the most stable selector: it matches the human label exactly
  // and is what the existing quote-form JS already keys off of.
  await page.locator('button.opt[data-val="Recurring janitorial"]').click();
  // Step auto-advances ~200ms after click (see quote.html setTimeout).
  await page.waitForSelector('fieldset.qstep.active[data-step="2"]', { timeout: 5000 });

  // ---- STEP 2 ----
  // All Step-2 fields have id attributes — using IDs directly.
  await page.locator('#facility').selectOption({ label: 'Office' });
  await page.locator('#sqft').fill('5000');
  await page.locator('#frequency').selectOption({ label: 'Weekly' });
  await page.locator('#window').selectOption({ label: 'After hours / overnight' });
  await page.locator('#extras').fill(
    'Two restrooms, polished concrete on the warehouse floor, badge access required.'
  );

  await page.locator('#nextBtn').click();
  await page.waitForSelector('fieldset.qstep.active[data-step="3"]', { timeout: 5000 });

  // Leave the SMS checkbox UNCHECKED (the default state — this is what
  // Twilio's reviewer needs to see) and do NOT submit the form.

  // Scroll the form into view for consistent framing across runs.
  await page.locator('#quoteForm').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400); // settle any scroll animation

  // ---- Screenshot 1: full quote-form card on Step 3 ----
  // Captures the stepper + Step 3 fields + consent block + nav buttons.
  await page.locator('#quoteForm').screenshot({ path: FULL_PNG });
  console.log(`[shot]  ${FULL_PNG}`);

  // ---- Screenshot 2: tight crop on the SMS consent block ----
  // Scope to the active Step 3 fieldset so we don't accidentally grab the
  // popup's consent-row (which is suppressed here, but be explicit anyway).
  await page.locator('fieldset.qstep.active[data-step="3"] .consent-row').screenshot({
    path: CLOSEUP_PNG,
  });
  console.log(`[shot]  ${CLOSEUP_PNG}`);

  await browser.close();
  server.close();
  console.log('[done]');
})().catch((err) => {
  console.error('[error]', err);
  process.exitCode = 1;
});
