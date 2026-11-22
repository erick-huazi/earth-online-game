function createReaderGameNavigation() {
  const params = new URLSearchParams(location.search);
  const from = params.get('from');
  const mode = from === 'expedition' || from === 'classic' ? from : '';
  const keptGameTab = Boolean(mode && params.get('gameTab') === 'kept');

  function carryTo(url) {
    if (mode) url.searchParams.set('from', mode);
    if (keptGameTab) url.searchParams.set('gameTab', 'kept');
    return url;
  }

  function mount({notify, keepReadingTab, beforeLeaving}) {
    const link = document.getElementById('reader-game-return');
    if (keptGameTab) {
      const button = document.createElement('button');
      button.id = link.id;
      button.type = 'button';
      button.className = 'return-kept-game';
      button.textContent = '回到游戏标签页';
      link.replaceWith(button);
      button.addEventListener('click', () => {
        if (keepReadingTab?.() || window.earthBookmarkStore?.hasPendingChanges()) {
          notify('请切回原游戏标签页，此页保留着尚未保存的阅读记录。');
          return;
        }
        notify('请切回原游戏标签页，继续刚才的进度。');
        window.close();
      });
      return;
    }
    if (mode) {
      link.hash = mode === 'expedition' ? 'expedition' : 'classic-story';
      link.textContent = mode === 'expedition' ? '返回本次远征' : '返回经典剧情';
    }
    link.addEventListener('click', () => {
      beforeLeaving?.(link);
      if (window.earthBookmarkStore?.hasPendingChanges()) {
        link.target = '_blank';
        link.rel = 'noopener';
      }
    });
  }
  return {mode, carryTo, mount};
}
