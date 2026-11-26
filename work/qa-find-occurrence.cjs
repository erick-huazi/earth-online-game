'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const base = pathToFileURL(path.resolve(__dirname, '../outputs') + path.sep).href;

async function manual(page) {
  await page.goto(base + 'earth-online-manual.html?book=daodejing&section=0#reader');
  const tools = page.locator('#reading-tools');
  if (!await tools.evaluate(node => node.open)) await tools.locator(':scope > summary').click();
  const input = page.locator('#book-search');
  await input.fill('道');
  await page.locator('button.search-result').first().click();
  const count = page.locator('#chapter-hit-count');
  const current = page.locator('#text-reading mark[aria-current]');
  const firstChapter = page.locator('#fulltext-content');
  const original = await firstChapter.textContent();
  await count.filter({hasText:'1 / 3'}).waitFor();
  assert.equal(await current.textContent(), '道');
  await page.locator('#chapter-next-hit').press('Enter');
  assert.match(await count.textContent(), /2 \/ 3/);
  assert.equal(await firstChapter.locator('mark').nth(1).getAttribute('aria-current'),'true');
  await page.locator('#chapter-prev-hit').click();
  await page.locator('#chapter-prev-hit').click();
  assert.match(await count.textContent(), /3 \/ 3/);
  assert.equal(await firstChapter.textContent(),original);
  await page.locator('#return-search').click();
  assert(await input.evaluate(node=>node===document.activeElement));
  await input.fill('第一章');
  await page.locator('.search-caption').filter({hasText:'1 节匹配'}).waitFor();
  await page.locator('button.search-result').first().click();
  await count.filter({hasText:'1 / 1'}).waitFor();
  assert.equal(await page.locator('#section-title mark[aria-current]').textContent(),'第一章');
  assert(await page.locator('#chapter-next-hit').isDisabled());
  await page.locator('#return-search').click();
  await page.locator('#book-search-mode').selectOption('terms');
  await input.fill('天地 无名');
  await page.locator('button.search-result mark').filter({hasText:'天地'}).first().waitFor();
  await page.locator('button.search-result').filter({hasText:'第一章'}).click();
  await count.filter({hasText:'1 / 2'}).waitFor();
  await page.locator('#chapter-next-hit').click();
  assert.equal(await current.textContent(),'天地');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  console.log('PASS 手册逐处定位、章内循环、标题单处、多词命中和返回结果焦点');
}

async function fullBook(page) {
  await page.goto(base + 'html/daodejing.html');
  const query=page.locator('#query'), status=page.locator('#search-state');
  const active=page.locator('.book-section mark[aria-current]');
  const body=page.locator('#section-0 .prose');
  const original=await body.textContent();
  const total=await page.locator('.book-section h2, .book-section .prose')
    .evaluateAll(nodes=>nodes.reduce((sum,node)=>sum+(node.textContent.match(/道/g)||[]).length,0));
  await query.fill('道');
  await query.press('Enter');
  await status.filter({hasText:'全书第 1 / '+total+' 处'}).waitFor();
  assert.equal(await page.locator('#section-0 .prose mark').first().getAttribute('aria-current'),'true');
  await query.press('Enter');
  assert.equal(await body.locator('mark').nth(1).getAttribute('aria-current'),'true');
  await query.press('Enter');
  await query.press('Enter');
  assert.equal(await body.locator('mark[aria-current]').count(),0);
  assert.equal(await active.textContent(),'道');
  await query.press('Shift+Enter');
  assert.equal(await body.locator('mark').last().getAttribute('aria-current'),'true');
  assert.equal(await body.textContent(),original);
  assert(await query.evaluate(node=>node===document.activeElement));
  await query.fill('第一章');await query.press('Shift+Enter');
  await status.filter({hasText:'1 / 1 处'}).waitFor();
  assert.equal(await page.locator('#section-0 h2 mark[aria-current]').textContent(),'第一章');
  await page.locator('#clear-search').click();
  await page.locator('#next-match:disabled').waitFor();
  assert.equal(await active.count(),0);
  await query.fill('道');
  await query.press('Shift+Enter');
  await status.filter({hasText:'全书第 '+total+' / '+total+' 处'}).waitFor();
  await page.locator('#next-match').click();
  assert.match(await status.textContent(), /全书第 1 \//);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  console.log('PASS 全书连续命中、跨章与首尾循环、标题命中、Enter 和反向键盘定位');
}

async function frequentTerm(page) {
  await page.goto(base+'html/zhuangzi.html');
  const query=page.locator('#query');
  await query.fill('之');await query.press('Shift+Enter');
  await page.locator('#search-state').filter({hasText:'3083 / 3083 处'}).waitFor();
  const paragraph=page.locator('#section-32 .prose');
  const result=await paragraph.evaluate(node=>{
    const active=node.querySelector('mark[aria-current]');
    const prefix=document.createRange();
    prefix.selectNodeContents(node);
    prefix.setEndBefore(active);
    return {offset:prefix.toString().length,last:node.textContent.lastIndexOf('之'),marks:node.querySelectorAll('mark').length};
  });
  assert.equal(result.offset,result.last);
  assert(result.marks<=100);
  console.log('PASS 《庄子》3083 处可首尾定位，末章第 139 处定位精确且 DOM 标记有界');
}

(async()=>{
  const browser=await chromium.launch(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{});
  try {
    const context=await browser.newContext({offline:true,viewport:{width:320,height:760},reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',req=>{if (/^https?:/.test(req.url())) errors.push(req.url());});
    await manual(page);
    await fullBook(page);
    await frequentTerm(page);
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
