(()=>{'use strict';
const chapters=window.EARTH_GAME_CHAPTERS,finale=window.EARTH_GAME_FINALE,all=[...chapters,finale],byId=new Map(all.map(c=>[c.id,c])),key='earth-online-game-v1';
const $=id=>document.getElementById(id),el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;};
const fresh=()=>({kind:'earth-online-game',version:1,records:{},current:null});let state=fresh(),storageOK=true,returnFocus=null;
const score=(chapter,answers)=>answers.reduce((n,a,i)=>n+chapter.scenes[i].choices[a].score,0);
const best=(id,data=state)=>data.records[id]?score(byId.get(id),data.records[id].answers):0;
const passed=(id,data=state)=>!!data.records[id]&&best(id,data)>=4;
const unlocked=(id,data=state)=>id==='finale'?chapters.every(c=>passed(c.id,data)):chapters.findIndex(c=>c.id===id)===0||passed(chapters[chapters.findIndex(c=>c.id===id)-1]?.id,data);
function validAnswers(a,min,max){return Array.isArray(a)&&a.length>=min&&a.length<=max&&a.every(x=>Number.isInteger(x)&&x>=0&&x<3);}
function validate(input){
 if(!input||input.kind!=='earth-online-game'||input.version!==1||!input.records||typeof input.records!=='object'||Array.isArray(input.records))throw Error('这不是可识别的游戏存档。');
 const data=fresh();for(const [id,r]of Object.entries(input.records)){if(!byId.has(id)||!r||!validAnswers(r.answers,3,3)||!Number.isInteger(r.attempts)||r.attempts<1||r.attempts>100000)throw Error('存档中的关卡记录不完整。');data.records[id]={answers:[...r.answers],attempts:r.attempts};}
 for(const id of Object.keys(data.records))if(!unlocked(id,data))throw Error('存档的关卡解锁顺序不完整。');
 if(input.current!==null&&input.current!==undefined){const c=input.current;if(!c||!byId.has(c.id)||!unlocked(c.id,data)||!['intro','choice','feedback','result'].includes(c.phase)||!validAnswers(c.answers,0,3))throw Error('当前关卡记录无效。');const n=c.answers.length;if((c.phase==='intro'&&n!==0)||(c.phase==='choice'&&n>=3)||(c.phase==='feedback'&&n===0)||(c.phase==='result'&&(n!==3||!data.records[c.id])))throw Error('当前场景记录不完整。');data.current={id:c.id,phase:c.phase,answers:[...c.answers]};}
 return data;
}
try{const raw=localStorage.getItem(key);if(raw)state=validate(JSON.parse(raw));}catch(e){storageOK=false;$('save-status').textContent='原存档无法读取，已暂时进入新旅程。请导出本页进度后再关闭页面。';}
function announce(message){$('game-status').textContent=message;}
function save(){try{localStorage.setItem(key,JSON.stringify(state));storageOK=true;$('save-status').textContent='旅程已自动保存到当前浏览器。换设备前可导出存档。';}catch(e){storageOK=false;$('save-status').textContent='浏览器未能保存，当前旅程仅在此页有效。请导出存档再关闭页面。';announce('当前旅程暂未保存，请使用导出存档。');}}
function nextId(){return chapters.find(c=>!passed(c.id))?.id||'finale';}
const desktop=[[10,69],[18,37],[34,20],[50,40],[64,20],[83,30],[88,60],[71,76],[48,78],[30,61]];
function trail(){const mobile=matchMedia('(max-width:760px)').matches;const points=chapters.map((c,i)=>mobile?[i%2?70:29,7+i*8.4]:desktop[i]);$('trail-path').setAttribute('d',points.map((p,i)=>(i?'L':'M')+p.join(' ')).join(' '));}
function renderWorld(){
 const count=chapters.filter(c=>passed(c.id)).length,won=passed('finale'),points=Object.keys(state.records).reduce((n,id)=>n+best(id),0);document.body.classList.toggle('victory',won);
 $('game-stats').replaceChildren(...[[count+'/10','点亮地域'],[points,'领悟'],[count,'旅途信物']].map(([value,label])=>{const d=el('div');d.append(el('strong','',value),el('span','',label));return d;}));
 $('rank').textContent=won?'自在行者':count>=7?'山河故人':count>=3?'渐入佳境':count?'循灯之人':'初入山河';
 $('journey-progress').style.width=(count*10)+'%';$('journey-progress-label').textContent=won?'十境已明，归途已通。':count===10?'十境已点亮，归途试炼等你。':`已点亮 ${count} / 10 处地域`;
 $('traveler-line').textContent=won?'归途不是终点，下一步仍由你选择。':'走过的路，会成为你的答案。';
 $('start-game').textContent=state.current?'继续经典剧情 ↗':won?'重访经典十境 ↗':count?'继续经典剧情 ↗':'经典剧情 · 33 场故事 ↗';
 $('journey-caption').textContent=state.current?'正在探索 · '+byId.get(state.current.id).title:won?'全篇通关 · 可自由重访各境':'无需账号 · 进度保存在本机';
 $('map-nodes').replaceChildren(...chapters.map((c,i)=>{const b=el('button','map-node');b.dataset.chapter=c.id;b.disabled=!unlocked(c.id);b.classList.toggle('passed',passed(c.id));b.classList.toggle('available',unlocked(c.id)&&!passed(c.id));b.style.setProperty('--x',desktop[i][0]+'%');b.style.setProperty('--y',desktop[i][1]+'%');b.style.setProperty('--mx',(i%2?70:29)+'%');b.style.setProperty('--my',(7+i*8.4)+'%');b.setAttribute('aria-label',`${i+1}. ${c.title}，${c.book}，${b.disabled?'尚未解锁':passed(c.id)?'已通关，可重访':'可探索'}`);b.append(el('span','node-glyph',passed(c.id)?'✓':b.disabled?'·':c.icon),el('span','node-name',c.title),el('span','node-book',c.book));b.addEventListener('click',()=>openChapter(c.id));return b;}));
 $('finale-node').disabled=count<10;$('finale-node').querySelector('small').textContent=won?'已经通关 · 可再挑战':count===10?'十境已明 · 归途开启':'点亮十境后开启';
 const next=byId.get(nextId());$('next-title').textContent=won?'回到人间':next.title;$('next-description').textContent=won?'你已经走完十境与归途。带着信物重访旧路，也许会看见不一样的选择。':next.prologue;$('next-quest').textContent=won?'重访终章 ↗':'前往探索 ↗';
 $('collection-count').textContent=count+' / 10 信物';$('collection').replaceChildren(...chapters.map(c=>{const unlocked=passed(c.id),d=el('div','relic'+(unlocked?' earned':''));d.append(el('span','',unlocked?c.icon:'◇'),el('strong','',unlocked?c.artifact.name:'未得之物'),el('p','',unlocked?c.artifact.desc:c.title+' · 待探索'));return d;}));trail();
}
function showQuest(){returnFocus=document.activeElement;if(!$('quest-panel').open)$('quest-panel').showModal();renderQuest();}
function openChapter(id){if(!unlocked(id))return;if(state.current?.id!==id){state.current={id,answers:[],phase:'intro'};save();}showQuest();}
function restart(){const id=state.current.id;state.current={id,answers:[],phase:'choice'};save();renderQuest();}
function closeQuest(){if($('quest-panel').open)$('quest-panel').close();renderWorld();if(returnFocus?.isConnected&&!returnFocus.disabled)returnFocus.focus({preventScroll:true});else $('start-game').focus({preventScroll:true});}
function renderQuest(){
 const current=state.current;if(!current)return;const chapter=byId.get(current.id),phase=current.phase;
 $('quest-book').textContent=(current.id==='finale'?'终章':`第 ${chapters.indexOf(chapter)+1} 境`)+ ' / '+chapter.book;
 $('quest-reading').href=chapter.reading.href;$('quest-reading').textContent=(chapter.reading.label||'翻开本关原典')+' ↗';
 $('quest-intro').hidden=phase!=='intro';$('scene-area').hidden=!['choice','feedback'].includes(phase);$('chapter-result').hidden=phase!=='result';$('hint-box').open=false;
 $('quest-title').textContent=chapter.title;$('quest-story').textContent=chapter.prologue;$('scene-progress').textContent=chapter.subtitle||'入世之旅';
 if(phase==='choice'||phase==='feedback'){
  const index=phase==='choice'?current.answers.length:current.answers.length-1,scene=chapter.scenes[index];$('scene-progress').textContent=`${chapter.title} · 第 ${index+1} / 3 次选择`;$('quest-title').textContent=scene.title;$('quest-story').textContent=scene.body;$('scene-hint').textContent=scene.hint;
  $('choices').replaceChildren(...scene.choices.map((choice,i)=>{const button=el('button','choice');button.dataset.choice=i;button.disabled=phase==='feedback';button.classList.toggle('selected',phase==='feedback'&&current.answers[index]===i);button.append(el('span','choice-letter','ABC'[i]),el('span','',choice.text));button.addEventListener('click',()=>choose(i));return button;}));
  $('choice-feedback').hidden=phase!=='feedback';if(phase==='feedback'){const choice=scene.choices[current.answers[index]];$('choice-score').textContent=choice.score===2?'领悟 +2 · 这一选择打开了新的可能':choice.score===1?'领悟 +1 · 得到一些，也留下一个问题':'领悟 +0 · 这条路也留下了提醒';$('choice-explanation').textContent=choice.feedback;$('next-scene').textContent=index===2?'查看本境结算 →':'继续前行 →';}
 }else if(phase==='result'){
  const total=score(chapter,current.answers),success=total>=4,final=current.id==='finale';$('scene-progress').textContent=final?'归途试炼 · 完成':chapter.title+' · 本次旅程结束';$('quest-title').textContent=success?(final?'你已走过山河。':'此境，已经点亮。'):'答案仍在路上。';$('quest-story').textContent=success?(final?'你带回的不是一套万能答案，而是观察、选择与行动的能力。世界不会结束；你的旅程才刚开始。':`你获得了「${chapter.artifact.name}」。${chapter.artifact.desc}`):'这一次，还差一点领悟。看看选择留下的回声，再走一次；已经点亮的地域与信物会保留。';$('result-seal').textContent=total+' / 6 点领悟';$('result-description').textContent=success?(final?'十境与终章全部完成。你可以回到地图自由重访，也可以把旅程存档导出。':'下一处地域已开放。也可以重访本境，试试另一种选择。'):'达到 4 点即可点亮本境。展开锦囊、读读原典，再试一次。';
 }
 $('quest-panel').scrollTop=0;requestAnimationFrame(()=>{const target=phase==='intro'?$('enter-chapter'):phase==='feedback'?$('next-scene'):phase==='result'?$('return-map'):$('choices').querySelector('button');target?.focus({preventScroll:true});});
}
function choose(index){if(state.current?.phase!=='choice')return;state.current.answers.push(index);state.current.phase='feedback';save();renderQuest();}
function advance(){if(state.current?.phase!=='feedback')return;if(state.current.answers.length<3)state.current.phase='choice';else{const c=state.current,chapter=byId.get(c.id),previous=state.records[c.id];state.records[c.id]={answers:!previous||score(chapter,c.answers)>score(chapter,previous.answers)?[...c.answers]:[...previous.answers],attempts:(previous?.attempts||0)+1};c.phase='result';}save();renderWorld();renderQuest();}
function exportSave(){const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='earth-online-game-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);announce('游戏存档已生成。请妥善保留下载的 JSON 文件。');}
async function importSave(event){const file=event.target.files[0];if(!file)return;try{if(file.size>100000)throw Error('文件过大，请选择本游戏导出的 JSON 存档。');const incoming=validate(JSON.parse(await file.text())),merged=validate(state);for(const [id,r]of Object.entries(incoming.records)){const old=merged.records[id];if(!old||best(id,incoming)>best(id,merged))merged.records[id]={answers:[...r.answers],attempts:Math.max(r.attempts,old?.attempts||0)};else old.attempts=Math.max(old.attempts,r.attempts);}if(!merged.current)merged.current=incoming.current;state=validate(merged);save();renderWorld();$('save-import-status').textContent=storageOK?'存档已合并，保留每关更好的成绩。':'存档已合并到此页，但尚未保存到浏览器，请导出备份。';}catch(e){$('save-import-status').textContent='未导入：'+(e instanceof SyntaxError?'文件不是有效 JSON。':e.message)+' 原有旅程保持不变。';}finally{event.target.value='';}}
 document.querySelector('.map-note').textContent='从'+chapters[0].title+'出发，循灯而行。';document.querySelector('.fiction-note').textContent='原创情境游戏 · 剧情、选项与评分不等同于原典结论。';
 $('choices').setAttribute('role','group');$('choices').setAttribute('aria-labelledby','quest-title');$('next-scene').setAttribute('aria-describedby','choice-score choice-explanation');$('return-map').setAttribute('aria-describedby','result-description');
 $('start-game').addEventListener('click',()=>openChapter(state.current?.id||nextId()));$('next-quest').addEventListener('click',()=>openChapter(nextId()));$('finale-node').addEventListener('click',()=>openChapter('finale'));
 $('enter-chapter').addEventListener('click',()=>{if(state.current?.phase!=='intro')return;state.current.phase='choice';save();renderQuest();});$('next-scene').addEventListener('click',advance);$('retry-chapter').addEventListener('click',restart);$('close-quest').addEventListener('click',closeQuest);
 $('return-map').addEventListener('click',()=>{state.current=null;save();closeQuest();$('world-map').scrollIntoView({block:'start',behavior:'smooth'});});$('quest-panel').addEventListener('cancel',event=>{event.preventDefault();closeQuest();});
 $('reset-game').addEventListener('click',()=>$('reset-dialog').showModal());$('cancel-reset').addEventListener('click',()=>$('reset-dialog').close());$('confirm-reset').addEventListener('click',()=>{state=fresh();save();$('reset-dialog').close();renderWorld();announce('已重新启程。典籍手册的阅读记录保持原样。');$('start-game').focus();});
 $('export-save').addEventListener('click',exportSave);$('import-save').addEventListener('change',importSave);matchMedia('(max-width:760px)').addEventListener('change',trail);
 let expeditionPriority=false;try{const exp=JSON.parse(localStorage.getItem('earth-online-expedition-v2')||'null');expeditionPriority=!!(exp?.run&&window.EarthExpedition?.validateRestore(exp.run));}catch(e){}
 renderWorld();if(state.current&&!expeditionPriority&&!location.hash.startsWith('#run='))showQuest();
})();
