(() => {
 'use strict';
 window.mountOriginalPageJump=function(adapter){
  const host=document.querySelector('[data-original-page-jump]');if(!host)return;
  host.innerHTML='<details class="page-jump" data-page-jump><summary>按原文件页码定位</summary><p class="page-jump-help">使用 PDF 文件中的页序，与书上印刷的页码可能不同。</p><div class="page-jump-fields"><label for="page-jump-volume">卷册<select id="page-jump-volume" data-page-jump-volume></select></label><label for="page-jump-number">原文件页码<input id="page-jump-number" data-page-jump-number type="text" inputmode="numeric" maxlength="6" aria-describedby="page-jump-status"></label><button type="button" data-page-jump-go>跳转</button></div></details><p id="page-jump-status" class="page-jump-status" data-page-jump-status role="status"></p>';
  const panel=host.querySelector('details'),volume=host.querySelector('select'),input=host.querySelector('input'),button=host.querySelector('button'),status=host.querySelector('[data-page-jump-status]');
  let bookId=null,book,volumes=[];
  function clearError(){input.removeAttribute('aria-invalid');status.textContent='';}
  function refresh(){
   book=adapter.book();const changed=book.id!==bookId;bookId=book.id;
   volumes=book.volumes.map(v=>({...v,pages:Math.max(0,...book.sections.filter(s=>s.volumeId===v.id).map(s=>s.pageEnd||s.pageStart||0))})).filter(v=>v.pages>0);
   host.hidden=!volumes.length;if(host.hidden){panel.open=false;return;}
   if(changed){volume.replaceChildren();for(const v of volumes){const option=document.createElement('option');option.value=v.id;option.textContent=v.label+' · '+v.pages+' 页';volume.append(option);}panel.open=false;clearError();}
   const current=book.sections[adapter.current()];
   if(current&&(changed||!host.contains(document.activeElement))){volume.value=current.volumeId;input.value=String(current.pageStart||1);}
  }
  volume.addEventListener('change',()=>{clearError();input.value='';input.focus({preventScroll:true});});
  input.addEventListener('input',clearError);
  function go(){
   const v=volumes.find(v=>v.id===volume.value),raw=input.value.trim(),page=Number(raw);
   if(!v||!/^\d+$/.test(raw)||!Number.isSafeInteger(page)||page<1||page>v.pages){input.setAttribute('aria-invalid','true');status.textContent='请输入 1—'+(v?.pages||1)+' 之间的整数页码。';input.focus({preventScroll:true});return;}
   const index=book.sections.findIndex(s=>s.volumeId===v.id&&s.pageStart<=page&&(s.pageEnd||s.pageStart)>=page);
   if(index<0){input.setAttribute('aria-invalid','true');status.textContent='这一页没有对应的阅读节，请使用篇章目录。';return;}
   clearError();panel.open=false;adapter.open(index);
   const s=book.sections[index],message='已打开 '+v.label+' · 原文件第 '+page+' 页。'+(s.pageEnd>s.pageStart?'此阅读节覆盖第 '+s.pageStart+'—'+s.pageEnd+' 页。':'');status.textContent=message;adapter.announce?.(message);
  }
  button.addEventListener('click',go);input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();go();}});
  window.earthPageJump={refresh};refresh();return window.earthPageJump;
 };
})();
