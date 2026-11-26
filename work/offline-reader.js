const localLibrary=__LIBRARY_DATA__;
const readerParams=new URLSearchParams(location.search);
const readingGame=createReaderGameNavigation();

function applyReadingEntry(){
 readingGame.mount({
  notify:message=>{toast(message);announce(message);},
  keepReadingTab:()=>pendingNotes.size>0||pendingCompleted.size>0||pendingManualOps.size>0,
  beforeLeaving:preserveManualBeforeLeaving
 });
 const id=readerParams.get('book'),raw=readerParams.get('section');
 if(!ids.has(id)||!/^\d+$/.test(raw||''))return;
 const index=Number(raw);
 if(!Number.isSafeInteger(index)||index>=localLibrary[id].sections.length)return;
 state.selected=id;
 readingState.mode='full';
 if(readingState.offsets[id]?.section!==index)readingState.offsets[id]={section:index,ratio:0};
 readingState.positions[id]=index;
 if(save()&&saveReading()){
  const clean=new URL(location.href);
  clean.searchParams.delete('book');
  clean.searchParams.delete('section');
  try{history.replaceState(history.state,'',clean.href);}catch(e){}
 }
}

function preserveManualBeforeLeaving(link){
 rememberReadingPosition();
 if(!save()||!saveReading()||window.earthBookmarkStore?.hasPendingChanges()){
  link.target='_blank';
  link.rel='noopener';
 }
}
const readingStorageKey='earth-online-reading-v1';
let readingState={mode:'full',positions:{},offsets:{},fontSize:18,fontChosen:false};
try{const saved=JSON.parse(localStorage.getItem(readingStorageKey)||'null');if(saved&&typeof saved==='object'){if(['guide','full'].includes(saved.mode))readingState.mode=saved.mode;if(saved.positions&&typeof saved.positions==='object')for(const id of ids)if(Number.isInteger(saved.positions[id])&&saved.positions[id]>=0)readingState.positions[id]=saved.positions[id];if(Number.isInteger(saved.fontSize)){readingState.fontSize=Math.min(26,Math.max(16,saved.fontSize));readingState.fontChosen=saved.fontSize!==18;}if(saved.fontChosen===true)readingState.fontChosen=true;}}catch(e){}
try{const saved=JSON.parse(localStorage.getItem(readingStorageKey)||'null');for(const id of ids){const offset=saved?.offsets?.[id];if(offset&&Number.isInteger(offset.section)&&offset.section>=0&&Number.isFinite(offset.ratio))readingState.offsets[id]={section:offset.section,ratio:Math.min(1,Math.max(0,offset.ratio))};}}catch(e){}
let activeReader=null,restoringPosition=false,restoreFrame,positionSaveTimer;
function readerRatio(){const e=$('text-reading');return e.scrollHeight>e.clientHeight?e.scrollTop/(e.scrollHeight-e.clientHeight):0;}
function rememberReadingPosition(){if(!activeReader||restoringPosition||$('local-pane').hidden)return;readingState.offsets[activeReader.id]={section:activeReader.section,ratio:readerRatio()};}
function restoreReaderPosition(ratio){cancelAnimationFrame(restoreFrame);restoringPosition=true;const e=$('text-reading');const apply=()=>{e.scrollTop=Math.max(0,e.scrollHeight-e.clientHeight)*ratio;};apply();restoreFrame=requestAnimationFrame(()=>{apply();restoringPosition=false;});}
function savedRatio(){const value=readingState.offsets[state.selected];return value?.section===sectionIndex()?value.ratio:0;}
function saveReading(){try{localStorage.setItem(readingStorageKey,JSON.stringify(readingState));return true;}catch(e){$('reading-position').textContent='阅读位置暂存于此页面。';return false;}}
function fileSize(n){return n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB';}
function localItem(){return localLibrary[state.selected];}
function sectionIndex(){return Math.min(Math.max(0,readingState.positions[state.selected]||0),localItem().sections.length-1);}
function textFile(item){return item.files.find(f=>/(fulltext|complete|combined|全文|合并).*\.txt$/i.test(f.path))||item.files.find(f=>/utf8\.txt$/i.test(f.path))||item.files.find(f=>f.path.endsWith('.txt'));}
function localLink(file,label){const a=document.createElement('a');a.href=file.path;a.download=file.path.split('/').pop();a.textContent=label||file.label+' ↓';return a;}
function updateReadingMode(){const full=readingState.mode==='full';$('guide-pane').hidden=full;$('local-pane').hidden=!full;$('read-original').setAttribute('aria-pressed',String(full));$('read-guide').setAttribute('aria-pressed',String(!full));document.querySelector('.reading-layout').classList.toggle('is-reading',full);if(full)restoreReaderPosition(savedRatio());}
function renderLocalBook(){
 clearTimeout(searchTimer);searchVersion++;searchComposing=false;
 const item=localItem(),book=books.find(b=>b.id===state.selected);
 if(!preserveSearchNavigation){searchLimit=40;$('book-search').value='';$('book-search-scope').value='current';$('search-results').hidden=true;$('search-results').replaceChildren();$('return-search').hidden=true;}
 $('local-badge').textContent=(item.volumes.length>1?item.volumes.length+' 卷 · ':'')+'全文 HTML';$('local-description').textContent=book.note;
 $('local-provenance').textContent=(item.sourceNote||'')+' 原始下载文件、来源与校验信息保留在配套书库中。';
 $('original-sources').replaceChildren();book.links.forEach(link=>{const a=document.createElement('a');a.href=link.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=link.label+' ↗';$('original-sources').append(a);});
 item.files.filter(f=>f.path.endsWith('.pdf')).forEach(f=>$('original-sources').append(localLink(f,'原版 '+f.label+' PDF ↓')));
 const catalog=document.createElement('a');catalog.href='books/download-catalog.json';catalog.download='download-catalog.json';catalog.textContent='下载记录 ↓';$('original-sources').append(catalog);
 $('source-links').replaceChildren();$('local-downloads').replaceChildren();
 const open=document.createElement('a');open.id='open-full-book';open.className='open-book';open.href=item.htmlPath;open.rel='noopener';
 if(readingGame.mode&&storageAvailable){
  open.textContent='展开全书 HTML';
  open.addEventListener('click',()=>preserveManualBeforeLeaving(open));
 }else{
  open.target='_blank';open.textContent='展开全书 HTML ↗';open.setAttribute('aria-label','展开全书 HTML，在新标签页打开');
 }
 $('local-downloads').append(open);
 const downloads=document.createElement('details');downloads.className='download-options';const summary=document.createElement('summary');summary.textContent='保存书籍';downloads.append(summary,localLink({path:item.htmlPath},'保存本书 HTML ↓'));$('local-downloads').append(downloads);
 const txt=textFile(item);if(txt){$('source-links').append(localLink(txt,'下载收录文字 TXT ↓'));downloads.append(localLink(txt,'保存收录文字 TXT ↓'));}
 $('volume-field').hidden=item.volumes.length<2;$('volume-select').replaceChildren();item.volumes.forEach(v=>{const o=document.createElement('option');o.value=v.id;o.textContent=v.label;$('volume-select').append(o);});
 renderSection();updateReadingMode();
}
function renderChapterOptions(volumeId){const item=localItem();$('chapter-select').replaceChildren();item.sections.forEach((s,i)=>{if(s.volumeId!==volumeId)return;const o=document.createElement('option');o.value=i;o.textContent=s.pageStart?(s.title.includes('第 '+s.pageStart+' 页')?s.title:'第 '+s.pageStart+' 页 · '+s.title):String(i+1).padStart(2,'0')+' · '+s.title;$('chapter-select').append(o);});}
let chapterHits=null, currentHit=-1;
function paintReadingText(){
 const container=$('fulltext-content'),section=localItem().sections[sectionIndex()],text=section.text||'';
 const mode=currentSearchMode(),query=$('book-search').value.trim();
 if(!chapterHits || chapterHits.section!==section || chapterHits.mode!==mode || chapterHits.query!==query){
  const find=value=>mode==='terms'
   ? EarthRankedSearch.mergeRanges(EarthTextSearch.termRanges(value,EarthRankedSearch.terms(query),'flexible',value.length).flat())
   : EarthTextSearch.ranges(value,query,mode,value.length);
  const title=find(section.title),body=find(text);
  chapterHits={section,mode,query,title,body,total:title.length+body.length};
  currentHit=-1;
 }
 EarthOccurrences.paint($('section-title'),section.title,chapterHits.title,currentHit);
 EarthOccurrences.paint(container,text,chapterHits.body,currentHit-chapterHits.title.length);
 $('chapter-hits').hidden=currentHit<0;
 $('chapter-hit-count').textContent=currentHit<0?'':'本章第 '+(currentHit+1)+' / '+chapterHits.total+' 处';
 $('chapter-prev-hit').disabled=$('chapter-next-hit').disabled=chapterHits.total<2;
 container.style.fontSize=readingState.fontSize+'px';$('font-smaller').disabled=readingState.fontSize<=16;$('font-larger').disabled=readingState.fontSize>=26;$('font-value').textContent='字号 '+readingState.fontSize;
}
function showChapterHit(index) {
 currentHit=index;
 paintReadingText();
 const reader=$('text-reading'),mark=reader.querySelector('mark[aria-current]');
 if(mark)reader.scrollTop+=mark.getBoundingClientRect().top-reader.getBoundingClientRect().top-38;
}
for(const [id,delta] of [['chapter-prev-hit',-1],['chapter-next-hit',1]]){
 $(id).addEventListener('click',()=>{
  showChapterHit(EarthOccurrences.advance(currentHit,delta,chapterHits.total));
  rememberReadingPosition();saveReading();
 });
}
function renderSection(){
 const item=localItem(),i=sectionIndex(),section=item.sections[i],volume=item.volumes.find(v=>v.id===section.volumeId);
 restoringPosition=true;activeReader={id:state.selected,section:i};
 $('volume-select').value=section.volumeId;renderChapterOptions(section.volumeId);$('chapter-select').value=i;$('section-title').textContent=section.title;
 $('section-origin').textContent=section.pageStart?volume.label+' · 原文件第 '+section.pageStart+(section.pageEnd>section.pageStart?'–'+section.pageEnd:'')+' 页'+(item.ocr?' · 扫描识别文字':''):'';
 const source=$('section-source');source.replaceChildren();source.hidden=!section.sourceNote;if(section.sourceNote){source.append(document.createTextNode(section.sourceNote+' '));if(section.sourceUrl){const a=document.createElement('a');a.href=section.sourceUrl;a.target='_blank';a.rel='noopener';a.textContent='补文来源 ↗';source.append(a);}}
 const text=section.text||'';paintReadingText();
 const images=$('section-images');images.replaceChildren();for(const picture of section.images||[]){const figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');img.src=picture.path;img.alt=picture.caption||section.title+' 原页';img.loading='lazy';caption.textContent=picture.caption||'原书图页';figure.append(img,caption);if(picture.role==='facsimile'&&text.trim()){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='展开本页影像，核对文字与图示';details.append(summary,figure);images.append(details);}else images.append(figure);}
 $('empty-page').hidden=Boolean(text.trim())||Boolean(section.images?.length);$('empty-page').textContent=section.blank?'原文件空白页，已保留页序。':'本页无可提取文字。';
 const within=item.sections.filter(s=>s.volumeId===section.volumeId),localIndex=within.indexOf(section);$('section-position').textContent=(localIndex+1)+' / '+within.length+' 节';$('prev-section').disabled=i===0;$('next-section').disabled=i===item.sections.length-1;
 $('tools-current').textContent=(item.volumes.length>1?volume.label+' · ':'')+(section.pageStart?'第 '+section.pageStart+' 页':section.title);
 const fullURL=readingGame.carryTo(new URL(item.htmlPath,location.href));fullURL.hash='section-'+i;$('open-full-book').href=fullURL.href;
 restoreReaderPosition(savedRatio());window.earthBookmarkUI?.refresh();window.earthPageJump?.refresh();
}
function goSection(index){rememberReadingPosition();readingState.positions[state.selected]=Math.min(Math.max(0,index),localItem().sections.length-1);readingState.offsets[state.selected]={section:sectionIndex(),ratio:0};saveReading();renderSection();announce('已打开'+localItem().sections[sectionIndex()].title);}
function openSearchResult(index,bookId=state.selected,searchContext){
 clearTimeout(searchTimer);
 if(searchContext&&!acceptSearchContext(searchContext))return;
 if(bookId!==state.selected){preserveSearchNavigation=true;try{selectBook(bookId,false);}finally{preserveSearchNavigation=false;}}
 goSection(index);$('search-results').hidden=true;$('return-search').hidden=false;
 if(matchMedia('(max-width:760px)').matches)$('reading-tools').open=false;
 const opened=chapterHits;
 requestAnimationFrame(()=>{
  if(chapterHits!==opened||$('return-search').hidden)return;
  const reader=$('text-reading');
  showChapterHit(chapterHits.total?0:-1);
  ($('chapter-hits').hidden?reader:$('chapter-hits')).scrollIntoView({block:'start',behavior:'instant'});
  reader.focus({preventScroll:true});rememberReadingPosition();saveReading();
 });
}
let searchTimer,searchLimit=40,searchComposing=false,preserveSearchNavigation=false;
const searchTextCache=new Map();let searchVersion=0;
const currentSearchMode=()=>$('book-search-mode').value;
function acceptSearchContext(context){
 if(searchComposing)return false;
 if(context.query!==$('book-search').value.trim()||context.scope!==$('book-search-scope').value||context.mode!==currentSearchMode()||(context.scope==='current'&&context.bookId!==state.selected)){
  clearTimeout(searchTimer);searchLimit=40;searchBook();$('book-search').focus({preventScroll:true});return false;
 }
 return true;
}
function searchableSections(bookId){
 if(!searchTextCache.has(bookId))searchTextCache.set(bookId,EarthSearchIndex.create(localLibrary[bookId].sections.map(s=>({title:s.title,text:s.text||''}))));
 return searchTextCache.get(bookId);
}
function searchSnippet(section,query,mode){
 if(mode==='terms')return rankedSnippet(section.text||'',EarthRankedSearch.terms(query));
 const snippet=document.createElement('span'),text=section.text||'',hit=EarthTextSearch.ranges(text,query,mode,1)[0];
 if(!hit){snippet.textContent=text.slice(0,110).replace(/\s+/g,' ');return snippet;}
 const start=Math.max(0,hit.start-25),end=Math.min(text.length,hit.end+65),mark=document.createElement('mark');
 mark.textContent=text.slice(hit.start,hit.end);
 snippet.append(document.createTextNode((start?'…':'')+text.slice(start,hit.start).replace(/\s+/g,' ')),mark,document.createTextNode(text.slice(hit.end,end).replace(/\s+/g,' ')+(end<text.length?'…':'')));
 return snippet;
}
function rankedSnippet(text, terms) {
 const snippet=document.createElement('span');
 const hits=EarthRankedSearch.mergeRanges(EarthTextSearch.termRanges(text,terms,'flexible',1).flat());
 if(!hits.length){snippet.textContent=text.slice(0,100);return snippet;}
 const windows=EarthRankedSearch.mergeRanges(hits.map(hit=>({start:Math.max(0,hit.start-12),end:Math.min(text.length,hit.end+21)}))).slice(0,2);
 for(const [index,range] of windows.entries()){
  if(index||range.start)snippet.append('…');
  let cursor=range.start;
  for(const hit of hits.filter(hit=>hit.start>=range.start&&hit.end<=range.end)){
   snippet.append(text.slice(cursor,hit.start));
   const mark=document.createElement('mark');mark.textContent=text.slice(hit.start,hit.end);snippet.append(mark);cursor=hit.end;
  }
  snippet.append(text.slice(cursor,range.end));
 }
 if(windows[windows.length-1].end<text.length)snippet.append('…');
 return snippet;
}
async function searchBook(){
 const version=++searchVersion,query=$('book-search').value.trim(),results=$('search-results'),mode=currentSearchMode();
 const ranked=mode==='terms',foldMode=ranked?'flexible':mode;
 const needles=ranked?EarthRankedSearch.terms(query):[EarthTextSearch.fold(query,mode)].filter(Boolean);
 const all=$('book-search-scope').value==='all',searchContext={query,mode,scope:all?'all':'current',bookId:state.selected};
 const isCurrent=()=>version===searchVersion&&!searchComposing&&query===$('book-search').value.trim()&&mode===currentSearchMode()&&searchContext.scope===$('book-search-scope').value&&(all||state.selected===searchContext.bookId);
 results.replaceChildren();results.hidden=!query;$('return-search').hidden=true;
 if(!query){const ratio=readerRatio();paintReadingText();restoreReaderPosition(ratio);return;}
 const count=document.createElement('p');count.className='search-caption';count.setAttribute('role','status');results.append(count);
 if(!needles.length){count.textContent='请输入要查的词，简繁兼容检索会忽略标点和空白。';const ratio=readerRatio();paintReadingText();restoreReaderPosition(ratio);return;}
 count.textContent='正在准备离线检索…';
 const candidates=[];
 for(const book of all?books:books.filter(book=>book.id===state.selected)){
  const item=localLibrary[book.id],cached=await searchableSections(book.id).ensure(foldMode);if(!isCurrent())return;
  cached.forEach((entry,i)=>{
   if(ranked||entry.title.includes(needles[0])||entry.text.includes(needles[0]))candidates.push({book,item,i,section:item.sections[i],title:entry.title,text:entry.text});
  });
 }
 if(!isCurrent())return;
 const matches=ranked?EarthRankedSearch.rank(candidates,needles).map(i=>candidates[i]):candidates;
 count.textContent=matches.length?(all?'全部 10 本':'本书')+'找到 '+matches.length+' 节匹配'+(all?' · '+new Set(matches.map(match=>match.book.id)).size+' 本书':'')+(ranked?' · 按相关度排序':'')+(matches.length>searchLimit?'，当前展示 '+searchLimit+' 节':''):(ranked?'没有章节同时包含所查的词，可减少一个词再试。':'未找到“'+query+'”，试试更短的原文词句。');
 matches.slice(0,searchLimit).forEach(({book,item,i,section})=>{
  const button=document.createElement('button');button.type='button';button.className='search-result';
  const heading=document.createElement('strong');heading.textContent='《'+book.title+'》 · '+(item.volumes.length>1?section.volumeLabel+' · ':'')+section.title+(section.pageStart?' · 第 '+section.pageStart+' 页':'');
  button.append(heading,searchSnippet(section,query,mode));button.addEventListener('click',()=>openSearchResult(i,book.id,searchContext));results.append(button);
 });
 if(matches.length>searchLimit){const more=document.createElement('button');more.type='button';more.className='reader-tool';more.textContent='再显示 40 节';more.addEventListener('click',async()=>{if(!acceptSearchContext(searchContext))return;const position=results.scrollTop;searchLimit+=40;await searchBook();if(isCurrent()||acceptSearchContext(searchContext))results.scrollTop=position;});results.append(more);}
 const ratio=readerRatio();paintReadingText();restoreReaderPosition(ratio);
}
$('read-original').addEventListener('click',()=>{readingState.mode='full';saveReading();updateReadingMode();});$('read-guide').addEventListener('click',()=>{rememberReadingPosition();readingState.mode='guide';saveReading();updateReadingMode();});
$('volume-select').addEventListener('change',e=>goSection(localItem().sections.findIndex(s=>s.volumeId===e.target.value)));
$('chapter-select').addEventListener('change',e=>goSection(Number(e.target.value)));$('prev-section').addEventListener('click',()=>goSection(sectionIndex()-1));$('next-section').addEventListener('click',()=>goSection(sectionIndex()+1));
for(const [id,delta] of [['font-smaller',-2],['font-larger',2]])$(id).addEventListener('click',()=>{const ratio=readerRatio();rememberReadingPosition();readingState.fontSize=Math.min(26,Math.max(16,readingState.fontSize+delta));readingState.fontChosen=true;paintReadingText();restoreReaderPosition(ratio);saveReading();});
$('book-search').addEventListener('input',event=>{clearTimeout(searchTimer);searchVersion++;if(searchComposing||event.isComposing)return;searchLimit=40;searchTimer=setTimeout(searchBook,180);});
$('book-search').addEventListener('compositionstart',()=>{searchComposing=true;searchVersion++;clearTimeout(searchTimer);});
$('book-search').addEventListener('compositionend',()=>{searchComposing=false;clearTimeout(searchTimer);searchLimit=40;searchTimer=setTimeout(searchBook,180);});
$('book-search-mode').addEventListener('change',()=>{
 const ranked=currentSearchMode()==='terms';
 $('book-search-help').textContent=ranked?'用空格分开词语，查同时包含各词的章节。支持简繁。':'查一句原文，或切换到「多词同章」查几个词。';
 $('book-search').placeholder=ranked?'例如：天地 圣人':'输入想查找的词句';
 clearTimeout(searchTimer);searchVersion++;searchLimit=40;if(!searchComposing)searchBook();
});
$('book-search-scope').addEventListener('change',()=>{clearTimeout(searchTimer);searchLimit=40;if(!searchComposing)searchBook();});
$('search-clear').addEventListener('click',()=>{clearTimeout(searchTimer);searchVersion++;searchComposing=false;searchLimit=40;$('book-search').value='';searchBook();$('book-search').focus();});
$('library-stats').textContent='10 项全书 HTML · 目录与全文搜索 · 可离线阅读';

$('text-reading').addEventListener('scroll',()=>{rememberReadingPosition();clearTimeout(positionSaveTimer);positionSaveTimer=setTimeout(saveReading,180);},{passive:true});
function flushReadingPosition(){clearTimeout(positionSaveTimer);rememberReadingPosition();saveReading();}
addEventListener('pagehide',flushReadingPosition);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushReadingPosition();});
$('return-search').addEventListener('click',()=>{$('reading-tools').open=true;$('search-results').hidden=false;$('return-search').hidden=true;$('book-search').focus();});
$('book-search').addEventListener('focus',()=>{if($('book-search').value.trim()){$('search-results').hidden=false;$('return-search').hidden=true;if(currentHit>=0){currentHit=-1;paintReadingText();}}});
$('reading-tools').open=!matchMedia('(max-width:760px)').matches;
