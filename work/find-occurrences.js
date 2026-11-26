// Paint just a window of marks. The cursor may reach every occurrence in the text.
const EarthOccurrences = (() => {
  function count(folded, needle) {
    if (!needle) return 0;
    let total = 0, offset = 0;
    while ((offset = folded.indexOf(needle, offset)) !== -1) {
      total++;
      offset += needle.length;
    }
    return total;
  }

  function advance(current, step, total) {
    if (!total) return -1;
    if (current < 0) return step < 0 ? total - 1 : 0;
    return (current + step + total) % total;
  }

  function paint(element, text, ranges, selected = -1) {
    if (!ranges.length) {
      if (element.childElementCount || element.textContent !== text) element.textContent = text;
      return;
    }
    const fragment = document.createDocumentFragment();
    const first = Math.max(0, Math.min(selected - 50, ranges.length - 100));
    const end = Math.min(ranges.length, first + 100);
    let offset = 0;
    for (let i = first; i < end; i++) {
      const range = ranges[i];
      const mark = document.createElement('mark');
      if (i === selected) mark.setAttribute('aria-current', 'true');
      mark.textContent = text.slice(range.start, range.end);
      fragment.append(text.slice(offset, range.start), mark);
      offset = range.end;
    }
    fragment.append(text.slice(offset));
    element.replaceChildren(fragment);
  }
  return { count, advance, paint };
})();
