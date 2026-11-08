const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const content=fs.readFileSync(path.join(__dirname,'game-content.js'),'utf8');const sandbox={window:{}};vm.runInNewContext(content,sandbox);
const chapters=sandbox.window.EARTH_GAME_CHAPTERS,finale=sandbox.window.EARTH_GAME_FINALE;
if(chapters.length!==10)throw Error('Expected ten chapters');
for(const c of [...chapters,finale]){if(c.scenes.length!==3)throw Error('Expected three scenes: '+c.id);for(const s of c.scenes)if(s.choices.length!==3||s.choices.map(c=>c.score).sort().join(',')!=='0,1,2')throw Error('Invalid choices: '+c.id);if(!fs.existsSync(path.join(root,'outputs',c.reading.href.split('#')[0])))throw Error('Missing reader: '+c.id);}
const game=fs.readFileSync(path.join(__dirname,'game-template.html'),'utf8').replace('__GAME_CSS__',()=>fs.readFileSync(path.join(__dirname,'game.css'),'utf8')).replace('__GAME_CONTENT__',()=>content.replace(/<\/script/gi,'<\\/script')).replace('__GAME_JS__',()=>fs.readFileSync(path.join(__dirname,'game.js'),'utf8'));
if(/__GAME_/.test(game))throw Error('Unresolved game slot');
fs.writeFileSync(path.join(root,'outputs','earth-online-game.html'),game,'utf8');
fs.writeFileSync(path.join(root,'outputs','index.html'),'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=earth-online-game.html"><title>地球 Online · 入世之旅</title></head><body><a href="earth-online-game.html">进入地球 Online · 入世之旅</a></body></html>','utf8');
console.log(JSON.stringify({game:'outputs/earth-online-game.html',bytes:Buffer.byteLength(game),chapters:chapters.length,scenes:33,choices:99}));
