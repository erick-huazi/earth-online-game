'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const vm = require('node:vm');
const base = pathToFileURL(path.resolve(__dirname, '../outputs') + path.sep).href;
const manual = base + 'earth-online-manual.html?book=daodejing&section=0#from-reading';
const records = page => page.evaluate(() => earthBookmarkStore.readForExport());

async function storeIsolation() {
  const normalKey = 'earth-online-bookmarks-v1', clipKey = 'earth-online-clippings-v1';
  const data = new Map();
  let fail = '';
  const sandbox = vm.createContext({localStorage: {
    getItem: key => data.get(key) ?? null, removeItem: key => data.delete(key),
    setItem: (key, value) => { if (key === fail) throw Error('Quota'); data.set(key, value); }
  }});
  for (const file of ['quote-anchor.js', 'bookmark-store.js'])
    vm.runInContext(await fs.readFile(path.join(__dirname, file), 'utf8'), sandbox);
  const options = {books: [{id: 'book', sectionCount:510}]};
  const first = sandbox.createBookmarkStore(options), second = sandbox.createBookmarkStore(options);
  const book = {bookId:'book', section:0, title:'测试', excerpt:'道', textOffset:0, createdAt:1, updatedAt:1};
  const clip = {...book, kind:'clip', anchor:sandbox.EarthQuoteAnchor.capture('道可道', 0, 1)};
  first.upsert(book);
  first.upsert(clip);
  second.upsert({...clip, textOffset:2, anchor:sandbox.EarthQuoteAnchor.capture('道可道', 2, 3)});
  // A v2.4 tab writes its chapter-only snapshot back to the original key.
  assert.equal(JSON.parse(data.get(normalKey)).entries.length, 1);
  data.set(normalKey, JSON.stringify({version:1, entries:[{...book, section:4}]}));
  assert.equal(first.read().filter(e => e.kind === 'clip').length, 2);
  assert.equal(first.read().find(e => !e.kind).section, 4);
  const original = new Map(data);
  fail = clipKey;
  first.remove('book', 0, clip.anchor);
  assert.equal(first.hasPendingChanges(), true);
  assert.equal(first.upsert(book).persisted, false);
  assert.deepEqual(data, original); // The first key was rolled back after the second key failed.
  assert.equal(second.read().length, 3);
  assert.equal(first.readForExport().filter(e => e.kind === 'clip').length, 1);
  fail = '';
  first.upsert(book);
  assert.equal(first.hasPendingChanges(), false);
  assert.equal(second.read().filter(e => e.kind === 'clip').length, 1);
  // V2.4 can fill all 500 legacy slots while a clip exists. A display limit
  // must never discard the 501st entry when backing up or resolving capacity.
  data.set(normalKey, JSON.stringify({version:1, entries:Array.from({length:500}, (_, section) => ({...book, section}))}));
  assert.equal(first.read().length, 500);
  assert.equal(first.readForExport().length, 501);
  assert.equal(first.upsert(book).reason, 'capacity');
  assert.equal(first.remove('book', 499).persisted, true);
  assert.equal(second.readForExport().length, 500);
  assert.equal(second.read().filter(e => e.kind === 'clip').length, 1);
  console.log('PASS v2.4 key isolation, separate tabs, multi-key quota rollback, conflicting capacity and recovery');
}

async function selectRange(element, start, end) {
  return element.evaluate((body, [start, end]) => {
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let seen = 0, node, started = false;
    while ((node = walker.nextNode())) {
      if (!started && start < seen + node.length) {
        range.setStart(node, start - seen);
        started = true;
      }
      if (started && end <= seen + node.length) {
        range.setEnd(node, end - seen);
        const selection = getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        return selection.toString();
      }
      seen += node.length;
    }
    throw Error('Selection outside chapter');
  }, [start, end]);
}

async function panel(page) {
  const panel = page.locator('[data-bookmark-panel]');
  if (!await panel.evaluate(node => node.open)) await panel.locator('summary').click();
}

async function located(page, exact, selector) {
  await page.waitForFunction(({exact, selector}) => {
    const selected = getSelection();
    return selected.rangeCount > 0 && selected.toString() === exact &&
      document.querySelector(selector)?.contains(selected.getRangeAt(0).startContainer);
  }, {exact, selector}, {timeout: 8000});
}

async function readBackup(page, selector) {
  const download = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await fs.readFile(await (await download).path(), 'utf8'));
}

async function saveSelections(page) {
  await page.goto(manual);
  const body = page.locator('#fulltext-content');
  await page.locator('[data-bookmark-add]').click();
  const text = await body.textContent();
  const repeat = text.indexOf('道', 1);
  assert(repeat > 0);
  for (const start of [0, repeat, repeat]) {
    await selectRange(body, start, start + 1);
    await page.locator('[data-clip-add]').click();
  }
  assert.equal((await records(page)).length, 3);
  assert.deepEqual((await records(page)).filter(e => e.kind).map(e => e.anchor.start), [0, repeat]);
  await panel(page);
  await page.locator('[data-clip-open]').first().click();
  await located(page, '道', '#fulltext-content');
  assert.equal(await page.evaluate(() => getSelection().getRangeAt(0).startOffset), repeat);
  await page.locator('[data-clip-remove]').first().click();
  assert.equal((await records(page)).length, 2);
  await page.locator('[data-bookmark-undo]').click();
  assert.equal((await records(page)).length, 3);
  await page.reload();
  assert.equal((await records(page)).length, 3);
  // Searching paints multiple nodes; the quote must still use chapter offsets.
  const tools = page.locator('#reading-tools');
  if (!await tools.evaluate(node => node.open)) await tools.locator('summary').click();
  await page.locator('#book-search').fill('道');
  await page.locator('button.search-result').first().click();
  assert(await body.locator('mark').count() > 1);
  const quote = await selectRange(body, 1, 15);
  await page.locator('[data-clip-add]').focus();
  await page.locator('[data-clip-add]').press('Enter');
  assert((await records(page)).some(e => e.anchor?.exact === quote));
  await panel(page);
  const popup = page.waitForEvent('popup');
  await page.locator('.clipping-row').filter({hasText:quote}).locator('[data-clip-other]').click();
  const full = await popup;
  await located(full, quote, '#section-0 .prose');
  assert.equal(new URL(full.url()).search, '');
  await full.close();
  console.log('PASS legacy bookmark + multiple clips, repeat save, remove/undo, reload, keyboard save across search marks, offline manual → book');
}

async function noStorage(browser) {
  const context = await browser.newContext({offline:true, viewport:{width:320,height:720}});
  try {
    await context.addInitScript(() => {
      for (const name of ['getItem', 'setItem']) Storage.prototype[name] = () => { throw new Error('Offline storage unavailable'); };
    });
    const page = await context.newPage();
    await page.goto(base + 'html/daodejing.html?from=expedition#section-5');
    const body = page.locator('#section-7 .prose');
    const quote = await selectRange(body, 1, 10);
    await page.locator('[data-clip-add]').click();
    assert.equal((await records(page))[0].section, 7);
    await panel(page);
    await page.locator('[data-bookmark-status]').filter({hasText:'暂存'}).waitFor();
    const archive = await readBackup(page, '[data-bookmark-export]');
    assert.equal(archive.bookmarks[0].anchor.exact, quote);
    const popup = page.waitForEvent('popup');
    await page.locator('[data-clip-other]').click();
    const destination = await popup;
    await located(destination, quote, '#fulltext-content');
    assert.equal(await destination.locator('#chapter-select').inputValue(), '7');
    assert.equal(new URL(destination.url()).searchParams.get('from'), 'expedition');
    assert.equal((await records(destination)).length, 0);
    assert.equal((await records(page)).length, 1);
    await page.evaluate(() => {
      const a = document.querySelector('#section-0 .prose'), b = document.querySelector('#section-1 .prose');
      const r = document.createRange(); r.setStart(a.firstChild, 0); r.setEnd(b.firstChild, 2);
      getSelection().removeAllRanges(); getSelection().addRange(r);
    });
    await page.locator('[data-clip-add]').click();
    assert.equal((await records(page)).length, 1);
    await page.locator('[data-bookmark-status]').filter({hasText:'同一节'}).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const box = await page.locator('[data-clip-add]').boundingBox();
    const old = await page.locator('[data-bookmark-add]').boundingBox();
    assert(box.x + box.width <= old.x || old.x + old.width <= box.x || box.y + box.height <= old.y);
    console.log('PASS 320px, temporary quote backup, isolated offline book → manual, game return, rejected cross-chapter selection');
    return archive;
  } finally { await context.close(); }
}

async function restore(page, extra) {
  await page.locator('#archive-tools > summary').click();
  const archive = await readBackup(page, '#archive-export');
  assert.equal(archive.bookmarks.length, 4);
  assert.equal(archive.bookmarks.filter(e => e.kind === 'clip').length, 3);
  archive.bookmarks.push(...extra.bookmarks);
  await page.evaluate(() => {
    localStorage.removeItem('earth-online-bookmarks-v1');
    localStorage.removeItem('earth-online-clippings-v1');
  });
  await page.reload();
  await page.locator('#archive-file').setInputFiles({name:'archive.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(archive))});
  const apply = page.locator('#archive-apply');
  await page.waitForFunction(() => !document.getElementById('archive-apply').disabled);
  await apply.evaluate(node => node.click());
  await page.waitForFunction(() => earthBookmarkStore.readForExport().length === 5);
  await panel(page);
  await page.locator('[data-bookmark-search]').fill(extra.bookmarks[0].anchor.exact);
  await page.locator('[data-clip-open]').click();
  await located(page, extra.bookmarks[0].anchor.exact, '#fulltext-content');
  assert.equal(await page.locator('#chapter-select').inputValue(), '7');
  console.log('PASS complete backup round trip with multiple clips per chapter and imported standalone backup');
}

(async () => {
  await storeIsolation();
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? {channel: process.env.PLAYWRIGHT_CHANNEL} : {});
  try {
    const context = await browser.newContext({offline:true, viewport:{width:1000,height:760}});
    const page = await context.newPage(), errors = [];
    context.on('page', p => p.on('pageerror', e => errors.push(e.message)));
    page.on('pageerror', e => errors.push(e.message));
    context.on('request', req => { if (/^https?:/.test(req.url())) errors.push(req.url()); });
    await saveSelections(page);
    const backup = await noStorage(browser);
    await restore(page, backup);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
