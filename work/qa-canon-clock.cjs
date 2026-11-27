'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

const outputs = pathToFileURL(path.join(__dirname, '../outputs') + path.sep).href;
const game = outputs + 'earth-online-game.html';
const oldInstant = new Date('2026-11-26T15:59:59Z');
const newInstant = new Date('2026-11-26T16:00:01Z');
const oldDay = '2026-11-26';
const newDay = '2026-11-27';

async function question(page) {
  // Next acquires the per-day write lock. The previous reveal can still be
  // visible until that operation completes; read a single actionable frame.
  const options = page.locator('#canon-dialog[open] [data-canon-choice]:enabled');
  await options.first().waitFor({state: 'visible'});
  const snapshot = await options.evaluateAll(nodes => ({
    quote: document.getElementById('canon-quote').innerText,
    choices: nodes.map(node => node.dataset.canonChoice)
  }));
  assert.equal(new Set(snapshot.choices).size, 3);
  return snapshot;
}

async function answerFirst(page) {
  await page.locator('[data-canon-choice]').first().click();
  await page.locator('#canon-feedback').waitFor({state: 'visible'});
  return new URL(await page.locator('#canon-source').getAttribute('href'), page.url());
}

async function puzzleAt(browser, timezoneId, instant) {
  const context = await browser.newContext({timezoneId, offline:true});
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(instant);
    await page.goto(game + '#daily-canon');
    const cards = [];
    for (let i = 0; i < 5; i++) {
      cards.push(await question(page));
      const source = await answerFirst(page);
      assert.equal(source.searchParams.get('day'), oldDay);
      await page.locator('#canon-next').click();
    }
    await page.locator('#canon-summary').waitFor({state:'visible'});
    assert.equal(new Set(cards.map(card => card.quote)).size, 5);
    return cards;
  } finally { await context.close(); }
}

async function readingRoundTrip(browser, cards) {
  const context = await browser.newContext({timezoneId:'America/Los_Angeles', offline:true,
    viewport:{width:320,height:740}, reducedMotion:'reduce'});
  try {
    const manual = await context.newPage();
    await manual.clock.setFixedTime(oldInstant);
    await manual.goto(outputs+'earth-online-manual.html?from=expedition#recall');
    const opened = manual.waitForEvent('popup');
    await manual.locator('[data-daily-canon-link]').click();
    const page = await opened;
    assert.deepEqual(await question(page), cards[0]);
    const source = await answerFirst(page);
    assert.equal(source.searchParams.get('day'), oldDay);
    assert.equal(source.searchParams.get('from'), 'daily-canon');
    const publishedQuote = await page.locator('#canon-quote').innerText();
    const [, , anchor] = JSON.parse(decodeURIComponent(source.hash.slice('#clip='.length)));
    assert.equal(publishedQuote, anchor.exact);
    const sourceOpened = page.waitForEvent('popup');
    await page.locator('#canon-source').click();
    const chapter = await sourceOpened;
    await chapter.waitForFunction(text => String(getSelection()) === text, publishedQuote);
    const back = chapter.locator('#reader-game-return');
    const gameURL = new URL(await back.getAttribute('href'), chapter.url());
    assert.equal(gameURL.hash, '#daily-canon');
    assert.equal(gameURL.searchParams.get('day'), oldDay);
    await back.click();
    await chapter.locator('#canon-feedback').waitFor({state:'visible'});
    assert.equal(await chapter.locator('#canon-quote').innerText(), publishedQuote);
    await chapter.close();
    await page.clock.setFixedTime(newInstant);
    await page.locator('#canon-next').click();
    assert.deepEqual(await question(page), cards[1]);
    assert.equal((await answerFirst(page)).searchParams.get('day'), oldDay);
    await page.locator('#canon-close').click();
    await page.locator('#canon-entry').click();
    await question(page);
    assert.equal((await answerFirst(page)).searchParams.get('day'), newDay);
  } finally { await context.close(); }
}

(async () => {
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {});
  try {
    const west = await puzzleAt(browser, 'America/Los_Angeles', oldInstant);
    const east = await puzzleAt(browser, 'Asia/Tokyo', oldInstant);
    assert.deepEqual(east, west);
    console.log('PASS two local calendar dates at one instant yield the same five prompts and option order');
    await readingRoundTrip(browser, west);
    console.log('PASS manual entry, selected original passage, dated return and Beijing midnight rollover');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
