'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { normalizedBook } = require('./full-book.cjs');
const normalize = require('./search-normalizer.js');
const ranked = require('./ranked-search.js');

const root = path.resolve(__dirname, '..');
function json(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8').replace(/^\uFEFF/, ''));
}
function corpus() {
  return json('books.json').flatMap(book =>
    normalizedBook(json('download-manifests/' + book.id + '.json'), root).sections.map((section, index) => ({
      title: normalize.fold(section.title), text: normalize.fold(section.text), book: book.id, index
    })));
}
function checkQueries(rows) {
  assert.deepEqual(ranked.terms('   ，  '), []);
  assert.deepEqual(ranked.terms(' 聖人  圣人　天地！ '), ['圣人', '天地']);
  assert.deepEqual(ranked.rank(rows, []), []);
  const hits = ranked.rank(rows, ranked.terms('天地 聖人'));
  const oracle = rows.map((row, i) => ({ row, i })).filter(({ row }) =>
    ['天地', '圣人'].every(term => row.title.includes(term) || row.text.includes(term))).map(({ i }) => i);
  assert.deepEqual(hits.toSorted((a, b) => a-b), oracle);
  assert.equal(new Set(hits.map(i => rows[i].book)).size, 7);
  assert.equal(hits.length, 70);
  assert.equal(rows[hits[0]].title, '天地第十二');
  assert.deepEqual(ranked.rank(rows, ranked.terms('天地 圣人 天地')), hits);
  const sample = [{title:'道',text:'德'}, {title:'',text:'道德'}, {title:'道',text:'德'}, {title:'道',text:''}];
  assert.deepEqual(ranked.rank(sample, ['道', '德']), [0,2,1]);
  const merged = ranked.mergeRanges(normalize.termRanges('A聖，人𠀀', ['圣','圣人','𠀀'], 'flexible', 10).flat());
  assert.deepEqual(merged, [{start:1,end:4},{start:4,end:6}]);
  console.log('PASS 多词去重、标点简繁、标题正文交集、相关度、并列顺序和原文选区');
  return hits;
}

async function browserCheck(rows, hits) {
  const channel = process.env.PLAYWRIGHT_CHANNEL;
  const browser = await chromium.launch(channel ? { channel } : {});
  try {
    const context = await browser.newContext({viewport:{width:320,height:740},offline:true});
    const page = await context.newPage(), errors = [], remoteRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) remoteRequests.push(request.url()); });
    await page.goto(pathToFileURL(path.join(root, 'outputs/earth-online-manual.html')).href + '?book=daodejing&section=0#reader');
    await page.locator('#read-original').click();
    await page.locator('#reading-tools').evaluate(details => { details.open = true; });
    const mode = page.locator('#book-search-mode'), input = page.locator('#book-search');
    const caption = page.locator('#search-results .search-caption'), results = page.locator('#search-results button.search-result');
    await mode.selectOption('terms');
    await page.locator('#book-search-scope').selectOption('all');
    await input.fill('天地 聖人');
    await caption.filter({hasText:'70 节匹配'}).waitFor();
    assert.match(await caption.innerText(), /7 本书/);
    assert.equal(await results.count(), 40);
    assert.match(normalize.fold(await results.first().innerText()), /庄子.*天地第十二/);
    await page.getByRole('button', {name:'再显示 40 节'}).click();
    await page.waitForFunction(() => document.querySelectorAll('.search-result').length === 70);
    const expected = rows[hits[0]];
    await results.first().click();
    const section = page.locator('#fulltext-content');
    assert.equal(await page.locator('#chapter-select').inputValue(), String(expected.index));
    assert.match(normalize.fold(await section.innerText()), /圣人/);
    assert((await section.locator('mark').allTextContents()).some(s => normalize.fold(s) === '圣人'));
    await page.locator('#return-search').click();
    assert.equal(await results.count(), 70);
    assert.equal(await input.inputValue(), '天地 聖人');
    await page.locator('#book-search-scope').selectOption('current');
    await caption.filter({hasText:'本书找到'}).waitFor();
    assert.equal(await results.count(), hits.filter(i => rows[i].book === expected.book).length);
    await input.fill('不存在的远古词汇zzzz 圣人');
    await caption.filter({hasText:'没有章节同时包含'}).waitFor();
    assert.equal(await results.count(), 0);
    await input.fill('，');
    await caption.filter({hasText:'请输入要查的词'}).waitFor();
    await input.fill('　');
    await page.locator('#search-results').waitFor({state:'hidden'});
    await page.locator('#book-search-scope').selectOption('all');
    await mode.selectOption('flexible');
    await input.fill('天下');
    await caption.filter({hasText:'166 节匹配'}).waitFor();
    assert.match(await caption.innerText(), /10 本书/);
    await mode.selectOption('exact');
    await input.fill('天地 聖人');
    await caption.filter({hasText:'未找到'}).waitFor();
    assert.deepEqual(remoteRequests, []);
    assert.deepEqual(errors, []);
    console.log('PASS 320px 离线跨书结果分页、原文高亮、返回列表、收窄范围和原有匹配模式');
  } finally {
    await browser.close();
  }
}

(async () => {
  const rows = corpus();
  const hits = checkQueries(rows);
  await browserCheck(rows, hits);
})().catch(error => { console.error(error); process.exitCode = 1; });
