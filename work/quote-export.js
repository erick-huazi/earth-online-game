// Produce portable notes from the saved quote, including when its source edition has changed.
function createEarthQuoteExport(panel, adapter, readEntries, matches, message) {
  'use strict';
  const controls = document.createElement('div');
  controls.className = 'quote-export';
  controls.innerHTML = '<label>导出摘录范围<select data-clip-export-scope><option value="filtered"></option><option value="book"></option></select></label><button data-clip-export type="button">下载 Markdown</button>';
  panel.querySelector('[data-bookmark-more]').after(controls);
  const scope = controls.querySelector('select');
  const button = controls.querySelector('button');
  const books = new Map(adapter.books.map(book => [book.id, book]));

  function inScope(entry, bookId) {
    return entry.kind === 'clip' && (scope.value === 'book' ? entry.bookId === bookId : matches(entry));
  }
  function refresh(entries) {
    const book = books.get(adapter.current().bookId);
    const clips = entries.filter(entry => entry.kind === 'clip');
    const count = clips.filter(matches).length;
    const bookCount = clips.filter(entry => entry.bookId === book.id).length;
    scope.options[0].textContent = '当前筛选（' + count + ' 段）';
    scope.options[1].textContent = '正在读的《' + book.title + '》（' + bookCount + ' 段）';
    button.disabled = (scope.value === 'book' ? bookCount : count) === 0;
  }

  // Escape Markdown syntax before inserting our own markup. Indentation in
  // source text must stay inside the quote, including tabs and leading spaces.
  function literal(line) {
    return line.replace(/[!-\/:-@\[-`{-~]/g, '\\$&')
      .replace(/\t/g, '&#9;').replace(/^ +| +$/g, spaces => '&#32;'.repeat(spaces.length));
  }
  function quotation(text) {
    const normalized = text.replace(/\r\n?/g, '\n');
    const trailing = normalized.match(/\n+$/)?.[0].length || 0;
    const body = normalized.slice(0, normalized.length - trailing);
    return body.split('\n').map(line => '> ' + literal(line)).join('\\\n') + '&#10;'.repeat(trailing);
  }
  function chapterLabel(entry) {
    return entry.title.replace(/[\r\n]+/g, ' ').trim() || '第 ' + (entry.section + 1) + ' 阅读节';
  }
  function markdown(entries) {
    const blocks = ['# 地球 Online · 原文摘录'];
    for (const book of adapter.books) {
      const quotes = entries.filter(entry => entry.bookId === book.id)
        .sort((a, b) => a.section - b.section || a.anchor.start - b.anchor.start || a.anchor.end - b.anchor.end);
      if (!quotes.length) continue;
      const edition = '《' + literal(book.edition || book.title) + '》';
      blocks.push('## ' + edition);
      let citation = '';
      let section = -1;
      for (const entry of quotes) {
        if (entry.section !== section) {
          if (citation) blocks.push(citation);
          section = entry.section;
          const chapter = literal(chapterLabel(entry));
          const url = 'https://39.107.91.13/earth-online/html/' + encodeURIComponent(book.id) + '.html#section-' + section;
          blocks.push('### ' + chapter);
          citation = '出处：[' + edition + ' · ' + chapter + ' · 第 ' + (section + 1) + ' 阅读节](' + url + ')';
        }
        blocks.push(quotation(entry.anchor.exact));
      }
      blocks.push(citation);
    }
    return blocks.join('\n\n') + '\n';
  }

  scope.addEventListener('change', () => refresh(readEntries()));
  button.addEventListener('click', () => {
    const entries = readEntries();
    const bookId = adapter.current().bookId;
    const selected = entries.filter(entry => inScope(entry, bookId));
    refresh(entries);
    if (!selected.length) { message('这个范围没有可导出的摘录。'); return; }
    let url;
    const link = document.createElement('a');
    try {
      url = URL.createObjectURL(new Blob([markdown(selected)], {type:'text/markdown;charset=utf-8'}));
      link.href = url;
      const label = scope.value === 'book' ? books.get(bookId).title : '筛选结果';
      link.download = '地球Online-摘录-' + label + '-' + new Date().toISOString().slice(0, 10) + '.md';
      link.hidden = true;
      document.body.append(link);
      link.click();
      message('已发起下载，共 ' + selected.length + ' 段原文摘录。');
    } catch (error) {
      message('未能生成摘录文件，请重试。');
    } finally {
      link.remove();
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });
  return refresh;
}
