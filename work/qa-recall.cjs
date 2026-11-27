'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const root = path.join(__dirname, '..');
const output = pathToFileURL(path.join(root, 'outputs') + path.sep).href;
const storeKeys = ['earth-online-bookmarks-v1','earth-online-clippings-v1','earth-online-expedition-v2','earth-online-game-v1'];
const old = {bookId:'daodejing', section:0, title:'第一章', excerpt:'旧章节书签', textOffset:0, createdAt:1, updatedAt:1};
function clip(section,text,start=0) {
  return {...old,section,title:'篇章 '+section,excerpt:text,textOffset:start,kind:'clip',
    anchor:{start,end:start+text.length,exact:text,prefix:'',suffix:''}};
}
const entries = Array.from({length:7},(_,i)=>clip(i,'本局独有摘录 '+i));
entries.push(clip(0,entries[0].anchor.exact,10),clip(8,'多章重复。'),clip(9,'多章 重复！'));
const save = records => JSON.stringify({version:1,entries:records});
async function check(browser, url, initial, run) {
  const context = await browser.newContext({offline:true,viewport:{width:320,height:745},reducedMotion:'reduce'});
  try {
    await context.addInitScript(values=>{
      for(const [k,v] of Object.entries(values))localStorage.setItem(k,v);
    },initial);
    const page = await context.newPage(), errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    await page.goto(output+url);
    const button=name=>page.locator('[data-recall-'+name+']');
    const snapshot=()=>page.evaluate(keys=>keys.map(key=>localStorage.getItem(key)),storeKeys);
    const before=await snapshot();
    await run(page,button);
    assert.deepEqual(await snapshot(),before);
    assert.deepEqual(errors,[]);
  } finally {await context.close();}
}
const focus = locator => locator.evaluate(node=>node===document.activeElement);
const press = (locator,key='Enter')=>locator.press(key);

async function palettes(page,part) {
  const backgrounds=new Set();
  for (const theme of ['paper','white','night']) {
    await page.evaluate(value=>EarthReadingAppearance.apply(value),theme);
    await part('start').click();await part('reveal').hover();
    const measured = await part('dialog').evaluate(dialog=>{
      function luminance(color) {
        const rgb=color.match(/\d+/g).slice(0,3).map(v=>Number(v)/255)
          .map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
        return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
      }
      const background=getComputedStyle(dialog).backgroundColor;
      const ratios=Array.from(dialog.querySelectorAll('p,blockquote,button'))
        .filter(el=>el.getClientRects().length)
        .map(el=>{
          const style=getComputedStyle(el);
          const fg=luminance(style.color),bg=luminance(style.backgroundColor==='rgba(0, 0, 0, 0)'?background:style.backgroundColor);
          return (Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);
        });
      return {background,min:Math.min(...ratios)};
    });
    assert(measured.min>=4.5, theme+' text contrast '+measured.min);
    backgrounds.add(measured.background);
    await page.keyboard.press('Escape');
  }
  assert.equal(backgrounds.size,3);
  await page.evaluate(()=>EarthReadingAppearance.apply('paper'));
}

async function demo(page,part) {
  await page.getByRole('link',{name:/用我的摘录辨典/}).click();
  await page.waitForURL(url=>url.hash==='#recall' && url.searchParams.get('from')==='expedition');
  await page.waitForLoadState('load');
  await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  // Exactly these three prompts must occur, verbatim and in the named chapter, in the published texts.
  const prompts = new Map();
  for(const [id,name,text] of [
    ['daodejing','道德经','玄之又玄，众妙之门。'],
    ['yijing','易经','九二：見龍在田，利見大人。'],
    ['zhuangzi','庄子','北冥有魚，其名為鯤。']
  ]){
    const book=JSON.parse(fs.readFileSync(path.join(__dirname,'download-manifests',id+'.json'),'utf8').replace(/^\uFEFF/,''));
    const sections=book.sections.filter(section=>section.text.includes(text));
    assert.equal(sections.length,1);
    prompts.set(text,'出处 · 《'+name+'》 · '+sections[0].title);
  }
  assert(await focus(part('start')));
  assert(await page.locator('[data-bookmark-panel]').evaluate(el=>el.open));
  assert.equal(await part('start').innerText(),'试玩三题');
  await page.keyboard.press('Enter');
  const seen = new Set();
  for(let i=0;i<3;i++){
    assert(await part('dialog').isVisible());
    const quote=await part('quote').innerText();
    assert(prompts.has(quote) && !seen.has(quote));seen.add(quote);
    assert(await focus(part('quote')));
    assert(await part('source').isHidden());
    assert.match(await part('progress').innerText(),/原典示例/);
    await page.keyboard.press('Tab');assert(await focus(part('reveal')));
    await page.keyboard.press('Enter');assert(await focus(part('source')));
    assert.equal(await part('source').innerText(),prompts.get(quote));
    await press(part('known'));
  }
  assert.match(await part('result').innerText(),/自评记得 3 题，待再练 0 题/);
  assert(await part('retry').isHidden());
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.activeElement?.hasAttribute('data-recall-start'));
  await part('read').click();
  assert(await focus(page.locator('#text-reading')));
  assert(await page.locator('#fulltext-content').isVisible());
  assert.equal(new URL(await page.locator('#reader-game-return').getAttribute('href'),page.url()).hash,'#expedition');
  console.log('PASS 从游戏直达空库示例，三道出处逐字核对，断网键盘揭晓、返回阅读和存档隔离');
}
async function personal(page,part,full) {
  const panel=page.locator('[data-bookmark-panel]');
  assert.equal(await panel.evaluate(node=>node.open),false);
  await panel.locator('summary').click();
  const filter=panel.locator('[data-bookmark-search]');
  await palettes(page,part);
  assert.match(await part('hint').innerText(),/当前可出 7 题/);
  await filter.fill('多章');
  assert(await part('start').isDisabled());
  await filter.fill('旧章节书签');assert(await part('start').isDisabled());
  await filter.fill('本局');
  await press(part('start'));
  const seen=new Set(),missed=[];
  for(let i=0;i<5;i++) {
    const quote=await part('quote').innerText();
    assert(!seen.has(quote));seen.add(quote);
    const record=entries.find(e=>e.anchor.exact===quote);
    assert(record);assert(await part('source').isHidden());
    await press(part('reveal'));
    assert.equal(await part('source').innerText(),'出处 · 《道德经》 · '+record.title);
    if(i===1 || i===4){missed.push(quote);await press(part('again'));}else await press(part('known'));
  }
  assert(await focus(part('result')));
  assert.match(await part('result').innerText(),/自评记得 3 题，待再练 2 题/);
  await press(part('retry'));
  for (const quote of missed) {
    assert.equal(await part('quote').innerText(),quote);
    await press(part('reveal'));await press(part('known'));
  }
  assert.match(await part('result').innerText(),/自评记得 2 题，待再练 0 题/);
  assert(await part('retry').isHidden());
  await press(part('close'));
  await filter.fill('独有摘录 0');
  await press(part('start'));assert.match(await part('progress').innerText(),/第 1 \/ 1 题/);
  assert(await part('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth && el.getBoundingClientRect().right<=innerWidth));
  await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement?.hasAttribute('data-recall-start'));
  assert.equal(await filter.inputValue(),'独有摘录 0');
  console.log('PASS',full?'独立全书':'手册','筛选摘录五题、排除歧义及普通书签、单题、仅重练自评未记住的原句、320px 退出焦点与存档隔离');
}
(async()=>{
  const browser=await chromium.launch(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{});
  try{
    const initial={ [storeKeys[0]]:save([old]),[storeKeys[2]]:'{"prior":1}',[storeKeys[3]]:'{"prior":2}'};
    await check(browser,'earth-online-game.html',initial,demo);
    initial[storeKeys[1]]=save(entries);
    await check(browser,'earth-online-manual.html?book=daodejing&section=0#reader',initial,(p,b)=>personal(p,b,false));
    await check(browser,'html/daodejing.html',initial,(p,b)=>personal(p,b,true));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
