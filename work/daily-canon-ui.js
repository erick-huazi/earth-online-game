// Daily Canon runs independently of the expedition and classic game saves.
(() => {
  'use strict';
  const quiz = window.EarthDailyCanon;
  const get = name => document.getElementById('canon-' + name);
  const dialog = get('dialog');
  const rounds = new Map();
  let day, questions, state;
  let persistent = true;
  const storageKey = date => 'earth-online-daily-canon-v1:' + date;

  function progress(value) {
    return value.index + value.answers.length;
  }
  function read(date) {
    const session = rounds.get(date) || quiz.create(date);
    try {
      const raw = localStorage.getItem(storageKey(date));
      if (raw) {
        const saved = quiz.restore(JSON.parse(raw), date);
        if (saved && progress(saved) >= progress(session)) return saved;
      }
    } catch (error) {
      if (!(error instanceof SyntaxError)) persistent = false;
    }
    return session;
  }
  function save(date, next) {
    rounds.set(date, next);
    try {
      localStorage.setItem(storageKey(date), JSON.stringify(next));
      persistent = true;
    } catch { persistent = false; }
  }
  function datedURL(date, share = false) {
    const url = new URL(location.href);
    if (share && (url.protocol === 'file:' || ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) {
      return 'https://39.107.91.13/earth-online/earth-online-game.html?day=' + date + '#daily-canon';
    }
    if (share) url.search = '';
    url.searchParams.set('day', date);
    url.hash = 'daily-canon';
    return url.href;
  }
  function sourceURL(card) {
    const url = new URL('html/' + card.bookId + '.html', location.href);
    url.searchParams.set('from', 'daily-canon');
    url.searchParams.set('day', day);
    const anchor = {start:card.start, end:card.start + card.text.length, exact:card.text,
      prefix:card.prefix, suffix:card.suffix};
    url.hash = 'clip=' + encodeURIComponent(JSON.stringify([card.bookId, card.section, anchor]));
    return url.href;
  }
  function sourceLink(card, link = document.createElement('a')) {
    link.href = sourceURL(card);
    link.target = '_blank';
    link.rel = 'noopener';
    const action = document.createElement('span');
    action.className = 'canon-link-action';
    action.textContent = '新标签读原文 ↗';
    link.replaceChildren('《' + quiz.books[card.bookId] + '》 · ' + card.title + ' ', action);
    return link;
  }
  function shareText() {
    return quiz.share(state) + '\n' + datedURL(day, true);
  }
  function review() {
    const rows = questions.map((card, index) => {
      const row = document.createElement('li');
      const quote = document.createElement('blockquote');
      quote.textContent = card.text;
      const note = document.createElement('p');
      const pick = state.answers[index];
      note.textContent = pick === card.bookId ? '答对' : '你选了《' + quiz.books[pick] + '》';
      row.append(quote, note, sourceLink(card));
      return row;
    });
    get('answers').replaceChildren(...rows);
  }
  function render() {
    const phase = quiz.phase(state);
    get('storage').hidden = persistent;
    get('play').hidden = phase === 'finished';
    get('finished').hidden = phase !== 'finished';
    if (phase === 'finished') {
      get('summary').textContent = '答对 ' + quiz.score(state) + ' / ' + questions.length + ' 题';
      get('share-text').value = shareText();
      review();
      get('summary').focus();
      return;
    }
    const card = questions[state.index];
    const revealed = phase === 'reveal';
    get('progress').textContent = '第 ' + (state.index + 1) + ' / ' + questions.length + ' 题';
    get('marks').replaceChildren(...questions.map((q,i)=>{
      const mark = document.createElement('i');
      if (i < state.answers.length) mark.className = q.bookId === state.answers[i] ? 'right' : 'wrong';
      else if (i === state.index) mark.className = 'current';
      return mark;
    }));
    get('edition').textContent = revealed ? '馆藏原文' : '简体题面';
    get('quote').textContent = revealed ? card.text : card.prompt;
    const choices = card.options.map((id, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.canonChoice = id;
      button.disabled = revealed;
      if (revealed && id === card.bookId) button.className = 'right';
      else if (revealed && id === state.answers[state.index]) button.className = 'wrong';
      const key = document.createElement('span');
      key.setAttribute('aria-hidden','true');
      key.textContent = String(index + 1);
      button.append(key, '《' + quiz.books[id] + '》');
      button.addEventListener('click', () => advance('question',id));
      return button;
    });
    get('options').replaceChildren(...choices);
    get('verdict').hidden = !revealed;
    if (revealed) {
      const picked = state.answers[state.index];
      get('feedback').textContent = picked === card.bookId ? '答对了，出自《' + quiz.books[card.bookId] + '》。'
        : '你选了《' + quiz.books[picked] + '》，原文出自《' + quiz.books[card.bookId] + '》。';
      sourceLink(card, get('source'));
      get('next').textContent = state.index + 1 === questions.length ? '查看战绩' : '下一题';
      get('feedback').focus();
    } else get('quote').focus();
  }

  async function advance(expectedPhase, choice) {
    const date = day, index = state.index;
    if (quiz.phase(state) !== expectedPhase) return;
    function update() {
      // A second tab or a fast second click may already have taken this step.
      const current = read(date);
      let next = current;
      if (current.index === index && quiz.phase(current) === expectedPhase) {
        next = expectedPhase === 'question' ? quiz.answer(current, choice) : quiz.next(current);
        save(date, next);
      }
      if (dialog.open && day === date) { state = next; render(); }
    }
    if (navigator.locks) {
      try { await navigator.locks.request(storageKey(date), update); return; }
      catch (error) { if (error.name !== 'SecurityError') throw error; }
    }
    update();
  }
  get('next').addEventListener('click', () => advance('reveal'));
  get('copy').addEventListener('click', async () => {
    const text = shareText();
    try {
      await navigator.clipboard.writeText(text);
      get('copy-status').textContent = '战绩和同日链接已复制。';
    } catch {
      get('share').open = true;
      get('share-text').focus();
      get('share-text').select();
      get('copy-status').textContent = '请复制已选中的战绩和链接。';
    }
  });
  dialog.addEventListener('keydown', event => {
    if (!dialog.open || event.repeat || event.isComposing || event.ctrlKey || event.metaKey ||
        event.altKey || !['1','2','3'].includes(event.key) || quiz.phase(state) !== 'question') return;
    event.preventDefault();
    advance('question', questions[state.index].options[Number(event.key)-1]);
  });
  window.addEventListener('storage', event => {
    if (!dialog.open || event.key !== storageKey(day)) return;
    const next = read(day);
    if (JSON.stringify(next) !== JSON.stringify(state)) { state = next; render(); }
  });
  function open(date, invalid) {
    if (dialog.open && day === date) return;
    day = date;
    questions = quiz.questions(day);
    state = read(day);
    get('date').textContent = day + ' · 北京时间';
    get('notice').textContent = invalid ? '链接日期无效，已打开今日题目。' : '';
    get('notice').hidden = !invalid;
    get('copy-status').textContent = '';
    get('share').open = get('review-list').open = false;
    if (!dialog.open) dialog.showModal();
    render();
  }
  function route() {
    if (location.hash !== '#daily-canon') {
      if (dialog.open) dialog.close();
      return;
    }
    const requested = history.state?.earthCanonDay || new URL(location.href).searchParams.get('day');
    const date = quiz.isDay(requested) ? requested : quiz.today();
    // Keep the original edition even if midnight passes before refresh.
    try {
      history.replaceState({...history.state, earthCanonDay:date}, '', datedURL(date));
    } catch { history.replaceState({...history.state, earthCanonDay:date}, ''); }
    open(date, requested !== null && !quiz.isDay(requested));
  }
  get('entry').addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const date = quiz.today();
    const marker = {earthCanonDay:date, earthCanonFromEntry:true};
    try { history.pushState(marker,'',datedURL(date)); }
    catch { history.pushState(marker,'','#daily-canon'); }
    open(date, false);
  });
  function close() {
    if (history.state?.earthCanonFromEntry) { history.back(); return; }
    const url = new URL(location.href);
    url.searchParams.delete('day');
    url.hash = 'expedition';
    try { history.replaceState(null,'',url.href); }
    catch { history.replaceState(null,'','#expedition'); }
    dialog.close();
  }
  get('close').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => { if (!dialog.open && !document.querySelector('dialog[open]')) get('entry').focus({preventScroll:true}); });
  window.addEventListener('hashchange', route);
  window.addEventListener('popstate', route);
  route();
})();
