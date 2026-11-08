(() => {
  'use strict';
  const bookId = __BOOK_ID__;
  const storageKey = 'earth-online-full-book-v1:' + bookId;
  const sections = Array.from(document.querySelectorAll('.book-section'));
  const paragraphs = sections.map(section => section.querySelector('.prose'));
  const texts = paragraphs.map(paragraph => paragraph.textContent);
  const searchIndex=EarthSearchIndex.create(sections.map((section,index)=>({title:section.querySelector('h2').textContent,text:texts[index]})));
  const indexById = new Map(sections.map((section, index) => [section.id, index]));
  const directory = document.querySelector('nav');
  const directoryLinks = Array.from(directory.querySelectorAll('a[href^="#section-"]'));
  const jump = document.getElementById('jump');
  const toolbar = document.querySelector('.toolbar');
  const queryInput = document.getElementById('query');
  const searchMode=document.getElementById('search-mode');let searchVersion=0;
  let searchedMode=searchMode.value;
  const clearSearch = document.getElementById('clear-search');
  const searchState = document.getElementById('search-state');
  const returnReading = document.createElement('button');
  returnReading.id = 'return-reading-position';
  returnReading.className = 'reader-tool return-reading';
  returnReading.type = 'button';
  returnReading.textContent = '返回刚才阅读处';
  returnReading.disabled = true;
  document.querySelector('.book-head h1').after(returnReading);
  let size = parseInt(getComputedStyle(sections[0].querySelector('.prose')).fontSize, 10) || 19;
  let activeIndex = -1, matches = [], currentMatch = -1;
  let searchTimer, saveTimer, scrollFrame;
  let userInteracted = false, initialized = false;
  let navigationVersion = 0;
  let readingPosition = null, focusPosition = null;
  let lastBodyPosition = null;
  let keyboardFocusPosition = null;
  let clampedPosition = null;
  let entryHash = location.hash;
  let searchedQuery = '', composing = false;
  const highlighted = new Map();
  try { history.scrollRestoration = 'manual'; } catch (error) {}

  function readStoredState() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved && saved.version === 1 && indexById.has(saved.sectionId)) {
        return {
          ...saved,
          offset: Number.isFinite(saved.offset) ? Math.max(0, saved.offset) : 0,
          ratio: Number.isFinite(saved.ratio) ? Math.min(1, Math.max(0, saved.ratio)) : 0,
          fontSize: Number.isFinite(saved.fontSize) ? Math.min(27, Math.max(15, saved.fontSize)) : size
        };
      }
    } catch (error) {}
    // The previous manual stored chapter indices only. Read it once as a fallback;
    // independent-book progress never writes to or replaces that older record.
    try {
      const previous = JSON.parse(localStorage.getItem('earth-online-reading-v1') || 'null');
      const index = previous?.positions?.[bookId];
      const validChapter = Number.isInteger(index) && index >= 0 && index < sections.length;
      const validFont = Number.isFinite(previous?.fontSize);
      if (validChapter || validFont) return {
        sectionId: sections[validChapter ? index : 0].id,
        offset: 0, ratio: 0, atStart: !validChapter,
        fontSize: validFont ? Math.min(27, Math.max(15, previous.fontSize)) : size
      };
    } catch (error) {}
    return null;
  }

  function readingInset() {
    return toolbar.getBoundingClientRect().height + 12;
  }

  function currentIndex() {
    // A short selected section near the end cannot always reach the reading
    // line. Preserve that explicit choice until the reader actually scrolls.
    if (clampedPosition) {
      if (Math.abs(scrollY - clampedPosition.scrollY) < 2) return clampedPosition.index;
      clampedPosition = null;
    }
    const line = readingInset() + 1;
    let low = 0, high = sections.length - 1, found = 0;
    while (low <= high) {
      const middle = (low + high) >> 1;
      if (sections[middle].getBoundingClientRect().top <= line) {
        found = middle;
        low = middle + 1;
      } else high = middle - 1;
    }
    return found;
  }

  function capturePosition() {
    const index = currentIndex();
    const rect = sections[index].getBoundingClientRect();
    const offset = Math.max(0, readingInset() - rect.top);
    return {
      sectionId: sections[index].id,
      offset,
      ratio: Math.min(1, offset / Math.max(1, rect.height)),
      viewportWidth: innerWidth,
      atStart: index === 0 && rect.top > readingInset() + 4,
      startOffset: scrollY
    };
  }

  function rememberBodyPosition(position) {
    // The header contains settings and bookmark search, not chapter zero.
    // Keep its browsing scroll separate from the last actual reading line.
    if (!position.atStart) {
      lastBodyPosition = {...position, fontSize: size};
      returnReading.disabled = false;
    }
  }

  function bodyPositionForLayout() {
    if (!lastBodyPosition) return null;
    if (lastBodyPosition.viewportWidth !== innerWidth || lastBodyPosition.fontSize !== size) {
      const index = indexById.get(lastBodyPosition.sectionId);
      lastBodyPosition = {...lastBodyPosition,
        offset: lastBodyPosition.ratio * sections[index].getBoundingClientRect().height,
        viewportWidth: innerWidth, fontSize: size};
    }
    return lastBodyPosition;
  }

  function setActive(index) {
    jump.value = sections[index].id;
    if (activeIndex === index) return;
    if (activeIndex >= 0) directoryLinks[activeIndex].removeAttribute('aria-current');
    activeIndex = index;
    window.earthBookmarkUI?.refresh();
    const link = directoryLinks[index];
    link.setAttribute('aria-current', 'location');
    link.closest('details').open = true;
    // Scroll only the directory, never the document, to expose the selected item.
    if (directory.getClientRects().length) {
      const box = directory.getBoundingClientRect(), item = link.getBoundingClientRect();
      if (item.top < box.top + 12) directory.scrollTop += item.top - box.top - 12;
      else if (item.bottom > box.bottom - 12) directory.scrollTop += item.bottom - box.bottom + 12;
    }
  }

  function restorePosition(position, proportional = false) {
    const index = indexById.get(position.sectionId);
    if (index === undefined) return;
    clampedPosition = null;
    if (position.atStart) scrollTo(0, Math.max(0, position.startOffset || 0));
    else {
      const rect = sections[index].getBoundingClientRect();
      const offset = proportional ? position.ratio * rect.height : position.offset;
      scrollTo(0, scrollY + rect.top + Math.min(Math.max(0, offset || 0), Math.max(0, rect.height - 1)) - readingInset());
    }
    const top = sections[index].getBoundingClientRect().top;
    if (!position.atStart && top > readingInset() + 2 && top < innerHeight &&
        scrollY >= document.documentElement.scrollHeight - innerHeight - 1) {
      clampedPosition = {index, scrollY};
    }
    setActive(index);
    readingPosition = capturePosition();
    rememberBodyPosition(readingPosition);
  }

  function savePosition() {
    if (!initialized) return;
    clearTimeout(saveTimer);
    const current = capturePosition();
    rememberBodyPosition(current);
    const position = current.atStart ? bodyPositionForLayout() || current : current;
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        version: 1, ...position, fontSize: size, entryHash, updatedAt: Date.now()
      }));
    } catch (error) {}
  }

  function updatePosition() {
    setActive(currentIndex());
    refreshHighlights();
    readingPosition = capturePosition();
    rememberBodyPosition(readingPosition);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(savePosition, 160);
  }

  function updateInset() {
    document.documentElement.style.scrollPaddingTop = readingInset() + 'px';
  }

  function navigateTo(id) {
    if (!indexById.has(id)) return;
    userInteracted = true;
    navigationVersion++;
    restorePosition({sectionId: id, offset: 0, ratio: 0});
    savePosition();
  }

  function applyFont() {
    document.documentElement.style.setProperty('--size', size + 'px');
    document.getElementById('smaller').disabled = size <= 15;
    document.getElementById('larger').disabled = size >= 27;
  }

  jump.addEventListener('change', event => navigateTo(event.target.value));
  returnReading.addEventListener('click', () => {
    const position = bodyPositionForLayout();
    if (!position) return;
    userInteracted = true;
    navigationVersion++;
    restorePosition(position);
    sections[indexById.get(position.sectionId)].focus({preventScroll: true});
    savePosition();
  });
  document.getElementById('skip-reading').addEventListener('click', event => {
    event.preventDefault();
    const index = currentIndex();
    navigateTo(sections[index].id);
    sections[index].focus({preventScroll: true});
  });
  directory.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#section-"]');
    if (!link) return;
    event.preventDefault();
    history.replaceState(null, '', link.hash);
    entryHash = location.hash;
    navigateTo(link.hash.slice(1));
  });
  addEventListener('hashchange', () => {
    entryHash = location.hash;
    if (indexById.has(location.hash.slice(1))) navigateTo(location.hash.slice(1));
    else if (location.hash === '#top') savePosition();
  });
  addEventListener('scroll', () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => { scrollFrame = null; updatePosition(); });
  }, {passive: true});
  for (const event of ['pointerdown', 'keydown', 'touchstart', 'wheel']) {
    addEventListener(event, () => { userInteracted = true; }, {passive: true, capture: true});
  }
  addEventListener('pagehide', savePosition);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') savePosition();
  });
  new ResizeObserver(updateInset).observe(toolbar);
  // Browsers may scroll a newly focused sticky control to the root's anchor
  // padding. Keep the reading line still, unless that action chose a new chapter.
  addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    // Native Tab scrolling happens before focusin, so capture before its default
    // action. A focus event that leaves the toolbar will simply discard this.
    keyboardFocusPosition = {position: capturePosition(), version: navigationVersion};
    requestAnimationFrame(() => { keyboardFocusPosition = null; });
  }, {capture: true});
  toolbar.addEventListener('focusin', () => {
    const version = navigationVersion;
    const position = keyboardFocusPosition?.version === version ? keyboardFocusPosition.position : capturePosition();
    keyboardFocusPosition = null;
    focusPosition = position;
    requestAnimationFrame(() => {
      if (version === navigationVersion && toolbar.contains(document.activeElement)) restorePosition(position);
      focusPosition = null;
    });
  });

  for (const [id, delta] of [['smaller', -2], ['larger', 2]]) {
    document.getElementById(id).addEventListener('click', () => {
      const position = capturePosition();
      navigationVersion++;
      size = Math.min(27, Math.max(15, size + delta));
      applyFont();
      restorePosition(position, true);
      savePosition();
    });
  }

  // Keep the complete book in the document, but decorate only the paragraphs
  // currently on screen. A common single character must not create 50,000 marks.
  function refreshHighlights(extraIndex) {
    const wanted = new Set();
    if (EarthTextSearch.fold(searchedQuery,searchedMode)) {
      for (let index = currentIndex(); index < sections.length; index++) {
        if (sections[index].getBoundingClientRect().top > innerHeight) break;
        wanted.add(index);
      }
      if (Number.isInteger(extraIndex)) wanted.add(extraIndex);
    }
    for (const [index, query] of highlighted) {
      if (!wanted.has(index) || query !== searchedMode+':'+searchedQuery) {
        paragraphs[index].textContent = texts[index];
        highlighted.delete(index);
      }
    }
    for (const index of wanted) {
      if (highlighted.has(index)) continue;
      const text=texts[index],ranges=EarthTextSearch.ranges(text,searchedQuery,searchedMode,100);if(!ranges.length)continue;
      const fragment=document.createDocumentFragment();let cursor=0;
      for(const range of ranges){fragment.append(document.createTextNode(text.slice(cursor,range.start)));const mark=document.createElement('mark');mark.textContent=text.slice(range.start,range.end);fragment.append(mark);cursor=range.end;}
      fragment.append(document.createTextNode(text.slice(cursor)));paragraphs[index].replaceChildren(fragment);highlighted.set(index,searchedMode+':'+searchedQuery);
    }
  }

  async function moveMatch(delta) {
    if (composing) return;
    clearTimeout(searchTimer);
    if (queryInput.value.trim() !== searchedQuery||searchMode.value!==searchedMode) await searchBook();
    if (composing||queryInput.value.trim()!==searchedQuery||searchMode.value!==searchedMode||!matches.length) return;
    currentMatch = currentMatch < 0 ? (delta < 0 ? matches.length - 1 : 0) : (currentMatch + delta + matches.length) % matches.length;
    searchState.textContent = '第 ' + (currentMatch + 1) + ' / ' + matches.length + ' 节匹配';
    updateInset();
    const index = matches[currentMatch];
    navigateTo(sections[index].id);
    refreshHighlights(index);
    const mark = paragraphs[index].querySelector('mark');
    if (mark) scrollTo(0, scrollY + mark.getBoundingClientRect().top - readingInset() - 12);
    sections[index].focus({preventScroll: true});
    readingPosition = capturePosition();
    savePosition();
  }

  async function searchBook() {
    const version=++searchVersion,query=queryInput.value.trim(),mode=searchMode.value,needle=EarthTextSearch.fold(query,mode);
    if(needle&&!searchIndex.peek(mode)){searchState.textContent='正在准备离线检索…';document.getElementById('prev-match').disabled=document.getElementById('next-match').disabled=true;}
    const indexed=needle?await searchIndex.ensure(mode):[];
    if(version!==searchVersion||composing||query!==queryInput.value.trim()||mode!==searchMode.value)return;
    const position=capturePosition(),previousMatches=matches;
    matches=needle?indexed.flatMap((entry,index)=>entry.title.includes(needle)||entry.text.includes(needle)?[index]:[]):[];
    const nextMatches=new Set(matches);
    for(const index of previousMatches)if(!nextMatches.has(index))sections[index].classList.remove('match');
    for(const index of matches)sections[index].classList.add('match');
    searchedQuery=query;searchedMode=mode;currentMatch=-1;refreshHighlights();
    document.getElementById('prev-match').disabled=document.getElementById('next-match').disabled=!matches.length;clearSearch.disabled=!queryInput.value;
    searchState.textContent=query?(!needle?'请输入文字或数字；兼容检索会忽略标点和空白。':matches.length?'找到 '+matches.length+' 节匹配，点“下处”前往。':'未找到，请尝试更短的原文词句。'):'连续阅读全部内容，或用目录跳转。';
    updateInset();restorePosition(position);savePosition();
  }
  function scheduleSearch(event) {
    searchVersion++;
    clearSearch.disabled = !queryInput.value;
    if (focusPosition || readingPosition) restorePosition(focusPosition || readingPosition);
    focusPosition = null;
    clearTimeout(searchTimer);
    if (!composing && !event?.isComposing) searchTimer = setTimeout(searchBook, 200);
  }
  searchMode.addEventListener('change',()=>{clearTimeout(searchTimer);searchVersion++;if(!composing)searchBook();});
  queryInput.addEventListener('compositionstart', () => { composing = true; searchVersion++;clearTimeout(searchTimer); });
  queryInput.addEventListener('compositionend', () => { composing = false; scheduleSearch(); });
  queryInput.addEventListener('input', scheduleSearch);
  queryInput.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !composing && !event.isComposing) {
      event.preventDefault();
      moveMatch(event.shiftKey ? -1 : 1);
    }
  });
  clearSearch.addEventListener('click', () => {
    if (focusPosition || readingPosition) restorePosition(focusPosition || readingPosition);
    focusPosition = null;
    clearTimeout(searchTimer);
    composing = false;
    queryInput.value = '';
    searchBook();
    queryInput.focus({preventScroll: true});
  });
  document.getElementById('prev-match').addEventListener('click', () => moveMatch(-1));
  document.getElementById('next-match').addEventListener('click', () => moveMatch(1));

  const saved = readStoredState();
  if (saved) { size = saved.fontSize; applyFont(); }
  const initialHash = entryHash.slice(1);
  const navigationType = performance.getEntriesByType('navigation')[0]?.type;
  const returning = navigationType === 'reload' || navigationType === 'back_forward';
  // A newly opened deep link always wins. Reloading that already-read document
  // or returning through browser history resumes its later reading position,
  // rather than reapplying the entry anchor.
  const explicitAnchor = indexById.has(initialHash) || initialHash === 'top';
  const resume = saved && (!explicitAnchor || (returning && saved.entryHash === entryHash));
  let resumedSavedPosition = false;
  function initializePosition() {
    updateInset();
    if (!userInteracted) {
      if (resume) {
        restorePosition(saved, saved.viewportWidth !== undefined && saved.viewportWidth !== innerWidth);
        resumedSavedPosition = true;
      }
      else if (indexById.has(initialHash)) restorePosition({sectionId: initialHash, offset: 0, ratio: 0});
      else { scrollTo(0, 0); setActive(0); }
    }
    initialized = true;
    updatePosition();
  }
  initializePosition();
  if (document.readyState !== 'complete') addEventListener('load', initializePosition, {once: true});
  document.fonts.ready.then(() => {
    if (!userInteracted) initializePosition();
  });
  const originalPageBook={id:bookId,volumes:pageJumpVolumes,sections:sections.map(section=>({volumeId:section.dataset.volume,pageStart:Number(section.dataset.pageStart),pageEnd:Number(section.dataset.pageEnd)}))};
  mountOriginalPageJump({book:()=>originalPageBook,current:currentIndex,open:index=>{navigateTo(sections[index].id);sections[index].focus({preventScroll:true});}});
  mountEarthBookmarks({
    books:bookmarkBooks,
    shouldOpenInitialBookmark:()=>!resumedSavedPosition,
    current:()=>{const index=currentIndex();return {bookId,section:index,title:sections[index].querySelector('h2').textContent,element:paragraphs[index]};},
    line:()=>readingInset()+12,
    scrollBy:delta=>scrollBy(0,delta),
    focus:()=>sections[currentIndex()].focus({preventScroll:true}),
    save:savePosition,
    open:entry=>{
      if(entry.bookId!==bookId){const target=new URL(entry.bookId+'.html',location.href);target.searchParams.set('bookmark',entry.section);target.hash='section-'+entry.section;location.href=target.href;return false;}
      navigateTo('section-'+entry.section);
    }
  });
})();
