'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'outputs'),file=path.join(output,'earth-online-game.html'),key='earth-online-expedition-v2';
const crypto=require('node:crypto'),hash=()=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report={date:new Date().toISOString().slice(0,10),buildSha256:hash(),tests:[],errors:[]};let server,browser,base;
const getRun=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)).run,key);
async function code(page,seed='qa-v2-world',role='walker'){return page.evaluate(({seed,role})=>EarthExpeditionShare.encode({seed,role}),{seed,role});}
async function open(page){await page.goto(base);await page.locator('#exp-begin').waitFor({state:'attached'});}
async function sharedStart(page,seed='qa-v2-world',role='walker'){await open(page);const c=await code(page,seed,role);await page.goto(base+'#run='+c);await page.reload();await page.locator('#exp-accept-shared').click();await page.locator('#exp-begin').click();return c;}
async function routeChoice(page){return page.evaluate(k=>{const E=EarthExpedition,s=JSON.parse(localStorage.getItem(k)).run;let best=null;for(const r of E.getRoutes(s)){const es=E.chooseRoute(s,r.id);for(const [i,o]of E.getEvent(es).options.entries()){const n=E.chooseOption(es,i),a=Object.values(n.resources),v=Math.min(...a)*3+a.reduce((x,y)=>x+y,0)+n.insight*.08;if(!best||v>best.value)best={route:r.id,choice:i,value:v};}}return best;},key);}
async function relicChoice(page){return page.evaluate(k=>{const E=EarthExpedition,s=JSON.parse(localStorage.getItem(k)).run,priority=['medicine_herb','grain_pouch','free_feather','water_seal','climate_dial','strategy_scroll','swift_sandals','accord_bell','practice_lamp','change_compass'];return E.getRelicChoices(s).sort((a,b)=>priority.indexOf(a.id)-priority.indexOf(b.id))[0].id;},key);}
async function step(page){let s=await getRun(page);if(s.phase==='route'){const pick=await routeChoice(page);await page.locator(`[data-route="${pick.route}"]`).click();await page.locator(`[data-option="${pick.choice}"]`).click();}else if(s.phase==='event'){const pick=await page.evaluate(k=>{const E=EarthExpedition,s=JSON.parse(localStorage.getItem(k)).run;return E.getEvent(s).options.map((_,i)=>{const n=E.chooseOption(s,i),a=Object.values(n.resources);return {i,v:Math.min(...a)*3+a.reduce((x,y)=>x+y,0)};}).sort((a,b)=>b.v-a.v)[0].i;},key);await page.locator(`[data-option="${pick}"]`).click();}else if(s.phase==='feedback')await page.locator('#exp-stage > .primary').click();else if(s.phase==='relic')await page.locator(`[data-relic="${await relicChoice(page)}"]`).click();return getRun(page);}
async function finish(page){let guard=0;while((await getRun(page)).phase!=='ending'){assert(++guard<45);await step(page);}return getRun(page);}
async function test(name,fn,options={}){const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',acceptDownloads:true,...options}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(6000);try{await fn(page,context);assert.deepEqual(errors,[],'Runtime errors');report.tests.push({name,pass:true});console.log('PASS',name);}catch(e){report.tests.push({name,pass:false,error:e.message});console.log('FAIL',name,e.message);}finally{await context.close();}}
async function exported(page){const wait=page.waitForEvent('download');await page.locator('#exp-export').click();const d=await wait;return fs.readFileSync(await d.path());}
async function importData(page,data){await page.locator('#exp-import').setInputFiles({name:'expedition.json',mimeType:'application/json',buffer:Buffer.isBuffer(data)?data:Buffer.from(data)});}
async function assertVisibleRecap(page, run) {
 const recap = page.locator('.exp-recap');
 if (!await recap.evaluate(element => element.open)) await recap.locator(':scope > summary').click();
 const rows = recap.locator('#exp-recap-list > li');
 assert.equal(await rows.count(), run.history.length);
 for (const [index, station] of run.history.entries()) {
  const row = rows.nth(index);
  assert.equal(await row.getAttribute('data-turn'), String(index + 1));
  const text = await row.innerText();
  for (const word of [station.title, station.routeTitle, station.label, '见识 +' + station.insight]) {
   assert(text.includes(word), 'Missing station detail: ' + word);
  }
  const resources = await row.locator('[data-resource]').evaluateAll(elements => elements.map(element => ({
   ...element.dataset,
   text: element.innerText.replace(/\s/g, '').replace(/−/g, '-')
  })));
  assert.deepEqual(resources.map(item => item.resource).sort(), ['stamina', 'supply', 'trust']);
  for (const item of resources) {
   const {resource, text} = item;
   const after = station.resources[resource], delta = station.delta[resource];
   const change = delta > 0 ? '+' + delta : String(delta);
   assert.equal(item.before, String(after - delta));
   assert.equal(item.after, String(after));
   assert.equal(item.delta, String(delta));
   assert(text.includes((after - delta) + '→' + after), text);
   assert(text.includes('（' + change + '）') || text.includes('(' + change + ')'), text);
  }
 }
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
}

async function assertComparison(page, result, previousScore) {
 const panel = page.locator('#exp-personal-comparison');
 assert(await panel.isVisible());
 assert.equal(await panel.getAttribute('data-result'), result);
 const displayedBase = await panel.getAttribute('data-previous-best');
 if (previousScore === undefined) assert(!displayedBase);
 else assert.equal(displayedBase, String(previousScore));
 assert((await panel.innerText()).trim().length > 3);
 const score = await page.evaluate(k => EarthExpedition.summarize(JSON.parse(localStorage.getItem(k)).run).score, key);
 assert.equal(await panel.getAttribute('data-score'), String(score));
 return score;
}

// Pick the lowest remaining resource to reach a repeatable early ending.
async function exhaust(page) {
 for (let n = 0; n < 45; n++) {
  const run = await getRun(page);
  if (run.phase === 'ending') return run;
  if (run.phase !== 'route') { await step(page); continue; }
  const next = await page.evaluate(k => {
   const state = JSON.parse(localStorage.getItem(k)).run;
   return EarthExpedition.getRoutes(state).flatMap(route => {
    const event = EarthExpedition.chooseRoute(state, route.id);
    return EarthExpedition.getEvent(event).options.map((_, choice) => ({
     route: route.id, choice,
     lowest: Math.min(...Object.values(EarthExpedition.chooseOption(event, choice).resources))
    }));
   }).sort((a, b) => a.lowest - b.lowest)[0];
  }, key);
  await page.locator('[data-route="' + next.route + '"]').click();
  await page.locator('[data-option="' + next.choice + '"]').click();
 }
 throw Error('Early ending did not settle within 45 actions');
}
async function layout(page){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const sizes=await page.locator('#exp-stage button').evaluateAll(bs=>bs.map(b=>b.getBoundingClientRect().height));assert(sizes.every(h=>h>=44),JSON.stringify(sizes));}
(async()=>{server=http.createServer((req,res)=>{try{let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name.startsWith('/earth-online/'))name=name.slice('/earth-online'.length);const p=path.resolve(output,'.'+name);if(!p.startsWith(output+path.sep))throw Error();res.setHeader('Content-Type',p.endsWith('.html')?'text/html;charset=utf-8':'application/octet-stream');fs.createReadStream(p).on('error',()=>res.writeHead(404).end()).pipe(res);}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/earth-online/earth-online-game.html`;browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
try{
 await test('快速烟测与首屏/事件截图',async page=>{await open(page);assert.equal(await page.locator('[data-role]').count(),3);assert(await page.evaluate(()=>!!Math.seedrandom&&!!window.LZString&&!!window.EarthExpedition));await page.screenshot({path:path.join(__dirname,'v2-home-1440.png'),fullPage:false});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(__dirname,'v2-home-390.png')});await page.locator('#exp-begin').click();await page.locator('[data-route]').first().click();await page.locator('#exp-stage').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(__dirname,'v2-event-390.png')});await layout(page);});
 console.log('SMOKE_SCREENSHOTS_READY');
 if(process.env.QA_SMOKE_ONLY)return;
 await test('同文档分享链接变化即时呈现邀请并保留现有旅程',async page=>{await open(page);await page.locator('#exp-begin').click();const before=await getRun(page),c=await code(page,'qa-hashchange','envoy');await page.goto(base+'#run='+c);await page.locator('#exp-accept-shared').waitFor();assert.deepEqual(await getRun(page),before);});
 await test('每日挑战采用北京时间日期，三种角色起点正确',async page=>{await open(page);const day=await page.evaluate(()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));assert.equal(await page.locator('#exp-day').textContent(),day);await page.locator('[data-role="planner"]').click();await page.locator('#exp-begin').click();const s=await getRun(page);assert.equal(s.role,'planner');assert.equal(s.seed,'day-'+day);assert.deepEqual(s.resources,{stamina:58,supply:78,trust:50});});
 await test('路线预览/实际delta一致且双击不重复结算',async page=>{await sharedStart(page);await page.locator('[data-route]').first().click();const before=await getRun(page),expected=await page.evaluate(k=>EarthExpedition.getEvent(JSON.parse(localStorage.getItem(k)).run).options[0].delta,key);await page.locator('[data-option="0"]').evaluate(b=>{b.click();b.click();});const after=await getRun(page);assert.equal(after.turn,1);assert.equal(after.phase,'feedback');for(const k of Object.keys(expected))assert.equal(after.resources[k],before.resources[k]+expected[k]);assert.equal(after.history.length,1);});
 await test('复盘在手机上可试算两种选择，结算成绩与存档保持一致', async page => {
  await sharedStart(page, 'qa-alternate');
  const run = await finish(page);
  const saved = await page.evaluate(k => localStorage.getItem(k), key);
  await page.locator('.exp-recap > summary').click();
  const station = page.locator('.exp-recap-station').last();
  await station.locator('.exp-alternate summary').click();
  const select = station.getByRole('combobox');
  const options = await select.locator('option').evaluateAll(items => items.map(o => o.value));
  assert.equal(options.length, 2);
  const actual = run.history.at(-1);
  assert(!options.includes(String(actual.choice)));
  for (const index of options) {
   await select.selectOption(index);
   const preview = await page.evaluate(({run,index}) => {
    const before = EarthExpedition.decisionAt(run, run.turn);
    return EarthExpedition.chooseOption(before, Number(index));
   }, {run,index});
   const content = await station.locator('.exp-alternate-result').innerText();
   for (const [k,v] of Object.entries({stamina:'体力',supply:'补给',trust:'声望'}))
    assert(content.includes(v+' '+preview.resources[k]+'（'));
   assert(content.includes('本站见识 +'+preview.lastOutcome.insight));
  }
  assert.equal(await page.evaluate(k => localStorage.getItem(k), key), saved);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
 }, {viewport:{width:320,height:800}});
 await test('十二站通关、复盘、战报编码反馈与重试、下载 PNG 及同局重开', async page => {
  await sharedStart(page, 'qa-world-12');
  const finished = await finish(page);
  assert.equal(finished.turn, 12);
  assert.equal(finished.relics.length, 3);
  assert(finished.ending.success);
  await assertVisibleRecap(page, finished);
  const profile = await page.evaluate(k => JSON.parse(localStorage.getItem(k)).profile, key);
  await page.reload();
  assert.deepEqual(await page.evaluate(k => JSON.parse(localStorage.getItem(k)).profile, key), profile);
  await page.locator('#exp-stage').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(__dirname, 'v2-ending-1440.png')});
  await page.getByRole('button', {name:'生成我的山河战报'}).click();
  const link = await page.locator('#exp-share-link').inputValue();
  assert.match(link, /#run=/);
  const decoded = await page.evaluate(url => EarthExpeditionShare.decode(url.split('#run=')[1]), link);
  assert.deepEqual(decoded, {seed:finished.seed, role:finished.role});

  const downloadButton = page.locator('#exp-download-card');
  const status = page.locator('#exp-share-status');
  await page.evaluate(() => {
   const canvas = document.getElementById('exp-share-canvas');
   window.pendingEncodes = [];
   canvas.toBlob = callback => window.pendingEncodes.push(callback);
  });
  await downloadButton.click();
  assert(await downloadButton.isDisabled());
  assert.match(await status.innerText(), /正在生成/);
  await downloadButton.evaluate(button => button.click());
  assert.equal(await page.evaluate(() => window.pendingEncodes.length), 1);
  await page.evaluate(() => {
   delete document.getElementById('exp-share-canvas').toBlob;
   window.pendingEncodes.pop()(null);
  });
  assert(await downloadButton.isEnabled());
  assert.match(await status.innerText(), /失败.*重试/);
  // A busy Chrome instance can defer canvas encoding for several seconds.
  const [download] = await Promise.all([
   page.waitForEvent('download', {timeout:30000}),
   downloadButton.click()
  ]);
  assert(await downloadButton.isEnabled());
  const bytes = fs.readFileSync(await download.path());
  assert.deepEqual([...bytes.subarray(0,8)], [137,80,78,71,13,10,26,10]);
  assert(bytes.length > 20000);
  assert.equal(bytes.readUInt32BE(16), 900);
  assert.equal(bytes.readUInt32BE(20), 1200);
  fs.writeFileSync(path.join(__dirname, 'v2-share-card.png'), bytes);
  await page.locator('#exp-share-close').click();
  await page.getByRole('button', {name:'同一开局，再走一遍'}).click();
  const again = await getRun(page);
  assert.equal(again.seed, finished.seed);
  assert.equal(again.role, finished.role);
  assert.equal(again.turn, 0);
 });
 await test('相同种子角色与UI取舍产生相同整局结果',async page=>{await sharedStart(page,'qa-deterministic');const one=await finish(page);const isolated=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});try{const other=await isolated.newPage();other.setDefaultTimeout(6000);await sharedStart(other,'qa-deterministic');const two=await finish(other);assert.deepEqual(two,one);}finally{await isolated.close();}});
 await test('刷新后首页继续同一局，可返回事件、反馈和赠印阶段', async page => {
  await sharedStart(page, 'qa-refresh');
  await page.locator('[data-route]').first().click();
  async function resumeFromHome() {
   const before = await getRun(page);
   await page.reload();
   const resume = page.locator('#exp-resume');
   assert(await resume.isVisible());
   await resume.click();
   assert.deepEqual(await getRun(page), before);
   assert.equal(await page.locator('#exp-confirm-dialog').isVisible(), false);
   assert.equal(await page.evaluate(() => document.activeElement.id), 'exp-stage-title');
  }
  await resumeFromHome();
  await step(page);
  await resumeFromHome();
  while ((await getRun(page)).phase !== 'relic') await step(page);
  await resumeFromHome();
  assert.equal(await page.locator('[data-relic]').count(), 3);
  await page.locator('[data-relic]').first().click();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'exp-stage-title');
 });
 await test('导出导入续局、替换确认及双模式记录保护',async(page,context)=>{await context.addInitScript(()=>{localStorage.setItem('earth-online-manual-v1','{"notes":{"yijing":"保留心得"}}');localStorage.setItem('earth-online-game-v1','{"kind":"earth-online-game","version":1,"records":{},"current":null}');});await sharedStart(page,'qa-export');await step(page);const s=await getRun(page),bytes=await exported(page),old=await page.evaluate(()=>localStorage.getItem('earth-online-game-v1'));await page.locator('#exp-new').click();await page.locator('#exp-cancel-new').click();assert.deepEqual(await getRun(page),s);await page.locator('#exp-new').click();await page.locator('#exp-confirm-new').click();await page.locator('#exp-begin').click();await importData(page,bytes);await page.locator('#exp-confirm-new').click();assert.deepEqual(await getRun(page),s);assert.equal(await page.evaluate(()=>localStorage.getItem('earth-online-game-v1')),old);assert.match(await page.evaluate(()=>localStorage.getItem('earth-online-manual-v1')),/保留心得/);});
 await test('非法/篡改/过大存档拒绝且当前旅程不变',async page=>{await sharedStart(page,'qa-bad-import');const before=await getRun(page);for(const data of ['{bad',JSON.stringify({kind:'earth-online-expedition-run',version:2,run:{...before,resources:{stamina:100,supply:100,trust:100}}}),' '.repeat(150001)]){await importData(page,data);await page.waitForFunction(()=>document.querySelector('#exp-import-status').textContent.startsWith('未导入'));assert.deepEqual(await getRun(page),before);}});
 await test('损坏本机存档不覆盖旧数据且可重新启程',async(page,context)=>{await context.addInitScript(()=>localStorage.setItem('earth-online-expedition-v2','broken-json'));await open(page);assert(await page.locator('#exp-storage-warning').isVisible());assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),'broken-json');await page.locator('#exp-begin').click();assert.equal((await getRun(page)).phase,'route');});
 await test('分享口令验证上限/字段白名单/错误链接保护',async page=>{await sharedStart(page,'qa-share');const before=await getRun(page);const result=await page.evaluate(()=>{const invalid=['x'.repeat(321),'bad!?',LZString.compressToEncodedURIComponent(JSON.stringify({v:2,seed:'qa',role:'walker',notes:'private'})),LZString.compressToEncodedURIComponent(JSON.stringify({v:2,seed:'<svg>',role:'walker'}))];return invalid.map(c=>{try{EarthExpeditionShare.decode(c);return false;}catch{return true;}});});assert(result.every(Boolean));await page.goto(base+'#run=bad!?');assert.deepEqual(await getRun(page),before);assert.match(await page.locator('#exp-status').textContent(),/无效/);});
 await test('存储被禁用仍可选择并导出续局',async(page,context)=>{await context.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Disabled','QuotaExceededError');};});await open(page);await page.locator('#exp-begin').click();await page.locator('[data-route]').first().click();await page.locator('[data-option]').first().click();assert(await page.locator('#exp-storage-warning').isVisible());const data=JSON.parse((await exported(page)).toString('utf8'));assert.equal(data.run.turn,1);assert.equal(data.run.phase,'feedback');});
 for(const width of [320,390,1440])await test(width+'px路线/事件/反馈布局与目标尺寸',async page=>{await sharedStart(page,'qa-responsive');await layout(page);await page.locator('#exp-board').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(__dirname,`v2-route-${width}.png`)});await page.locator('[data-route]').first().click();await layout(page);await page.locator('[data-option]').first().click();await layout(page);await page.screenshot({path:path.join(__dirname,`v2-feedback-${width}.png`)});},{viewport:{width,height:900}});
 await test('断网file协议可玩远征且无外部请求',async(page,context)=>{const remote=[];page.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url());});await context.setOffline(true);await page.goto(pathToFileURL(file).href);await page.locator('#exp-begin').click();await page.locator('[data-route]').first().click();await page.locator('[data-option]').first().click();assert.equal((await getRun(page)).turn,1);assert.deepEqual(remote,[]);});
 await test('旧剧情进行中不遮挡远征恢复，规则对话框可Escape关闭',async page=>{await open(page);await page.locator('#start-game').click();await page.locator('#enter-chapter').click();await page.locator('#close-quest').click();await page.locator('#exp-begin').click();await page.reload();assert.equal(await page.locator('#quest-panel').isVisible(),false);assert.equal((await getRun(page)).phase,'route');await page.locator('#exp-rules-open').click();assert(await page.locator('#exp-rules-dialog').isVisible());await page.keyboard.press('Escape');assert.equal(await page.locator('#exp-rules-dialog').isVisible(),false);});
 await test('资源归零的归营复盘逐站展示真实资源收支，手机可回看最后一站', async page => {
  await sharedStart(page, 'qa-exhaustion');
  const run = await exhaust(page);
  assert(run.turn < 12 && !run.ending.success);
  assert(Object.values(run.resources).some(value => value === 0));
  assert(await page.locator('.exp-ending .exp-subtitle').textContent());
  assert(await page.getByRole('button', {name: '同一开局，再走一遍'}).isVisible());
  await assertVisibleRecap(page, run);
  await page.locator('.exp-recap > summary').evaluate(summary => summary.scrollIntoView({block:'start'}));
  await page.screenshot({path:path.join(__dirname, 'v2-recap-320.png')});
 }, {viewport: {width: 320, height: 844}});
 await test('分享保留部署子路径、剪贴板拒绝可手动复制、减少动态不放烟花',async(page,context)=>{await context.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new DOMException('Denied'))}});});const hosted='https://earth-online.example/nested/game/earth-online-game.html';await page.route('https://earth-online.example/**',route=>route.fulfill({path:file,contentType:'text/html; charset=utf-8'}));await page.goto(hosted);await page.evaluate(()=>{window.__confettiCalls=0;window.confetti=()=>window.__confettiCalls++;});await page.locator('#exp-begin').click();await finish(page);assert.equal(await page.evaluate(()=>window.__confettiCalls),0);await page.getByRole('button',{name:'生成我的山河战报'}).click();assert((await page.locator('#exp-share-link').inputValue()).startsWith(hosted+'#run='));await page.locator('#exp-copy-link').click();assert.match(await page.locator('#exp-share-status').textContent(),/已选中|请复制/);assert(await page.locator('#exp-share-link').evaluate(e=>e.selectionEnd-e.selectionStart===e.value.length));await page.setViewportSize({width:320,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(__dirname,'v2-share-dialog-320.png')});});

 await test('只用键盘走完一程：数字与字母选择、Enter 继续，输入框与对话框不被劫持',async page=>{await sharedStart(page,'qa-keyboard');await page.locator('#exp-stage .exp-key-hint').waitFor();await page.keyboard.press('a');assert.equal((await getRun(page)).phase,'route','字母键不应在选路阶段生效');await page.locator('#exp-rules-open').click();await page.keyboard.press('1');assert.equal((await getRun(page)).phase,'route','对话框打开时不响应快捷键');await page.keyboard.press('Escape');await page.locator('#exp-stage-title').focus();let guard=0,keys=0;while((await getRun(page)).phase!=='ending'){assert(++guard<45);const s=await getRun(page);if(s.phase==='route'){const pick=await routeChoice(page);await page.keyboard.press(String(['quiet','venture','hazard'].indexOf(pick.route)+1));assert.equal((await getRun(page)).phase,'event');await page.keyboard.press(guard%2?'abc'[pick.choice]:String(pick.choice+1));}else if(s.phase==='feedback')await page.keyboard.press('Enter');else if(s.phase==='relic')await page.keyboard.press('2');const n=await getRun(page);assert.notDeepEqual(n,s,'按键应推进旅程');keys++;assert.equal(await page.evaluate(()=>document.activeElement.id),'exp-stage-title');}const end=await getRun(page);assert.equal(end.turn,12);assert.equal(end.relics.length,3);assert(keys>=24);});
 await test('结局图鉴、今日记录、连续天数与新纪录提示随结算更新并在刷新后保留',async(page,context)=>{await context.addInitScript(k=>{if(localStorage.getItem(k))return;const fmt=d=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;},today=fmt(new Date()),yesterday=new Date(Date.parse(today+'T00:00:00Z')-864e5).toISOString().slice(0,10);localStorage.setItem(k,JSON.stringify({kind:'earth-online-expedition',version:2,run:null,profile:{best:10,finished:1,cleared:0,endings:['rest'],last:{title:'歇脚重整',score:10},streak:{last:yesterday,count:2}},mode:'daily',attempt:'',recorded:''}));},key);await open(page);assert.equal(await page.locator('#exp-endings .exp-ending-chip').count(),9);assert.equal(await page.locator('#exp-endings .exp-ending-chip.found').count(),1);assert.equal(await page.locator('#exp-ending-count').textContent(),'1 / 9');assert.match(await page.locator('#exp-daily-record').textContent(),/尚未挑战 · 连续 2 天/);await page.locator('#exp-begin').click();const s=await finish(page);assert(s.seed.startsWith('day-'));assert(s.ending.success);assert.equal(await page.locator('#exp-ending-count').textContent(),'2 / 9');assert.equal(await page.locator('#exp-endings .exp-ending-chip.found').count(),2);assert((await page.locator('#exp-endings .exp-ending-chip.found').allTextContents()).includes(s.ending.title));const noteText=await page.locator('.exp-record-note').textContent();assert.match(noteText,/本机新纪录/);assert.match(noteText,/新结局 · 已遇见 2 \/ 9/);const record=await page.locator('#exp-daily-record').textContent();assert.match(record,/今日山河已走过 · 最佳 \d+ 分 · 连续 3 天/);const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).profile,key);assert.equal(saved.streak.count,3);assert.equal(saved.daily.best,saved.best);await page.getByRole('button',{name:'同一开局，再走一遍'}).click();await finish(page);assert.equal((await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).profile,key)).streak.count,3,'同一天重复挑战不重复累计');assert.equal(await page.locator('.exp-record-note').count(),0,'未破纪录且无新结局时不显示提示');await page.reload();assert.equal(await page.locator('#exp-daily-record').textContent(),record);assert.equal(await page.locator('#exp-ending-count').textContent(),'2 / 9');});
 await test('会让资源归零的选项带有归营提示，且与引擎预览一致',async page=>{await sharedStart(page,'qa-exhaustion');let guard=0,fatalSeen=0,safeSeen=0;while((await getRun(page)).phase!=='ending'){assert(++guard<40);const s=await getRun(page);if(s.phase==='route'){const pick=await page.evaluate(k=>{const E=EarthExpedition,s=JSON.parse(localStorage.getItem(k)).run;return E.getRoutes(s).flatMap(r=>E.getEvent(E.chooseRoute(s,r.id)).options.map((_,i)=>{const n=E.chooseOption(E.chooseRoute(s,r.id),i);return {route:r.id,choice:i,v:Math.min(...Object.values(n.resources))};})).sort((a,b)=>a.v-b.v)[0];},key);await page.locator(`[data-route="${pick.route}"]`).click();const expected=await page.evaluate(k=>{const E=EarthExpedition,s=JSON.parse(localStorage.getItem(k)).run;return E.getEvent(s).options.map(o=>Object.keys(s.resources).some(r=>s.resources[r]+o.delta[r]<=0));},key);const shown=await page.locator('[data-option]').evaluateAll(bs=>bs.map(b=>b.classList.contains('exp-option-fatal')&&!!b.querySelector('.exp-fatal')));assert.deepEqual(shown,expected);fatalSeen+=expected.filter(Boolean).length;safeSeen+=expected.filter(x=>!x).length;await page.locator(`[data-option="${pick.choice}"]`).click();}else await step(page);}assert(fatalSeen>=1,'应至少出现一次归营提示');assert(safeSeen>=1);assert(!(await getRun(page)).ending.success);});
 await test('页面元信息、图标与入口页标题一致，系统分享在不支持时保持隐藏',async page=>{await open(page);assert.equal(await page.title(),'地球 Online · 山河远征');assert.equal(await page.locator('meta[property="og:title"]').getAttribute('content'),'地球 Online · 山河远征');assert((await page.locator('meta[property="og:description"]').getAttribute('content')).length>20);assert.match(await page.locator('link[rel="icon"]').getAttribute('href'),/^data:image\/svg\+xml,/);assert.match(fs.readFileSync(path.join(output,'index.html'),'utf8'),/<title>地球 Online · 山河远征<\/title>/);await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:undefined});});await page.locator('#exp-begin').click();await finish(page);await page.getByRole('button',{name:'生成我的山河战报'}).click();assert.equal(await page.locator('#exp-native-share').isVisible(),false);await page.locator('#exp-share-close').click();await page.evaluate(()=>{window.__shared=null;Object.defineProperty(navigator,'share',{configurable:true,value:d=>{window.__shared=d;return Promise.resolve();}});});await page.getByRole('button',{name:'生成我的山河战报'}).click();await page.locator('#exp-native-share').click();const sent=await page.evaluate(()=>window.__shared);assert.match(sent.url,/#run=/);assert.match(sent.text,/分。/);assert.deepEqual(Object.keys(sent).sort(),['text','title','url']);assert.match(await page.locator('#exp-share-status').textContent(),/系统分享/);});
 await test('同局重玩按真实历史最佳比较，刷新不重复登记，导入已结算存档不计成绩', async page => {
  await sharedStart(page, 'qa-personal-best');
  const weak = await exhaust(page);
  const weakScore = await assertComparison(page, 'first');
  const retry = page.getByRole('button', {name: '同一开局，再走一遍'});
  await retry.click();
  await finish(page);
  const bestScore = await assertComparison(page, 'improved', weakScore);
  assert(bestScore > weakScore);
  await page.reload();
  assert.equal(await assertComparison(page, 'improved', weakScore), bestScore);
  await retry.click();
  await exhaust(page);
  assert.equal(await assertComparison(page, 'lower', bestScore), weakScore);
  await retry.click();
  await finish(page);
  assert.equal(await assertComparison(page, 'tied', bestScore), bestScore);
  const profile = await page.evaluate(k => JSON.parse(localStorage.getItem(k)).profile, key);
  assert.equal(profile.finished, 4);
  await importData(page, JSON.stringify({kind:'earth-online-expedition-run', version:2, run:weak}));
  await page.locator('#exp-personal-comparison[data-result="unranked"]').waitFor();
  await assertComparison(page, 'unranked');
  assert.deepEqual(await page.evaluate(k => JSON.parse(localStorage.getItem(k)).profile, key), profile);
  assert.equal(await page.locator('#exp-resume').isVisible(), false);
 });

 await test('旧档保留总体纪录，同图换角色或同角色换种子都独立计分', async (page, context) => {
  const legacyProfile = {best:9999, finished:1, cleared:1, endings:['home'], last:{title:'灯火可归',score:9999}};
  await context.addInitScript(({key, profile}) => {
   if (!localStorage.getItem(key)) {
    localStorage.setItem(key, JSON.stringify({kind:'earth-online-expedition', version:2, run:null,
     profile, mode:'free', attempt:'', recorded:''}));
   }
  }, {key, profile:legacyProfile});
  for (const [seed, role] of [['qa-first','walker'], ['qa-first','planner'], ['qa-other','walker']]) {
   await sharedStart(page, seed, role);
   await exhaust(page);
   await assertComparison(page, 'first');
  }
  const profile = await page.evaluate(k => JSON.parse(localStorage.getItem(k)).profile, key);
  assert.equal(profile.best, legacyProfile.best);
  assert.equal(profile.finished, 4);
  await page.evaluate(k => {
   const old = JSON.parse(localStorage.getItem(k));
   delete old.comparison;
   localStorage.setItem(k, JSON.stringify(old));
  }, key);
  await page.reload();
  await assertComparison(page, 'unranked');
  assert.deepEqual(await page.evaluate(k => JSON.parse(localStorage.getItem(k)).profile, key), profile);
  const partial = await page.evaluate(() => {
   const expedition = EarthExpedition.create({seed:'qa-partial-import', role:'walker'});
   return EarthExpedition.chooseRoute(expedition, EarthExpedition.getRoutes(expedition)[0].id);
  });
  await importData(page, JSON.stringify({kind:'earth-online-expedition-run', version:2, run:partial}));
  await page.locator('#exp-resume').waitFor();
  await page.reload();
  await page.locator('#exp-resume').click();
  assert.deepEqual(await getRun(page), partial);
  await exhaust(page);
  await assertComparison(page, 'first');
  assert.equal(await page.evaluate(k => JSON.parse(localStorage.getItem(k)).profile.finished, key), 5);
 });
}finally{await browser?.close();await new Promise(r=>server.close(r));report.buildUnchangedDuringRun=report.buildSha256===hash();fs.writeFileSync(path.join(__dirname,'expedition-browser-qa.json'),JSON.stringify(report,null,2));}console.log(JSON.stringify({passed:report.tests.filter(x=>x.pass).length,total:report.tests.length,buildUnchangedDuringRun:report.buildUnchangedDuringRun},null,2));if(report.tests.some(x=>!x.pass)||!report.buildUnchangedDuringRun)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;server?.close();});
