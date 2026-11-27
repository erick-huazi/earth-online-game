'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

const built = pathToFileURL(path.resolve(__dirname, '../outputs/earth-online-game.html')).href;
// A v2.4 R1 replay with two relic picks and a completed twelfth station.
const code = 'R1.KYQwTgLgFgtMAeAHYATAlhNB7AdjATAHQAMAPiiAJ4HH4BsMAjIwXaQO4gA2A1sGKQCOAVzTAIAGmISRYydNnipM0UukBzMCDQ4A+oizCAxlBVzli+WbXWriLUcxHguriAC2iWxdVXLP82IgA.1p0lvzx';

async function main() {
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? {channel: process.env.PLAYWRIGHT_CHANNEL} : {});
  try {
    const context = await browser.newContext({offline:true,viewport:{width:320,height:780},reducedMotion:'reduce'});
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(built);
    await page.locator('#exp-begin').click();
    const saved = () => page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
    const before = await saved();
    assert(before['earth-online-expedition-v2']);
    await page.goto(built + '#replay=' + code);
    const jump = page.locator('#exp-replay-jump');
    const start = page.locator('#exp-practice-start');
    const panel = page.locator('#exp-practice'), stage = panel.locator('#exp-practice-stage');
    const undo = panel.getByRole('button', {name:'撤销一步',exact:true});
    const redo = panel.getByRole('button', {name:'重做一步',exact:true});
    const storageUnchanged = async () => assert.deepEqual(await saved(), before);
    const clickMove = key => stage.locator('[data-move="' + key + '"]').click();
    async function open(station) {
      await jump.selectOption(String(station - 1));
      await start.click();
      assert(await undo.isDisabled() && await redo.isDisabled());
      return page.evaluate(({code,station}) => {
        const full = EarthExpeditionReplay.decode(code);
        const entry = EarthExpedition.stationStart(full,station);
        return full.actions.slice(entry.actions.length).map(move =>
          move.t === 'advance' ? 'advance' : String(move.t === 'choice' ? move.index : move.id));
      },{code,station});
    }
    function snapshot() {
      return panel.evaluate(el => ({
        phase:el.querySelector('#exp-practice-stage').dataset.phase,
        title:el.querySelector('#exp-practice-title').textContent,
        resources:el.querySelector('#exp-practice-resources').innerText,
        seals:el.querySelector('#exp-practice-seals').textContent,
        actions:el.querySelector('#exp-practice-stage').textContent
      }));
    }

    const eighth = await open(8);
    const states = [await snapshot()];
    for (const move of eighth.slice(0,4)) {
      await clickMove(move);
      states.push(await snapshot());
    }
    assert.deepEqual(states.map(s => s.phase), ['route','event','feedback','relic','route']);
    for (let i = states.length - 2; i >= 0; i--) {
      await page.keyboard.press('Control+z');
      assert.deepEqual(await snapshot(), states[i]);
    }
    assert(await undo.isDisabled() && await redo.isEnabled());
    await redo.focus();
    for (let i = 1; i < states.length; i++) {
      await page.keyboard.press(i === 1 ? 'Space' : 'Control+Shift+z');
      assert.deepEqual(await snapshot(), states[i]);
    }
    assert(await redo.isDisabled() && await undo.isEnabled());
    const size = await undo.boundingBox();
    assert(size.width >= 44 && size.height >= 44);
    assert(await page.locator('#exp-replay-dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth));
    await storageUnchanged();
    console.log('PASS 从第八站选路到选印的每一步都能键盘撤销和重做，逐步核对选项、资源和书印');

    await undo.click();
    const otherRelic = await stage.locator('[data-move]').evaluateAll((buttons, previous) =>
      buttons.map(button => button.dataset.move).find(id => id !== previous), eighth[3]);
    assert(otherRelic);
    await clickMove(otherRelic);
    const alternate = await snapshot();
    assert.notEqual(alternate.seals, states[4].seals);
    assert(await redo.isDisabled());
    await page.keyboard.press('Control+y');
    assert.deepEqual(await snapshot(), alternate);
    await undo.click();
    await page.keyboard.press('Control+y');
    assert.deepEqual(await snapshot(), alternate);
    await page.keyboard.press('Escape');
    assert.equal(await jump.inputValue(), '7');
    await open(8);
    assert.deepEqual(await snapshot(), states[0]);
    await panel.locator('#exp-practice-return').click();
    await storageUnchanged();
    console.log('PASS 换选书印会替换未来步骤，退出练习并再进同一站得到干净的起点');

    const last = await open(12);
    for (const move of last) await clickMove(move);
    const ending = await snapshot();
    assert.equal(ending.phase, 'ending');
    assert.equal(await stage.locator('.exp-practice-result dd').first().textContent(),
      await stage.locator('.exp-practice-result dd').last().textContent());
    await undo.click();
    assert.equal((await snapshot()).phase, 'feedback');
    await redo.click();
    assert.deepEqual(await snapshot(), ending);
    await undo.click();
    await undo.click();
    assert.equal((await snapshot()).phase, 'event');
    const otherChoice = (Number(last[1]) + 1) % 3;
    await clickMove(String(otherChoice));
    await clickMove('advance');
    assert(await redo.isDisabled());
    const result = await stage.locator('.exp-practice-result dd').allTextContents();
    assert(result[0].includes('1140 分') && result[1].includes('1143 分'));
    await stage.locator('.exp-station-compare > summary').click();
    assert.equal(await panel.locator('#exp-compare-station option:checked').textContent(), '第 12 站 · 行动不同');
    await clickMove('retry');
    assert(await undo.isDisabled() && await redo.isDisabled());
    assert.equal((await snapshot()).phase, 'route');
    await panel.locator('#exp-practice-return').click();
    await page.locator('#exp-replay-close').click();
    await page.reload();
    await storageUnchanged();
    assert.deepEqual(errors, []);
    console.log('PASS 末站结算可回退改选并刷新逐站对照，重试清空历史，正式档退出刷新后逐字节一致');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode=1; });
