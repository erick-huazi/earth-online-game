const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');
const game = pathToFileURL(path.resolve(__dirname, '../outputs/earth-online-game.html')).href;
const axeSource = require.resolve('axe-core/axe.min.js');
const reports = [];

async function scan(page, state) {
  const results = await page.evaluate(async () => {
    const { violations } = await axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa', 'best-practice']
      }
    });
    return violations.map(({id, nodes}) => ({
      id, nodes: nodes.map(({target, failureSummary}) => ({target, failureSummary}))
    }));
  });
  reports.push({state, violations: results});
  if (!results.length) console.log('PASS', state);
}

async function exercise(browser, viewport) {
  const context = await browser.newContext({viewport, reducedMotion: 'reduce'});
  const page = await context.newPage();
  const scope = viewport.width + 'px ';
  try {
    await page.goto(game);
    await page.addScriptTag({path: axeSource});
    await page.locator('#exp-begin').waitFor();
    await scan(page, scope + '出发');
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.skip:focus').count(), 1);
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#expedition:focus').count(), 1);
    await page.locator('#exp-begin').click();
    await scan(page, scope + '选择路线');
    await page.locator('[data-route]').first().click();
    await scan(page, scope + '事件选项');
    await page.locator('[data-option]').first().click();
    await scan(page, scope + '选择反馈');
    const chapter = page.locator('.map-node.available').first();
    const chapterId = await chapter.getAttribute('data-chapter');
    const title = await chapter.locator('.node-name').innerText();
    const book = await chapter.locator('.node-book').innerText();
    assert.equal(await chapter.and(page.getByRole('button', {name: title + ' ' + book, exact: true})).count(), 1);
    await chapter.focus();
    await page.keyboard.press('Enter');
    await page.locator('#enter-chapter').click();
    await scan(page, scope + '经典剧情对话框');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.map-node:focus').getAttribute('data-chapter'), chapterId);
    const stage = page.locator('#exp-stage');
    for (let step = 0; step < 50 && !await stage.locator('.exp-ending').count(); step++) {
      await stage.locator('[data-route], [data-option], [data-relic], :scope > button.primary').first().click();
    }
    await stage.locator('.exp-recap > summary').click();
    const alternate = stage.locator('.exp-alternate').first();
    await alternate.locator('summary').click();
    const options = alternate.getByRole('combobox', {name: /试算第.*站/});
    await options.selectOption({index: 1});
    await scan(page, scope + '结算与另一种选择');
  } finally {
    await context.close();
  }
}

(async () => {
  const channel = process.env.PLAYWRIGHT_CHANNEL;
  const browser = await chromium.launch(channel ? {channel} : {});
  try {
    for (const viewport of [{width: 1280, height: 800}, {width: 390, height: 844}]) {
      await exercise(browser, viewport);
    }
    const failures = reports.filter(result => result.violations.length);
    assert.equal(failures.length, 0, JSON.stringify(failures, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
