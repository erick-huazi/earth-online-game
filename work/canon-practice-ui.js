// Wrong-answer practice owns a separate record; historical daily rounds are read-only.
(() => {
  'use strict';
  const engine = window.EarthCanonPractice;
  const daily = window.EarthDailyCanon;
  const dailyPage = window.EarthDailyCanonPage;
  const get = name => document.getElementById('practice-' + name);
  const dialog = get('dialog');
  const dailyPrefix = 'earth-online-daily-canon-v1:';
  let state = engine.create();
  let memoryOnly = false;
  let entry;
  let generation = 0;
  let round = [];
  let position = 0;
  let correctCount = 0;
  let graded = false;
  let busy = false;
  let completed = false;
  let overviewDay;
  let midnightTimer;

  window.EarthCanonPracticePage = Object.freeze({pending: () => memoryOnly ? state : null,
    imported: saved => { state = saved; memoryOnly = false; }});

  function load() {
    if (memoryOnly) return state;
    try {
      const raw = localStorage.getItem(engine.storageKey);
      return raw ? engine.restore(JSON.parse(raw)) || engine.create() : engine.create();
    } catch (error) {
      if (error instanceof SyntaxError) return engine.create();
      memoryOnly = true;
      return state;
    }
  }

  function collect(saved, day) {
    // A player's pre-upgrade answers may span many different daily keys.
    let updated = saved;
    if (!memoryOnly) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key || !key.startsWith(dailyPrefix)) continue;
          const date = key.slice(dailyPrefix.length);
          if (!daily.isDay(date)) continue;
          let record;
          try { record = JSON.parse(localStorage.getItem(key)); }
          catch (error) { if (error instanceof SyntaxError) continue; throw error; }
          if (record?.day === date) updated = engine.importRound(updated, record, day);
        }
      } catch { memoryOnly = true; }
    }
    for (const record of dailyPage.savedRounds()) updated = engine.importRound(updated, record, day);
    return updated;
  }

  function transact(change) {
    function update() {
      const before = load();
      state = change(before);
      if (!memoryOnly && state !== before) {
        try { localStorage.setItem(engine.storageKey, JSON.stringify(state)); }
        catch { memoryOnly = true; }
      }
      get('storage').hidden = !memoryOnly;
    }
    if (!navigator.locks) { update(); return Promise.resolve(); }
    return navigator.locks.request(engine.storageKey, update).catch(error => {
      if (error.name !== 'SecurityError') throw error;
      update();
    });
  }

  function overview(focus) {
    const day = daily.today();
    overviewDay = day;
    clearTimeout(midnightTimer);
    // A Beijing date ends at 16:00 UTC, irrespective of the device's timezone.
    const midnight = Date.parse(day + 'T16:00:00Z');
    midnightTimer = setTimeout(refreshDay, Math.max(1, midnight - Date.now() + 50));
    const stats = engine.summary(state, day);
    const count = Math.min(stats.due, 5);
    get('play').hidden = true;
    get('home').hidden = false;
    get('date').textContent = day + ' · 本机复习记录';
    get('summary').textContent = completed ? '本轮答对 ' + correctCount + ' / ' + round.length + ' 题'
      : stats.total ? '我的复习进度' : '还没有错题';
    for (const name of ['due','mastered','total']) get(name).textContent = stats[name];
    get('schedule').textContent = !stats.total ? '先参加每日辨典，答错的原句会出现在这里。'
      : stats.due ? (stats.nextDue ? '下一批原句将在 ' + stats.nextDue + ' 到期。' : '')
      : stats.nextDue ? '今天的复习已完成，下次复习在 ' + stats.nextDue + '（北京时间）。'
      : '收录的原句已全部掌握。';
    get('schedule').hidden = !get('schedule').textContent;
    get('start').hidden = !count;
    get('start').textContent = '重练 ' + count + ' 题';
    if (focus) get('summary').focus();
  }
  async function refreshDay() {
    if (!dialog.open || get('home').hidden || overviewDay === daily.today()) return;
    const token = generation;
    await transact(saved => collect(saved, daily.today()));
    if (dialog.open && token === generation && !get('home').hidden) overview(false);
  }
  window.addEventListener('focus', refreshDay);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDay(); });

  function present() {
    const {card} = round[position];
    graded = false;
    busy = false;
    get('home').hidden = true;
    get('play').hidden = false;
    get('verdict').hidden = true;
    get('progress').textContent = '第 ' + (position + 1) + ' / ' + round.length + ' 题 · 简体题面';
    get('quote').textContent = card.prompt;
    get('options').replaceChildren(...card.options.map((id, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.practiceChoice = id;
      const key = document.createElement('span');
      key.setAttribute('aria-hidden','true');
      key.textContent = index + 1;
      button.append(key, '《' + daily.books[id] + '》');
      button.addEventListener('click', () => grade(id));
      return button;
    }));
    get('quote').focus();
  }

  async function grade(pick) {
    if (graded || busy || get('play').hidden) return;
    busy = true;
    const token = generation;
    const {id,card} = round[position];
    const day = daily.today();
    let counted = false;
    await transact(saved => {
      const updated = engine.answer(saved, id, pick, day);
      counted = updated !== saved;
      return updated;
    });
    if (!dialog.open || generation !== token) return;
    graded = true;
    busy = false;
    if (card.bookId === pick) correctCount++;
    for (const button of get('options').children) {
      button.disabled = true;
      if (button.dataset.practiceChoice === card.bookId) button.className = 'right';
      else if (button.dataset.practiceChoice === pick) button.className = 'wrong';
    }
    const result = state.cards[id];
    const response = pick === card.bookId ? '答对了。' : '你选了《' + daily.books[pick] + '》。';
    const schedule = !result ? '' : !result.due ? '这题已掌握。'
      : result.due > day ? '下次复习在 ' + result.due + '。' : '今天可以再练这题。';
    get('feedback').textContent = response + '原文出自《' + daily.books[card.bookId] + '》。' +
      (counted ? '' : '另一页已更新复习记录。') + schedule;
    get('progress').textContent = '第 ' + (position + 1) + ' / ' + round.length + ' 题 · 馆藏原文';
    get('quote').textContent = card.text;
    dailyPage.sourceLink(card, get('source'), 'canon-practice');
    get('verdict').hidden = false;
    get('next').textContent = position + 1 === round.length ? '查看复习进度' : '下一题';
    get('feedback').focus();
  }

  get('start').addEventListener('click', async () => {
    const token = generation;
    const day = daily.today();
    await transact(saved => collect(saved, day));
    if (!dialog.open || generation !== token || get('home').hidden) return;
    round = engine.queue(state, day).slice(0,5);
    position = correctCount = 0;
    completed = false;
    if (round.length) present(); else overview(true);
  });
  get('next').addEventListener('click', () => {
    if (!graded || get('play').hidden) return;
    if (position + 1 < round.length) { position++; present(); }
    else { completed = true; overview(true); }
  });
  dialog.addEventListener('keydown', event => {
    if (get('play').hidden || graded || event.repeat || event.isComposing || event.ctrlKey ||
        event.metaKey || event.altKey || !['1','2','3'].includes(event.key)) return;
    event.preventDefault();
    grade(round[position].card.options[Number(event.key)-1]);
  });

  for (const link of [get('entry'), document.getElementById('canon-to-practice')]) {
    link.addEventListener('click', event => {
      if (!(event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) entry = link;
    });
  }
  function close() {
    if (entry) { history.back(); return; }
    location.replace('#expedition');
  }
  get('close').addEventListener('click', close);
  dialog.addEventListener('close', () => clearTimeout(midnightTimer));
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  get('daily').addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    document.getElementById('canon-entry').click();
    dialog.close();
    generation++;
    entry = null;
  });
  async function route() {
    if (location.hash !== '#canon-practice') {
      if (dialog.open) {
        generation++;
        dialog.close();
        const returnTo = entry || get('entry');
        if (!returnTo.closest('dialog:not([open])') && (!document.querySelector('dialog[open]') || returnTo.closest('dialog[open]'))) {
          returnTo.focus({preventScroll:true});
        }
        entry = null;
      }
      return;
    }
    if (dialog.open) return;
    const token = ++generation;
    completed = false;
    get('rules').open = false;
    get('home').hidden = true;
    get('play').hidden = true;
    dialog.showModal();
    await transact(saved => collect(saved, daily.today()));
    if (dialog.open && token === generation) overview(true);
  }
  window.addEventListener('storage', async event => {
    if (!dialog.open || (event.key && !event.key.startsWith(dailyPrefix) && event.key !== engine.storageKey)) return;
    const token = generation;
    await transact(saved => event.key?.startsWith(dailyPrefix) ? collect(saved, daily.today()) : saved);
    if (dialog.open && token === generation && !get('home').hidden) overview(false);
  });
  window.addEventListener('hashchange', route);
  window.addEventListener('popstate', route);
  route();
})();
