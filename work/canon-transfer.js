// Pure conversion and merge of the dated quiz and personal practice records.
(() => {
  'use strict';
  const commonJS = typeof module === 'object' && module.exports;
  const quiz = commonJS ? require('./daily-canon.js') : globalThis.EarthDailyCanon;
  const review = commonJS ? require('./canon-practice.js') : globalThis.EarthCanonPractice;
  const bank = commonJS ? require('./daily-canon-bank.js') : globalThis.EarthDailyCanonBank;
  const MAX_BYTES = 2 * 1024 * 1024;
  const MAX_ROUNDS = 8192;
  const formatName = 'earth-online-canon-backup';
  // This fixed edition's existing signature covers every bank entry, the
  // rules version, the deck order and the order of offered choices.
  const catalog = quiz.create('2026-11-27').deck;
  const encoder = new TextEncoder();
  const roundKeys = ['rules', 'day', 'deck', 'index', 'answers'];
  const cardKeys = ['stage', 'due', 'lastReviewed', 'sourceDay'];
  // Only daily.restore's frozen snapshots (including the answers array) are
  // keys. Parsed file data and live localStorage input are always revalidated.
  const missedIds = new WeakMap();

  function fail(message) { throw new Error(message); }
  function object(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
  function fields(value, keys) {
    return object(value) && Object.keys(value).length === keys.length &&
      keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
  }

  function verifyRound(raw) {
    if (missedIds.has(raw)) return raw;
    if (!fields(raw, roundKeys)) fail('日卷字段不完整或版本不兼容。');
    const round = quiz.restore(raw, raw.day);
    if (!round) fail('日卷的日期、题库或首答记录校验失败。');
    const deck = quiz.questions(round.day);
    missedIds.set(round, round.answers.flatMap((pick,i) => pick !== deck[i].bookId ? [deck[i].id] : []));
    return round;
  }

  function normalize(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.rounds)) fail('每日答题记录格式有误。');
    if (snapshot.rounds.length > MAX_ROUNDS) fail('备份超过可处理的日卷数量。');
    const days = new Set();
    const rounds = snapshot.rounds.map(raw => {
      const round = verifyRound(raw);
      if (days.has(round.day)) fail('备份中出现重复的日卷日期。');
      days.add(round.day);
      return round;
    }).sort((a, b) => a.day.localeCompare(b.day));

    const rawPractice = snapshot.practice;
    if (rawPractice === null) return { rounds, practice:review.create() };
    if (!fields(rawPractice, ['rules', 'cards']) || !object(rawPractice.cards)) fail('错题本格式有误。');
    const ids = Object.keys(rawPractice.cards).sort();
    if (ids.length > bank.length) fail('错题数量超过题库容量。');
    const restored = review.restore(rawPractice);
    if (!restored || ids.length !== Object.keys(restored.cards).length) fail('错题本含有未知题目或无效的复习进度。');
    const cards = {};
    for (const id of ids) {
      const card = restored.cards[id];
      if (!fields(rawPractice.cards[id], cardKeys) || !quiz.questions(card.sourceDay).some(row => row.id === id)) {
        fail('错题来源或复习字段校验失败。');
      }
      cards[id] = card;
    }
    return { rounds, practice:{ rules:restored.rules, cards } };
  }

  // Accidental-edit detection over canonical UTF-8 content. The exported
  // record is personal game data and this checksum is not an identity proof.
  function checksum(payload) {
    let hash = 2166136261;
    for (const byte of encoder.encode(JSON.stringify(payload))) hash = Math.imul(hash ^ byte, 16777619);
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
  function envelope(snapshot) {
    return { format:formatName, version:1, catalog, rounds:snapshot.rounds, practice:snapshot.practice };
  }
  function checkSize(text) {
    if (typeof text !== 'string' || text.length > MAX_BYTES || encoder.encode(text).length > MAX_BYTES) {
      fail('请选择 2 MiB 以内的辨典 JSON 备份。');
    }
  }
  function format(snapshot) {
    const payload = envelope(normalize(snapshot));
    const text = JSON.stringify({ ...payload, checksum:checksum(payload) });
    checkSize(text);
    return text;
  }
  function parse(text) {
    checkSize(text);
    let raw;
    try { raw = JSON.parse(text.replace(/^\uFEFF/, '')); }
    catch { fail('备份不是完整的 JSON 文件。'); }
    if (!fields(raw, ['format','version','catalog','rounds','practice','checksum']) ||
        raw.format !== formatName || raw.version !== 1 || raw.catalog !== catalog) {
      fail('备份类型、版本或题库与当前游戏不匹配。');
    }
    const snapshot = normalize(raw);
    if (raw.checksum !== checksum(envelope(snapshot))) fail('备份校验码不符，文件内容可能已经改变。');
    return snapshot;
  }

  function combineCard(a, b) {
    if (!a) return b;
    const last = (x, y) => x > y ? x : y;
    const dateA = last(a.sourceDay, a.lastReviewed || '');
    const dateB = last(b.sourceDay, b.lastReviewed || '');
    // A later genuine miss can reopen a mastered card. Equal-day progress is
    // ranked by stage because neither store has a trustworthy time-of-day.
    const winner = dateB > dateA || (dateB === dateA && b.stage > a.stage) ? b : a;
    return { ...winner, sourceDay:last(a.sourceDay,b.sourceDay),
      lastReviewed:last(a.lastReviewed || '',b.lastReviewed || '') || null };
  }

  function plan(local, incoming, day) {
    if (!quiz.isDay(day)) fail('当前复习日期无效。');
    const before = normalize(local);
    const source = normalize(incoming);
    const roundsByDay = new Map(before.rounds.map(round => [round.day, round]));
    const stats = { addedRounds:0, advancedRounds:0, conflictRounds:0, unchangedRounds:0, addedCards:0, updatedCards:0 };
    for (const round of source.rounds) {
      const existing = roundsByDay.get(round.day);
      if (!existing) {
        stats.addedRounds++;
        roundsByDay.set(round.day, round);
        continue;
      }
      const common = Math.min(existing.answers.length, round.answers.length);
      if (round.answers.slice(0, common).some((pick, i) => pick !== existing.answers[i])) {
        stats.conflictRounds++;
      } else if (round.answers.length > existing.answers.length || round.index > existing.index) {
        stats.advancedRounds++;
        roundsByDay.set(round.day, round);
      } else stats.unchangedRounds++;
    }
    if (roundsByDay.size > MAX_ROUNDS) fail('合并后的日卷数量超过上限。');
    const rounds = [...roundsByDay.values()].sort((a, b) => a.day.localeCompare(b.day));
    const localCards = before.practice.cards;
    const cards = { ...localCards };
    for (const [id, other] of Object.entries(source.practice.cards)) cards[id] = combineCard(cards[id], other);
    // Explicit old review records remain useful even when a dated paper was
    // lost or differs. Infer additional misses only from accepted rounds.
    let practice = { rules:before.practice.rules, cards };
    const seen = new Set();
    for (let i = rounds.length - 1; i >= 0 && seen.size < bank.length; i--) {
      const round = rounds[i];
      if (round.day > day) continue;
      const misses = missedIds.get(round);
      // Only the latest eligible miss of each card can affect its schedule.
      // Reuse the review engine for those editions (at most one per card).
      if (misses.some(id => !seen.has(id))) {
        practice = review.importRound(practice, round, day);
        for (const id of misses) seen.add(id);
      }
    }
    for (const [id, card] of Object.entries(practice.cards)) {
      if (!localCards[id]) stats.addedCards++;
      else if (cardKeys.some(key => card[key] !== localCards[id][key])) stats.updatedCards++;
    }
    return { rounds, practice, stats };
  }

  const api = Object.freeze({ MAX_BYTES, MAX_ROUNDS, normalize, format, parse, plan });
  if (commonJS) module.exports = api;
  else globalThis.EarthCanonTransfer = api;
})();
