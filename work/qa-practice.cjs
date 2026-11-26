'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

const box = {};
box.window = box;
vm.createContext(box);
for (const file of ['vendor/seedrandom-3.0.5.min.js', 'vendor/lz-string-1.5.0.min.js',
  'expedition-content.js', 'expedition-engine.js', 'expedition-replay.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), box, {filename: file});
}
const engine = box.EarthExpedition;
const replay = box.EarthExpeditionReplay;

// Play forward to obtain independent station snapshots. An optional fork changes the first route.
function travel(start, {avoidRoute, exhaust = false} = {}) {
  const moves = [], starts = [], feedback = [];
  let run = start;
  while (run.phase !== 'ending') {
    if (run.phase === 'relic') {
      const relic = engine.getRelicChoices(run)[0];
      moves.push({key: relic.id, phase: 'relic'});
      run = engine.chooseRelic(run, relic.id);
      continue;
    }
    starts.push(run);
    let best;
    for (const route of engine.getRoutes(run)) {
      if (starts.length === 1 && route.id === avoidRoute) continue;
      const event = engine.chooseRoute(run, route.id);
      for (const [index] of engine.getEvent(event).options.entries()) {
        const result = engine.chooseOption(event, index);
        const values = Object.values(result.resources);
        const fitness = (exhaust ? -1 : 1) * (3 * Math.min(...values) + values.reduce((a,b) => a+b));
        if (!best || fitness > best.fitness) best = {route, index, result, fitness};
      }
    }
    moves.push({key: best.route.id, phase: 'route'}, {key: String(best.index), phase: 'event'},
      {key: 'advance', phase: 'feedback'});
    feedback.push(best.result);
    run = engine.advance(best.result);
  }
  return {run, moves, starts, feedback};
}

async function main() {
  const complete = travel(engine.create({seed: 'replay-12', role: 'planner'}));
  const early = travel(engine.create({seed: 'replay-early', role: 'envoy'}), {exhaust: true});
  assert.equal(complete.run.turn, 12);
  assert(early.run.turn < 12);
  for (const journey of [complete, early]) {
    for (const [index, start] of journey.starts.entries()) {
      assert.deepEqual(engine.stationStart(journey.run, index + 1), start);
    }
    assert.equal(engine.stationStart(journey.run, 0), null);
    assert.equal(engine.stationStart(journey.run, journey.run.turn + 1), null);
  }
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? {channel: process.env.PLAYWRIGHT_CHANNEL} : {});
  try {
    const context = await browser.newContext({offline: true, viewport: {width: 320, height: 780}, reducedMotion: 'reduce'});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const url = pathToFileURL(path.resolve(__dirname, '../outputs/earth-online-game.html')).href;
    await page.goto(url);
    // Finish an actual daily via the final feedback screen, then leave a second run in progress.
    await page.locator('#exp-daily-start').click();
    const day = await page.locator('#exp-day').innerText();
    const daily = travel(engine.create({seed: 'day-' + day, role: 'walker'}));
    await page.locator('#exp-import').setInputFiles({name: 'daily.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({kind: 'earth-online-expedition-run', version: 2, run: daily.feedback.at(-1)}))});
    await page.locator('#exp-stage > .primary').click();
    const storage = () => page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
    const finished = await storage();
    const selfReplay = page.getByRole('button', {name: '回放并练习', exact: true});
    await selfReplay.click();
    await page.locator('#exp-replay-jump').selectOption(String(daily.run.turn - 1));
    await page.locator('#exp-practice-start').click();
    await page.locator('#exp-practice-stage button').first().click();
    await page.locator('#exp-practice-return').click();
    await page.locator('#exp-replay-close').click();
    assert(await selfReplay.evaluate(el => document.activeElement === el));
    assert.deepEqual(await storage(), finished);
    await page.locator('#exp-free-start').click();
    await page.locator('#exp-begin').click();
    await page.locator('[data-route]').first().click();
    await page.locator('#start-game').click();
    await page.locator('#enter-chapter').click();
    await page.locator('#close-quest').click();
    const snapshot = await storage();
    const own = JSON.parse(snapshot['earth-online-expedition-v2']);
    assert.equal(own.run.phase, 'event');
    assert.equal(own.profile.finished, 1);
    assert.equal(own.profile.daily.date, day);
    assert(snapshot['earth-online-game-v1']);

    const code = replay.encode(complete.run);
    await page.goto(url + '#replay=' + code);
    const select = page.locator('#exp-replay-jump');
    const panel = page.locator('#exp-practice'), stage = page.locator('#exp-practice-stage');
    const fork = page.locator('#exp-practice-start'), back = page.locator('#exp-practice-return');
    const title = page.locator('#exp-practice-title');
    const begin = async station => {
      await select.selectOption(String(station - 1));
      await fork.click();
      assert.equal(await title.innerText(), '第 ' + station + ' 站 · 选择路线');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'exp-practice-title');
    };
    await begin(5);
    const startingState = complete.starts[4];
    const resourceLabels = ['体力 ' + startingState.resources.stamina, '补给 ' + startingState.resources.supply,
      '声望 ' + startingState.resources.trust, '见识 ' + startingState.insight];
    assert.deepEqual(await panel.locator('#exp-practice-resources li').allTextContents(), resourceLabels);
    for (const id of startingState.relics) assert((await page.locator('#exp-practice-seals').innerText()).includes(engine.relics.find(r => r.id === id).name));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert(await page.locator('#exp-replay-dialog').evaluate(el => el.scrollWidth <= el.clientWidth));
    await page.addScriptTag({path: require.resolve('axe-core/axe.min.js')});
    const audit = () => page.evaluate(async () => (await axe.run(document.getElementById('exp-replay-dialog'), {
      runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22a','wcag22aa']}
    })).violations.map(v => v.id));
    assert.deepEqual(await audit(), []);
    await page.keyboard.press('End');
    assert.equal(await select.inputValue(), '4');
    const alternative = travel(startingState, {avoidRoute: complete.run.history[4].routeId});
    assert.equal(alternative.run.turn, 12);
    assert(alternative.moves.some(m => m.phase === 'relic'));
    for (const [i, move] of alternative.moves.entries()) {
      assert.equal(await stage.getAttribute('data-phase'), move.phase);
      const button = stage.locator('[data-move="' + move.key + '"]');
      if (i === 0) await button.evaluate(el => { el.click(); el.click(); });
      else await button.click();
    }
    assert.equal(await stage.getAttribute('data-phase'), 'ending');
    const scores = await panel.locator('.exp-practice-result dd').allTextContents();
    for (const [index, run] of [alternative.run, complete.run].entries()) {
      const summary = engine.summarize(run);
      assert.equal(scores[index], summary.title + ' · ' + summary.turn + ' 站 · ' + summary.score + ' 分');
    }
    assert.deepEqual(await audit(), []);
    assert.equal(new URL(page.url()).hash, '#replay=' + code);
    assert.deepEqual(await storage(), snapshot);
    await stage.locator('[data-move="retry"]').click();
    assert.deepEqual(await panel.locator('#exp-practice-resources li').allTextContents(), resourceLabels);
    await back.click();
    assert.equal(await select.inputValue(), '4');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'exp-practice-start');
    assert.equal(await page.locator('#exp-replay-action').innerText(), complete.run.history[4].label);
    console.log('PASS 第五站完整还原书印与资源，离线改走支线到十二站并与原局逐项核分；重试、返回与 320px 无障碍检查通过');

    await begin(9);
    await stage.locator('button').first().click();
    await page.keyboard.press('Escape');
    assert.equal(await select.inputValue(), '8');
    assert.equal(await panel.isVisible(), false);
    await begin(12);
    await page.locator('#exp-replay-close').click();
    assert.equal(await select.inputValue(), '11');
    await begin(2);
    await page.reload();
    await select.waitFor();
    assert.equal(await panel.isVisible(), false);
    await begin(1);
    const shortened = travel(complete.starts[0], {exhaust: true});
    assert(shortened.run.turn < 12);
    for (const move of shortened.moves) await stage.locator('[data-move="' + move.key + '"]').click();
    assert.equal(await title.innerText(), '练习结局 · ' + shortened.run.ending.title);
    await page.goto(url + '#replay=damaged');
    await page.locator('#exp-replay-summary').filter({hasText: '不完整'}).waitFor();
    assert.equal(await panel.isVisible(), false);
    assert.equal(await fork.isVisible(), false);
    await page.locator('#exp-replay-close').click();
    assert.deepEqual(await storage(), snapshot);
    assert.deepEqual(errors, []);
    console.log('PASS 练习提前归营、Esc 与关闭返回原站、刷新及无效回放处理；正式活跃远征、经典存档、每日与个人成绩逐字节保持一致');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
