'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const quiz = require('./daily-canon.js');
const transfer = require('./canon-transfer.js');

const game = pathToFileURL(path.resolve(__dirname, '../outputs/earth-online-game.html')).href;
const fileDays = ['2026-11-25','2026-11-26','2026-11-27'];
const key = day => 'earth-online-daily-canon-v1:' + day;
const backup = {name:'辨典存档.json',mimeType:'application/json',buffer:Buffer.from(transfer.format({
  rounds:fileDays.map(day=>quiz.answer(quiz.create(day),'daodejing')),practice:null
}))};

async function prepare(page) {
  await page.goto(game+'#canon-transfer');
  await page.locator('#transfer-file').setInputFiles(backup);
  await page.locator('#transfer-preview:visible').waitFor();
}

(async()=>{
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {});
  try {
    const context = await browser.newContext({offline:true});
    const other = await context.newPage();
    await other.clock.setFixedTime(new Date('2026-11-27T04:00:00Z'));
    await other.goto(game+'?day='+fileDays[0]+'#daily-canon');
    await other.locator('[data-canon-choice="zhuangzi"]').click();
    await other.locator('#canon-feedback:focus').waitFor();
    const first = await other.evaluate(k=>localStorage.getItem(k),key(fileDays[0]));
    assert.deepEqual(JSON.parse(first).answers,['zhuangzi']);

    // An older game tab holds the last paper's real per-day write lock. This
    // gives us an observable point between two writes without a timing delay.
    await other.evaluate(lock=>new Promise(ready=>{
      navigator.locks.request(lock,()=>new Promise(release=>{
        window.releaseLastPaper = release;
        ready();
      }));
    }),key(fileDays[2]));
    const closing = await context.newPage();
    await prepare(closing);
    await closing.locator('#transfer-apply').click();
    await other.waitForFunction(async ([middle,last]) =>
      localStorage.getItem(middle) !== null && (await navigator.locks.query()).pending.some(lock=>lock.name===last),
    [key(fileDays[1]),key(fileDays[2])]);
    assert.equal(await other.evaluate(k=>localStorage.getItem(k),key(fileDays[2])),null);
    await closing.close();
    await other.evaluate(()=>window.releaseLastPaper());

    const returned = await context.newPage();
    await prepare(returned);
    await returned.locator('#transfer-apply').click();
    await returned.locator('#transfer-result:visible').waitFor();
    const actual = await returned.evaluate(keys=>keys.map(k=>localStorage.getItem(k)),fileDays.map(key));
    assert.equal(actual[0],first);
    assert.deepEqual(actual.slice(1).map(raw=>JSON.parse(raw).answers),[['daodejing'],['daodejing']]);
    await returned.reload();
    for (const day of fileDays.slice(1)) {
      await returned.goto(game+'?day='+day+'#daily-canon');
      await returned.locator('#canon-feedback:focus').waitFor();
      assert.equal(await returned.locator('#canon-quote').textContent(),quiz.questions(day)[0].text);
    }
    console.log('PASS closing the importing tab between writes and retrying completes the backup and preserves the local first answer');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
