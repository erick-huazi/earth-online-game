// The frozen v1 rule set is shared by the offline game and Node verification.
(() => {
  'use strict';
  const commonJS = typeof module === 'object' && module.exports;
  const bank = commonJS ? require('./daily-canon-bank.js') : globalThis.EarthDailyCanonBank;
  const seedrandom = commonJS ? require('./vendor/seedrandom-3.0.5.min.js') : Math.seedrandom;
  const RULES = 'daily-canon-v1';
  const books = Object.freeze({ yijing: '周易', daodejing: '道德经', zhuangzi: '庄子' });
  const bookIds = Object.keys(books);
  const roundSize = 5;
  const dayMillis = 86400000;
  const quotas = [[2, 2, 1], [1, 2, 2], [2, 1, 2]];
  const pools = bookIds.map(id => bank.filter(card => card.bookId === id));
  const bankKey = checksum(bank.map(card => [
    card.id, card.bookId, card.section, card.title, card.text, card.prompt, card.start, card.prefix, card.suffix
  ]));
  let cachedDay;
  let cachedCards;
  let cachedDeckKey;

  // FNV-1a over stable UTF-16 JSON detects accidental data or shuffle changes
  // when a save is reopened with a different build of the same rules.
  function checksum(fields) {
    const value = JSON.stringify(fields);
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function isDay(day) {
    if (typeof day !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(day)) return false;
    const time = Date.parse(day + 'T00:00:00Z');
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === day;
  }

  function today(now = Date.now()) {
    const time = now instanceof Date ? now.getTime() : now;
    if (!Number.isFinite(time)) throw new RangeError('Expected an instant in milliseconds');
    const day = new Date(time + 8 * 3600000).toISOString().slice(0, 10);
    if (!isDay(day)) throw new RangeError('Unsupported Beijing date');
    return day;
  }

  function requireDay(day) {
    if (!isDay(day)) throw new RangeError('Expected a valid YYYY-MM-DD');
  }

  function shuffled(values, seed) {
    const result = values.slice();
    const random = new seedrandom(RULES + '|' + seed);
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function questions(day) {
    requireDay(day);
    if (day === cachedDay) return cachedCards;
    const ordinal = Date.parse(day + 'T00:00:00Z') / dayMillis;
    const block = Math.floor(ordinal / 3);
    const slot = ordinal - 3 * block;
    // Three consecutive days draw from a single shuffle. The next block uses
    // the other half of each book, so every four consecutive days are disjoint.
    const cards = pools.flatMap((pool, bookIndex) => {
      const split = Math.floor(pool.length / 2);
      const half = block % 2 === 0 ? pool.slice(0, split) : pool.slice(split);
      const draw = shuffled(half, block + '|' + bookIds[bookIndex]);
      const offset = quotas.slice(0, slot).reduce((sum, row) => sum + row[bookIndex], 0);
      return draw.slice(offset, offset + quotas[slot][bookIndex]);
    });
    // Each answer position appears once or twice. The underrepresented
    // position also rotates, independently of the order of the passages.
    const positions = shuffled([0, 1, 2], day + '|positions');
    const slots = shuffled(positions.concat(positions.slice(0, 2)), day + '|slots');
    const ordered = shuffled(cards, day + '|order').map((card, index) => {
      const options = shuffled(bookIds.filter(id => id !== card.bookId), day + '|' + card.id);
      options.splice(slots[index], 0, card.bookId);
      return Object.freeze({ ...card, options: Object.freeze(options) });
    });
    cachedDay = day;
    cachedCards = Object.freeze(ordered);
    cachedDeckKey = checksum([RULES, bankKey, day, ordered.map(card => [card.id, card.options])]);
    return cachedCards;
  }

  function snapshot(day, index, answers) {
    questions(day);
    return Object.freeze({ rules: RULES, day, deck: cachedDeckKey, index, answers: Object.freeze(answers) });
  }

  function create(day) {
    requireDay(day);
    return snapshot(day, 0, []);
  }

  function restore(raw, day) {
    if (!isDay(day) || !raw || raw.rules !== RULES || raw.day !== day) return null;
    const { index, answers } = raw;
    if (!Number.isInteger(index) || index < 0 || index > roundSize || !Array.isArray(answers)) return null;
    if (answers.length < index || answers.length > Math.min(index + 1, roundSize)) return null;
    const choices = Array.from(answers);
    if (!choices.every(id => bookIds.includes(id))) return null;
    questions(day);
    if (raw.deck !== cachedDeckKey) return null;
    return snapshot(day, index, choices);
  }

  function phase(state) {
    if (state.index === roundSize) return 'finished';
    return state.answers.length > state.index ? 'reveal' : 'question';
  }

  function answer(state, bookId) {
    if (phase(state) !== 'question' || !bookIds.includes(bookId)) return state;
    return snapshot(state.day, state.index, state.answers.concat(bookId));
  }

  function next(state) {
    if (phase(state) !== 'reveal') return state;
    return snapshot(state.day, state.index + 1, state.answers);
  }

  function verdicts(state) {
    const cards = questions(state.day);
    return state.answers.map((id, index) => id === cards[index].bookId);
  }

  function score(state) {
    return verdicts(state).filter(Boolean).length;
  }

  function share(state) {
    if (phase(state) !== 'finished') return '';
    const results = verdicts(state);
    return '每日辨典 · ' + state.day + '\n首答 ' + results.filter(Boolean).length + '/' + roundSize +
      '\n' + results.map(correct => correct ? '🟩' : '⬜').join('');
  }

  const api = Object.freeze({ RULES, books, isDay, today, questions, create, restore, phase, answer, next, score, share });
  if (commonJS) module.exports = api;
  else globalThis.EarthDailyCanon = api;
})();
