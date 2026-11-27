// Each round snapshots the filtered clippings. Ratings belong only to this dialog.
function createEarthRecall(panel, adapter, readEntries, matches) {
  'use strict';
  const books = new Map(adapter.books.map(book => [book.id, book]));
  const samples = adapter.books.flatMap(book => book.recallSample ? [book.recallSample] : []);
  const entry = document.createElement('section');
  // The hash is handled explicitly. A second native fragment jump to the
  // container during page load would steal focus from the start button.
  entry.dataset.recallEntry = '';
  entry.className = 'recall-entry';
  entry.innerHTML = '<h3>辨典挑战</h3><p data-recall-hint></p><div class="recall-actions"><button type="button" data-recall-start></button><button type="button" data-recall-read>去读原文</button></div>';
  panel.querySelector('[data-bookmark-list]').before(entry);
  const start = entry.querySelector('[data-recall-start]');
  const read = entry.querySelector('[data-recall-read]');
  const hint = entry.querySelector('[data-recall-hint]');
  const dialog = document.createElement('dialog');
  dialog.className = 'recall-dialog';
  dialog.dataset.recallDialog = '';
  dialog.setAttribute('aria-labelledby', 'recall-title');
  dialog.innerHTML = '<h2 id="recall-title">辨典挑战</h2><p data-recall-progress></p><blockquote tabindex="-1" data-recall-quote></blockquote><p tabindex="-1" data-recall-source hidden></p><p tabindex="-1" data-recall-result hidden></p><div class="recall-actions"><button type="button" data-recall-reveal>揭晓出处</button><button type="button" data-recall-again>再练</button><button type="button" data-recall-known>记得</button><button type="button" data-recall-retry>只练没记住的</button><button type="button" data-recall-close>退出挑战</button></div>';
  // Native showModal promotes the dialog visually while keeping the reader's
  // paper, night and white palette variables in its inheritance chain.
  entry.after(dialog);
  const part = key => dialog.querySelector('[data-recall-' + key + ']');
  const quote = part('quote'), source = part('source'), result = part('result');
  const reveal = part('reveal'), again = part('again'), known = part('known'), retry = part('retry');
  let round = [], missed = [], index = 0, practiceName = '';

  function pool(entries) {
    const passages = new Map();
    let hasClips = false;
    for (const clip of entries) {
      if (clip.kind !== 'clip') continue;
      hasClips = true;
      const text = clip.anchor.exact;
      const key = text.normalize('NFKC').replace(/[\s\p{P}]+/gu,'').toLowerCase();
      if (!key) continue;
      let group = passages.get(key);
      if (!group) {
        group = {bookId:clip.bookId, section:clip.section, multiple:false, card:null};
        passages.set(key,group);
      }
      if (clip.bookId !== group.bookId || clip.section !== group.section) group.multiple = true;
      if (!group.card && matches(clip)) {
        group.card = {bookId:clip.bookId, title:clip.title || '第 ' + (clip.section + 1) + ' 阅读节', text};
      }
    }
    const cards = Array.from(passages.values()).filter(group => group.card && !group.multiple).map(group => group.card);
    return {hasClips,cards};
  }
  function refresh(entries) {
    const {hasClips,cards} = pool(entries);
    start.textContent = hasClips ? '开始辨典' : '试玩三题';
    start.disabled = hasClips && !cards.length;
    if (!hasClips) hint.textContent = '先试三道原典示例。选中正文后点「存摘录」，就能用自己的原句出题。';
    else if (!cards.length) hint.textContent = '当前筛选中没有可辨认唯一出处的摘录。可更换筛选，或去正文存入新摘录。';
    else hint.textContent = '当前可出 ' + cards.length + ' 题。每局最多五题，看原句回忆书名和章节。';
  }
  function showQuestion() {
    part('progress').textContent = practiceName + ' · 第 ' + (index + 1) + ' / ' + round.length + ' 题 · 出自哪一书、哪一章？';
    quote.textContent = round[index].text;
    source.textContent = '';
    quote.hidden = reveal.hidden = false;
    source.hidden = result.hidden = again.hidden = known.hidden = retry.hidden = true;
    quote.focus();
  }
  function begin(cards, name) {
    round = cards;
    index = 0;
    missed = [];
    practiceName = name;
    if (!dialog.open) dialog.showModal();
    showQuestion();
  }
  start.addEventListener('click', () => {
    const {hasClips,cards} = pool(readEntries());
    if (!hasClips) { begin(samples, '原典示例'); return; }
    if (!cards.length) { refresh(readEntries()); read.focus(); return; }
    for (let i = 0; i < Math.min(cards.length,5); i++) {
      const j = i + Math.floor(Math.random() * (cards.length-i));
      [cards[i],cards[j]] = [cards[j],cards[i]];
    }
    begin(cards.slice(0,5), '我的摘录');
  });
  reveal.addEventListener('click', () => {
    const card = round[index], book = books.get(card.bookId);
    source.textContent = '出处 · 《' + book.title + '》 · ' + card.title;
    reveal.hidden = true;
    source.hidden = again.hidden = known.hidden = false;
    source.focus();
  });
  function rate(remembered) {
    if (!remembered) missed.push(round[index]);
    if (++index < round.length) { showQuestion(); return; }
    part('progress').textContent = practiceName + ' · 本轮完成';
    quote.hidden = source.hidden = again.hidden = known.hidden = true;
    retry.hidden = !missed.length;
    result.hidden = false;
    result.textContent = '自评记得 ' + (round.length - missed.length) + ' 题，待再练 ' + missed.length + ' 题。';
    result.focus();
  }
  again.addEventListener('click', () => rate(false));
  known.addEventListener('click', () => rate(true));
  retry.addEventListener('click', () => begin(missed, '再练'));
  part('close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    round = []; missed = [];
    quote.textContent = source.textContent = result.textContent = '';
    (start.disabled ? read : start).focus();
  });
  read.addEventListener('click', () => {
    const section = adapter.current().section;
    panel.open = false;
    adapter.focus(section);
    adapter.current().element.scrollIntoView({block:'nearest',behavior:'instant'});
  });
  function followLink() {
    if (location.hash !== '#recall') return;
    adapter.showReader?.();
    panel.open = true;
    (start.disabled ? read : start).focus();
    entry.scrollIntoView({block:'center',behavior:'instant'});
  }
  addEventListener('hashchange', followLink);
  return {refresh, followLink};
}
