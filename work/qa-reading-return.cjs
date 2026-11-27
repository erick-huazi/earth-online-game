'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

const output = path.resolve(__dirname, '../outputs');
const game = 'earth-online-game.html';
const manual = 'earth-online-manual.html';
const gameReturn = '#reader-game-return';
const manualReturn = '.reading-trail [data-manual-return]';

async function startServer() {
  const prefix = '/earth-online/';
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      assert(url.pathname.startsWith(prefix));
      const target = path.resolve(output, decodeURIComponent(url.pathname.slice(prefix.length)));
      assert(target.startsWith(output + path.sep) && fs.statSync(target).isFile());
      const type = {'.html': 'text/html;charset=utf-8', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png'};
      res.writeHead(200, {'Content-Type': type[path.extname(target)] || 'application/octet-stream'});
      fs.createReadStream(target).pipe(res);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  return {server, base: 'http://127.0.0.1:' + server.address().port + prefix};
}

async function check(browser, name, action) {
  const context = await browser.newContext({viewport: {width: 375, height: 812}, reducedMotion: 'reduce'});
  const errors = [];
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    await action(page, context);
    assert.deepEqual(errors, []);
    console.log('PASS', name);
  } finally {
    await context.close();
  }
}

async function urlOf(page, selector) {
  return new URL(await page.locator(selector).evaluate(link => link.href));
}

async function writeNote(page, note) {
  await page.locator('#read-guide').click();
  await page.locator('#book-note').fill(note);
  await page.locator('#read-original').click();
}

async function main() {
  const {server, base} = await startServer();
  let browser;
  try {
    const channel = process.env.PLAYWRIGHT_CHANNEL;
    browser = await chromium.launch(channel ? {channel} : {});

    await check(browser, '在线与离线手册均能从阅读备份进入辨典存档，原页保留', async (page, context) => {
      for (const root of [base, pathToFileURL(output + path.sep).href]) {
        await page.goto(root + game);
        await page.locator('#start-game').click();
        await page.locator('#quest-panel[open]').waitFor();
        await page.goto(root + manual + '#progress');
        await page.locator('#archive-tools summary').click();
        const popup = page.waitForEvent('popup');
        await page.getByRole('link', {name:/打开辨典存档/}).click();
        const archive = await popup;
        await archive.getByRole('dialog', {name:'辨典存档'}).waitFor();
        assert.equal(new URL(archive.url()).hash, '#canon-transfer');
        assert.equal(await archive.locator('#quest-panel').isVisible(), false);
        assert(await page.locator('#archive-tools').evaluate(el=>el.open));
        await archive.close();
        assert.equal(context.pages().length, 1);
      }
    });

    await check(browser, '全书与手册保留错题复习入口，在线和离线都能返回', async page => {
      const offline = pathToFileURL(output + path.sep).href;
      for (const root of [base, offline]) {
        await page.goto(root + 'html/daodejing.html?from=canon-practice#section-4');
        assert.equal((await urlOf(page, gameReturn)).href, root + game + '#canon-practice');
        assert.equal((await urlOf(page, manualReturn)).searchParams.get('from'), 'canon-practice');
        await page.locator(manualReturn).click();
        assert.equal((await urlOf(page, gameReturn)).hash, '#canon-practice');
        assert.equal((await urlOf(page, '#open-full-book')).searchParams.get('from'), 'canon-practice');
        for (const reader of [manual, 'html/daodejing.html']) {
          await page.goto(root + reader + '#recall');
          const link = page.getByRole('link', {name:'复习我的错题（新标签页）'});
          assert.equal(new URL(await link.getAttribute('href'), page.url()).href, root + game + '#canon-practice');
        }
      }
    });

    await check(browser, '远征与经典同时有进度时，阅读后回到原模式、原阶段', async (page, context) => {
      await page.goto(base + game);
      await page.locator('#exp-begin').click();
      await page.locator('[data-route]').first().click();
      const eventTitle = await page.locator('#exp-stage-title').textContent();
      await page.locator('#start-game').click();
      await page.locator('#enter-chapter').click();
      await page.locator('[data-choice]').first().click();
      const feedback = await page.locator('#choice-explanation').textContent();
      await page.locator('#quest-reading').click();
      assert.equal(new URL(page.url()).searchParams.get('from'), 'classic');
      await page.locator(gameReturn).click();
      assert.equal(new URL(page.url()).hash, '#classic-story');
      await page.locator('#next-scene').waitFor({state: 'visible'});
      assert.equal(await page.locator('#choice-explanation').textContent(), feedback);
      await page.locator('#close-quest').click();
      await page.locator('.exp-reading').click();
      assert.equal(new URL(page.url()).searchParams.get('from'), 'expedition');
      await page.locator(gameReturn).click();
      assert.equal(new URL(page.url()).hash, '#expedition');
      await page.locator('[data-option]').first().waitFor({state: 'visible'});
      assert.equal(await page.locator('#exp-stage-title').textContent(), eventTitle);
      assert.equal(await page.locator('#quest-panel').isVisible(), false);
      assert.equal(context.pages().length, 1);
    });

    for (const [label, location] of [
      ['站点子目录', base],
      ['离线文件', pathToFileURL(output + path.sep).href]
    ]) {
      await check(browser, label + '下全书、手册和当前章双向贯通', async (page, context) => {
        await page.setViewportSize({width: 320, height: 745});
        await page.goto(location + 'html/daodejing.html?from=expedition#section-4');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert((await page.locator(gameReturn).boundingBox()).height >= 44);
        await page.locator('#jump').selectOption('section-7');
        const back = await urlOf(page, manualReturn);
        assert.equal(back.searchParams.get('book'), 'daodejing');
        assert.equal(back.searchParams.get('section'), '7');
        await page.locator(manualReturn).click();
        await page.locator('#chapter-select option:checked').waitFor({state: 'attached'});
        assert.equal(await page.locator('#chapter-select').inputValue(), '7');
        assert.equal(await page.locator('.book-entry.active').getAttribute('data-book'), 'daodejing');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert((await page.locator(gameReturn).boundingBox()).height >= 44);
        await writeNote(page, '留下这一章的阅读心得');
        await page.locator('#next-section').click();
        const next = await urlOf(page, '#open-full-book');
        assert.equal(next.hash, '#section-8');
        assert.equal(next.searchParams.get('from'), 'expedition');
        await page.locator('#open-full-book').click();
        await page.waitForFunction(() => document.getElementById('jump')?.value === 'section-8');
        assert.equal(await page.locator('#jump').inputValue(), 'section-8');
        // Revealing a visible sticky link must not move the reading line.
        await page.locator(manualReturn).evaluate(async link => {
          link.scrollIntoView({block:'nearest', inline:'nearest'});
          link.focus();
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
        assert.equal(await page.locator('#jump').inputValue(), 'section-8');
        assert.equal((await urlOf(page, manualReturn)).searchParams.get('section'), '8');
        await page.locator(manualReturn).click();
        await page.locator('#chapter-select option:checked').waitFor({state: 'attached'});
        assert.equal(await page.locator('#book-note').inputValue(), '留下这一章的阅读心得');
        assert.equal(await page.locator('#chapter-select').inputValue(), '8');
        assert.equal((await urlOf(page, gameReturn)).hash, '#expedition');
        assert.equal(context.pages().length, 1);
      });
    }

    await check(browser, '普通入口保留阅读草稿和另页展开，异常地址不改变书和章节', async (page, context) => {
      await page.goto(base + manual + '?book=daodejing&section=6#reader');
      await writeNote(page, '普通手册草稿');
      const popup = context.waitForEvent('page');
      await page.locator('#open-full-book').click();
      const book = await popup;
      await book.waitForLoadState();
      assert.equal(new URL(book.url()).hash, '#section-6');
      assert.equal(await page.locator('#book-note').inputValue(), '普通手册草稿');
      await book.close();
      await page.goto(base + manual + '?book=yijing&section=999999&from=https%3A%2F%2Fexample.invalid#reader');
      assert.equal(await page.locator('.book-entry.active').getAttribute('data-book'), 'daodejing');
      assert.equal(await page.locator('#chapter-select').inputValue(), '6');
      assert.equal((await urlOf(page, gameReturn)).href, base + game);
      assert.equal((await urlOf(page, '#open-full-book')).search, '');
    });

    await check(browser, '手册无法写入存储时，展开全书保留原标签中的心得', async (page, context) => {
      await context.addInitScript(() => {
        Storage.prototype.setItem = function () { throw new DOMException('storage disabled', 'QuotaExceededError'); };
      });
      await page.goto(base + manual + '?book=daodejing&section=5&from=classic#reader');
      await writeNote(page, '尚未写入本机的阅读心得');
      const popup = context.waitForEvent('page');
      await page.locator('#open-full-book').click();
      const book = await popup;
      await book.waitForLoadState();
      assert.equal(new URL(book.url()).hash, '#section-5');
      assert.equal(await page.locator('#book-note').inputValue(), '尚未写入本机的阅读心得');
    });

    await check(browser, '游戏无法落盘时，阅读标签返回原游戏并保留选择', async (page, context) => {
      await context.addInitScript(() => {
        Storage.prototype.setItem = function () { throw new DOMException('storage disabled', 'QuotaExceededError'); };
      });
      await page.goto(base + game);
      await page.locator('#exp-begin').click();
      await page.locator('[data-route]').first().click();
      const eventTitle = await page.locator('#exp-stage-title').textContent();
      const popup = context.waitForEvent('page');
      await page.locator('.exp-reading').click();
      const book = await popup;
      await book.waitForLoadState();
      assert.equal(new URL(book.url()).searchParams.get('gameTab'), 'kept');
      const closed = book.waitForEvent('close');
      await book.getByRole('button', {name: '回到游戏标签页'}).click();
      await closed;
      assert.equal(await page.locator('#exp-stage-title').textContent(), eventTitle);
      assert.equal(context.pages().length, 1);

      const manualPopup = context.waitForEvent('page');
      await page.locator('.topbar a[href*="earth-online-manual"]').click();
      const reader = await manualPopup;
      await writeNote(reader, '留在本标签的心得');
      await reader.getByRole('button', {name: '回到游戏标签页'}).click();
      assert.match(await reader.locator('#live-message').textContent(), /切回原游戏标签页/);
      assert.equal(await reader.locator('#book-note').inputValue(), '留在本标签的心得');
      assert.equal(context.pages().length, 2);
    });
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
