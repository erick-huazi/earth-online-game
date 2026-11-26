'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fc = require('fast-check');
const anchors = require('./quote-anchor.js');

const box = {};
box.window = box;
vm.createContext(box);
for (const file of ['vendor/seedrandom-3.0.5.min.js','expedition-content.js','expedition-engine.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),box,{filename:file});
}
const game = box.EarthExpedition;
const target = process.env.FC_CASE;
if (target && !['practice-prefix', 'quote-relocation', 'quote-ambiguity'].includes(target)) {
  throw new Error('Unknown FC_CASE: ' + target);
}

function property(name, specification) {
  if (target && target !== name) return;
  const options = {numRuns:128};
  if (process.env.FC_SEED) options.seed = Number(process.env.FC_SEED);
  if (process.env.FC_PATH) options.path = process.env.FC_PATH;
  fc.assert(specification, options);
  console.log('PASS', name, options.path ? '(replayed)' : '(128 generated cases)');
}

// Capture the actual station entry states in forward play for an independent oracle.
function play(state, decisions, entries) {
  while (state.phase !== 'ending') {
    if (state.phase === 'relic') {
      const offer = game.getRelicChoices(state);
      state = game.chooseRelic(state, offer[decisions[state.turn].seal % offer.length].id);
    }
    if (entries) entries.push(state);
    const decision = decisions[state.turn];
    state = game.chooseRoute(state,game.getRoutes(state)[decision.road].id);
    state = game.advance(game.chooseOption(state,decision.action));
  }
  return state;
}

const pick = fc.integer({min:0,max:2});
const itinerary = fc.array(fc.record({road:pick,action:pick,seal:pick}),{minLength:12,maxLength:12});
property('practice-prefix',fc.property(
  fc.integer(), fc.constantFrom(...game.roles.map(r=>r.id)), itinerary, itinerary, fc.nat(11),
  (seed, role, original, alternate, index) => {
    const entries = [];
    const finished = play(game.create({seed:'p'+seed,role}),original,entries);
    const before = JSON.stringify(finished);
    const station = 1 + index % entries.length;
    const start = game.stationStart(finished,station);
    assert.deepEqual(start,entries[station-1]);
    assert.deepEqual(play(start,original),finished);
    const fork = play(start,alternate);
    assert.deepEqual(fork.history.slice(0,station-1),finished.history.slice(0,station-1));
    assert.deepEqual(game.validateRestore(fork),fork);
    assert.equal(JSON.stringify(finished),before);
  }
));

const glyph = fc.constantFrom('道','氣','气','𠮷','人','🌿','e\u0301','—','\n',' ');
const text = fc.array(glyph,{maxLength:40}).map(parts=>parts.join(''));
property('quote-relocation',fc.property(text,text,text,text,(body,left,right,inserted)=>{
  const quote = '‹'+body+'›';
  const original = left+quote+right;
  const anchor = anchors.capture(original,left.length,left.length+quote.length);
  assert(anchor);
  assert.equal(anchor.exact,quote);
  for (const prefix of ['', '移'+inserted]) {
    const expected = prefix.length+left.length;
    assert.deepEqual(anchors.resolve(prefix+original,anchor),{start:expected,end:expected+quote.length});
  }
}));

property('quote-ambiguity',fc.property(text,fc.constantFrom('🌿','𠮷'),(body,astral)=>{
  const quote='‹'+body+'›';
  const anchor=anchors.capture(quote,0,quote.length);
  assert.equal(anchors.resolve('移'+quote+'隔'+quote,anchor),null);
  assert.equal(anchors.resolve('原段已移除',anchor),null);
  // After an edition change exactly one of two identical quotes retains its context.
  const original='甲'+quote+'乙';
  const withContext=anchors.capture(original,1,1+quote.length);
  const revised='丙'+quote+'丁'+original;
  const wanted=revised.lastIndexOf(quote);
  assert.deepEqual(anchors.resolve(revised,withContext),{start:wanted,end:wanted+quote.length});
  assert.equal(anchors.resolve('移'+original+'隔'+original,withContext),null);
  const pair='始'+astral+'末';
  assert.equal(anchors.capture(pair,2,3),null);
  assert.equal(anchors.capture(pair,1,2),null);
}));
