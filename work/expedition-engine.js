/* Earth Online expedition rules. All transitions are immutable and replayable. */
(function(g){'use strict';
 const RULES='earth-expedition-2.0',TOTAL_TURNS=12,keys=['stamina','supply','trust'],events=g.EARTH_EXPEDITION_CONTENT;
 if(!Array.isArray(events)||events.length<30)throw Error('Expedition content missing');
 const relics=[
  {id:'water_seal',name:'若水印',bookId:'daodejing',icon:'水',description:'选项恢复体力时，额外恢复 4 点。',effect:'stamina_gain'},
  {id:'free_feather',name:'游心羽',bookId:'zhuangzi',icon:'羽',description:'选项获得补给时，额外获得 4 点。',effect:'supply_gain'},
  {id:'change_compass',name:'观变盘',bookId:'yijing',icon:'变',description:'走行险或险峰路线时，额外获得 3 点见识。',effect:'risk_insight'},
  {id:'grain_pouch',name:'备物囊',bookId:'bazi',icon:'囊',description:'每次选择的补给损失减少 3 点。',effect:'supply_guard'},
  {id:'medicine_herb',name:'调息签',bookId:'neijing',icon:'息',description:'每次选择后恢复 2 点体力（游戏效果）。',effect:'stamina_regen'},
  {id:'climate_dial',name:'候风仪',bookId:'yunqi',icon:'候',description:'每段路的体力与补给消耗各减少 1 点。',effect:'travel_guard'},
  {id:'practice_lamp',name:'求实灯',bookId:'mao',icon:'实',description:'每次选择额外获得 2 点见识。',effect:'insight_gain'},
  {id:'strategy_scroll',name:'筹策卷',bookId:'sunzi',icon:'策',description:'声望损失减少 3 点；险峰再得 2 点见识。',effect:'trust_guard'},
  {id:'accord_bell',name:'同声铃',bookId:'yinfu',icon:'铃',description:'选项获得声望时，额外获得 4 点。',effect:'trust_gain'},
  {id:'swift_sandals',name:'行远履',bookId:'qiti',icon:'履',description:'每段路的体力消耗减少 2 点。',effect:'travel_stamina'}
 ];
 const roles=[
  {id:'walker',name:'行者',subtitle:'敢走远路',description:'体力充足，行远履降低旅途消耗。',resources:{stamina:78,supply:54,trust:54},relicId:'swift_sandals'},
  {id:'planner',name:'筹划者',subtitle:'善留余量',description:'补给充足，备物囊减少每次补给损失。',resources:{stamina:58,supply:78,trust:50},relicId:'grain_pouch'},
  {id:'envoy',name:'联络人',subtitle:'同行有伴',description:'声望充足，同声铃放大每次声望收益。',resources:{stamina:60,supply:50,trust:76},relicId:'accord_bell'}
 ];
 const routeKinds=[
  {id:'quiet',title:'缓行小径',risk:0,subtitle:'少些消耗，稳步前行',baseCost:{stamina:-3,supply:-2,trust:0},insightBonus:0},
  {id:'venture',title:'行险山道',risk:1,subtitle:'多走一程，多一份见识',baseCost:{stamina:-5,supply:-3,trust:0},insightBonus:3},
  {id:'hazard',title:'险峰远路',risk:2,subtitle:'大量消耗，最高见识',baseCost:{stamina:-12,supply:-8,trust:0},insightBonus:7}
 ];
 const clone=x=>JSON.parse(JSON.stringify(x)),clamp=x=>Math.max(0,Math.min(100,x));
 const seeded=s=>{const factory=Math.seedrandom||g.seedrandom;if(typeof factory!=='function')throw Error('seedrandom is required');return new factory(s);};
 const eventById=id=>events.find(e=>e.id===id),relicById=id=>relics.find(r=>r.id===id),roleById=id=>roles.find(r=>r.id===id),has=(s,id)=>s.relics.includes(id);
 const requirePhase=(s,p)=>{if(!s||s.rules!==RULES||s.phase!==p)throw Error('Invalid expedition phase');};
 const validSeed=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,48}$/.test(s);
 function create({seed,role='walker'}={}){if(!validSeed(seed)||!roleById(role))throw Error('Invalid seed or role');const r=roleById(role);return {version:2,rules:RULES,seed,role,turn:0,phase:'route',resources:clone(r.resources),insight:0,relics:[r.relicId],routeId:null,eventId:null,lastOutcome:null,history:[],actions:[],ending:null};}
 function shuffled(list,seed){const out=list.slice(),rng=seeded(seed);for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
 function getRoutes(s){requirePhase(s,'route');const seen=new Set(s.history.map(h=>h.eventId));const pool=events.filter(e=>!seen.has(e.id));const picked=shuffled(pool,RULES+'|'+s.seed+'|routes|'+s.turn).slice(0,3);return routeKinds.map((kind,i)=>{const e=picked[i],cost=clone(kind.baseCost);if(has(s,'swift_sandals'))cost.stamina+=2;if(has(s,'climate_dial')){cost.stamina+=1;cost.supply+=1;}cost.stamina=Math.min(0,cost.stamina);cost.supply=Math.min(0,cost.supply);return {...clone(kind),eventId:e.id,eventTitle:e.title,bookId:e.bookId,book:e.book,theme:e.theme,cost};});}
 function chooseRoute(state,id){requirePhase(state,'route');const route=getRoutes(state).find(r=>r.id===id);if(!route)throw Error('Unknown route');const s=clone(state);s.phase='event';s.routeId=id;s.eventId=route.eventId;s.actions.push({t:'route',id});return s;}
 function selectedRoute(s){const probe={...s,phase:'route'};return getRoutes(probe).find(r=>r.id===s.routeId);}
 function optionPreview(s,option,route){const delta=clone(option.delta);if(delta.stamina>0&&has(s,'water_seal'))delta.stamina+=4;if(delta.supply>0&&has(s,'free_feather'))delta.supply+=4;if(delta.trust>0&&has(s,'accord_bell'))delta.trust+=4;for(const k of keys)delta[k]+=route.cost[k];if(delta.supply<0&&has(s,'grain_pouch'))delta.supply=Math.min(0,delta.supply+3);if(delta.trust<0&&has(s,'strategy_scroll'))delta.trust=Math.min(0,delta.trust+3);if(has(s,'medicine_herb'))delta.stamina+=2;for(const k of keys)delta[k]=clamp(s.resources[k]+delta[k])-s.resources[k];let insight=option.insight+route.insightBonus;if(has(s,'practice_lamp'))insight+=2;if(route.risk>0&&has(s,'change_compass'))insight+=3;if(route.risk===2&&has(s,'strategy_scroll'))insight+=2;return {...clone(option),delta,insight};}
 function getEvent(s){requirePhase(s,'event');const e=eventById(s.eventId),route=selectedRoute(s);if(!e||!route||route.eventId!==e.id)throw Error('Invalid selected event');const ordered=shuffled(e.options,RULES+'|'+s.seed+'|options|'+s.turn+'|'+e.id);return {...clone(e),route,options:ordered.map(o=>optionPreview(s,o,route))};}
 function chooseOption(state,index){requirePhase(state,'event');if(!Number.isInteger(index)||index<0||index>2)throw Error('Invalid choice');const e=getEvent(state),choice=e.options[index],s=clone(state);for(const k of keys)s.resources[k]=clamp(s.resources[k]+choice.delta[k]);s.insight+=choice.insight;s.turn++;s.phase='feedback';s.lastOutcome={turn:s.turn,eventId:e.id,title:e.title,bookId:e.bookId,book:e.book,routeId:s.routeId,routeTitle:e.route.title,risk:e.route.risk,choice:index,label:choice.label,feedback:choice.feedback,delta:clone(choice.delta),insight:choice.insight,resources:clone(s.resources)};s.history.push(clone(s.lastOutcome));s.actions.push({t:'choice',index});return s;}
 const endings=[
  {id:'rest',title:'歇脚重整',subtitle:'脚步暂歇，路还在。下次把恢复也纳入行程。',success:false},
  {id:'resupply',title:'空囊归营',subtitle:'行囊见底。下一程，为意外留一份储备。',success:false},
  {id:'reconnect',title:'独行回望',subtitle:'联系暂断。下一程，让约定也有被照顾的位置。',success:false},
  {id:'harmony',title:'三境皆安',subtitle:'体力、补给与同行的关系，都被你带到了终点。',success:true},
  {id:'insight',title:'观变知行',subtitle:'远路留下丰富见识，你也承担了探索的真实代价。',success:true},
  {id:'companions',title:'众行归途',subtitle:'这趟远征最丰厚的收获，是愿意继续同行的人。',success:true},
  {id:'keeper',title:'丰囊而返',subtitle:'你带回了充足物资，也看见保留余量的分量。',success:true},
  {id:'traveler',title:'行有余力',subtitle:'路走完了，脚下仍有余力，可以从容选择下一程。',success:true},
  {id:'home',title:'灯火可归',subtitle:'不是每一项都充裕，你仍把这一程完整走到了尽头。',success:true}
 ];
 const ending=id=>clone(endings.find(e=>e.id===id));
 function endingFor(s){const r=s.resources;if(r.stamina===0)return ending('rest');if(r.supply===0)return ending('resupply');if(r.trust===0)return ending('reconnect');if(Math.min(...keys.map(k=>r[k]))>=45)return ending('harmony');if(s.insight>=150)return ending('insight');if(r.trust>=72)return ending('companions');if(r.supply>=72)return ending('keeper');if(r.stamina>=72)return ending('traveler');return ending('home');}
 function advance(state){requirePhase(state,'feedback');const s=clone(state);s.actions.push({t:'advance'});if(keys.some(k=>s.resources[k]===0)||s.turn===TOTAL_TURNS){s.phase='ending';s.ending=endingFor(s);s.ending.description=s.ending.subtitle;}else{s.phase=s.turn===4||s.turn===8?'relic':'route';s.routeId=null;s.eventId=null;}return s;}
 function getRelicChoices(s){requirePhase(s,'relic');return shuffled(relics.filter(r=>!s.relics.includes(r.id)),RULES+'|'+s.seed+'|relics|'+s.turn+'|'+s.relics.join(',')).slice(0,3).map(clone);}
 function chooseRelic(state,id){requirePhase(state,'relic');if(state.relics.length>=3||!getRelicChoices(state).some(r=>r.id===id))throw Error('Unavailable relic');const s=clone(state);s.relics.push(id);s.phase='route';s.actions.push({t:'relic',id});return s;}
 function summarize(s){const completed=s.phase==='ending'&&Boolean(s.ending?.success),bonus=completed?100:0;const resourceScore=Math.floor(keys.reduce((n,k)=>n+s.resources[k],0)/3),score=s.insight*5+s.turn*30+resourceScore+s.relics.length*20+bonus;return {score,scoreBreakdown:{insight:s.insight*5,journey:s.turn*30,reserves:resourceScore,relics:s.relics.length*20,completion:bonus},title:s.ending?.title||'远征进行中',ending:clone(s.ending),completed,turn:s.turn,totalTurns:TOTAL_TURNS,resources:clone(s.resources),insight:s.insight,relics:s.relics.map(id=>clone(relicById(id))),history:clone(s.history),seed:s.seed,role:s.role,roleName:roleById(s.role).name,rules:RULES};}
 function stable(x){if(x===null||typeof x!=='object')return JSON.stringify(x);if(Array.isArray(x))return '['+x.map(stable).join(',')+']';return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}';}
 function validateRestore(raw){try{if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==2||raw.rules!==RULES||!validSeed(raw.seed)||!roleById(raw.role)||!Array.isArray(raw.actions)||raw.actions.length>40)return null;if(!Number.isInteger(raw.turn)||raw.turn<0||raw.turn>12||!raw.resources||keys.some(k=>!Number.isInteger(raw.resources[k])||raw.resources[k]<0||raw.resources[k]>100))return null;if(!Array.isArray(raw.history)||raw.history.length>12||!Array.isArray(raw.relics)||raw.relics.length>3||!Number.isInteger(raw.insight)||raw.insight<0||raw.insight>1000)return null;let s=create({seed:raw.seed,role:raw.role});for(const a of raw.actions){if(!a||typeof a!=='object'||Array.isArray(a))return null;if(a.t==='route'&&Object.keys(a).length===2&&typeof a.id==='string')s=chooseRoute(s,a.id);else if(a.t==='choice'&&Object.keys(a).length===2)s=chooseOption(s,a.index);else if(a.t==='advance'&&Object.keys(a).length===1)s=advance(s);else if(a.t==='relic'&&Object.keys(a).length===2&&typeof a.id==='string')s=chooseRelic(s,a.id);else return null;}return stable(raw)===stable(s)?s:null;}catch{return null;}}
 g.EarthExpedition={RULES,TOTAL_TURNS,scoreFormula:'见识 × 5 + 已走回合 × 30 + 三项剩余资源均值向下取整 + 遗物数 × 20 + 完整通关奖励 100。资源归零结束；分数用于同规则、同种子、同角色的本地比较，不是人生评价。',roles:clone(roles),relics:clone(relics),endings:endings.map(e=>({id:e.id,title:e.title,success:e.success})),create,getRoutes,chooseRoute,getEvent,chooseOption,advance,getRelicChoices,chooseRelic,summarize,validateRestore};
})(typeof window==='undefined'?globalThis:window);
