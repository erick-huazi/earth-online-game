const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const content=fs.readFileSync(path.join(__dirname,'game-content.js'),'utf8');const sandbox={window:{}};vm.runInNewContext(content,sandbox);
const chapters=sandbox.window.EARTH_GAME_CHAPTERS,finale=sandbox.window.EARTH_GAME_FINALE;
if(chapters.length!==10)throw Error('Expected ten chapters');
for(const c of [...chapters,finale]){if(c.scenes.length!==3)throw Error('Expected three scenes: '+c.id);for(const s of c.scenes)if(s.choices.length!==3||s.choices.map(c=>c.score).sort().join(',')!=='0,1,2')throw Error('Invalid choices: '+c.id);if(!fs.existsSync(path.join(root,'outputs',c.reading.href.split('#')[0])))throw Error('Missing reader: '+c.id);}
const read=file=>fs.readFileSync(path.join(__dirname,file),'utf8');
const script=file=>read(file).replace(/<\/script/gi,'<\\/script');
const vendorManifest=JSON.parse(read('vendor/manifest.json'));
const vendor=['seedrandom-3.0.5.min.js','lz-string-1.5.0.min.js','canvas-confetti-1.9.4.js'].map(file=>{const item=vendorManifest.files.find(x=>x.path==='work/vendor/'+file);if(!item||crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'vendor',file))).digest('hex')!==item.sha256)throw Error('Vendor hash mismatch: '+file);return script('vendor/'+file);}).join('\n;\n');
const game=read('game-template.html').replace('__GAME_CSS__',()=>read('game.css')+'\n'+read('expedition.css')).replace('__EXPEDITION_HTML__',()=>read('expedition-template.html')).replace('__VENDOR_JS__',()=>vendor).replace('__EXPEDITION_ENGINE__',()=>script('expedition-content.js')+'\n'+script('expedition-engine.js')).replace('__GAME_CONTENT__',()=>content.replace(/<\/script/gi,'<\\/script')).replace('__GAME_JS__',()=>read('game.js')).replace('__EXPEDITION_UI__',()=>script('expedition-ui.js'));
if(/__(?:GAME_|EXPEDITION_|VENDOR_)/.test(game))throw Error('Unresolved game slot');
fs.writeFileSync(path.join(root,'outputs','earth-online-game.html'),game,'utf8');
fs.writeFileSync(path.join(root,'outputs','index.html'),'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=earth-online-game.html"><title>地球 Online · 山河远征</title></head><body><a href="earth-online-game.html">进入地球 Online · 山河远征</a></body></html>','utf8');
console.log(JSON.stringify({game:'outputs/earth-online-game.html',bytes:Buffer.byteLength(game),chapters:chapters.length,scenes:33,choices:99}));
