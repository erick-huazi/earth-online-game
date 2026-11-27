'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const engine = require('./daily-canon.js');
const bank = require('./daily-canon-bank.js');
const { fold } = require('./search-normalizer.js');
const { resolve } = require('./quote-anchor.js');

const bookIds = Object.keys(engine.books);
const day = '2026-11-27';
const file = (relative) => fs.readFileSync(path.join(__dirname, relative), 'utf8');

function unescapeHTML(value) {
  const entities = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
  return value.replace(/&(?:amp|lt|gt|quot|#39);/g, entity => entities[entity]);
}

// Verify what players can actually open, including the two converted books.
function provenance() {
  const directory = path.join(__dirname, '../outputs/html');
  const files = fs.readdirSync(directory).filter(name => name.endsWith('.html'));
  assert.equal(files.length, 10);
  const sections = [];
  for (const name of files) {
    const html = fs.readFileSync(path.join(directory, name), 'utf8');
    const book = path.basename(name, '.html');
    const sectionPattern = /<section class="book-section"[^>]+id="section-(\d+)"[^>]*>([\s\S]*?)<\/section>/g;
    let count = 0;
    for (const [, index, section] of html.matchAll(sectionPattern)) {
      const title = unescapeHTML(section.match(/<h2>([\s\S]*?)<\/h2>/)[1]);
      const text = unescapeHTML(section.match(/<div class="prose">([\s\S]*?)<\/div>/)[1]);
      assert.equal(Number(index), count++);
      sections.push({ book, index: Number(index), title, text: bookIds.includes(book) ? text : '', folded: fold(text) });
    }
    assert.ok(count > 0, name);
  }
  assert.equal(new Set(bank.map(card => card.id)).size, bank.length);
  for (const book of bookIds) assert.ok(bank.filter(card => card.bookId === book).length >= 10);
  for (const card of bank) {
    const query = fold(card.text);
    // Preserve every word, sentence boundary and punctuation mark while hiding
    // the source edition's script. The offline runtime ships the short result.
    assert.equal(card.prompt, [...card.text].map(character => fold(character) || character).join(''), card.id);
    const hits = sections.filter(section => section.folded.includes(query));
    assert.deepEqual(hits.map(hit => [hit.book, hit.index]), [[card.bookId, card.section]], 'Ambiguous attribution: ' + card.id);
    const source = hits[0];
    const end = card.start + card.text.length;
    assert.equal(source.title, card.title);
    assert.equal(source.text.slice(card.start, end), card.text);
    assert.equal(card.prefix, [...source.text.slice(0, card.start)].slice(-12).join(''));
    assert.equal(card.suffix, [...source.text.slice(end)].slice(0, 12).join(''));
    assert.deepEqual(resolve(source.text, { start: card.start, end, exact: card.text, prefix: card.prefix, suffix: card.suffix }), { start: card.start, end });
    assert.doesNotMatch(query, /周易|道德经|庄子/);
    assert.match(card.text, /[。！？]$/);
  }
  return sections.length;
}

function browserEngine(alterBank = false) {
  const context = vm.createContext({});
  vm.runInContext(file('vendor/seedrandom-3.0.5.min.js'), context);
  vm.runInContext(file('daily-canon-bank.js'), context);
  if (alterBank) {
    vm.runInContext("EarthDailyCanonBank = EarthDailyCanonBank.map((card,i) => i ? card : { ...card, start: card.start + 1 })", context);
  }
  vm.runInContext(file('daily-canon.js'), context);
  return context.EarthDailyCanon;
}

// These fixtures pin BOTH the chosen passages and the visible option order.
// Y = 周易, D = 道德经, Z = 庄子.
const gold = {
  '0012-02-29': ['11ce1ddd', 'yijing-22:DZY zhuangzi-2:YZD daodejing-25:ZDY yijing-1:YZD daodejing-1:DYZ'],
  '2026-11-27': ['ff0efe8a', 'yijing-2:YZD zhuangzi-13:DZY yijing-15:DZY daodejing-11:ZYD daodejing-25:DYZ'],
  '2026-11-28': ['930f154e', 'daodejing-12:ZDY zhuangzi-1:YDZ daodejing-1:YZD zhuangzi-4:DZY yijing-14:YDZ']
};
function calendars() {
  const browser = browserEngine();
  for (const [date, [deck, expected]] of Object.entries(gold)) {
    const cards = engine.questions(date);
    const sequence = cards.map(card => card.id + ':' + card.options.map(id => id[0].toUpperCase()).join('')).join(' ');
    assert.equal(sequence, expected);
    assert.equal(engine.create(date).deck, deck);
    assert.equal(JSON.stringify(browser.questions(date)), JSON.stringify(cards));
    assert.equal(browser.create(date).deck, deck);
  }
  const invalid = [null, false, [], {}, new Date(), '', '0000-01-01', '2025-02-29', '1900-02-29', '2026-04-31', '2026-00-15',
    '2026-13-15', '9999-12-32', '2026-1-01', ' 2026-11-27', '2026-11-27\n', '2026-11-27T00:00:00Z'];
  for (const date of invalid) {
    assert.equal(engine.isDay(date), false);
    assert.throws(() => engine.create(date), RangeError);
    assert.throws(() => engine.questions(date), RangeError);
    assert.equal(engine.restore({}, date), null);
  }
  for (const date of ['0001-01-01', '1582-10-10', '1900-02-28', '2000-02-29', '9999-12-31']) {
    assert.equal(engine.isDay(date), true);
    assert.equal(engine.questions(date).length, 5);
  }
  assert.equal(engine.today(new Date('2026-11-26T16:00:00Z')), day);
  for (const invalidInstant of [new Date(NaN), NaN, Infinity, '2026-11-27', null]) {
    assert.throws(() => engine.today(invalidInstant), RangeError);
  }
  const testClock = `const e = require('./daily-canon.js');
    const dates = ['2026-11-26T15:59:59.999Z','2026-11-26T16:00:00.000Z','2026-12-31T16:00:00.000Z','2024-02-28T16:00:00.000Z']
      .map(stamp => e.today(Date.parse(stamp)));
    console.log(JSON.stringify([dates, e.create(dates[1]).deck]));`;
  for (const tz of ['UTC', 'America/Los_Angeles', 'Asia/Shanghai', 'Pacific/Auckland']) {
    const result = execFileSync(process.execPath, ['-e', testClock], { cwd: __dirname, env: { ...process.env, TZ: tz }, encoding: 'utf8' });
    assert.deepEqual(JSON.parse(result), [['2026-11-26', day, '2027-01-01', '2024-02-29'], gold[day][0]], tz);
  }

  const used = new Set();
  const recent = [];
  for (let offset = 0; offset < 730; offset++) {
    const date = new Date(Date.UTC(1969, 0, 1) + offset * 86400000).toISOString().slice(0, 10);
    const cards = engine.questions(date);
    assert.equal(cards.length, 5);
    assert.deepEqual(new Set(cards.map(card => card.bookId)), new Set(bookIds));
    const ids = cards.map(card => card.id);
    recent.push(ids);
    if (recent.length > 4) recent.shift();
    assert.equal(new Set(recent.flat()).size, recent.length * 5, 'Four-day draw has repeated a passage on ' + date);
    const positions = cards.map(card => card.options.indexOf(card.bookId));
    assert.deepEqual(new Set(positions), new Set([0, 1, 2]));
    for (const card of cards) {
      assert.deepEqual(new Set(card.options), new Set(bookIds));
      used.add(card.id);
    }
  }
  assert.equal(used.size, bank.length);
}

function savedGames() {
  const base = engine.create(day);
  const cards = engine.questions(day);
  const revived = state => engine.restore(JSON.parse(JSON.stringify(state)), day);
  for (const invalid of [null, 'bad', [], {}, { ...base, rules: 'future' }, { ...base, day: '2026-11-28' },
    { ...base, deck: engine.create('2026-11-28').deck }, { ...base, deck: undefined },
    { ...base, index: -1 }, { ...base, index: 1.5 }, { ...base, index: 6 }, { ...base, index: 5 },
    { ...base, answers: {} }, { ...base, answers: Array(1) }, { ...base, answers: ['__proto__'] },
    { ...base, answers: ['yijing', 'yijing'] }]) assert.equal(engine.restore(invalid, day), null);
  assert.equal(browserEngine(true).restore(base, day), null, 'Same rule name but drifted bank must invalidate the save');
  const allScores = new Set();
  for (let pathIndex = 0; pathIndex < 3 ** 5; pathIndex++) {
    let state = base;
    let picks = pathIndex;
    let correct = 0;
    let result = '';
    for (const [index, card] of cards.entries()) {
      assert.deepEqual(revived(state), state);
      assert.equal(engine.phase(state), 'question');
      assert.equal(engine.share(state), '');
      assert.equal(engine.next(state), state);
      assert.equal(engine.answer(state, 'unknown'), state);
      const pick = card.options[picks % 3];
      picks = Math.floor(picks / 3);
      const revealed = engine.answer(state, pick);
      assert.equal(state.answers.length, index);
      assert.equal(engine.phase(revealed), 'reveal');
      assert.deepEqual(revived(revealed), revealed);
      assert.equal(engine.answer(revealed, card.bookId), revealed);
      assert.equal(engine.share(revealed), '');
      if (pick === card.bookId) correct++;
      result += pick === card.bookId ? '🟩' : '⬜';
      assert.equal(engine.score(revealed), correct);
      state = engine.next(revealed);
    }
    assert.equal(engine.phase(state), 'finished');
    assert.deepEqual(revived(state), state);
    assert.equal(engine.next(state), state);
    assert.equal(engine.answer(state, 'yijing'), state);
    assert.equal(engine.share(revived(state)), '每日辨典 · ' + day + '\n首答 ' + correct + '/5\n' + result);
    allScores.add(correct);
  }
  assert.deepEqual(allScores, new Set([0, 1, 2, 3, 4, 5]));
}

const sectionCount = provenance();
calendars();
savedGames();
console.log('PASS daily canon: ' + bank.length + ' verified passages across ' + sectionCount +
  ' published sections, 730 scheduled days, 4 time zones, 3 fixed decks and all 243 answer paths.');
