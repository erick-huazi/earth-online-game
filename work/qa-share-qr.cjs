'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

async function check() {
  const browser = await chromium.launch({channel: process.env.PLAYWRIGHT_CHANNEL});
  try {
    const page = await browser.newPage({viewport:{width:320,height:800},reducedMotion:'reduce'});
    const remoteRequests = [];
    page.on('request', request => {
      if (/^https?:/.test(request.url())) remoteRequests.push(request.url());
    });
    await page.context().setOffline(true);
    await page.goto(pathToFileURL(path.resolve(__dirname, '../outputs/earth-online-game.html')).href);
    await page.locator('#exp-begin').click();
    const stage = page.locator('#exp-stage');
    for (let i = 0; i < 45 && !await stage.locator('.exp-ending').count(); i++)
      await stage.locator('[data-route], [data-option], [data-relic], :scope > button.primary').first().click();
    const share = page.getByRole('button', {name:/生成我的山河战报/});
    await share.click();
    const panel = page.locator('#exp-qr');
    await panel.locator('summary').click();
    await page.addScriptTag({path:require.resolve('jsqr')});
    for (const [kind, source, prefix] of [['replay','#exp-replay-link','#replay='], ['challenge','#exp-share-link','#run=']]) {
      await panel.locator('select').selectOption(kind);
      const wanted = await page.locator(source).inputValue();
      assert.equal(new URL(wanted).protocol,'https:');
      assert(new URL(wanted).hash.startsWith(prefix));
      // Decode the saved PNG itself rather than testing the string sent to the QR encoder.
      const screenshot = await page.locator('#exp-qr-image').screenshot();
      const decoded = await page.locator('#exp-qr-save').evaluate(async (link, display) => {
        async function read(source) {
          const img = new Image();
          img.src = source;
          await img.decode();
          const cv = document.createElement('canvas');
          cv.width = img.width; cv.height = img.height;
          const ctx = cv.getContext('2d');
          ctx.drawImage(img,0,0);
          return jsQR(ctx.getImageData(0,0,cv.width,cv.height).data,cv.width,cv.height)?.data;
        }
        return Promise.all([read(link.href), read(display)]);
      }, 'data:image/png;base64,' + screenshot.toString('base64'));
      assert.deepEqual(decoded,[wanted,wanted]);
      console.log('PASS 离线生成并独立解码 '+kind+' 二维码 PNG');
    }
    await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
    const issues = await page.evaluate(async () => (await axe.run('#exp-qr')).violations.flatMap(v => v.nodes.map(n => ({rule:v.id, target:n.target, summary:n.failureSummary}))));
    assert.deepEqual(issues, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    await page.locator('#exp-share-close').click();
    await share.click();
    assert.equal(await panel.evaluate(el => el.open),false);
    assert.equal(await panel.locator('select').inputValue(),'replay');
    assert.deepEqual(remoteRequests,[]);
  } finally { await browser.close(); }
}
check().catch(error => { console.error(error); process.exitCode = 1; });
