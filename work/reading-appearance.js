(() => {
  'use strict';
  if (!document.body.matches('.earth-manual, .earth-full-book')) return;
  const containers = [...document.querySelectorAll('[data-reading-appearance]')];
  if (!containers.length || containers.every(el => el.dataset.appearanceReady)) return;
  const key = 'earth-online-appearance-v1';
  const choices = [['paper', '纸色'], ['night', '夜读'], ['white', '素白']];
  const validThemes = new Set(choices.map(([value]) => value));
  const decode = raw => {
    try {
      const value = JSON.parse(raw);
      return value && typeof value === 'object' && !Array.isArray(value) &&
        Object.keys(value).length === 1 && validThemes.has(value.theme) ? value.theme : 'paper';
    } catch { return 'paper'; }
  };
  let theme = 'paper', canSave = true;
  try { theme = decode(localStorage.getItem(key)); } catch { canSave = false; }
  const controls = [], notices = [];
  const paint = () => {
    document.documentElement.dataset.readingTheme = theme;
    controls.forEach(select => { select.value = theme; });
    notices.forEach(notice => { notice.hidden = canSave; });
  };
  const apply = value => {
    if (!validThemes.has(value)) return false;
    theme = value;
    try { localStorage.setItem(key, JSON.stringify({theme})); canSave = true; }
    catch { canSave = false; }
    paint();
    return true;
  };
  const refresh = () => {
    try { theme = decode(localStorage.getItem(key)); canSave = true; }
    catch { canSave = false; }
    paint();
  };
  containers.forEach((container, index) => {
    if (container.dataset.appearanceReady) return;
    const field = document.createElement('div');
    field.className = 'appearance-field';
    const text = document.createElement('label');
    text.textContent = '阅读配色';
    const select = document.createElement('select');
    select.id = 'reading-appearance-' + (index + 1);
    text.htmlFor = select.id;
    choices.forEach(([value, title]) => {
      const option = document.createElement('option');
      option.value = value; option.textContent = title; select.append(option);
    });
    select.addEventListener('change', () => {
      apply(select.value);
    });
    field.append(text, select);
    const notice = document.createElement('p');
    notice.className = 'appearance-notice';
    notice.setAttribute('role', 'status');
    notice.textContent = '仅本页生效，浏览器未开放保存。';
    controls.push(select); notices.push(notice);
    container.append(field, notice);
    container.dataset.appearanceReady = 'true';
  });
  window.EarthReadingAppearance = Object.freeze({apply, refresh});
  paint();
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) { theme = decode(event.newValue); paint(); }
  });
})();
