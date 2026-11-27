'use strict';
const assert = require('node:assert/strict');
const fc = require('fast-check');
const daily = require('./daily-canon.js');
const practice = require('./canon-practice.js');

const firstDay = '2026-11-27';
const firstCard = 'yijing-2';
// This is the serialized form of an unfinished v2.8.0 round, on its reveal.
const legacy = { rules:'daily-canon-v1', day:firstDay, deck:'ff0efe8a', index:0, answers:['zhuangzi'] };
const sourceBytes = JSON.stringify(legacy);
const empty = practice.create();
const initial = practice.importRound(empty, legacy, firstDay);

function day(offset) {
  return new Date(Date.UTC(2026, 10, 27 + offset)).toISOString().slice(0, 10);
}

function savedEdition(offset, mask) {
  const date = day(offset);
  const cards = daily.questions(date);
  const answers = cards.map((card, index) => mask & (1 << index)
    ? card.options.find(book => book !== card.bookId) : card.bookId);
  return { ...daily.create(date), index:cards.length, answers };
}

function anotherMiss(offset) {
  for (let i = offset; i < offset + 90; i++) {
    const index = daily.questions(day(i)).findIndex(card => card.id === firstCard);
    if (index >= 0) return savedEdition(i, 1 << index);
  }
  assert.fail('Expected the sample card in another edition');
}

assert.equal(practice.storageKey, 'earth-online-canon-practice-v1');
assert.deepEqual(practice.queue(initial, firstDay).map(entry => entry.id), [firstCard]);
assert.deepEqual(practice.summary(initial, firstDay),
  { total:1, due:1, learning:1, mastered:0, nextDue:null });
for (const raw of [null, { ...legacy, day:'2026-02-30' }, { ...legacy, deck:'broken' },
                   { ...legacy, answers:['constructor'] }, { ...legacy, index:5 }]) {
  assert.strictEqual(practice.importRound(initial, raw, firstDay), initial);
}
assert.strictEqual(practice.importRound(empty, savedEdition(0, 0), firstDay), empty);
assert.strictEqual(practice.importRound(initial, legacy, firstDay), initial);
assert.strictEqual(practice.importRound(empty, legacy, day(-1)), empty);
const future = day(40);
assert.equal(practice.summary(practice.importRound(empty, legacy, future), future).due, 1);
assert.deepEqual(practice.restore(JSON.parse(JSON.stringify(initial))), initial);
assert.equal(practice.restore({ rules:'other-edition', cards:{} }), null);
const damaged = { ...initial, cards:{ ...initial.cards,
  'zhuangzi-13':{ stage:0, sourceDay:firstDay, lastReviewed:null, due:'9999-12-31' },
  'daodejing-9':{ stage:2, due:day(4), sourceDay:day(0), lastReviewed:null }, 'unknown-card':{} } };
assert.deepEqual(practice.restore(damaged), initial);
console.log('PASS unfinished v2.8 first answers import once, future papers wait, and damaged entries are isolated');

let state = initial;
const correct = 'yijing';
const wrong = 'daodejing';
for (const [stage, offset, next] of [[1,0,1],[2,1,4],[3,4,11],[4,11,null]]) {
  const date = day(offset);
  const [entry] = practice.queue(state, date);
  assert.equal(entry.card.id, firstCard);
  assert.equal(new Set(entry.card.options).size, 3);
  assert(entry.card.options.includes(correct));
  assert.equal(entry.card.text, daily.questions(firstDay)[0].text);
  state = practice.answer(state, firstCard, correct, date);
  assert.equal(state.cards[firstCard].stage, stage);
  assert.equal(state.cards[firstCard].due, next === null ? null : day(next));
  assert.strictEqual(practice.answer(state, firstCard, wrong, date), state);
  assert.strictEqual(practice.answer(state, firstCard, correct, date), state);
  assert.strictEqual(practice.importRound(state, legacy, date), state);
  if (next !== null) assert.equal(practice.summary(state, date).nextDue, day(next));
}
assert.deepEqual(practice.summary(state, day(11)),
  { total:1, due:0, learning:0, mastered:1, nextDue:null });
const laterMiss = anotherMiss(12);
assert.strictEqual(practice.importRound(state, laterMiss, day(11)), state);
const again = practice.importRound(state, laterMiss, laterMiss.day);
assert.equal(again.cards[firstCard].stage, 0);
assert.equal(again.cards[firstCard].due, laterMiss.day);
assert.strictEqual(practice.importRound(again, legacy, laterMiss.day), again);
const earlierMiss = anotherMiss(4);
if (earlierMiss.day > day(11)) assert.fail('Expected historical evidence before mastery');
assert.equal(practice.importRound(state, earlierMiss, laterMiss.day).cards[firstCard].stage, 4);
console.log('PASS 1/3/7-day intervals, four due successes, archived misses stay mastered, and a later new miss reopens');

let lapse = practice.answer(initial, firstCard, correct, firstDay);
lapse = practice.answer(lapse, firstCard, correct, day(1));
assert.strictEqual(practice.answer(lapse, firstCard, wrong, day(3)), lapse);
lapse = practice.answer(lapse, firstCard, wrong, day(4));
assert.equal(lapse.cards[firstCard].stage, 0);
assert.equal(lapse.cards[firstCard].due, day(4));
lapse = practice.answer(lapse, firstCard, correct, day(4));
assert.equal(lapse.cards[firstCard].stage, 1);
assert.equal(lapse.cards[firstCard].due, day(5));
assert.strictEqual(practice.answer(lapse, firstCard, correct, day(4)), lapse);
assert.deepEqual(practice.restore(JSON.parse(JSON.stringify(lapse))), lapse);
assert.equal(JSON.stringify(legacy), sourceBytes);
console.log('PASS a lapse returns the card to today, retries recover once, and the official first answer is unchanged');

// Compare migration to an independent union of the observed wrong IDs, keeping
// only the newest eligible paper for each card. Shuffling imports or restoring
// the notebook between them must preserve both membership and queue order.
const editionInputs = fc.array(fc.record({ offset:fc.integer({min:0,max:50}),
  mask:fc.integer({min:0,max:31}) }), {minLength:2,maxLength:20});
fc.assert(fc.property(editionInputs, inputs => {
  const now = day(42);
  const rounds = inputs.map(input => savedEdition(input.offset, input.mask));
  const expected = new Map();
  for (const input of inputs) {
    if (input.offset > 42) continue;
    daily.questions(day(input.offset)).forEach((card, index) => {
      if (input.mask & (1 << index)) expected.set(card.id, Math.max(input.offset, expected.get(card.id) ?? -1));
    });
  }
  const bytes = JSON.stringify(rounds);
  const collect = list => list.reduce((current, round) =>
    practice.importRound(current, round, now), empty);
  const records = collect(rounds);
  const reversed = collect(rounds.slice().reverse());
  assert.deepEqual(records, reversed);
  assert.deepEqual(practice.restore(JSON.parse(JSON.stringify(records))), records);
  const entries = practice.queue(records, now);
  const sorted = [...expected].sort(([idA, a], [idB, b]) => a - b || idA.localeCompare(idB));
  assert.deepEqual(entries.map(row => [row.id, row.due]), sorted.map(([id, offset]) => [id, day(offset)]));
  for (const round of rounds) assert.strictEqual(practice.importRound(records, round, now), records);
  assert.equal(JSON.stringify(rounds), bytes);
}), { seed:29001, numRuns:128 });
console.log('PASS 128 generated archive collections match the wrong-card union and preserve order, bytes and restoration');

// A calendar indexed by integers is a second model of the single-card
// scheduler. Mix clock advances, stale archive reads, reloads and grades.
const commands = fc.array(fc.record({ skip:fc.integer({min:0,max:5}),
  action:fc.constantFrom('right','wrong','reread','reload') }), {minLength:8,maxLength:55});
fc.assert(fc.property(commands, operations => {
  let actual = initial, date = 0, expectedStage = 0, due = 0;
  for (const { skip, action } of operations) {
    date += skip;
    if (action === 'reread') actual = practice.importRound(actual, legacy, day(date));
    else if (action === 'reload') actual = practice.restore(JSON.parse(JSON.stringify(actual)));
    else {
      const success = action === 'right';
      actual = practice.answer(actual, firstCard, success ? correct : wrong, day(date));
      if (date >= due) {
        expectedStage = success ? expectedStage + 1 : 0;
        due = date + [0, 1, 3, 7, Infinity][expectedStage];
      }
    }
    assert.equal(actual.cards[firstCard].stage, expectedStage);
    assert.equal(actual.cards[firstCard].due, Number.isFinite(due) ? day(due) : null);
    assert.equal(practice.queue(actual, day(date)).length, Number(date >= due));
  }
}), { seed:29002, numRuns:256 });
console.log('PASS 256 mixed review, reload and replay sequences match an independent calendar after every operation');
