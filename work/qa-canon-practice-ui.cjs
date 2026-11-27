'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const quiz = require('./daily-canon.js');

const game = pathToFileURL(path.join(__dirname,'../outputs/earth-online-game.html')).href;
const day = '2026-11-26';
const tomorrow = '2026-11-27';
const dayKey = 'earth-online-daily-canon-v1:' + day;
const cards = quiz.questions(day);
const wrong = card => card.options.find(id => id !== card.bookId);

async function checkAccess(page) {
  if (!await page.evaluate(() => Boolean(window.axe))) {
    await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  }
  const issues = await page.evaluate(async () => {
    const {violations} = await axe.run('#practice-dialog', {runOnly:{type:'tag',values:[
      'wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22a','wcag22aa','best-practice'
    ]}});
    return violations.map(v => [v.id, v.nodes.map(n => [n.target,n.failureSummary])]);
  });
  assert.deepEqual(issues,[]);
}
async function grade(page, pick) {
  await page.locator('[data-practice-choice="' + pick + '"]').click();
  await page.locator('#practice-feedback:focus').waitFor();
}
async function start(page) {
  await page.locator('#practice-start').press('Enter');
  await page.locator('#practice-quote:focus').waitFor();
}

async function scheduledPractice(browser) {
  const context = await browser.newContext({viewport:{width:320,height:740},offline:true});
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date('2026-11-26T13:00:00Z'));
    await page.goto(game);
    const finished = cards.reduce((state, card, index) =>
      quiz.next(quiz.answer(state,index === 0 ? wrong(card) : card.bookId)),quiz.create(day));
    const original = JSON.stringify(finished);
    await page.evaluate(({dayKey,original}) => {
      localStorage.setItem(dayKey,original);
      localStorage.setItem('earth-online-daily-canon-v1:2026-11-22','{');
      localStorage.setItem('earth-online-daily-canon-v1:2026-11-21',original);
    },{dayKey,original});
    await page.goto(game + '?day=' + day + '#daily-canon');
    await page.locator('#canon-to-practice').click();
    await page.locator('#practice-summary:focus').waitFor();
    assert.equal(await page.locator('#practice-due').textContent(),'1');
    for (const width of [320,768,1280]) {
      await page.setViewportSize({width,height:740});
      assert(await page.locator('#practice-dialog').evaluate(el => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().right <= innerWidth));
    }
    await page.setViewportSize({width:320,height:740});
    await checkAccess(page);
    await start(page);
    assert.equal(await page.locator('#practice-quote').textContent(),cards[0].prompt);
    assert(!await page.locator('#practice-source').isVisible());
    await checkAccess(page);
    await grade(page,wrong(cards[0]));
    assert((await page.locator('#practice-feedback').textContent()).includes('今天可以再练'));
    await page.locator('#practice-next').click();
    await start(page);
    await grade(page,cards[0].bookId);
    assert((await page.locator('#practice-feedback').textContent()).includes(tomorrow));
    assert.equal(await page.locator('#practice-quote').textContent(),cards[0].text);
    await checkAccess(page);
    const bookOpened = page.waitForEvent('popup');
    await page.locator('#practice-source').click();
    const book = await bookOpened;
    await book.waitForFunction(text => getSelection().toString() === text,cards[0].text);
    assert.equal(new URL(book.url()).searchParams.get('gameTab'),'kept');
    await book.close();
    await page.locator('#practice-next').click();
    assert.equal(await page.locator('#practice-summary').textContent(),'本轮答对 1 / 1 题');
    assert.equal(await page.locator('#practice-due').textContent(),'0');
    await page.keyboard.press('Escape');
    await page.locator('#canon-dialog[open] #canon-summary').waitFor();
    assert.equal(await page.locator('#canon-summary').textContent(),'答对 4 / 5 题');
    await page.goto(game+'#canon-practice');
    await page.locator('#practice-summary:focus').waitFor();
    assert(!await page.locator('#practice-start').isVisible());
    await page.clock.setFixedTime(new Date('2026-11-26T16:00:01Z'));
    await page.evaluate(() => dispatchEvent(new Event('focus')));
    await page.locator('#practice-start:visible').waitFor();
    await start(page);
    // A stale second tab may still prompt the player after the first has graded.
    const other = await context.newPage();
    await other.clock.setFixedTime(new Date('2026-11-26T16:00:02Z'));
    await other.goto(game+'#canon-practice');
    await start(other);
    await grade(page,cards[0].bookId);
    assert((await page.locator('#practice-feedback').textContent()).includes('2026-11-30'));
    await grade(other,wrong(cards[0]));
    assert((await other.locator('#practice-feedback').textContent()).includes('另一页'));
    assert((await other.locator('#practice-feedback').textContent()).includes('2026-11-30'));
    assert.equal(await page.evaluate(key => localStorage.getItem(key),dayKey),original);
    console.log('PASS 旧版错题、同日错后再练、跨北京日、双标签冲突、原句选区与记分隔离');
    console.log('PASS 320/768/1280px 错题布局及总览、题面、揭晓三态无障碍');
  } finally { await context.close(); }
}

async function memoryPractice(browser) {
  const context = await browser.newContext({offline:true});
  await context.addInitScript(() => Object.defineProperty(window,'localStorage',{
    get(){throw new DOMException('Storage blocked','SecurityError');}
  }));
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date('2026-11-26T12:00:00Z'));
    await page.goto(game+'#canon-practice');
    await page.locator('#practice-summary:focus').waitFor();
    assert.equal(await page.locator('#practice-summary').textContent(),'还没有错题');
    await page.locator('#practice-daily').click();
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      await page.locator('[data-canon-choice="'+(i === 0 ? wrong(card) : card.bookId)+'"]').click();
      await page.locator('#canon-next').click();
    }
    await page.locator('#canon-to-practice').click();
    await page.locator('#practice-start:visible').waitFor();
    assert(await page.locator('#practice-storage').isVisible());
    await start(page);
    const choices = await page.locator('[data-practice-choice]').evaluateAll(nodes => nodes.map(n => n.dataset.practiceChoice));
    await page.keyboard.press(String(choices.indexOf(cards[0].bookId)+1));
    await page.locator('#practice-feedback:focus').waitFor();
    await page.locator('#practice-next').press('Enter');
    assert.equal(await page.locator('#practice-summary').textContent(),'本轮答对 1 / 1 题');
    console.log('PASS file:// 断网和拒存的空态可进入每日、带错题回来并用键盘完成重练');
  } finally { await context.close(); }
}

(async () => {
  const browser = await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || undefined});
  try { await scheduledPractice(browser); await memoryPractice(browser); }
  finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
