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
for (const file of ['vendor/seedrandom-3.0.5.min.js','vendor/lz-string-1.5.0.min.js',
  'expedition-content.js','expedition-engine.js','expedition-replay.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),box,{filename:file});
}
const engine = box.EarthExpedition, replay = box.EarthExpeditionReplay;
function journey(seed, role, risk) {
  let run = engine.create({seed,role});
  while (run.phase !== 'ending') {
    if (run.phase === 'relic') {
      const choices = engine.getRelicChoices(run);
      run = engine.chooseRelic(run, choices.at(-1).id);
      continue;
    }
    const possibilities = [];
    for (const route of engine.getRoutes(run)) {
      const event = engine.chooseRoute(run,route.id);
      for (let i=0; i<3; i++) {
        const choice = engine.chooseOption(event,i);
        const values = Object.values(choice.resources);
        possibilities.push({choice, score:3*Math.min(...values)+values.reduce((a,b)=>a+b)});
      }
    }
    possibilities.sort((a,b)=>b.score-a.score);
    run = engine.advance((risk?possibilities.at(-1):possibilities[0]).choice);
  }
  return run;
}
const complete = journey('replay-12','planner',false);
const early = journey('replay-early','envoy',true);
assert.equal(complete.turn,12);
assert(early.turn < 12);
for (const run of [complete, early, journey('x'.repeat(48),'walker',false)]) {
  const code = replay.encode(run);
  assert.deepEqual(replay.decode(code),run);
  assert(code.length <= 400);
}
console.log('PASS 回放编码可还原十二站、双次选印、提前归营和最长种子的完整结果');

function wrap(data) {
  const packed = box.LZString.compressToEncodedURIComponent(data);
  let h=2166136261;
  for (const c of packed) h=Math.imul(h^c.charCodeAt(0),16777619);
  return 'R1.'+packed+'.'+(h>>>0).toString(36);
}
const valid=replay.encode(complete), original=box.LZString.decompressFromEncodedURIComponent(valid.split('.')[1]);
const base=[engine.RULES,'valid','walker','quiet,1'].join('|');
for (const bad of [valid.slice(0,-3),valid+'0',valid.replace('R1.','R2.'),valid.replace(/^R1\../,'R1.*'),
  'R1.'+'a'.repeat(401),wrap(original+',quiet'),wrap(base),wrap(base.replace('walker','unknown')),
  wrap(base.replace(engine.RULES,'old')),wrap(base.replace('quiet,1','quiet,9')),
  wrap(base.replace('quiet,1','water_seal')),wrap(original+'|42')]) {
  assert.throws(()=>replay.decode(bad));
}
console.log('PASS 截断、更改、未结算、错误版本、额外行动及非法决策会被拒绝');

async function browserCheck() {
  const channel=process.env.PLAYWRIGHT_CHANNEL;
  const browser=await chromium.launch(channel?{channel}:{});
  try {
    const context=await browser.newContext({offline:true,viewport:{width:320,height:780},reducedMotion:'reduce'});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const url=pathToFileURL(path.resolve(__dirname,'../outputs/earth-online-game.html')).href;
    await page.goto(url);
    await page.locator('#exp-import').setInputFiles({name:'done.json',mimeType:'application/json',
      buffer:Buffer.from(JSON.stringify({kind:'earth-online-expedition-run',version:2,run:complete}))});
    await page.getByRole('button',{name:'生成我的山河战报'}).click();
    const link=await page.locator('#exp-replay-link').inputValue();
    assert.equal(new URL(link).hash,'#replay='+valid);
    assert.match(await page.locator('#exp-share-link').inputValue(),/#run=/);
    await page.locator('.exp-replay-share summary').click();
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
      configurable: true, value: {async writeText(value) { window.copiedReplay = value; }}
    }));
    await page.locator('#exp-copy-replay').click();
    await page.locator('#exp-share-status').filter({hasText:'逐站回放链接已复制'}).waitFor();
    assert.equal(await page.evaluate(() => window.copiedReplay), link);
    await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('Permission denied'); }; });
    await page.locator('#exp-copy-replay').click();
    await page.locator('#exp-share-status').filter({hasText:'已选中'}).waitFor();
    assert.equal(await page.locator('#exp-replay-link').evaluate(el =>
      el.value.slice(el.selectionStart, el.selectionEnd)), link);
    await page.locator('#exp-share-close').click();
    console.log('PASS 已结算战报可复制逐站回放链接，原同图挑战链接可同时使用');

    await page.locator('#exp-free-start').click();
    await page.locator('#exp-begin').click();
    await page.locator('[data-route]').first().click();
    await page.locator('#start-game').click();
    await page.locator('#enter-chapter').click();
    await page.locator('#close-quest').click();
    const readStorage=()=>page.evaluate(()=>JSON.stringify({...localStorage}));
    const saved=await readStorage();
    await page.goto(url+new URL(link).hash);
    await page.reload();
    const dialog=page.locator('#exp-replay-dialog');
    assert(await dialog.isVisible());
    assert(!await page.locator('#quest-panel').isVisible());
    assert.match(await dialog.locator('#exp-replay-summary').innerText(),new RegExp(engine.summarize(complete).score+' 分'));
    for (let i=0;i<complete.turn;i++) {
      const step=complete.history[i];
      assert((await dialog.locator('#exp-replay-position').innerText()).includes(step.title));
      assert.equal(await dialog.locator('#exp-replay-action').innerText(),step.label);
      if (step.turn===4 || step.turn===8) {
        const seal = engine.relics.find(item=>item.id===complete.relics[step.turn/4]);
        assert((await dialog.locator('#exp-replay-insight').innerText()).includes(seal.name));
      }
      const resources=await dialog.locator('#exp-replay-resources').innerText();
      for(const key of Object.keys(step.resources)) assert(resources.includes((step.resources[key]-step.delta[key])+' → '+step.resources[key]));
      if(i+1<complete.turn) await dialog.locator('#exp-replay-next').click();
    }
    assert(await dialog.locator('#exp-replay-next').isDisabled());
    await dialog.locator('#exp-replay-close').focus();
    await page.keyboard.press('Home');
    assert(await dialog.locator('#exp-replay-prev').isDisabled());
    await page.keyboard.press('ArrowRight');
    assert.equal(await dialog.locator('#exp-replay-jump').inputValue(),'1');
    await dialog.locator('#exp-replay-jump').selectOption('4');
    assert((await dialog.locator('#exp-replay-position').innerText()).includes(complete.history[4].title));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth));
    await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
    const violations=await page.evaluate(async()=> (await axe.run(document.getElementById('exp-replay-dialog'),{
      runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22a','wcag22aa']}
    })).violations.map(v=>v.id));
    assert.deepEqual(violations,[]);
    assert.equal(await readStorage(),saved);
    console.log('PASS 320px 离线逐站回放、资源对照、键盘和选站全程保留双模式存档');

    await dialog.locator('#exp-replay-challenge').click();
    await page.locator('#exp-cancel-new').click();
    assert.equal(await readStorage(),saved);
    await page.locator('.exp-code-entry > summary').click();
    await page.locator('#exp-code-input').fill(link);
    await page.locator('#exp-code-input').press('Enter');
    assert(await dialog.isVisible());
    await dialog.locator('#exp-replay-challenge').click();
    await page.locator('#exp-confirm-new').click();
    await page.locator('#exp-begin').click();
    const own=await page.evaluate(()=>JSON.parse(localStorage.getItem('earth-online-expedition-v2')));
    assert.equal(own.run.seed,complete.seed);
    assert.equal(own.run.role,complete.role);
    assert.equal(own.run.turn,0);
    assert.equal(own.profile.finished,0);
    await page.goto(url+'#replay=damaged');
    assert.match(await dialog.locator('#exp-replay-summary').innerText(),/不完整/);
    assert(!await dialog.locator('#exp-replay-challenge').isVisible());
    assert.deepEqual(errors,[]);
    console.log('PASS 回放口令可粘贴，接下同局挑战尊重替换确认，首站不继承分享成绩');
  } finally { await browser.close(); }
}
browserCheck().catch(error=>{console.error(error);process.exitCode=1;});
