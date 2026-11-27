/* A replay branch lives only inside this viewer. All moves use the ordinary expedition rules. */
(() => {
  'use strict';
  const engine = window.EarthExpedition;
  const resourceNames = {stamina: '体力', supply: '补给', trust: '声望'};
  const signed = value => value > 0 ? '+' + value : String(value);
  const changes = delta => Object.entries(resourceNames)
    .filter(([key]) => delta[key] !== 0)
    .map(([key, name]) => name + ' ' + signed(delta[key])).join(' · ');

  function mount() {
    const get = id => document.getElementById('exp-practice-' + id);
    const panel = document.getElementById('exp-practice');
    const stage = get('stage');
    let source = null;
    let startStation = 0;
    let run = null;

    function element(tag, text) {
      const node = document.createElement(tag);
      node.textContent = text;
      return node;
    }
    function action(key, label, detail, change) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.move = key;
      button.append(element('strong', label));
      if (detail) button.append(element('span', detail));
      button.addEventListener('click', () => {
        if (!stage.contains(button)) return;
        run = change(run);
        render();
      });
      stage.append(button);
    }
    function sealAfter(journey, station) {
      if (station !== 4 && station !== 8) return null;
      return engine.relics.find(seal => seal.id === journey.relics[station / 4])?.name || null;
    }
    function stationDifference(station) {
      const trial = run.history[station - 1], original = source.history[station - 1];
      if (!trial) return '仅原局到达';
      if (!original) return '仅练习到达';
      if (trial.routeId !== original.routeId) return '路线不同';
      if (trial.eventId !== original.eventId) return '遭遇不同';
      if (trial.choice !== original.choice) return '行动不同';
      if (sealAfter(run, station) !== sealAfter(source, station)) return '书印不同';
      return '';
    }
    function appendStationComparison() {
      const details = element('details', '');
      details.className = 'exp-station-compare';
      const select = element('select', '');
      select.id = 'exp-compare-station';
      const lastStation = Math.max(run.turn, source.turn);
      let firstDifference;
      for (let station = startStation; station <= lastStation; station++) {
        const difference = stationDifference(station);
        if (difference && firstDifference === undefined) firstDifference = station;
        select.add(new Option('第 ' + station + ' 站' + (difference ? ' · ' + difference : ''), String(station)));
      }
      const summary = element('summary', '逐站对照');
      summary.append(element('span', firstDifference === undefined ? '两次行程选择一致' : '首次不同在第 ' + firstDifference + ' 站'));
      select.value = String(firstDifference ?? startStation);
      const label = element('label', '查看站点');
      label.htmlFor = select.id;
      const choices = element('dl', '');
      choices.className = 'exp-compare-choices';
      const table = element('table', '');
      table.createCaption().textContent = '站末资源与本站见识';
      const header = table.createTHead().insertRow();
      for (const name of ['项目', '练习', '原局', '练习减原局']) {
        const cell = element('th', name);
        cell.scope = 'col';
        header.append(cell);
      }
      const body = table.createTBody();
      function showStation() {
        const station = Number(select.value);
        choices.replaceChildren();
        for (const [name, journey] of [['本次练习', run], ['原局回放', source]]) {
          const step = journey.history[station - 1];
          const description = element('dd', '');
          if (step) {
            description.append(element('strong', step.routeTitle + ' · ' + step.title), element('p', step.label));
            const seal = sealAfter(journey, station);
            if (seal) description.append(element('p', '收下书印「' + seal + '」'));
          } else {
            description.textContent = '已在第 ' + journey.turn + ' 站归营 · ' + journey.ending.title;
          }
          choices.append(element('dt', name), description);
        }
        const trial = run.history[station - 1], original = source.history[station - 1];
        body.replaceChildren();
        for (const [key, name] of Object.entries({...resourceNames, insight: '本站见识'})) {
          const row = body.insertRow();
          const heading = element('th', name);
          heading.scope = 'row';
          row.append(heading);
          const value = step => key === 'insight' ? step?.insight : step?.resources[key];
          const a = value(trial), b = value(original);
          row.insertCell().textContent = a ?? '—';
          row.insertCell().textContent = b ?? '—';
          row.insertCell().textContent = trial && original ? signed(a - b) : '—';
        }
      }
      select.addEventListener('change', showStation);
      showStation();
      details.append(summary, label, select, choices, table);
      stage.append(details);
    }
    function render() {
      const atChoice = run.phase === 'route' || run.phase === 'event';
      const station = atChoice ? run.turn + 1 : run.turn;
      const original = source.history[station - 1];
      const title = get('title');
      const prefix = '第 ' + station + ' 站 · ';
      stage.dataset.phase = run.phase;
      stage.replaceChildren();
      get('resources').replaceChildren(...Object.entries(resourceNames).map(([key, name]) =>
        element('li', name + ' ' + run.resources[key])), element('li', '见识 ' + run.insight));
      get('seals').textContent = '随身书印 · ' + run.relics.map(id => engine.relics.find(r => r.id === id).name).join('、');
      if (run.phase === 'route') {
        title.textContent = prefix + '选择路线';
        if (original) stage.append(element('p', '原回放走了「' + original.routeTitle + '」，遇到「' + original.title + '」。'));
        for (const route of engine.getRoutes(run)) {
          action(route.id, route.title + ' · ' + route.eventTitle, route.book + ' ｜ 路耗 ' + changes(route.cost), state => engine.chooseRoute(state, route.id));
        }
      } else if (run.phase === 'event') {
        const event = engine.getEvent(run);
        title.textContent = prefix + event.title;
        stage.append(element('p', event.body));
        if (original?.eventId === event.id) stage.append(element('p', '原回放选择「' + original.label + '」。'));
        event.options.forEach((option, index) => {
          const preview = [changes(option.delta), '见识 +' + option.insight].filter(Boolean).join(' · ');
          action(String(index), option.label, preview, state => engine.chooseOption(state, index));
        });
      } else if (run.phase === 'feedback') {
        const outcome = run.lastOutcome;
        title.textContent = prefix + outcome.label;
        stage.append(element('p', outcome.feedback), element('p', [changes(outcome.delta), '见识 +' + outcome.insight].filter(Boolean).join(' · ')));
        action('advance', '继续练习', '', engine.advance);
      } else if (run.phase === 'relic') {
        title.textContent = prefix + '选一枚书印';
        for (const relic of engine.getRelicChoices(run)) {
          action(relic.id, relic.name, relic.description, state => engine.chooseRelic(state, relic.id));
        }
      } else {
        const branch = engine.summarize(run);
        const replay = engine.summarize(source);
        title.textContent = '练习结局 · ' + branch.title;
        stage.append(element('p', run.ending.description));
        const comparison = document.createElement('dl');
        comparison.className = 'exp-practice-result';
        for (const [name, summary] of [['本次练习', branch], ['原局回放', replay]]) {
          comparison.append(element('dt', name), element('dd', summary.title + ' · ' + summary.turn + ' 站 · ' + summary.score + ' 分'));
        }
        stage.append(comparison);
        stage.append(element('p', '练习得分较原局 ' + signed(branch.score - replay.score) + ' 分'));
        appendStationComparison();
        action('retry', '从第 ' + startStation + ' 站再试一次', '', () => engine.stationStart(source, startStation));
      }
      title.focus();
    }
    return {
      start(replay, station) {
        source = replay;
        startStation = station;
        run = engine.stationStart(source, station);
        get('origin').textContent = '第 ' + station + ' 站分岔 · 练习仅在本次回放中有效';
        get('return').textContent = '返回第 ' + station + ' 站回放';
        panel.hidden = false;
        render();
      },
      clear() {
        panel.hidden = true;
        source = run = null;
        stage.replaceChildren();
      },
      get active() { return Boolean(run); }
    };
  }
  window.EarthExpeditionPractice = Object.freeze({mount});
})();
