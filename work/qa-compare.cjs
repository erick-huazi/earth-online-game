'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

// The original is a published v2.4 replay. The second follows its first three
// stations, then spends its resources differently and returns after station 8.
const fullCode = 'R1.KYQwTgLgFgtMAeAHYATAlhNB7AdjATAHQAMAPiiAJ4HH4BsMAjIwXaQO4gA2A1sGKQCOAVzTAIAGmISRYydNnipM0UukBzMCDQ4A+oizCAxlBVzli+WbXWriLUcxHguriAC2iWxdVXLP82IgA.1p0lvzx';
const shortCode = 'R1.KYQwTgLgFgtMAeAHYATAlhNB7AdjATAHQAMAPiiAJ4HH4BsMAjIwXaQO4gA2A1sGKQCOAVzTAIAGmISRYydNnipM0UvwSA5mBBocAfURZhAYygq5ExhIBuwHBGFhgl80oWr5QA.14cxml3';
// Each of these changes just one move in fullCode, either the last choice
// (index 0 to 1) or the station-8 relic (practice_lamp to free_feather).
const choiceCode = 'R1.KYQwTgLgFgtMAeAHYATAlhNB7AdjATAHQAMAPiiAJ4HH4BsMAjIwXaQO4gA2A1sGKQCOAVzTAIAGmISRYydNnipM0UukBzMCDQ4A+oizCAxlBVzli+WbXWriLUcxHguriAC2iWxdVXLP80YgA.ihnesv';
const sealCode = 'R1.KYQwTgLgFgtMAeAHYATAlhNB7AdjATAHQAMAPiiAJ4HH4BsMAjIwXaQO4gA2A1sGKQCOAVzTAIAGmISRYydNnipM0UukBzMCDQ4A+oizCAxlBVzli+WbXWrAMzDBguu6Gj9bF1VctfzxIA.9vi8nb';
const url = pathToFileURL(path.resolve(__dirname, '../outputs/earth-online-game.html')).href;
const signed = n => n > 0 ? '+' + n : String(n);

// The global game theme has pale text for dark panels; this dialog is light.
// Check the CSS applied to visible, scrolled-into-view text since an automated
// audit can skip text that lies outside a scrolling dialog's viewport.
async function measureContrast(review) {
  const selectors = ['summary', 'summary span', 'label', 'select', 'dt', 'dd strong', 'dd p', 'caption', 'thead th', 'tbody th', 'tbody td'];
  const measurements = [];
  for (const selector of selectors) {
    const node = review.locator(selector).first();
    await node.scrollIntoViewIfNeeded();
    const colors = await node.evaluate(el => {
      const foreground = getComputedStyle(el).color;
      for (let parent = el; parent; parent = parent.parentElement) {
        const bg = getComputedStyle(parent).backgroundColor;
        if (bg.startsWith('rgb(')) return [foreground, bg];
        if (bg !== 'rgba(0, 0, 0, 0)') throw Error('Unexpected translucent panel ' + bg);
      }
      throw Error('Missing dialog background');
    });
    const luminance = color => color.match(/[\d.]+/g).reduce((sum, channel, i) => {
      const v = Number(channel) / 255;
      return sum + [0.2126,0.7152,0.0722][i] * (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    }, 0);
    const [low, high] = colors.map(luminance).sort((a,b) => a-b);
    const ratio = (high+0.05) / (low+0.05);
    measurements.push({selector, colors, ratio});
  }
  const weak = measurements.filter(item => item.ratio < 4.5);
  assert.deepEqual(weak, [], 'WCAG contrast below 4.5: ' + JSON.stringify(weak));
  console.log('Comparison text contrast: minimum ' + Math.min(...measurements.map(m=>m.ratio)).toFixed(2) + ':1');
}

async function compare(page, originalCode, practiceCode, start, expectedStation, reason) {
  const plan = await page.evaluate(({originalCode, practiceCode, start}) => {
    const original = EarthExpeditionReplay.decode(originalCode), trial = EarthExpeditionReplay.decode(practiceCode);
    const entry = EarthExpedition.stationStart(original, start);
    return {moves: trial.actions.slice(entry.actions.length), trial: EarthExpedition.summarize(trial),
      original: EarthExpedition.summarize(original)};
  }, {originalCode, practiceCode, start});
  await page.goto(url + '#replay=' + originalCode);
  const replayStation = page.locator('#exp-replay-jump');
  await replayStation.selectOption(String(start - 1));
  await page.locator('#exp-practice-start').click();
  const stage = page.locator('#exp-practice-stage');
  for (const move of plan.moves) {
    const key = move.t === 'advance' ? 'advance' : move.t === 'choice' ? move.index : move.id;
    await stage.locator('[data-move="' + key + '"]').click();
  }
  const review = stage.locator('.exp-station-compare');
  const summary = review.locator('summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  const select = review.getByRole('combobox', {name:'查看站点'});
  await select.waitFor();
  const {trial, original} = plan;
  const delta = trial.score - original.score;
  assert((await stage.innerText()).includes('较原局 ' + signed(delta) + ' 分'));
  assert.equal(await select.inputValue(), String(expectedStation));
  if (reason) assert.equal(await select.locator('option:checked').textContent(), '第 ' + expectedStation + ' 站 · ' + reason);
  const last = Math.max(original.turn, trial.turn);
  assert.equal(await select.locator('option').count(), last - start + 1);
  for (let station = start; station <= last; station++) {
    await select.selectOption(String(station));
    const steps = [trial, original].map(run => run.history[station - 1]);
    for (const [i, journey] of [trial, original].entries()) {
      const choice = await review.locator('dd').nth(i).innerText(), step = steps[i];
      if (!step) {
        assert(choice.includes('第 ' + journey.turn + ' 站归营 · ' + journey.title));
        continue;
      }
      for (const text of [step.routeTitle, step.title, step.label]) assert(choice.includes(text));
      const seal = (station === 4 || station === 8) && journey.relics[station / 4];
      if (seal) assert(choice.includes(seal.name));
    }
    for (const [label, key] of [['体力','stamina'], ['补给','supply'], ['声望','trust'], ['本站见识','insight']]) {
      const row = review.getByRole('rowheader', {name:label, exact:true}).locator('..');
      const [a,b] = steps.map(s => key === 'insight' ? s?.insight : s?.resources[key]);
      assert.deepEqual(await row.getByRole('cell').allTextContents(), [
        String(a ?? '—'), String(b ?? '—'), steps.every(Boolean) ? signed(a-b) : '—'
      ]);
    }
  }
  await select.focus();
  await page.keyboard.press('Home');
  assert.equal(await select.inputValue(), String(start));
  await page.keyboard.press('End');
  assert.equal(await select.inputValue(), String(last));
  assert(await page.locator('#exp-replay-dialog').evaluate(el => el.scrollWidth <= el.clientWidth));
  if (originalCode === fullCode && practiceCode === shortCode) {
    await select.selectOption(String(start));
    await measureContrast(review);
    await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
    const violations = await page.evaluate(async () => (await axe.run(document.querySelector('.exp-station-compare'), {
      runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22a','wcag22aa']}
    })).violations.map(v => v.id));
    assert.deepEqual(violations, []);
  }
  await summary.focus();
  await page.keyboard.press('Space');
  assert.equal(await select.isVisible(), false);
  await page.locator('#exp-practice-return').click();
  assert.equal(await replayStation.inputValue(), String(start - 1));
  await page.locator('#exp-replay-close').click();
  await page.waitForFunction(() => !location.hash.startsWith('#replay='));
}

(async () => {
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {});
  try {
    const context = await browser.newContext({offline:true,viewport:{width:320,height:780},reducedMotion:'reduce'});
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    await page.locator('#exp-begin').click();
    const storage = () => page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
    const before = await storage();
    assert(before['earth-online-expedition-v2']);
    await compare(page, fullCode, shortCode, 3, 4);
    assert.deepEqual(await storage(), before);
    console.log('PASS 离线旧战报中练习提前归营，逐站核对路线、行动、书印和四项实数，窄屏及键盘验收通过');
    await compare(page, shortCode, fullCode, 4, 4);
    assert.deepEqual(await storage(), before);
    console.log('PASS 原局第八站归营、练习走完十二站；额外站点正确展示单侧记录和结局');
    await compare(page, fullCode, choiceCode, 11, 12, '行动不同');
    await compare(page, fullCode, sealCode, 7, 8, '书印不同');
    await compare(page, fullCode, fullCode, 12, 12);
    assert.deepEqual(await storage(), before);
    assert.deepEqual(errors, []);
    console.log('PASS 仅改行动或书印均指向实际分岔站，末站同选同分及折叠返回正常，正式存档逐字节保持一致');
  } finally { await browser.close(); }
})().catch(e => {console.error(e);process.exitCode = 1;});
