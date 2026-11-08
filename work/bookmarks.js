(() => {
 'use strict';
 // Text offsets survive reflow, changed fonts and a different reader layout.
 function textRange(element,offset){
  const walk=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);let node,left=Math.max(0,offset),last=null;
  while(node=walk.nextNode()){last=node;if(left<node.length){const r=document.createRange();r.setStart(node,left);r.setEnd(node,Math.min(node.length,left+1));return r;}left-=node.length;}
  if(last&&last.length){const r=document.createRange();r.setStart(last,last.length-1);r.setEnd(last,last.length);return r;}return null;
 }
 function captureTextOffset(element,line){
  const length=element.textContent.length;if(!length||element.getBoundingClientRect().top>=line)return 0;
  let low=0,high=length-1;
  while(low<high){const middle=(low+high)>>1,rect=textRange(element,middle)?.getBoundingClientRect();if(rect&&rect.bottom<=line)low=middle+1;else high=middle;}
  return low;
 }
 window.mountEarthBookmarks=function(adapter){
  const store=createBookmarkStore({books:adapter.books});window.earthBookmarkStore=store;
  const panel=document.querySelector('[data-bookmark-panel]'),list=panel.querySelector('[data-bookmark-list]'),status=panel.querySelector('[data-bookmark-status]'),undo=panel.querySelector('[data-bookmark-undo]'),add=document.querySelector('[data-bookmark-add]');
  const toast=document.createElement('p');toast.className='bookmark-toast';toast.hidden=true;toast.setAttribute('role','status');document.body.append(toast);
  const controls=document.createElement('div');controls.className='bookmark-filters';
  controls.innerHTML='<label for="bookmark-search">查找书签</label><div class="bookmark-search-row"><input id="bookmark-search" data-bookmark-search type="search" maxlength="160" placeholder="书名、章节或摘录词句"><button type="button" data-bookmark-clear aria-label="清除书签筛选">清除</button></div><label class="bookmark-scope-field" for="bookmark-scope">书籍<select id="bookmark-scope" data-bookmark-scope><option value="all">全部典籍</option></select></label>';
  const search=controls.querySelector('[data-bookmark-search]'),scope=controls.querySelector('[data-bookmark-scope]'),clear=controls.querySelector('[data-bookmark-clear]');
  for(const book of adapter.books){const option=document.createElement('option');option.value=book.id;option.textContent=book.title;scope.append(option);}
  const resultCount=document.createElement('p');resultCount.className='bookmark-status';resultCount.dataset.bookmarkResultCount='';resultCount.setAttribute('role','status');
  const capacity=document.createElement('p');capacity.className='bookmark-status';capacity.hidden=true;capacity.setAttribute('role','status');
  const more=document.createElement('button');more.className='bookmark-more';more.dataset.bookmarkMore='';more.type='button';more.hidden=true;
  list.before(controls,capacity,resultCount);list.after(more);
  let removed=null,toastTimer,signature='',query='',visibleLimit=40,composing=false;
  const allEntries=()=>store.readForExport();
  const matches=entry=>(scope.value==='all'||entry.bookId===scope.value)&&(!query||(adapter.books.find(b=>b.id===entry.bookId).title+' '+entry.title+' '+entry.excerpt).toLocaleLowerCase().includes(query));
  const capacityMessage='合并后的书签超过 500 枚，操作暂存在本页，已有书签保持原样。请先导出备份，再删除不再需要的书签。';
  function message(text){status.textContent=text;toast.textContent=text;toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast.hidden=true},4200);}
  function syncButton(entries){const current=adapter.current(),found=entries.some(e=>e.bookId===current.bookId&&e.section===current.section);add.textContent=found?'更新书签':'存书签';add.title=found?'更新本节书签到当前位置':'保存当前位置为书签';add.setAttribute('aria-label',add.title);}
  function render(){
   const entries=allEntries();syncButton(entries);const next=JSON.stringify([entries,query,scope.value,visibleLimit]);if(next===signature)return;signature=next;
   const previousScroll=list.scrollTop;panel.querySelector('[data-bookmark-count]').textContent=entries.length?' · '+entries.length:'';list.replaceChildren();
   controls.hidden=!entries.length&&!query&&scope.value==='all';resultCount.hidden=controls.hidden;
   clear.disabled=!query&&scope.value==='all'&&!search.value;
   capacity.hidden=entries.length<=500;capacity.textContent=capacity.hidden?'':capacityMessage;
   const found=entries.filter(matches).sort((a,b)=>b.updatedAt-a.updatedAt),shown=found.slice(0,visibleLimit);
   resultCount.textContent='显示 '+shown.length+' / '+found.length+' 枚匹配书签，共 '+entries.length+' 枚。';
   more.hidden=shown.length>=found.length;more.textContent='再显示 '+Math.min(40,found.length-shown.length)+' 枚';
   if(!found.length){const empty=document.createElement('p');empty.className='bookmark-empty';empty.textContent=!entries.length?'还没有书签。读到想回看的地方，点“存书签”。':'没有匹配的书签。可换个词句，或清除筛选查看全部。';list.append(empty);return;}
   for(const entry of shown){
    const row=document.createElement('div');row.className='bookmark-row';
    const open=document.createElement('button');open.type='button';open.dataset.bookmarkOpen='';open.className='bookmark-open';
    const title=document.createElement('strong'),excerpt=document.createElement('span');const book=adapter.books.find(b=>b.id===entry.bookId);
    title.textContent='《'+book.title+'》 · '+entry.title;excerpt.textContent=entry.excerpt||'本节开头';open.append(title,excerpt);open.addEventListener('click',()=>openEntry(entry));
    const remove=document.createElement('button');remove.type='button';remove.dataset.bookmarkRemove='';remove.className='bookmark-remove';remove.textContent='删除';remove.setAttribute('aria-label','删除《'+book.title+'》'+entry.title+'书签');
    remove.addEventListener('click',()=>{const result=store.remove(entry.bookId,entry.section);removed=entry;undo.hidden=false;render();message(result.reason==='capacity'?capacityMessage:result.persisted?'书签已删除，可撤销。':'书签已临时删除；浏览器存储不可用。');undo.focus({preventScroll:true});});
    row.append(open,remove);list.append(row);
   }
   list.scrollTop=previousScroll;
  }
  function filter(){query=search.value.trim().toLocaleLowerCase();visibleLimit=40;list.scrollTop=0;render();}
  search.addEventListener('compositionstart',()=>{composing=true;});
  search.addEventListener('compositionend',()=>{composing=false;filter();});
  search.addEventListener('input',event=>{if(!composing&&!event.isComposing)filter();});
  scope.addEventListener('change',filter);
  clear.addEventListener('click',()=>{search.value='';scope.value='all';composing=false;filter();search.focus({preventScroll:true});});
  more.addEventListener('click',()=>{const previous=list.querySelectorAll('[data-bookmark-open]').length;visibleLimit+=40;render();const next=list.querySelectorAll('[data-bookmark-open]')[previous];if(next){list.scrollTop+=next.getBoundingClientRect().top-list.getBoundingClientRect().top;next.focus({preventScroll:true});}});
  function openEntry(entry){
   if(adapter.open(entry)===false)return;
   requestAnimationFrame(()=>{
    const current=adapter.current();if(current.bookId!==entry.bookId||current.section!==entry.section)return;
    const range=textRange(current.element,entry.textOffset);if(range){const delta=range.getBoundingClientRect().top-adapter.line();adapter.scrollBy(delta);}
    adapter.focus();adapter.save();message('已回到书签中的词句。');render();
   });
  }
  add.addEventListener('click',()=>{
   const current=adapter.current(),text=current.element.textContent,textOffset=captureTextOffset(current.element,adapter.line()),now=Date.now();
   try{const result=store.upsert({bookId:current.bookId,section:current.section,textOffset,title:current.title.slice(0,240),excerpt:text.slice(textOffset,textOffset+90).replace(/\s+/g,' '),createdAt:now,updatedAt:now});
   render();message(result.reason==='capacity'?capacityMessage:result.persisted?'书签已保存，可在“我的书签”中回看。':document.body.classList.contains('earth-full-book')?'书签仅临时保存在当前页，请在“我的书签”中导出。':'书签仅临时保存在当前页，请及时下载完整备份。');}catch(e){message('未能添加书签。最多可保留 500 枚，请先删除不再需要的书签。');}
  });
  undo.addEventListener('click',()=>{
   if(!removed)return;
   const sameEntry=entry=>entry.bookId===removed.bookId&&entry.section===removed.section;
   const existed=allEntries().some(sameEntry),result=store.merge([removed]),restored=allEntries().find(sameEntry);
   if(!restored){render();message('未能恢复：书签已达到 500 枚，已保留撤销入口；名额腾出后可重试。');undo.focus({preventScroll:true});return;}
   const keptExisting=existed||['textOffset','title','excerpt','createdAt','updatedAt'].some(key=>restored[key]!==removed[key]);
   removed=null;undo.hidden=true;render();
   message(result.reason==='capacity'?capacityMessage:(keptExisting?(result.persisted?'本节已有新书签，已保留现有书签。':'本节已有新书签，已临时保留，请及时备份。'):(result.persisted?'已恢复删除的书签。':'书签已临时恢复，请及时备份。'))+(!matches(restored)?'当前筛选未显示这枚书签，可清除筛选查看。':''));
   list.querySelector('button')?.focus({preventScroll:true});
  });
  addEventListener('storage',event=>{if(event.key==='earth-online-bookmarks-v1'||event.key===null)render();});
  window.earthBookmarkUI={refresh:render,open:openEntry};render();
  const requested=new URL(location.href).searchParams.get('bookmark');
  if(requested!==null&&/^\d+$/.test(requested)&&adapter.shouldOpenInitialBookmark?.()!==false){const current=adapter.current(),entry=allEntries().find(e=>e.bookId===current.bookId&&e.section===Number(requested));if(entry)requestAnimationFrame(()=>openEntry(entry));}
  return window.earthBookmarkUI;
 };
})();
