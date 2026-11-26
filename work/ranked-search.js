/*!
 * BM25+ scoring function adapted from Luca Ongaro's MiniSearch v7.2.0.
 * https://github.com/lucaong/minisearch/blob/v7.2.0/src/MiniSearch.ts
 *
 * Copyright 2022 Luca Ongaro
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
(function(root) {
  'use strict';

  function terms(query) {
    return [...new Set(query.split(/\s+/u).map(term => root.EarthTextSearch.fold(term, 'flexible')).filter(Boolean))];
  }

  function frequency(text, term) {
    let count = 0;
    let offset = 0;
    while ((offset = text.indexOf(term, offset)) !== -1) {
      count++;
      offset += term.length;
    }
    return count;
  }

  // MiniSearch BM25+ with its default k, b and d.
  // Fields use normalized text length so classical Chinese needs no word dictionary.
  function fieldScore(tf, matched, total, length, average) {
    if (!tf) return 0;
    const k = 1.2, b = 0.7, d = 0.5;
    const idf = Math.log(1 + (total - matched + 0.5) / (matched + 0.5));
    return idf * (d + tf * (k + 1) / (tf + k * (1 - b + b * length / average)));
  }

  function rank(rows, needles) {
    if (!rows.length || !needles.length || needles.some(term => !term)) return [];
    let titleLength = 0, bodyLength = 0;
    const titleDocuments = needles.map(() => 0);
    const bodyDocuments = needles.map(() => 0);
    const matches = [];
    rows.forEach((row, index) => {
      titleLength += row.title.length;
      bodyLength += row.text.length;
      const titleHits = [], bodyHits = [];
      let allFound = true;
      for (let i = 0; i < needles.length; i++) {
        const title = frequency(row.title, needles[i]);
        const body = frequency(row.text, needles[i]);
        titleHits.push(title);
        bodyHits.push(body);
        if (title) titleDocuments[i]++;
        if (body) bodyDocuments[i]++;
        if (!title && !body) allFound = false;
      }
      if (allFound) matches.push({ index, titleHits, bodyHits });
    });
    const averageTitle = titleLength / rows.length || 1;
    const averageBody = bodyLength / rows.length || 1;
    for (const hit of matches) {
      const row = rows[hit.index];
      hit.score = needles.reduce((score, _, i) => score
        + 3 * fieldScore(hit.titleHits[i], titleDocuments[i], rows.length, row.title.length, averageTitle)
        + fieldScore(hit.bodyHits[i], bodyDocuments[i], rows.length, row.text.length, averageBody), 0);
    }
    return matches.sort((a, b) => b.score - a.score || a.index - b.index).map(hit => hit.index);
  }

  function mergeRanges(ranges) {
    const merged = [];
    for (const range of ranges.sort((a, b) => a.start - b.start || b.end - a.end)) {
      const last = merged[merged.length - 1];
      if (last && range.start < last.end) last.end = Math.max(last.end, range.end);
      else merged.push({ ...range });
    }
    return merged;
  }

  const api = Object.freeze({ terms, rank, mergeRanges });
  root.EarthRankedSearch = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window === 'object' ? window : globalThis);
