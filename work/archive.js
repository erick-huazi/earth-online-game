// Local, versioned archives. Nothing is sent to a server.
(() => {
 const fullPrefix='earth-online-full-book-v1:';
 const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
 const validIndex=(id,index)=>Number.isInteger(index)&&index>=0&&index<localLibrary[id].sections.length;
 const finite=value=>typeof value==='number'&&Number.isFinite(value);
 let pending=null,importVersion=0;
 function normalizeBookmarks(entries){
  if(!Array.isArray(entries))return [];
  const found=[],seen=new Set();
  for(let start=0;start<entries.length;start+=500){
   for(const entry of window.earthBookmarkStore.validate(entries.slice(start,start+500))){const key=entry.bookId+':'+entry.section;if(!seen.has(key)){seen.add(key);found.push(entry);}}
  }
  return found;
 }
 function normalize(data){
  if(!object(data)||data.format!=='earth-online-backup'||data.version!==1||!object(data.manual))throw Error('请选择本手册导出的 JSON 备份。');
  const manual={selected:ids.has(data.manual.selected)?data.manual.selected:'daodejing',completed:[],notes:{}};
  if(Array.isArray(data.manual.completed))manual.completed=[...new Set(data.manual.completed.filter(id=>ids.has(id)))];
  if(object(data.manual.notes))for(const id of ids){const note=data.manual.notes[id];if(note!==undefined){if(typeof note!=='string'||note.length>8000)throw Error('心得格式或长度不正确。');manual.notes[id]=note;}}
  const noteConflicts=mergeManualConflicts(normalizeManualConflicts(data.manual.noteConflicts,true));if(Object.keys(noteConflicts).length)manual.noteConflicts=noteConflicts;
  const r=object(data.reading)?data.reading:{},reading={positions:{},offsets:{}};
  if(['full','guide'].includes(r.mode))reading.mode=r.mode;
  if(Number.isInteger(r.fontSize))reading.fontSize=Math.min(26,Math.max(16,r.fontSize));
  if(r.fontChosen===true)reading.fontChosen=true;
  for(const id of ids){
   if(validIndex(id,r.positions?.[id]))reading.positions[id]=r.positions[id];
   const o=r.offsets?.[id];if(object(o)&&validIndex(id,o.section)&&finite(o.ratio)){reading.offsets[id]={section:o.section,ratio:Math.min(1,Math.max(0,o.ratio))};if(reading.positions[id]===undefined)reading.positions[id]=o.section;}
  }
  const fullBooks={};
  for(const id of ids){
   const value=data.fullBooks?.[id];if(!object(value)||value.version!==1||!/^section-\d+$/.test(value.sectionId||''))continue;
   if(!validIndex(id,Number(value.sectionId.slice(8))))continue;
   fullBooks[id]={version:1,sectionId:value.sectionId,offset:finite(value.offset)?Math.max(0,Math.min(1e8,value.offset)):0,ratio:finite(value.ratio)?Math.min(1,Math.max(0,value.ratio)):0,fontSize:finite(value.fontSize)?Math.min(27,Math.max(15,value.fontSize)):19,atStart:Boolean(value.atStart),startOffset:finite(value.startOffset)?Math.max(0,Math.min(1e8,value.startOffset)):0,entryHash:typeof value.entryHash==='string'&&/^#(?:top|section-\d+)$/.test(value.entryHash)?value.entryHash:'',updatedAt:Date.now()};
   if(finite(value.viewportWidth)&&value.viewportWidth>0)fullBooks[id].viewportWidth=value.viewportWidth;
  }
  const bookmarks=normalizeBookmarks(data.bookmarks);
  const appearance=['paper','night','white'].includes(data.appearance?.theme)?{theme:data.appearance.theme}:null;
  return {format:'earth-online-backup',version:1,manual,reading,fullBooks,bookmarks,appearance};
 }
 function collect(){
  rememberReadingPosition();saveReading();
  const fullBooks={};for(const id of ids)try{const raw=localStorage.getItem(fullPrefix+id);if(raw)fullBooks[id]=JSON.parse(raw);}catch(e){}
  return {...normalize({format:'earth-online-backup',version:1,manual:manualSnapshotForExport(),reading:readingState,fullBooks,bookmarks:window.earthBookmarkStore?.readForExport()||[],appearance:{theme:document.documentElement.dataset.readingTheme||'paper'}}),exportedAt:new Date().toISOString()};
 }
 function downloadArchive(){
  const blob=new Blob([JSON.stringify(collect(),null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='地球Online-完整备份-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('archive-status').textContent='完整备份已下载，包含心得及副本、探索标记、阅读位置、书签与配色。';
 }
 function merged(data){
  const next=manualSnapshotForExport(),reading=JSON.parse(JSON.stringify(readingState)),full={},stats={notes:0,conflicts:0,positions:0,noteCopies:0};
  const priorCopyCount=Object.values(next.noteConflicts||{}).reduce((sum,entries)=>sum+entries.length,0),noteConflicts=mergeManualConflicts(next.noteConflicts,data.manual.noteConflicts);stats.noteCopies=Object.values(noteConflicts).reduce((sum,entries)=>sum+entries.length,0)-priorCopyCount;if(Object.keys(noteConflicts).length)next.noteConflicts=noteConflicts;
  for(const id of ids){
   const note=data.manual.notes[id];if(note){if(!next.notes[id]){next.notes[id]=note;stats.notes++;}else if(next.notes[id]!==note)stats.conflicts++;}
   const offset=reading.offsets[id],alreadyReading=validIndex(id,reading.positions[id])||(offset&&validIndex(id,offset.section)&&(offset.section>0||offset.ratio>0));
   if(!alreadyReading&&data.reading.positions[id]!==undefined){reading.positions[id]=data.reading.positions[id];if(data.reading.offsets[id])reading.offsets[id]=data.reading.offsets[id];stats.positions++;}
   try{if(!localStorage.getItem(fullPrefix+id)&&data.fullBooks[id]){full[id]=data.fullBooks[id];stats.positions++;}}catch(e){}
  }
  next.completed=[...new Set([...next.completed,...data.manual.completed])];
  // A fresh reader has no explicit chapter record; prefer the archive's font.
  const hasReadingPosition=Object.keys(readingState.positions).length||Object.values(readingState.offsets).some(o=>o.section>0||o.ratio>0);
  if(!hasReadingPosition&&!readingState.fontChosen&&readingState.fontSize===18&&data.reading.fontSize){reading.fontSize=data.reading.fontSize;reading.fontChosen=data.reading.fontChosen===true;}
  const existing=window.earthBookmarkStore?.readForExport()||[],keys=new Set(existing.map(e=>e.bookId+':'+e.section));
  const additional=data.bookmarks.filter(e=>!keys.has(e.bookId+':'+e.section));
  const bookmarks=window.earthBookmarkStore?.validate([...existing,...additional])||[];
  stats.bookmarks=Math.max(0,bookmarks.length-existing.length);
  stats.skippedBookmarks=additional.length-stats.bookmarks;stats.capacityConflict=existing.length>500;
  let currentTheme;try{currentTheme=JSON.parse(localStorage.getItem('earth-online-appearance-v1')||'null')?.theme;}catch(e){}
  const appearance=['paper','night','white'].includes(currentTheme)?null:data.appearance;
  return {manual:next,reading,fullBooks:full,bookmarks,appearance,stats};
 }
 $('archive-export').addEventListener('click',downloadArchive);
 $('archive-select').addEventListener('click',()=>$('archive-file').click());
 $('archive-file').addEventListener('change',async event=>{
  const version=++importVersion,file=event.target.files[0];pending=null;$('archive-apply').hidden=true;$('archive-apply').disabled=true;
  if(!file)return;
  $('archive-status').textContent='正在读取备份…';
  try{
   if(file.size>8*1024*1024)throw Error('文件超过 8 MB，请选择本手册导出的备份。');
   const data=normalize(JSON.parse((await file.text()).replace(/^\uFEFF/,'')));if(version!==importVersion)return;
   pending=data;const {stats}=merged(data);
   $('archive-status').textContent='预览：可补入 '+stats.notes+' 部心得、'+stats.noteCopies+' 份心得副本、'+stats.positions+' 处阅读位置、'+stats.bookmarks+' 枚书签；合并探索标记。'+(stats.conflicts?'有 '+stats.conflicts+' 部心得不同，将保留本机内容。':'已有记录会保留。')+(stats.skippedBookmarks?'另有 '+stats.skippedBookmarks+' 枚因 500 枚上限暂不合并，请保留原备份。':'')+(stats.capacityConflict?'当前有跨页面容量冲突，请先导出当前备份并删除不再需要的书签，再恢复。':'');
   $('archive-apply').hidden=false;$('archive-apply').disabled=false;
  }catch(e){if(version!==importVersion)return;$('archive-status').textContent='无法读取备份。'+(e instanceof SyntaxError?'文件不是有效的 JSON。':e.message);}
  event.target.value='';
 });
 $('archive-apply').addEventListener('click',()=>{
  if(!pending)return;
  rememberReadingPosition();
  const next=merged(pending),updates=new Map([[storageKey,JSON.stringify(next.manual)],[readingStorageKey,JSON.stringify(next.reading)]]),old=new Map();
  if(next.stats.capacityConflict){$('archive-status').textContent='暂未恢复：当前合并的书签超过 500 枚。已保留全部记录，请先导出当前备份，再删除不再需要的书签。';return;}
  for(const [id,value]of Object.entries(next.fullBooks))updates.set(fullPrefix+id,JSON.stringify(value));
  if(pending.bookmarks.length)updates.set('earth-online-bookmarks-v1',JSON.stringify({version:1,entries:next.bookmarks}));
  if(next.appearance)updates.set('earth-online-appearance-v1',JSON.stringify(next.appearance));
  try{
   for(const key of updates.keys())old.set(key,localStorage.getItem(key));
   for(const [key,value]of updates)localStorage.setItem(key,value);
  }catch(e){
   for(const [key,value]of old)try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch(ignored){}
   $('archive-status').textContent='无法保存恢复内容，浏览器存储不可用或空间不足。请先下载当前备份，再换一个可用的浏览器。';return;
  }
  acceptRestoredManual(next.manual);readingState=next.reading;storageAvailable=true;renderBook();
  window.earthBookmarkUI?.refresh();if(next.appearance)window.EarthReadingAppearance?.apply(next.appearance.theme);
  $('archive-status').textContent='已合并备份，现有心得和阅读位置已保留。新增 '+next.stats.noteCopies+' 份心得副本。'+(next.stats.skippedBookmarks?'另有 '+next.stats.skippedBookmarks+' 枚因 500 枚上限未合并，请保留原备份。':'');pending=null;$('archive-apply').hidden=true;$('archive-apply').disabled=true;announce('阅读备份已恢复。');
 });
})();
