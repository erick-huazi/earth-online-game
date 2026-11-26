// Convert only chapter body text to offsets. Search marks may split that text
// into different nodes in the manual and in a standalone book.
function createEarthClippings(adapter, store, render, message) {
  const add = document.querySelector('[data-clip-add]');
  const fullBook = document.body.classList.contains('earth-full-book');
  let candidate = null, transferring = false;

  function selectionEntry() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    const parent = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
    const body = parent?.closest('#fulltext-content, .book-section .prose');
    if (!body || !body.contains(range.endContainer)) return null;
    const current = adapter.forBody ? adapter.forBody(body) : adapter.current();
    if (!current || current.element !== body) return null;
    const before = document.createRange();
    before.selectNodeContents(body);
    before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length;
    const anchor = EarthQuoteAnchor.capture(body.textContent, start, start + range.toString().length);
    return anchor && {bookId: current.bookId, section: current.section, title: current.title.slice(0, 240),
      textOffset: start, excerpt: anchor.exact.slice(0, 160), kind: 'clip', anchor};
  }

  function resetSelection() { candidate = null; transferring = false; }
  function keepSelection() {
    const selected = selectionEntry();
    if (selected || !window.getSelection()?.isCollapsed) candidate = selected;
    transferring = true;
  }
  // Focus can collapse a DOM selection before a keyboard-generated click.
  // Keep a validated snapshot across Tab navigation only. Cancel it when a
  // user starts a different selection, clicks elsewhere or changes chapters.
  document.addEventListener('selectionchange', () => {
    if (!window.getSelection()?.isCollapsed) candidate = selectionEntry();
    else if (!transferring) candidate = null;
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Tab') keepSelection();
    else if (!(event.target === add && (event.key === 'Enter' || event.key === ' ')) && event.key !== 'Shift')
      resetSelection();
  }, true);
  document.addEventListener('focusout', event => {
    if (event.relatedTarget === add) keepSelection();
  }, true);
  document.addEventListener('pointerdown', event => {
    if (event.target === add) keepSelection();
    else resetSelection();
  }, true);
  add.addEventListener('pointercancel', resetSelection);
  add.addEventListener('mousedown', event => event.preventDefault());
  add.addEventListener('click', () => {
    let entry = selectionEntry();
    if (!entry && transferring && candidate && window.getSelection()?.isCollapsed) {
      const body = adapter.forSection?.(candidate.section) || adapter.current();
      if (body.bookId === candidate.bookId && body.section === candidate.section &&
          body.element.textContent.slice(candidate.anchor.start, candidate.anchor.end) === candidate.anchor.exact)
        entry = candidate;
    }
    resetSelection();
    if (!entry) { message('请先在同一节正文中选中一段文字。较长的选段请分次摘录。'); return; }
    try {
      const result = store.upsert(entry);
      render();
      message(result.persisted ? '摘录已保存，可在“我的书签与摘录”中定位原文。' : '摘录暂存于此页，请在离开前导出备份。');
    } catch (error) { message('未能保存摘录。书签与摘录最多共 500 条，请先腾出空间。'); }
  });

  function highlight(element, anchor) {
    const position = EarthQuoteAnchor.resolve(element.textContent, anchor);
    if (!position) return null;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let offset = 0, started = false, node;
    while ((node = walker.nextNode())) {
      const next = offset + node.length;
      if (!started && position.start < next) {
        range.setStart(node, position.start - offset);
        started = true;
      }
      if (started && position.end <= next) {
        range.setEnd(node, position.end - offset);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        return range;
      }
      offset = next;
    }
    return null;
  }

  // The fragment stays on the device. It carries just this passage so opening
  // another local HTML file works even when each file has isolated storage.
  function url(entry, anotherView) {
    const manual = fullBook && anotherView;
    const book = adapter.books.find(book => book.id === entry.bookId);
    const path = manual ? '../earth-online-manual.html' : fullBook ? entry.bookId + '.html' : book.htmlPath;
    const target = adapter.carryTo(new URL(path, location.href));
    if (manual) {
      target.searchParams.set('book', entry.bookId);
      target.searchParams.set('section', entry.section);
    }
    target.hash = 'clip=' + encodeURIComponent(JSON.stringify([entry.bookId, entry.section, entry.anchor]));
    return target.href;
  }

  function link(entry, anotherView = true) {
    const node = document.createElement('a');
    node.href = url(entry, anotherView);
    node.target = '_blank';
    node.rel = 'noopener';
    node.dataset.clipOther = '';
    node.textContent = fullBook && anotherView ? '手册中读' : '全书中读';
    node.setAttribute('aria-label', node.textContent + '（新标签页）');
    return node;
  }

  function incoming() {
    if (!location.hash.startsWith('#clip=') || location.hash.length > 24576) return null;
    try {
      const [bookId, section, anchor] = JSON.parse(decodeURIComponent(location.hash.slice(6)));
      const book = adapter.books.find(book => book.id === bookId);
      if (!book || !Number.isSafeInteger(section) || section < 0 || section >= book.sectionCount ||
          !EarthQuoteAnchor.valid(anchor) || (fullBook && bookId !== adapter.current().bookId)) return null;
      return {bookId, section, anchor, kind: 'clip'};
    } catch (error) { return null; }
  }

  return {highlight, link, incoming};
}
