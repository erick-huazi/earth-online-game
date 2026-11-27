// A portable save contains only daily papers and their personal review record.
(() => {
  'use strict';
  const transfer = window.EarthCanonTransfer;
  const daily = window.EarthDailyCanon;
  const practice = window.EarthCanonPractice;
  const dailyPage = window.EarthDailyCanonPage;
  const practicePage = window.EarthCanonPracticePage;
  const prefix = 'earth-online-daily-canon-v1:';
  const get = name => document.getElementById('transfer-' + name);
  const dialog = get('dialog');
  let request = 0, incoming, preview, busy = false, opener;
  let diskCache = new Map();

  function readLocal() {
    const raw = new Map(), papers = new Map();
    let storedPractice = null, available = true;
    try {
      for (const key of Object.keys(localStorage)) {
        if (key !== practice.storageKey && !key.startsWith(prefix)) continue;
        const bytes = localStorage.getItem(key);
        if (bytes === null) continue;
        const cached = diskCache.get(key);
        const parsed = cached?.bytes === bytes ? cached.record : JSON.parse(bytes);
        if (!parsed || (key !== practice.storageKey && key !== prefix + parsed.day)) {
          throw new Error('本机辨典记录格式异常，请保留原记录。');
        }
        raw.set(key, bytes);
        if (key === practice.storageKey) storedPractice = parsed;
        else papers.set(parsed.day, parsed);
      }
    } catch (error) {
      if (error.name !== 'SecurityError') throw error;
      available = false;
    }
    // Validate disk records before combining them with progress held by this tab.
    const disk = {rounds:[...papers.values()], practice:storedPractice};
    const canonical = transfer.normalize(disk);
    diskCache = new Map();
    for (const record of canonical.rounds) {
      papers.set(record.day,record);
      const key = prefix + record.day;
      diskCache.set(key,{record,bytes:raw.get(key)});
    }
    storedPractice = canonical.practice;
    for (const held of dailyPage.savedRounds()) {
      const other = papers.get(held.day);
      if (!other || (held.index + held.answers.length > other.index + other.answers.length &&
          other.answers.every((answer,i) => held.answers[i] === answer))) papers.set(held.day, held);
    }
    const pending = practicePage.pending();
    if (pending) storedPractice = transfer.plan({rounds:[],practice:storedPractice},
      {rounds:[],practice:pending},daily.today()).practice;
    return {raw,available, data:{rounds:[...papers.values()],practice:storedPractice}};
  }

  function clearPreview() {
    request++;
    incoming = preview = null;
    get('file').value = '';
    get('preview').hidden = true;
    get('result').hidden = true;
  }

  function printPreview(local, plan) {
    preview = plan;
    const days = incoming.rounds.map(round => round.day).sort();
    const count = Object.keys(incoming.practice?.cards || {}).length;
    get('range').textContent = '文件包含 ' + days.length + ' 份日卷、' + count + ' 张复习卡。';
    if (days.length) {
      const time = day => {
        const node = document.createElement('time');
        node.dateTime = node.textContent = day;
        return node;
      };
      get('range').append(time(days[0]));
      if (days.length > 1) get('range').append(' 至 ',time(days.at(-1)));
      get('range').append('。');
    }
    const labels = {addedRounds:'新增日卷',advancedRounds:'可接续的日卷',conflictRounds:'首答冲突 · 保留本机',
      unchangedRounds:'已有日卷',addedCards:'新增复习卡',updatedCards:'更新复习进度'};
    const rows = Object.entries(labels).map(([key,label]) => {
      const row = document.createElement('div'), term = document.createElement('dt'), value = document.createElement('dd');
      term.textContent = label;
      value.textContent = plan.stats[key];
      row.append(term,value);
      return row;
    });
    get('stats').replaceChildren(...rows);
    const existing = new Map(local.data.rounds.map(round => [round.day,round.answers]));
    const conflictDays = incoming.rounds.filter(round => {
      const answers = existing.get(round.day);
      return answers && round.answers.some((answer,i) => i < answers.length && answers[i] !== answer);
    });
    get('days').replaceChildren(...conflictDays.map(round => {
      const li = document.createElement('li'); li.textContent = round.day; return li;
    }));
    get('conflicts').hidden = !conflictDays.length;
    get('conflicts').open = false;
    get('preview').hidden = false;
    get('apply').disabled = !local.available;
    get('caption').focus();
  }

  get('export').addEventListener('click', () => {
    let url;
    try {
      const local = readLocal();
      const bytes = transfer.format(local.data);
      url = URL.createObjectURL(new Blob([bytes],{type:'application/json'}));
      const link = document.createElement('a');
      link.href = url; link.download = 'earth-online-canon-' + daily.today() + '.json';
      document.body.append(link); link.click(); link.remove();
      get('status').textContent = local.available ? '已生成 JSON 文件，可在另一台设备打开辨典存档并选择该文件。'
        : '已导出当前页可读取的辨典记录。';
    } catch (error) { get('status').textContent = '无法导出。' + problem(error); }
    finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 30000); }
  });

  function problem(error) {
    if (error instanceof SyntaxError) return 'JSON 或本机记录格式无效。';
    if (error.name === 'QuotaExceededError') return '浏览器存储空间不足。';
    if (error.name === 'SecurityError') return '浏览器拒绝访问存储。';
    return error.message;
  }
  get('file').addEventListener('change', async () => {
    const file = get('file').files[0];
    clearPreview();
    const token = request;
    get('status').textContent = '';
    if (!file) return;
    get('status').textContent = '正在核对文件与本机记录…';
    try {
      if (file.size > transfer.MAX_BYTES) throw new Error('文件超过 2 MiB。');
      const data = transfer.parse(await file.text());
      if (token !== request || !dialog.open) return;
      const local = readLocal(), plan = transfer.plan(local.data,data,daily.today());
      incoming = data;
      printPreview(local,plan);
      get('status').textContent = local.available ? '' : '当前浏览器无法保存，可在允许本地存储的浏览器中导入。';
    } catch (error) {
      if (token === request) get('status').textContent = '无法预览。' + problem(error);
    }
  });
  get('cancel').addEventListener('click', () => {
    clearPreview();
    get('status').textContent = '已取消合并。';
    get('file').focus();
  });

  // Match the per-day and practice locks used by v2.8/v2.9 tabs as well.
  // The practice lock serializes imports; date locks protect first answers
  // even when an older copy of the game is running in another tab.
  function locked(key, action) {
    if (!navigator.locks) return action();
    let entered = false;
    return navigator.locks.request(key, () => { entered = true; return action(); }).catch(error => {
      if (entered || error.name !== 'SecurityError') throw error;
      return action();
    });
  }
  function paperEqual(a, b) {
    return a && a.deck === b.deck && a.index === b.index && a.answers.length === b.answers.length &&
      a.answers.every((value,i) => value === b.answers[i]);
  }
  function practiceEqual(a,b) {
    const left = a?.cards || {}, right = b.cards;
    return Object.keys(left).length === Object.keys(right).length && Object.entries(right).every(([id,card]) =>
      Object.keys(card).every(k=>left[id] && left[id][k] === card[k]));
  }
  function showResult(plan) {
    const fileDays = new Set(incoming.rounds.map(round=>round.day));
    const matches = plan.rounds.filter(round=>fileDays.has(round.day)).sort((a,b)=>b.day.localeCompare(a.day));
    const next = matches.find(round=>daily.phase(round) !== 'finished') || matches[0];
    clearPreview();
    get('resume').hidden = !next;
    if (next) {
      const url = new URL(location.href);
      url.searchParams.set('day',next.day); url.hash='daily-canon';
      get('resume').href=url.href;
      get('resume').textContent=(daily.phase(next)==='finished'?'查看 ':'继续 ')+next.day+' 日卷 →';
    }
    get('result').hidden = false;
    get('status').focus();
  }
  async function commit() {
    const token = request, local = readLocal(), day = daily.today();
    if (!local.available) throw new Error('当前浏览器无法持久保存。');
    if (!dialog.open || !incoming) return;
    const next = transfer.plan(local.data,incoming,day);
    if (JSON.stringify(next) !== JSON.stringify(preview)) {
      printPreview(local,next);
      get('status').textContent = '本机进度已变化，请核对更新后的预览并再次确认。';
      return;
    }
    const writes = [];
    const add = (key,value) => writes.push({key,before:local.raw.get(key) ?? null,after:JSON.stringify(value)});
    for (const paper of next.rounds) {
      const key = prefix + paper.day, before = local.raw.get(key);
      if (!paperEqual(before ? JSON.parse(before) : null,paper)) add(key,paper);
    }
    const previousPractice = local.raw.get(practice.storageKey);
    if (!practiceEqual(previousPractice ? JSON.parse(previousPractice) : null, next.practice)) add(practice.storageKey,next.practice);
    // Acquire only affected daily locks, in date order, then do all writes and
    // any rollback synchronously. Navigation, storage events and ordinary
    // v2.8/v2.9 answers cannot intervene between individual writes in this tab.
    const dayKeys = writes.map(change=>change.key).filter(key=>key !== practice.storageKey);
    function applyLocked() {
      if (request !== token || !dialog.open) return;
      const fresh = readLocal();
      const latest = transfer.plan(fresh.data,incoming,daily.today());
      if (JSON.stringify(next) !== JSON.stringify(latest) ||
          writes.some(change=>(fresh.raw.get(change.key) ?? null) !== change.before)) {
        printPreview(fresh,latest);
        get('status').textContent = '本机进度已变化，请核对更新后的预览并再次确认。';
        return;
      }
      const applied = [];
      try {
        for (const change of writes) {
          localStorage.setItem(change.key,change.after);
          applied.push(change);
        }
      } catch (error) {
        let retained = 0;
        for (const change of applied.reverse()) {
          try {
            if (localStorage.getItem(change.key) !== change.after) { retained++; continue; }
            if (change.before === null) localStorage.removeItem(change.key);
            else localStorage.setItem(change.key,change.before);
          } catch { retained++; }
        }
        throw new Error(problem(error) + (retained ? '部分记录有后续变动或无法回退，请重选文件核对剩余更改。' : '此次合并未写入，修复后可重试。'));
      }
      dailyPage.imported(next.rounds);
      practicePage.imported(next.practice);
      get('status').textContent = writes.length ? '辨典存档已合并。' : '已核对，本机已有这些记录。';
      showResult(next);
    }
    function lockDay(index) {
      if (index === dayKeys.length || !navigator.locks) return applyLocked();
      if (request !== token || !dialog.open) return;
      return locked(dayKeys[index],()=>lockDay(index+1));
    }
    await lockDay(0);
  }
  get('apply').addEventListener('click', async () => {
    if (busy || !incoming) return;
    busy = true;
    get('status').textContent = '正在核对并合并存档…';
    for (const id of ['apply','cancel','file','close','export']) get(id).disabled = true;
    try { await locked(practice.storageKey,commit); }
    catch (error) { get('status').textContent = '合并未完成。' + problem(error); }
    finally {
      busy = false;
      for (const id of ['apply','cancel','file','close','export']) get(id).disabled = false;
    }
  });
  function close() {
    if (busy) return;
    if (opener) history.back();
    else location.replace('#canon-practice');
  }
  for (const id of ['practice-transfer','canon-transfer-link']) document.getElementById(id).addEventListener('click',event => {
    if (!(event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) opener = event.currentTarget;
  });
  get('close').addEventListener('click',close);
  dialog.addEventListener('cancel',event => {event.preventDefault(); close();});
  function route() {
    if (location.hash !== '#canon-transfer') {
      if (dialog.open) {
        dialog.close(); clearPreview(); diskCache.clear();
        if (opener?.closest('dialog[open]')) opener.focus({preventScroll:true});
        opener = null;
      }
    } else if (!dialog.open) {
      clearPreview(); get('status').textContent = '';
      dialog.showModal(); get('title').focus();
    }
  }
  window.addEventListener('hashchange',route);
  window.addEventListener('popstate',route);
  route();
})();
