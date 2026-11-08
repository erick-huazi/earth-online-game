(function(root){
 'use strict';
 function checkMode(mode){if(mode!=='exact'&&mode!=='flexible')throw new RangeError('Unknown search mode: '+mode);}
 function create(rows){
  if(!Array.isArray(rows))throw new TypeError('Search rows must be an array');
  const source=rows.slice(),ready=Object.create(null),inflight=Object.create(null);
  const now=root.performance&&typeof root.performance.now==='function'?()=>root.performance.now():()=>Date.now();
  function peek(mode){checkMode(mode);return ready[mode]||null;}
  function ensure(mode){
   checkMode(mode);if(inflight[mode])return inflight[mode];
   let resolve,reject;
   const task=new Promise((done,failed)=>{resolve=done;reject=failed;});inflight[mode]=task;
   const folded=new Array(source.length);let offset=0;
   function batch(){
    try{
     if(!root.EarthTextSearch)throw new Error('Load search-normalizer.js before building a search index');
     const started=now();let processed=0;
     while(offset<source.length&&processed<32&&(processed===0||now()-started<8)){
      const row=source[offset];
      folded[offset]={title:root.EarthTextSearch.fold(row.title,mode),text:root.EarthTextSearch.fold(row.text,mode)};
      offset++;processed++;
     }
     if(offset<source.length)setTimeout(batch,0);
     else{ready[mode]=folded;resolve(folded);}
    }catch(error){delete inflight[mode];reject(error);}
   }
   // Yield before the first batch too, so the caller can show a waiting state.
   setTimeout(batch,0);return task;
  }
  return Object.freeze({peek,ensure});
 }
 const api=Object.freeze({create});root.EarthSearchIndex=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
