'use strict';
const assert = require('node:assert/strict');
const fc = require('fast-check');
const daily = require('./daily-canon.js');
const review = require('./canon-practice.js');
const transfer = require('./canon-transfer.js');

const empty = {rounds:[], practice:null};
const day = '2026-11-27';
const old = { rules:'daily-canon-v1', day, deck:'ff0efe8a', index:0, answers:['zhuangzi'] };
const id = 'yijing-2';
const practice = record => ({ rules:'canon-practice-v1', cards:{[id]:record} });
const mastered = { stage:4, due:null, lastReviewed:'2026-12-08', sourceDay:day };
const local = { rounds:[old], practice:practice(mastered) };
const frozenBytes = JSON.stringify(local);
const backup = transfer.format(local);
assert.deepEqual(transfer.parse(backup), local);
assert.equal(transfer.format(transfer.parse('\uFEFF' + JSON.stringify(JSON.parse(backup), null, 2))), backup);
const same = transfer.plan(local, transfer.parse(backup), day);
assert.deepEqual(same.stats,{addedRounds:0,advancedRounds:0,conflictRounds:0,unchangedRounds:1,addedCards:0,updatedCards:0});
assert.equal(JSON.stringify(local),frozenBytes);
console.log('PASS v2.8 first answers and v2.9 mastery survive portable JSON roundtrip and repeated import');

const otherDate = { ...daily.create('2026-11-28'), answers:['yijing'] };
const ahead = {...old, index:1, answers:['zhuangzi', 'daodejing']};
const advance = transfer.plan(local,{rounds:[otherDate,ahead],practice:null},day);
assert.deepEqual(advance.rounds,[ahead,otherDate]);
assert.equal(advance.stats.advancedRounds,1);
assert.equal(advance.stats.addedRounds,1);
const afterReveal = transfer.plan(local, {rounds:[{...old,index:1}],practice:null},day);
assert.equal(afterReveal.rounds[0].index,1);
assert.equal(afterReveal.stats.advancedRounds,1);
assert.equal(transfer.plan(advance,local,day).rounds[0].answers.length,2);

// A losing paper must not manufacture extra mistakes from its discarded suffix.
const correct = {...old, answers:['yijing']};
const winner = {rounds:[correct],practice:null};
const rejected = transfer.plan(winner,{rounds:[ahead],practice:null},day);
assert.deepEqual(rejected.rounds,[correct]);
assert.deepEqual(rejected.practice.cards,{});
assert.equal(rejected.stats.conflictRounds,1);
// The other device's actual practice is independent of the losing paper.
const independent = transfer.plan(winner,local,day);
assert.deepEqual(independent.rounds,[correct]);
assert.deepEqual(independent.practice,local.practice);
assert.equal(independent.stats.addedCards,1);
console.log('PASS accepted prefixes advance, conflicting first answers stay local, and independent review cards merge');

const oldMiss = {stage:0, due:day, lastReviewed:null, sourceDay:day};
const merged = transfer.plan(local,{rounds:[old],practice:practice(oldMiss)},'2026-12-09');
assert.deepEqual(merged.practice.cards[id],mastered);
let again;
for (let d=9; d<=31 && !again; d++) {
  const date = '2026-12-'+String(d).padStart(2,'0');
  const index = daily.questions(date).findIndex(card=>card.id === id);
  if (index < 0) continue;
  const answers = daily.questions(date).slice(0,index+1).map(card=>card.bookId);
  answers[index] = 'daodejing';
  again = {...daily.create(date),index,answers};
}
assert(again);
const reopened = transfer.plan(merged,{rounds:[again],practice:null},again.day);
assert.deepEqual(reopened.practice.cards[id],{stage:0,due:again.day,lastReviewed:'2026-12-08',sourceDay:again.day});
assert.equal(reopened.stats.updatedCards,1);
assert.deepEqual(transfer.plan(reopened, local, again.day).practice,reopened.practice);
const relapse = {stage:0,due:'2026-12-09',lastReviewed:'2026-12-09',sourceDay:day};
assert.deepEqual(transfer.plan(local,{rounds:[],practice:practice(relapse)},again.day).practice.cards[id],relapse);
const sameDayAgain = {...oldMiss, due:mastered.lastReviewed,lastReviewed:mastered.lastReviewed};
const tie = transfer.plan({rounds:[],practice:practice(sameDayAgain)},local,again.day);
assert.deepEqual(tie.practice.cards[id],mastered);
console.log('PASS later missed editions and review lapses reopen mastered cards; older and same-day imports preserve progress');

function reject(change, expectedError) {
  const input = JSON.parse(backup);
  change(input);
  assert.throws(()=>transfer.parse(JSON.stringify(input)), expectedError);
}
reject(x => { x.format='another-app'; }, /类型、版本或题库/);
reject(x => { x.version=2; }, /类型、版本或题库/);
reject(x => { x.catalog='next-catalog'; }, /类型、版本或题库/);
reject(x => { x.rounds[0].deck='previous-bank'; }, /首答记录校验失败/);
reject(x => { x.rounds[0].answers[0]='yijing'; }, /校验码不符/); // Valid pick, stale checksum.
reject(x => { x.rounds[0].extra=true; }, /日卷字段/);
reject(x => { x.rounds.push(old); }, /重复的日卷/);
reject(x => { x.practice.cards[id].due='9999-12-31'; }, /无效的复习进度/);
reject(x => { x.practice.cards.foreign=mastered; }, /未知题目/);
reject(x => { x.practice.cards[id].sourceDay='2026-11-28'; }, /错题来源/); // Valid date, different deck.
assert.throws(()=>transfer.parse('{'));
assert.throws(()=>transfer.parse(' '.repeat(transfer.MAX_BYTES+1)));
assert.throws(()=>transfer.parse('错'.repeat(Math.ceil(transfer.MAX_BYTES/3)+1)), /2 MiB/);
assert.throws(()=>transfer.plan({rounds:[],practice:{rules:'broken',cards:{}}},local, day));
assert.throws(()=>transfer.plan(local,{rounds:Array(transfer.MAX_ROUNDS+1).fill(old),practice:null},day));
assert.equal(JSON.stringify(local),frozenBytes);
console.log('PASS invalid signatures, incompatible versions, damaged cards, duplicate dates and oversized files reject the entire preview');

// Expected results depend only on the selected answers and reveal position,
// independently of the engine's merge implementation.
const entry = fc.record({offset:fc.integer({min:0,max:12}),n:fc.integer({min:0,max:5}),
  reveal:fc.boolean(), picks:fc.array(fc.constantFrom('daodejing','zhuangzi','yijing'),{minLength:5,maxLength:5})});
function archive(entries) {
  const byDay = new Map();
  for (const value of entries) {
    const date = new Date(Date.UTC(2026,10,27+value.offset)).toISOString().slice(0,10);
    byDay.set(date,{...daily.create(date),index:value.n - Number(value.reveal && value.n>0),answers:value.picks.slice(0,value.n)});
  }
  return {rounds:[...byDay.values()],practice:null};
}
const records = fc.array(entry,{maxLength:15});
fc.assert(fc.property(records, records,(a,b)=>{
  const left = archive(a), right = archive(b);
  const result = transfer.plan(left,right,'2026-12-31');
  const accepted = new Map(result.rounds.map(row=>[row.day,row]));
  const allRounds = result.rounds.reduce((state,row)=>review.importRound(state,row,'2026-12-31'),review.create());
  assert.deepEqual(result.practice,allRounds);
  const localByDay = new Map(left.rounds.map(row=>[row.day,row]));
  assert.equal(accepted.size,new Set([...a,...b].map(row=>row.offset)).size);
  for (const row of left.rounds) assert.deepEqual(accepted.get(row.day).answers.slice(0,row.answers.length),row.answers);
  for (const row of right.rounds) {
    const oldRow = localByDay.get(row.day);
    if (!oldRow) { assert.deepEqual(accepted.get(row.day),row); continue; }
    const overlaps = oldRow.answers.some((v,i)=>i<row.answers.length && v!==row.answers[i]);
    if (overlaps) { assert.deepEqual(accepted.get(row.day),oldRow); continue; }
    assert.equal(accepted.get(row.day).index,Math.max(oldRow.index,row.index));
    assert.equal(accepted.get(row.day).answers.length,Math.max(oldRow.answers.length,row.answers.length));
  }
  const canonical = transfer.format(result);
  const repeated = transfer.plan(transfer.parse(canonical),right,'2026-12-31');
  assert.equal(transfer.format(repeated),canonical);
  assert.equal(repeated.stats.addedRounds+repeated.stats.advancedRounds+repeated.stats.addedCards+repeated.stats.updatedCards,0);
}),{numRuns:192,seed:210001});
console.log('PASS 192 generated pairs of archives preserve every local answer prefix and produce idempotent merges');
