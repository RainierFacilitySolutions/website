// scripts/verify-opt-in.js
//
// Verification harness for the new /sms-opt-in.html page. Spins up the same
// static server as the screenshot script and checks:
//
//   1. sms-opt-in.html loads with no console errors and no failed requests
//   2. Both inline screenshots resolve (HTTP 200)
//   3. Every internal link on sms-opt-in.html is reachable
//   4. The footer link to sms-opt-in.html exists and is clickable from
//      both index.html and privacy.html
//
// Run: node scripts/verify-opt-in.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PORT = 8081; // different from screenshot script in case both run
const SITE_DIR = path.resolve(__dirname, '..', 'site');

const MIME = {
  '.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8',
  '.js':'text/javascript;charset=utf-8','.json':'application/json',
  '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg',
  '.jpeg':'image/jpeg','.ico':'image/x-icon','.xml':'application/xml',
  '.txt':'text/plain','.woff2':'font/woff2','.woff':'font/woff',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
      const fp = path.normalize(path.join(SITE_DIR, urlPath));
      if (!fp.startsWith(SITE_DIR)) { res.statusCode = 403; return res.end(); }
      fs.stat(fp, (err, st) => {
        if (err || !st.isFile()) { res.statusCode = 404; return res.end('Not found'); }
        res.setHeader('Content-Type', MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream');
        fs.createReadStream(fp).pipe(res);
      });
    });
    server.listen(PORT, () => resolve(server));
  });
}

const log = (ok, msg) => console.log(`${ok ? '  ✓' : '  ✗'} ${msg}`);
let failures = 0;
const fail = (msg) => { failures++; log(false, msg); };
const pass = (msg) => log(true, msg);

(async () => {
  const server = await startServer();
  console.log(`[serve] http://localhost:${PORT} → ${SITE_DIR}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // Suppress the lead popup
  await context.addInitScript(() => {
    try { sessionStorage.setItem('rfs_lead_modal_dismissed_v1', '1'); } catch (e) {}
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('requestfailed', (r) => failedRequests.push(`${r.url()}  (${r.failure()?.errorText || 'unknown'})`));
  page.on('response', (r) => {
    // Surface 4xx / 5xx on subresources too
    if (r.status() >= 400) failedRequests.push(`${r.url()}  (HTTP ${r.status()})`);
  });

  console.log('\n[1] Load /sms-opt-in.html');
  await page.goto(`http://localhost:${PORT}/sms-opt-in.html`, { waitUntil: 'networkidle' });
  const title = await page.title();
  title.startsWith('SMS Opt-In') ? pass(`title: "${title}"`) : fail(`unexpected title: "${title}"`);
  if (consoleErrors.length === 0) pass('no console errors');
  else { fail(`${consoleErrors.length} console error(s):`); consoleErrors.forEach(e => console.log('      ', e)); }

  console.log('\n[2] Both inline screenshots resolve');
  const imgChecks = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('main img'));
    return imgs.map(i => ({
      src: i.currentSrc || i.src,
      naturalWidth: i.naturalWidth,
      naturalHeight: i.naturalHeight,
      complete: i.complete,
    }));
  });
  imgChecks.forEach(i => {
    if (i.complete && i.naturalWidth > 0) pass(`${i.src.split('/').pop()}  (${i.naturalWidth}×${i.naturalHeight})`);
    else fail(`image failed to load: ${i.src}`);
  });

  console.log('\n[3] Internal links on /sms-opt-in.html');
  const links = await page.evaluate(() => Array.from(document.querySelectorAll('main a[href]'))
    .map(a => a.getAttribute('href'))
    .filter(h => h && !h.startsWith('http') && !h.startsWith('mailto:') && !h.startsWith('tel:'))
  );
  const unique = [...new Set(links)];
  for (const href of unique) {
    const url = new URL(href, `http://localhost:${PORT}/sms-opt-in.html`);
    const res = await page.request.get(url.href);
    if (res.status() === 200) pass(`${href}  →  HTTP 200`);
    else fail(`${href}  →  HTTP ${res.status()}`);
  }

  console.log('\n[4] Footer link reachable from index and privacy');
  for (const fromPath of ['/index.html', '/privacy.html']) {
    await page.goto(`http://localhost:${PORT}${fromPath}`, { waitUntil: 'domcontentloaded' });
    const footerLink = await page.locator('footer.site-footer a[href$="sms-opt-in.html"]').first();
    if (await footerLink.count() > 0) {
      pass(`${fromPath}  footer contains SMS Opt-In link`);
      // Click and confirm landing
      await Promise.all([
        page.waitForURL('**/sms-opt-in.html'),
        footerLink.click(),
      ]);
      const ok = page.url().endsWith('/sms-opt-in.html');
      ok ? pass(`${fromPath}  link navigates correctly`) : fail(`${fromPath}  did not land on sms-opt-in.html`);
    } else {
      fail(`${fromPath}  is missing the footer link`);
    }
  }

  console.log('\n[5] Failed network requests (across full session)');
  if (failedRequests.length === 0) pass('none');
  else { fail(`${failedRequests.length} failed request(s):`); failedRequests.forEach(r => console.log('      ', r)); }

  await browser.close();
  server.close();

  console.log(failures === 0 ? '\n✅  All checks passed.' : `\n❌  ${failures} check(s) failed.`);
  process.exitCode = failures === 0 ? 0 : 1;
})().catch(err => { console.error('[error]', err); process.exit(1); });
