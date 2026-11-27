// Personal review uses the immutable first answers of the dated game as input.
(() => {
  'use strict';
  const commonJS = typeof module === 'object' && module.exports;
  const quiz = commonJS ? require('./daily-canon.js') : globalThis.EarthDailyCanon;
  const bank = commonJS ? require('./daily-canon-bank.js') : globalThis.EarthDailyCanonBank;
  const seedrandom = commonJS ? require('./vendor/seedrandom-3.0.5.min.js') : Math.seedrandom;
  const byId = new Map(bank.map(card => [card.id, card]));
  const books = Object.keys(quiz.books);
  const rules = 'canon-practice-v1';
  const storageKey = 'earth-online-' + rules;
  const gaps = [1, 3, 7];
  const mastered = gaps.length + 1;

  function later(day, interval) {
    const date = new Date(day + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() + interval);
    if (date.getUTCFullYear() > 9999) return '9999-12-31';
    return date.toISOString().slice(0, 10);
  }

  function snapshot(cards) {
    return Object.freeze({ rules, cards:Object.freeze(cards) });
  }

  function create() {
    return snapshot({});
  }

  function valid(record) {
    if (!record || !quiz.isDay(record.sourceDay)) return false;
    const { stage, due, lastReviewed, sourceDay } = record;
    if (lastReviewed !== null && !quiz.isDay(lastReviewed)) return false;
    if (stage === 0) {
      return due === (lastReviewed && lastReviewed > sourceDay ? lastReviewed : sourceDay);
    }
    if (!Number.isInteger(stage) || stage < 1 || stage > mastered ||
        !lastReviewed || lastReviewed < sourceDay) return false;
    return stage === mastered ? due === null : due === later(lastReviewed, gaps[stage - 1]);
  }

  function restore(raw) {
    if (!raw || raw.rules !== rules || !raw.cards || typeof raw.cards !== 'object' ||
        Array.isArray(raw.cards)) return null;
    const cards = {};
    for (const [id, record] of Object.entries(raw.cards)) {
      if (!byId.has(id) || !valid(record)) continue;
      const { stage, due, lastReviewed, sourceDay } = record;
      cards[id] = Object.freeze({ stage, due, lastReviewed, sourceDay });
    }
    return snapshot(cards);
  }

  function importRound(state, raw, today) {
    if (!quiz.isDay(today) || !quiz.isDay(raw?.day) || raw.day > today) return state;
    const round = quiz.restore(raw, raw.day);
    if (!round) return state;
    const deck = quiz.questions(round.day);
    let cards = state.cards;
    round.answers.forEach((pick, index) => {
      const { id, bookId } = deck[index];
      const previous = cards[id];
      if (pick === bookId || (previous && previous.sourceDay >= round.day)) return;
      if (cards === state.cards) cards = { ...cards };
      // Reopening an old edition can update provenance. Only a miss from a
      // later calendar day can supersede what the player has since practised.
      const lastReviewed = previous?.lastReviewed ?? null;
      const next = lastReviewed && lastReviewed >= round.day
        ? { ...previous, sourceDay:round.day }
        : { stage:0, due:round.day, lastReviewed, sourceDay:round.day };
      cards[id] = Object.freeze(next);
    });
    return cards === state.cards ? state : snapshot(cards);
  }

  function isDue(record, today) {
    return record.stage < mastered && record.due <= today &&
      (record.stage === 0 || record.lastReviewed !== today);
  }

  function reviewCard(id, stage, today) {
    const options = books.slice();
    const random = new seedrandom([rules, id, stage, today].join('|'));
    for (let i = options.length - 1; i > 0; i--) {
      const other = Math.floor(random() * (i + 1));
      [options[i], options[other]] = [options[other], options[i]];
    }
    return { ...byId.get(id), options };
  }

  function queue(state, today) {
    if (!quiz.isDay(today)) throw new RangeError('Expected a Beijing date');
    return Object.entries(state.cards)
      .filter(([, record]) => isDue(record, today))
      .sort(([idA, a], [idB, b]) => a.due.localeCompare(b.due) ||
        Number(a.lastReviewed === today) - Number(b.lastReviewed === today) || idA.localeCompare(idB))
      .map(([id, record]) => ({ id, ...record, card:reviewCard(id, record.stage, today) }));
  }

  function summary(state, today) {
    if (!quiz.isDay(today)) throw new RangeError('Expected a Beijing date');
    const records = Object.values(state.cards);
    let due = 0, done = 0, nextDue = null;
    for (const record of records) {
      if (record.stage === mastered) done++;
      else if (isDue(record, today)) due++;
      else if (record.due > today && (!nextDue || record.due < nextDue)) nextDue = record.due;
    }
    return { total:records.length, due, learning:records.length - done, mastered:done, nextDue };
  }

  function answer(state, id, pick, today) {
    if (!quiz.isDay(today) || !byId.has(id) || !books.includes(pick)) return state;
    const previous = state.cards[id];
    if (!previous || !isDue(previous, today)) return state;
    const stage = pick === byId.get(id).bookId ? previous.stage + 1 : 0;
    const due = stage === mastered ? null : later(today, gaps[stage - 1] || 0);
    const next = Object.freeze({ ...previous, stage, due, lastReviewed:today });
    return snapshot({ ...state.cards, [id]:next });
  }

  const api = Object.freeze({ storageKey, create, restore, importRound, queue, summary, answer });
  if (commonJS) module.exports = api;
  else globalThis.EarthCanonPractice = api;
})();
