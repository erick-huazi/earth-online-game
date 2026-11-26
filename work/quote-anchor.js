// DOM Range offsets use UTF-16 code units. Store both an exact quote and its
// location so changing fonts, markup or the surrounding edition can be handled.
(function (root) {
  'use strict';
  const contextLength = 32;
  const maxLength = 1000;

  function splitsPair(text, offset) {
    const left = text.charCodeAt(offset - 1), right = text.charCodeAt(offset);
    return left >= 0xd800 && left <= 0xdbff && right >= 0xdc00 && right <= 0xdfff;
  }

  function valid(anchor) {
    return !!anchor && Number.isSafeInteger(anchor.start) && anchor.start >= 0 &&
      Number.isSafeInteger(anchor.end) && typeof anchor.exact === 'string' &&
      anchor.exact.length <= maxLength && !!anchor.exact.trim() &&
      anchor.end - anchor.start === anchor.exact.length &&
      typeof anchor.prefix === 'string' && anchor.prefix.length <= contextLength &&
      typeof anchor.suffix === 'string' && anchor.suffix.length <= contextLength;
  }

  function capture(text, start, end) {
    if (typeof text !== 'string' || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
        start < 0 || end > text.length || start >= end || end - start > maxLength ||
        splitsPair(text, start) || splitsPair(text, end)) return null;
    let from = Math.max(0, start - contextLength), to = Math.min(text.length, end + contextLength);
    if (splitsPair(text, from)) from++;
    if (splitsPair(text, to)) to--;
    const anchor = {start, end, exact: text.slice(start, end), prefix: text.slice(from, start), suffix: text.slice(end, to)};
    return valid(anchor) ? anchor : null;
  }

  function resolve(text, anchor) {
    if (typeof text !== 'string' || !valid(anchor)) return null;
    const {start, end, exact, prefix, suffix} = anchor;
    if (text.slice(start, end) === exact && text.slice(Math.max(0, start - prefix.length), start) === prefix &&
        text.slice(end, end + suffix.length) === suffix && !splitsPair(text, start) && !splitsPair(text, end))
      return {start, end};
    let best = -1, bestScore = -1, count = 0, tied = false;
    for (let i = text.indexOf(exact); i !== -1; i = text.indexOf(exact, i + 1)) {
      const after = i + exact.length;
      if (splitsPair(text, i) || splitsPair(text, after)) continue;
      let left = 0, right = 0;
      while (left < prefix.length && text[i - left - 1] === prefix[prefix.length - left - 1]) left++;
      while (right < suffix.length && text[after + right] === suffix[right]) right++;
      const score = left + right;
      count++;
      if (score > bestScore) { best = i; bestScore = score; tied = false; }
      else if (score === bestScore) tied = true;
    }
    return count === 1 || (bestScore > 0 && !tied) ? {start: best, end: best + exact.length} : null;
  }

  const api = {capture, resolve, valid};
  root.EarthQuoteAnchor = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
