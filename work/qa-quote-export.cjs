'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {Parser} = require('commonmark');
const {chromium} = require('playwright');
const output = pathToFileURL(path.resolve(__dirname, '../outputs') + path.sep).href;

const special = '\n    # 原文 *不可改* __原样__\n\n1. [资料](https://example.org) ![图](x) &amp; <b>甲</b>\n' +
  '\t\`代码\` | ~记~ \\路径\n' + '原文🌿'.repeat(55) + '  \n';
const title = '第一章 [标题](test)\n# 原章名';
function clip(bookId, section, start, text, name) {
  return {bookId, section, textOffset:start, title:name, excerpt:text.slice(0, 160),
    createdAt:1, updatedAt:2, kind:'clip', anchor:{start, end:start+text.length, exact:text, prefix:'', suffix:''}};
}
const records = [
  clip('daodejing', 0, 4, special, title),
  clip('bazi', 0, 0, '另一部书的原句', '原序'),
  ...Array.from({length:41}, (_,i) => clip('daodejing', 0, 1000 + i, '依次收录第' + i + '段', title))
];
const old = {bookId:'daodejing',section:0,title:'旧书签',excerpt:'旧书签预览',textOffset:1,createdAt:1,updatedAt:1};

async function download(page, button, suffix) {
  const [file] = await Promise.all([page.waitForEvent('download'), button.click()]);
  assert(file.suggestedFilename().endsWith(suffix));
  assert.equal(await file.failure(), null);
  return fs.readFile(await file.path(), 'utf8');
}

function parseNote(content) {
  const walker = new Parser().parse(content).walker();
  const headings = [], quotes = [], links = [];
  let event;
  while ((event = walker.next())) {
    const node = event.node;
    if (!event.entering) continue;
    if (node.type === 'heading') headings.push([node.level, plainText(node)]);
    else if (node.type === 'block_quote') quotes.push(plainText(node));
    else if (node.type === 'link') links.push([plainText(node),node.destination]);
    else assert(['document', 'paragraph', 'text', 'linebreak', 'softbreak'].includes(node.type), 'Unexpected markup: ' + node.type);
  }
  return {headings,quotes,links};
}
function plainText(root) {
  const walker = root.walker();
  let event, text = '';
  while ((event = walker.next())) {
    if (event.node.type === 'text') text += event.node.literal;
    else if (['linebreak','softbreak'].includes(event.node.type)) text += '\n';
  }
  return text;
}

async function check(browser, full) {
  const context = await browser.newContext({offline:true,viewport:{width:320,height:740},acceptDownloads:true});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  context.on('request', request => { if (/^https?:/i.test(request.url())) errors.push(request.url()); });
  try {
    await context.addInitScript(({old,records}) => {
      localStorage.setItem('earth-online-bookmarks-v1',JSON.stringify({version:1,entries:[old]}));
      localStorage.setItem('earth-online-clippings-v1',JSON.stringify({version:1,entries:records}));
    },{old,records});
    await page.goto(output + (full ? 'html/daodejing.html' : 'earth-online-manual.html?book=daodejing&section=0#reader'));
    const panel = page.locator('[data-bookmark-panel]');
    await panel.locator('summary').click();
    const button = panel.getByRole('button', {name:'下载 Markdown'});
    const range = panel.getByLabel('导出摘录范围');
    const filter = panel.locator('[data-bookmark-search]');
    const status = panel.locator('[data-bookmark-status]');
    assert.equal(await range.inputValue(),'filtered');
    assert.equal(await panel.locator('[data-bookmark-open]').count(),40);
    const all = parseNote(await download(page, button, '.md'));
    const firstTitle = '第一章 [标题](test) # 原章名';
    assert.deepEqual(all.headings,[[1,'地球 Online · 原文摘录'],[2,'《道德经》'],[3,firstTitle],
      [2,'《四柱八字 · 子平真诠评注》'],[3,'原序']]);
    assert.deepEqual(all.quotes,[special,...records.slice(2).map(r=>r.anchor.exact),'另一部书的原句']);
    assert.deepEqual(all.links,[
      ['《道德经》 · '+firstTitle+' · 第 1 阅读节','https://39.107.91.13/earth-online/html/daodejing.html#section-0'],
      ['《四柱八字 · 子平真诠评注》 · 原序 · 第 1 阅读节','https://39.107.91.13/earth-online/html/bazi.html#section-0']
    ]);
    await panel.locator('[data-bookmark-scope]').selectOption('bazi');
    await filter.fill('另一部');
    assert.deepEqual(parseNote(await download(page,button,'.md')).quotes,['另一部书的原句']);
    await range.selectOption('book');
    assert.deepEqual(parseNote(await download(page,button,'.md')).quotes,all.quotes.slice(0,-1));
    await range.selectOption('filtered');
    await filter.fill('没有这样的句子');
    assert(await button.isDisabled());
    // Legacy backups keep their full scope while a Markdown filter is empty.
    if (!full) await page.locator('#archive-tools > summary').click();
    const backup = JSON.parse(await download(page, full ? panel.locator('[data-bookmark-export]') : page.locator('#archive-export'), '.json'));
    assert.equal(backup.bookmarks.length,records.length+1);
    assert(backup.bookmarks.some(entry=>entry.excerpt===old.excerpt));
    await range.selectOption('book');
    await page.evaluate(() => {
      const original = URL.createObjectURL;
      URL.createObjectURL = (...args) => {URL.createObjectURL=original; throw new Error('temporary blob failure');};
    });
    await button.click();
    await status.filter({hasText:'未能生成'}).waitFor();
    assert.deepEqual(parseNote(await download(page,button,'.md')).quotes,all.quotes.slice(0,-1));
    assert(await button.evaluate(node=>{const r=node.getBoundingClientRect(); return r.width>=44 && r.height>=44 && r.right<=innerWidth+1;}));
    assert.deepEqual(errors,[]);
    console.log('PASS', full?'独立全书':'手册', '离线摘录下载、CommonMark 逐字校对、两种范围与完整旧备份、320px 和失败后重试');
  } finally { await context.close(); }
}
(async()=>{
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {});
  try { await check(browser,false); await check(browser,true); }
  finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
