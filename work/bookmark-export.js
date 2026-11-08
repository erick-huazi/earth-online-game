(() => {
 'use strict';
 const button=document.querySelector('[data-bookmark-export]');if(!button)return;
 button.addEventListener('click',()=>{
  const data={format:'earth-online-backup',version:1,manual:{completed:[],notes:{}},reading:{},fullBooks:{},bookmarks:window.earthBookmarkStore.readForExport(),appearance:{theme:document.documentElement.dataset.readingTheme||'paper'},exportedAt:new Date().toISOString()};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'})),link=document.createElement('a');
  link.href=url;link.download='地球Online-书签备份-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  document.querySelector('[data-bookmark-export-status]').textContent='书签备份已下载，可在主手册“备份与恢复”中合并。';
 });
})();
