/* A compact move log. Each decision is resolved using the same engine as local play. */
(() => {
  'use strict';
  const engine = window.EarthExpedition;
  const lz = window.LZString;

  // Detect truncated or mistyped codes. The checksum is not a signature.
  function checksum(text) {
    let hash = 2166136261;
    for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return (hash >>> 0).toString(36);
  }

  function encode(run) {
    if (run.phase !== 'ending' || run.rules !== engine.RULES) throw Error('请先完成这次远征。');
    const moves = run.actions.filter(action => action.t !== 'advance')
      .map(action => action.t === 'choice' ? action.index : action.id);
    const data = [run.rules, run.seed, run.role, moves.join(',')].join('|');
    const packed = lz.compressToEncodedURIComponent(data);
    return 'R1.' + packed + '.' + checksum(packed);
  }

  function decode(code) {
    const invalid = () => Error('回放口令不完整或不适用于当前规则。');
    if (typeof code !== 'string' || code.length > 400) throw invalid();
    const match = /^R1\.([A-Za-z0-9+$-]{4,380})\.([0-9a-z]{1,7})$/.exec(code);
    if (!match || checksum(match[1]) !== match[2]) throw invalid();
    const data = lz.decompressFromEncodedURIComponent(match[1]);
    if (!data || data.length > 350 || lz.compressToEncodedURIComponent(data) !== match[1]) throw invalid();
    const fields = data.split('|');
    if (fields.length !== 4 || fields[0] !== engine.RULES || !/^[a-z_0-2,]+$/.test(fields[3])) throw invalid();
    const moves = fields[3].split(',');
    if (moves.length > engine.TOTAL_TURNS * 2 + 2) throw invalid();
    try {
      let state = engine.create({seed: fields[1], role: fields[2]});
      for (const move of moves) {
        if (state.phase === 'route') state = engine.chooseRoute(state, move);
        else if (state.phase === 'relic') state = engine.chooseRelic(state, move);
        else if (state.phase === 'event' && /^[012]$/.test(move)) {
          state = engine.advance(engine.chooseOption(state, Number(move)));
        } else throw invalid();
      }
      if (state.phase !== 'ending') throw invalid();
      return state;
    } catch { throw invalid(); }
  }

  function mount(onChallenge) {
    const $ = id => document.getElementById(id);
    const dialog = $('exp-replay-dialog');
    const jump = $('exp-replay-jump');
    let viewed = null;
    let station = 0;
    function showStation(index) {
      if (!viewed) return;
      const previousFocus = document.activeElement;
      station = Math.max(0, Math.min(index, viewed.turn - 1));
      const step = viewed.history[station];
      jump.value = String(station);
      $('exp-replay-prev').disabled = station === 0;
      $('exp-replay-next').disabled = station + 1 === viewed.turn;
      $('exp-replay-position').textContent = '第 ' + step.turn + ' / ' + viewed.turn + ' 站 · ' + step.title;
      $('exp-replay-route').textContent = step.routeTitle + ' · ' + step.book;
      $('exp-replay-action').textContent = step.label;
      $('exp-replay-feedback').textContent = step.feedback;
      const resourceList = $('exp-replay-resources');
      resourceList.replaceChildren();
      for (const [key, name] of Object.entries({stamina:'体力', supply:'补给', trust:'声望'})) {
        const item = document.createElement('li');
        item.textContent = name + ' ' + (step.resources[key] - step.delta[key]) + ' → ' + step.resources[key];
        resourceList.append(item);
      }
      const sealId = (step.turn === 4 || step.turn === 8) ? viewed.relics[step.turn / 4] : null;
      const seal = sealId && engine.relics.find(item => item.id === sealId);
      $('exp-replay-insight').textContent = '本站见识 +' + step.insight + (seal ? ' · 收下书印「' + seal.name + '」' : '');
      if (previousFocus?.disabled && dialog.contains(previousFocus)) jump.focus();
    }
    function open(code) {
      try {
        viewed = decode(code);
        const summary = engine.summarize(viewed);
        $('exp-replay-summary').textContent = summary.roleName + ' · ' + summary.title + ' · ' + summary.score + ' 分';
        jump.replaceChildren(...viewed.history.map((step, i) => new Option('第 ' + step.turn + ' 站 · ' + step.title, String(i))));
        showStation(0);
      } catch (error) {
        viewed = null;
        $('exp-replay-summary').textContent = error.message;
      }
      $('exp-replay-view').hidden = !viewed;
      if (!dialog.open) dialog.showModal();
      $('exp-replay-close').focus();
    }
    $('exp-replay-prev').addEventListener('click', () => showStation(station - 1));
    $('exp-replay-next').addEventListener('click', () => showStation(station + 1));
    jump.addEventListener('change', () => showStation(Number(jump.value)));
    dialog.addEventListener('keydown', event => {
      if (!viewed || event.target === jump || event.ctrlKey || event.metaKey || event.altKey) return;
      const targets = {ArrowLeft: station - 1, ArrowRight: station + 1, Home: 0, End: viewed.turn - 1};
      if (!Object.hasOwn(targets, event.key)) return;
      event.preventDefault();
      showStation(targets[event.key]);
    });
    $('exp-replay-challenge').addEventListener('click', () => {
      if (!viewed) return;
      const seed = viewed.seed, role = viewed.role;
      dialog.close();
      onChallenge(seed, role);
    });
    $('exp-replay-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      if (dialog.open) return;
      viewed = null;
      if (location.hash.startsWith('#replay=')) {
        try { history.replaceState(history.state, '', '#expedition'); } catch { /* file URLs can restrict history. */ }
      }
    });
    return {open, close() { if (dialog.open) dialog.close(); }};
  }
  window.EarthExpeditionReplay = Object.freeze({encode, decode, mount});
})();
