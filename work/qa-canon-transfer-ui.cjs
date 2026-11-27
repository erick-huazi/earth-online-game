'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const quiz = require('./daily-canon.js');
const review = require('./canon-practice.js');
const transfer = require('./canon-transfer.js');

const url = pathToFileURL(path.join(__dirname,'../outputs/earth-online-game.html')).href;
const prefix = 'earth-online-daily-canon-v1:';
const date = '2026-11-25', second = '2026-11-26', third = '2026-11-27';
const unfinished = day => quiz.answer(quiz.create(day), quiz.questions(day)[0].bookId);
const wrong = day => quiz.answer(quiz.create(day),quiz.questions(day)[0].options.find(x=>x!==quiz.questions(day)[0].bookId));
const asMap = page => page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
async function open(context) {
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date('2026-11-27T05:00:00Z'));
  await page.goto(url+'#canon-transfer');
  await page.getByRole('dialog',{name:'辨典存档'}).waitFor();
  return page;
}
async function upload(page, text) {
  await page.locator('#transfer-file').setInputFiles({name:'progress.json',mimeType:'application/json',buffer:Buffer.from(text)});
}
async function preview(page,text) {
  await upload(page,text);
  await page.locator('#transfer-caption:focus').waitFor();
}
async function status(page,contains) {
  await page.waitForFunction(s=>document.querySelector('#transfer-status').innerText.includes(s),contains);
}
async function a11y(page) {
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  const issues = await page.evaluate(async ()=>(await axe.run('#transfer-dialog',{runOnly:{type:'tag',
    values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22a','wcag22aa','best-practice']}})).violations.map(v=>[v.id,v.nodes.map(n=>n.target)]));
  assert.deepEqual(issues,[]);
}
async function main() {
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {});
  const context = () => browser.newContext({viewport:{width:320,height:740},offline:true,acceptDownloads:true});
  try {
    const source = await context(), target = await context();
    const a = await open(source), b = await open(target);
    const oldest = wrong(date);
    const learned = review.answer(review.importRound(review.create(),oldest,third),quiz.questions(date)[0].id,quiz.questions(date)[0].bookId,third);
    const saved = {[prefix+date]:oldest,[prefix+second]:unfinished(second),[prefix+third]:unfinished(third),[review.storageKey]:learned};
    await a.evaluate(map=>{for(const [k,v] of Object.entries(map)) localStorage.setItem(k,JSON.stringify(v));localStorage.setItem('reader-notes','private quotation');},saved);
    await a.goto(url+'#canon-practice');
    await a.locator('#practice-transfer').click();
    const download = a.waitForEvent('download');
    await a.locator('#transfer-export').press('Enter');
    const file = await download;
    const bytes = await fs.readFile(await file.path(),'utf8');
    assert(!bytes.includes('private quotation'));
    const incoming = transfer.parse(bytes);
    assert.equal(incoming.rounds.length,3);
    assert.deepEqual(incoming.practice.cards,learned.cards);
    const legacy = {[prefix+date]:JSON.stringify(unfinished(date)), 'earth-online-game-v1':'retained'};
    await b.evaluate(map=>{for (const [k,v] of Object.entries(map)) localStorage.setItem(k,v);},legacy);
    await preview(b,bytes);
    assert.deepEqual(await asMap(b),legacy);
    assert(await b.locator('#transfer-stats').innerText().then(s=>s.includes('首答冲突')));
    await b.locator('#transfer-conflicts summary').click();
    assert.equal(await b.locator('#transfer-days').innerText(),date);
    await a11y(b);
    assert(await b.locator('#transfer-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth));
    await b.locator('#transfer-cancel').press('Enter');
    assert.deepEqual(await asMap(b),legacy);
    await preview(b,bytes);
    // A second page completes a previously unseen date after the preview.
    const racing = await open(target);
    const conflict = JSON.stringify(wrong(second));
    await racing.evaluate(([key,value])=>localStorage.setItem(key,value),[prefix+second,conflict]);
    await b.locator('#transfer-apply').press('Enter');
    await status(b,'再次确认');
    assert.deepEqual(await asMap(b),{...legacy,[prefix+second]:conflict});
    // An old v2.8 game may already own the day lock when the player confirms.
    // Finish that genuine lock's pending write, then verify the new proposal
    // leaves the imported third paper uncommitted until it is approved again.
    await racing.evaluate(async ([key,value])=>{
      let ready;
      const locked = new Promise(resolve=>{ ready=resolve; });
      navigator.locks.request(key,async ()=>{
        const finished = new Promise(resolve=>{window.finishOldSave=resolve;});
        ready();
        await finished;
        localStorage.setItem(key,value);
      });
      await locked;
    }, [prefix+third,JSON.stringify(quiz.create(third))]);
    await b.locator('#transfer-apply').click();
    await racing.evaluate(()=>window.finishOldSave());
    await b.waitForFunction(()=>!document.getElementById('transfer-apply').disabled);
    assert.deepEqual(JSON.parse((await asMap(b))[prefix+third]),quiz.create(third));
    await b.locator('#transfer-apply').press('Enter');
    await b.locator('#transfer-result:visible').waitFor();
    const merged = await asMap(b);
    assert.equal(merged[prefix+date],legacy[prefix+date]);
    assert.equal(merged[prefix+second],conflict);
    assert.deepEqual(JSON.parse(merged[prefix+third]),unfinished(third));
    assert.deepEqual(JSON.parse(merged[review.storageKey]).cards[quiz.questions(date)[0].id],Object.values(learned.cards)[0]);
    await b.locator('#transfer-resume').click();
    await b.locator('#canon-feedback:visible').waitFor();
    assert.equal(new URL(b.url()).searchParams.get('day'),third);
    console.log('PASS offline file download, isolated browser migration, specific conflicts, changed preview and dated resume');
    await source.close(); await target.close();

    const failure = await context(), c = await open(failure);
    const local = {[prefix+date]:JSON.stringify(quiz.create(date)),'unrelated-key':'old data'};
    await c.evaluate(map=>{for (const [k,v] of Object.entries(map)) localStorage.setItem(k,v);},local);
    await preview(c,bytes);
    await c.evaluate(()=>{
      const write = Storage.prototype.setItem;
      let n = 0;
      window.blockWrite = 2;
      window.blockCount = 0;
      Storage.prototype.setItem = function(k,v) {
        if (++n === window.blockWrite) {
          n = 0; window.blockCount++;
          throw new DOMException('simulated quota','QuotaExceededError');
        }
        return write.call(this,k,v);
      };
    });
    await c.locator('#transfer-apply').click();
    await status(c,'未写入');
    assert.deepEqual(await asMap(c),local);
    // Round one was restored. Fail after both the overwrite and an insertion.
    await c.evaluate(()=>{window.blockWrite = 4;});
    await c.locator('#transfer-apply').click();
    await c.waitForFunction(()=>window.blockCount === 2 && !document.getElementById('transfer-apply').disabled);
    assert.deepEqual(await asMap(c),local);
    await c.evaluate(()=>{window.blockWrite = -1;});
    await c.locator('#transfer-apply').click();
    await c.locator('#transfer-result:visible').waitFor();
    assert.deepEqual(JSON.parse((await asMap(c))[prefix+date]),oldest);
    await upload(c,'{"format":"unknown"}');
    await status(c,'无法预览');
    assert(!(await c.locator('#transfer-preview').isVisible()));
    console.log('PASS quota failure restores both overwritten and inserted keys, retry succeeds and invalid imports cannot apply');
    await failure.close();

    const blocked = await context();
    await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}}));
    const d = await open(blocked);
    await d.goto(url+'?day='+date+'#daily-canon');
    await d.locator('[data-canon-choice]').first().click();
    await d.locator('#canon-feedback:visible').waitFor();
    await d.evaluate(()=>{location.hash='canon-transfer'});
    const obtained = d.waitForEvent('download');
    await d.locator('#transfer-export').click();
    const held = transfer.parse(await fs.readFile(await (await obtained).path(),'utf8'));
    assert.equal(held.rounds[0].answers.length,1);
    await preview(d,bytes);
    assert(await d.locator('#transfer-apply').isDisabled());
    await status(d,'无法保存');
    console.log('PASS blocked storage can still export a real in-memory first answer and preview a new file');
    await blocked.close();
  } finally {await browser.close();}
}
main().catch(error=>{ console.error(error); process.exitCode=1; });
