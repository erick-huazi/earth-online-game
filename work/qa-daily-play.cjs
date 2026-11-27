'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

const outputs = path.resolve(__dirname, '../outputs');
const game = 'earth-online-game.html';
const day = '2026-11-25';
const storageKey = 'earth-online-daily-canon-v1:' + day;
const oldSlots = ['earth-online-game-v1','earth-online-expedition-v2','earth-online-clippings-v1'];
const dated = (base, date = day) => base + game + '?day=' + date + '#daily-canon';
const snapshot = page => page.evaluate(keys => keys.map(k => localStorage.getItem(k)), oldSlots);
const focused = locator => locator.evaluate(el => document.activeElement === el);

async function checkDialogAccess(page) {
  if (!await page.evaluate(() => Boolean(window.axe))) {
    await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  }
  const issues = await page.evaluate(async () => {
    const {violations} = await axe.run('#canon-dialog',{runOnly:{
      type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22a','wcag22aa','best-practice']
    }});
    return violations.map(v => [v.id,v.nodes.map(node=>[node.target,node.failureSummary])]);
  });
  assert.deepEqual(issues,[]);
}

async function serve() {
  const prefix = '/game-test/';
  const server = http.createServer((req,res) => {
    const route = new URL(req.url,'http://localhost').pathname;
    const file = path.resolve(outputs, '.' + route.slice(prefix.length - 1));
    if (!route.startsWith(prefix) || !file.startsWith(outputs + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end();return;
    }
    res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  return {server,base:'http://127.0.0.1:'+server.address().port+prefix};
}

async function main() {
  const {server,base} = await serve();
  const browser = await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || undefined});
  const errors = [];
  try {
    const context = await browser.newContext({viewport:{width:320,height:720},reducedMotion:'reduce'});
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base+game);
    await page.locator('#start-game').click();
    await page.locator('#quest-panel[open]').waitFor();
    await page.evaluate(() => localStorage.setItem('earth-online-clippings-v1','{"version":1,"entries":[]}'));
    const original = await snapshot(page);
    assert(original[0]);
    await page.goto(dated(base));
    await page.locator('#canon-dialog[open]').waitFor();
    assert(!await page.locator('#quest-panel').evaluate(el=>el.open));
    assert(await focused(page.locator('#canon-quote')));
    const cards = await page.evaluate(date => EarthDailyCanon.questions(date),day);
    for (const width of [320,768,1280]) {
      await page.setViewportSize({width,height:720});
      assert(await page.locator('#canon-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth && el.getBoundingClientRect().right<=innerWidth));
    }
    await page.setViewportSize({width:320,height:720});
    await checkDialogAccess(page);
    const choices = [cards[0].options.find(id=>id!==cards[0].bookId), ...cards.slice(1).map(card=>card.bookId)];
    for (const [i,card] of cards.entries()) {
      assert.equal(await page.locator('#canon-quote').textContent(),card.prompt);
      assert.equal(await page.locator('#canon-edition').textContent(),'简体题面');
      await page.keyboard.press(String(card.options.indexOf(choices[i])+1));
      await page.locator('#canon-feedback:focus').waitFor();
      assert.equal(await page.locator('#canon-quote').textContent(),card.text);
      assert.equal(await page.locator('#canon-edition').textContent(),'馆藏原文');
      const action = page.locator('#canon-source .canon-link-action');
      assert(await action.evaluate(el=>{
        const range=document.createRange();
        range.selectNodeContents(el);
        return range.getClientRects().length === 1 && el.getBoundingClientRect().right <= innerWidth;
      }));
      assert.equal(await page.locator('[data-canon-choice]:disabled').count(),3);
      if (!i) {
        await page.reload();
        await page.locator('#canon-feedback:focus').waitFor();
        await checkDialogAccess(page);
        const href = new URL(await page.locator('#canon-source').getAttribute('href'));
        assert(href.pathname.startsWith('/game-test/html/'));
        assert.equal(href.searchParams.get('day'),day);
        const popupWait = page.waitForEvent('popup');
        await page.locator('#canon-source').click();
        const book = await popupWait;
        await book.waitForFunction(quote=>getSelection().toString()===quote,card.text);
        await book.close();
      }
      await page.locator('#canon-next').click();
      await page.locator(i===cards.length-1 ? '#canon-summary:focus' : '#canon-quote:focus').waitFor();
    }
    assert.equal(await page.locator('#canon-summary').textContent(),'答对 4 / 5 题');
    await page.locator('#canon-review').click();
    assert.deepEqual(await page.locator('#canon-answers blockquote').allTextContents(),cards.map(card=>card.text));
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('blocked');}}}));
    await page.locator('#canon-copy').click();
    await page.locator('#canon-share-text:focus').waitFor();
    await checkDialogAccess(page);
    const share = await page.locator('#canon-share-text').inputValue();
    assert(share.includes('?day='+day+'#daily-canon') && share.includes('https://'));
    for (const card of cards) assert(!share.includes(card.text) && !share.includes(card.prompt));
    assert(!/道德经|庄子|周易|bookId|answers/.test(share));
    await page.keyboard.press('Escape');
    await page.locator('#canon-dialog').waitFor({state:'hidden'});
    assert(await focused(page.locator('#canon-entry')));
    await page.locator('#canon-entry').click();
    await page.locator('#canon-quote:focus').waitFor();
    assert((await page.locator('#canon-date').textContent()).startsWith(await page.evaluate(()=>EarthDailyCanon.today())));
    await page.goto(dated(base));
    await page.locator('#canon-summary:focus').waitFor();
    assert.deepEqual(await snapshot(page),original);
    console.log('PASS 五次首答、刷新续局、精确原文跳转、战绩回看与无剧透分享；经典未完成档及旧日进度保持完整');

    // Two genuine same-origin pages try to score a different first answer.
    const otherDate = '2026-11-24';
    const second = await context.newPage();
    await Promise.all([page.goto(dated(base,otherDate)),second.goto(dated(base,otherDate))]);
    const left=page.locator('[data-canon-choice]').first(), right=second.locator('[data-canon-choice]').last();
    await Promise.all([left.evaluate(el=>el.click()),right.evaluate(el=>el.click())]);
    for (const p of [page,second]) await p.locator('#canon-verdict:visible').waitFor();
    const readState = () => page.evaluate(date=>JSON.parse(localStorage.getItem('earth-online-daily-canon-v1:'+date)),otherDate);
    const first = await readState();
    assert.equal(first.answers.length,1);
    assert.equal(await page.locator('#canon-feedback').textContent(),await second.locator('#canon-feedback').textContent());
    await Promise.all([page.locator('#canon-next').evaluate(el=>el.click()),second.locator('#canon-next').evaluate(el=>el.click())]);
    for (const p of [page,second]) await p.locator('#canon-progress').filter({hasText:'第 2 / 5 题'}).waitFor();
    assert.deepEqual((await readState()).answers,first.answers);
    assert.equal((await readState()).index,1);
    assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).index,storageKey),5);
    console.log('PASS 同日双标签同时作答及推进只登记一次，旧日与其他日期隔离');
    await context.close();

    const offline = await browser.newContext({offline:true,viewport:{width:320,height:600}});
    await offline.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('denied','SecurityError');}}));
    const file = await offline.newPage();
    file.on('pageerror',e=>errors.push(e.message));
    await file.goto(pathToFileURL(path.join(outputs,game)).href);
    await file.locator('#canon-entry').click();
    await file.locator('#canon-quote:focus').waitFor();
    for (let i=0;i<5;i++) {
      await file.keyboard.press('1');
      await file.locator('#canon-feedback:focus').waitFor();
      await file.locator('#canon-next').press('Enter');
      await file.locator(i===4?'#canon-summary:focus':'#canon-quote:focus').waitFor();
    }
    assert(await file.locator('#canon-storage').isVisible());
    await file.keyboard.press('Escape');
    await file.locator('#canon-dialog').waitFor({state:'hidden'});
    await file.locator('#canon-entry').press('Enter');
    await file.locator('#canon-summary:focus').waitFor();
    assert((await file.locator('#canon-share-text').inputValue()).includes('https://'));
    assert(!(await file.locator('#canon-share-text').inputValue()).includes('file:'));
    await offline.close();
    assert.deepEqual(errors,[]);
    console.log('PASS file:// 断网及存储被拒时可键盘通关，关闭后能回看，分享链接可公开使用');
  } finally {
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
