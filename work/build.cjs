const fs=require('fs');
const path=require('path');
const {normalizedBook,fullBook}=require('./full-book.cjs');
const root=path.resolve(__dirname,'..');
const books=JSON.parse(fs.readFileSync(path.join(__dirname,'books.json'),'utf8').replace(/^\uFEFF/,''));
const route=JSON.parse(fs.readFileSync(path.join(__dirname,'reading-route.json'),'utf8').replace(/^\uFEFF/,''));
const notes={
 yijing:'《周易》繁体 TXT，按篇保存，含六十四卦及《系辞》《说卦》等传文。',
 daodejing:'收录 81 章，可按章离线阅读与搜索；保留来源版本的文字与标点。',
 zhuangzi:'《庄子》33 篇繁体 TXT，含内篇、外篇和杂篇。',
 bazi:'图片未注明作者或版本。此处提供相关原典《子平真诠评注》，尚不能确定为图片中的某一本同名书。',
 neijing:'收录《素问》与《灵枢经》各 81 篇，以及来源版本的序文。篇章目录可切换阅读。',
 yunqi:'图片未注明作者或版本。此处提供相关原典《素问》运气七篇，尚不能确定某一本同名著作。',
 mao:'第一至第五卷已转换为 HTML 文字，保留原文件页序，可选卷阅读与搜索。',
 sunzi:'收录十三篇正文，含《始计篇》至《用间篇》，可离线阅读与搜索。',
 yinfu:'《黄帝阴符经》TXT 原文，上、中、下三章，文件标注底本为《正统道藏》。',
 qiti:'上下册共 512 页，已逐页识别为 HTML 文字。识别结果未逐字校订，可展开原页核对图示与文字。'
};
books.forEach(b=>{b.note=notes[b.id]||b.note;if(b.id==='mao')b.shortTitle='毛选';});
const embed=x=>JSON.stringify(x).replace(/</g,'\\u003c');
let template=fs.readFileSync(path.join(__dirname,'manual-template.html'),'utf8');
template=template.replace('__BOOK_DATA__',embed(books)).replace('__ROUTE_DATA__',embed(route));
if(template.includes('__OFFLINE_SCRIPT__')){
 const library={};
 for(const book of books){
  const p=path.join(__dirname,'download-manifests',book.id+'.json');
  if(!fs.existsSync(p))throw new Error('Missing local book manifest: '+book.id);
  const item=JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
  if(item.id!==book.id||!['text','pdf'].includes(item.kind)||!Array.isArray(item.files)||!item.files.length)throw new Error('Invalid manifest: '+book.id);
  for(const f of item.files){
   if(!f.path.startsWith('books/')||f.path.includes('..'))throw new Error('Unsafe book path');
   const local=path.join(root,'outputs',f.path);
   if(!fs.existsSync(local)||fs.statSync(local).size!==f.bytes)throw new Error('Missing or inconsistent file: '+f.path);
  }
  if(item.kind==='text'&&(!item.sections.length||item.sections.some(s=>!s.title||!s.text||!s.text.trim())))throw new Error('Incomplete text: '+book.id);
  library[book.id]=normalizedBook(item,root);
 }
 const bookmarkBooks=books.map(book=>({id:book.id,title:book.title,sectionCount:library[book.id].sections.length,htmlPath:library[book.id].htmlPath}));
 for(const book of books)fullBook(library[book.id],book,root,bookmarkBooks);
 const enhancements=['search-normalizer.js','search-index.js','bookmark-store.js','bookmarks.js','reading-appearance.js','page-jump.js'].map(file=>fs.readFileSync(path.join(__dirname,file),'utf8')).join('\n');
 const offlineScript=fs.readFileSync(path.join(__dirname,'offline-reader.js'),'utf8').replace('__LIBRARY_DATA__',embed(library));
 template=template.replace('__OFFLINE_CSS__',()=>['offline-reader.css','bookmarks.css','reading-appearance.css','page-jump.css','search-options.css'].map(file=>fs.readFileSync(path.join(__dirname,file),'utf8')).join('\n'))
  .replace('__OFFLINE_PANE__',()=>fs.readFileSync(path.join(__dirname,'offline-pane.html'),'utf8'))
  .replace('__OFFLINE_SCRIPT__',()=>offlineScript)
  .replace('__READER_ENHANCEMENTS__',()=>enhancements)
  .replace('__BOOKMARKS_INIT__',()=>fs.readFileSync(path.join(__dirname,'bookmarks-main.js'),'utf8').replace('__BOOKMARK_BOOKS__',embed(bookmarkBooks)))
  .replace('__ARCHIVE_SCRIPT__',()=>fs.readFileSync(path.join(__dirname,'archive.js'),'utf8'));
 const catalog=Object.values(library).map(({sections,...b})=>({...b,sectionCount:sections.length,characters:sections.reduce((n,s)=>n+s.text.length,0)}));
 fs.mkdirSync(path.join(root,'outputs','books'),{recursive:true});
 fs.writeFileSync(path.join(root,'outputs','books','download-catalog.json'),JSON.stringify({title:'地球 Online 本地书库',downloaded:'2026-09-16',books:catalog},null,2),'utf8');
}
if(/__(?:BOOK_DATA|ROUTE_DATA|OFFLINE_|LIBRARY_DATA|BOOKMARK|READER_ENHANCEMENTS)/.test(template))throw new Error('Unresolved template slot');
fs.mkdirSync(path.join(root,'outputs'),{recursive:true});
fs.writeFileSync(path.join(root,'outputs','earth-online-manual.html'),template,'utf8');
console.log('Built standalone manual: '+Buffer.byteLength(template)+' bytes; '+books.length+' books; '+books.reduce((n,b)=>n+b.links.length,0)+' source links.');
