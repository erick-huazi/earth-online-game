/* Local same-start records and the station review for completed expeditions. */
(() => {
  'use strict';

  const engine = window.EarthExpedition;
  const storageKey = 'earth-online-expedition-bests-v1';
  const capacity = 32;
  const resources = { stamina: '体力', supply: '补给', trust: '声望' };
  let sessionRecords = [];
  let pendingRecords = [];
  let readable = true;

  function element(tag, className, text) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== undefined) item.textContent = text;
    return item;
  }

  function validScore(value) {
    return Number.isInteger(value) && value >= 0 && value <= 100000;
  }

  function validStart(record) {
    return record && record.rules === engine.RULES &&
      typeof record.seed === 'string' && /^[A-Za-z0-9_-]{1,48}$/.test(record.seed) &&
      engine.roles.some(role => role.id === record.role);
  }

  function sameStart(left, right) {
    return left.rules === right.rules && left.seed === right.seed && left.role === right.role;
  }

  function validReceipt(record) {
    return validStart(record) && typeof record.attempt === 'string' &&
      record.attempt.length > 0 && record.attempt.length < 100 &&
      (record.previous === null || validScore(record.previous));
  }

  function receiptFor(record, run, attempt) {
    if (!run || run.phase !== 'ending' || !validReceipt(record) ||
        record.attempt !== attempt || !sameStart(record, run)) return null;
    return {
      rules: run.rules, seed: run.seed, role: run.role,
      attempt, previous: record.previous, temporary: record.temporary === true
    };
  }

  function mergePending(stored) {
    const pending = pendingRecords.map(record => {
      const other = stored.find(item => sameStart(item, record));
      return other && other.best > record.best ? { ...record, best: other.best } : record;
    });
    return [...pending, ...stored.filter(item => !pending.some(record => sameStart(record, item)))].slice(0, capacity);
  }

  function loadRecords() {
    try {
      const raw = localStorage.getItem(storageKey);
      readable = true;
      let stored = [];
      if (raw && raw.length < 24000) {
        try { stored = JSON.parse(raw); } catch { /* A malformed table can be rebuilt from this page. */ }
      }
      const valid = Array.isArray(stored) ? stored.filter(entry => validReceipt(entry) && validScore(entry.best)).slice(0, capacity) : [];
      sessionRecords = mergePending(valid);
    } catch {
      readable = false;
    }
    return sessionRecords;
  }

  window.addEventListener('storage', event => {
    if (event.newValue !== null || (event.key !== storageKey && event.key !== null)) return;
    try { if (event.storageArea !== localStorage) return; } catch { return; }
    pendingRecords = [];
    sessionRecords = [];
  });

  function recordFinish(run, attempt, score) {
    const records = loadRecords();
    const last = records.find(record => sameStart(record, run));
    const savedReceipt = receiptFor(last, run, attempt);
    if (savedReceipt) {
      savedReceipt.temporary = pendingRecords.some(record => sameStart(record, run) && record.attempt === attempt);
      return savedReceipt;
    }
    const receipt = { rules: run.rules, seed: run.seed, role: run.role, attempt, previous: last?.best ?? null };
    const record = { ...receipt, best: Math.max(last?.best ?? 0, score) };
    sessionRecords = [record, ...records.filter(item => !sameStart(item, run))].slice(0, capacity);
    if (readable) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(sessionRecords));
        pendingRecords = [];
        return receipt;
      } catch {
        // Retry with the next result if the browser becomes writable again.
      }
    }
    pendingRecords = [record, ...pendingRecords.filter(item => !sameStart(item, run))].slice(0, capacity);
    receipt.temporary = true;
    return receipt;
  }

  function comparisonPanel(run, attempt, score, receipt) {
    const panel = element('p', 'exp-comparison');
    panel.id = 'exp-personal-comparison';
    panel.dataset.score = String(score);
    if (!receiptFor(receipt, run, attempt)) {
      panel.dataset.result = 'unranked';
      panel.textContent = '这份战报可逐站回看。再走一遍，可在本机记录同一开局的成绩。';
      return panel;
    }
    if (receipt.previous === null) {
      panel.dataset.result = 'first';
      panel.textContent = '首次完成这个开局。在同一种子下用同一角色重玩，可比较两次的分数。';
    } else {
      const difference = score - receipt.previous;
      panel.dataset.previousBest = String(receipt.previous);
      panel.dataset.result = difference > 0 ? 'improved' : difference < 0 ? 'lower' : 'tied';
      const change = difference > 0 ? '提高 ' + difference + ' 分' :
        difference < 0 ? '少 ' + Math.abs(difference) + ' 分' : '成绩持平';
      panel.textContent = '此前同局最佳 ' + receipt.previous + ' 分，本次 ' + change + '。';
    }
    if (receipt.temporary) panel.append(' 同局成绩暂时只保留在当前页面。');
    return panel;
  }

  function signed(value) {
    if (value > 0) return '+' + value;
    return value < 0 ? '−' + Math.abs(value) : '0';
  }

  function alternateChoices(run, outcome) {
    const details = element('details', 'exp-alternate');
    const heading = element('summary', '', '如果这一站换个选择');
    details.append(heading);
    details.addEventListener('toggle', () => {
      if (!details.open || details.childElementCount > 1) return;
      const before = engine.decisionAt(run, outcome.turn);
      const options = engine.getEvent(before).options;
      const label = element('label', '', '试算第 ' + outcome.turn + ' 站的另一种选择');
      const select = element('select');
      options.forEach((choice, i) => {
        if (i === outcome.choice) return;
        const option = element('option', '', choice.label);
        option.value = String(i);
        select.append(option);
      });
      label.append(select);
      const result = element('div', 'exp-alternate-result');
      result.setAttribute('aria-live', 'polite');
      result.setAttribute('aria-atomic', 'true');
      function update() {
        const preview = engine.chooseOption(before, Number(select.value));
        const next = engine.advance(preview);
        const balances = element('ul');
        for (const [key, name] of Object.entries(resources)) {
          const value = preview.resources[key];
          const diff = value - outcome.resources[key];
          const comparison = diff === 0 ? '与实走相同' : '比实走' + (diff > 0 ? '多 ' : '少 ') + Math.abs(diff);
          balances.append(element('li', '', name + ' ' + value + '（' + comparison + '）'));
        }
        const destination = next.ending ? '此处结算 · ' + next.ending.title :
          next.phase === 'relic' ? '接下来挑选书印' : '可前往第 ' + (preview.turn + 1) + ' 站';
        result.replaceChildren(balances, element('p', '', '本站见识 +' + preview.lastOutcome.insight + ' · ' + destination));
      }
      select.addEventListener('change', update);
      details.append(label, result);
      update();
    });
    return details;
  }

  function buildStation(run, outcome) {
    const station = element('li', 'exp-recap-station');
    station.dataset.turn = String(outcome.turn);
    const heading = element('h4', '', '第 ' + outcome.turn + ' 站 · ' + outcome.title);
    const route = element('p', 'exp-recap-route', outcome.routeTitle + ' · ' + outcome.book);
    const decision = element('p', 'exp-recap-choice', outcome.label);
    const changes = element('div', 'exp-recap-resources');
    for (const [key, label] of Object.entries(resources)) {
      const after = outcome.resources[key];
      const delta = outcome.delta[key];
      const before = after - delta;
      const item = element('span', '', label + ' ' + before + ' → ' + after + '（' + signed(delta) + '）');
      Object.assign(item.dataset, { resource: key, before, after, delta });
      if (after === 0) item.append(' · 归零');
      changes.append(item);
    }
    station.append(heading, route, decision, changes, element('p', 'exp-recap-insight', '见识 +' + outcome.insight), alternateChoices(run, outcome));
    return station;
  }

  function stationReview(run) {
    const details = element('details', 'exp-recap');
    const list = element('ol', 'exp-recap-list');
    list.id = 'exp-recap-list';
    const intro = element('summary', '', '回看这一路的 ' + run.turn + ' 次取舍');
    for (const outcome of run.history) list.append(buildStation(run, outcome));
    details.append(intro, list);
    return details;
  }

  window.EarthExpeditionRecap = Object.freeze({ receiptFor, recordFinish, comparisonPanel, stationReview });
})();
