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
