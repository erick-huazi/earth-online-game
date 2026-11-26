(function (root, factory) {
  'use strict';
  var createBookmarkStore = factory(root);
  root.createBookmarkStore = createBookmarkStore;
  if (typeof module === 'object' && module.exports) module.exports = createBookmarkStore;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  var STORAGE_KEY = 'earth-online-bookmarks-v1';
  // Older open tabs rewrite every v1 entry as a chapter bookmark. Keep quote
  // anchors in their own key so those writers can never erase a clipping.
  var CLIP_KEY = 'earth-online-clippings-v1';
  var LIMIT = 500;
  var own = function (object, key) { return Object.prototype.hasOwnProperty.call(object, key); };
  var anchors = root.EarthQuoteAnchor || (typeof require === 'function' && require('./quote-anchor.js'));
  var clone = function (entries) { return entries.map(function (entry) {
    return entry.kind === 'clip' ? Object.assign({}, entry, {anchor: Object.assign({}, entry.anchor)}) : Object.assign({}, entry);
  }); };
  var keyOf = function (entry) {
    var fields = [entry.bookId, entry.section];
    if (entry.kind === 'clip' && entry.anchor) fields.push(entry.anchor.start, entry.anchor.end, entry.anchor.exact);
    return JSON.stringify(fields);
  };

  return function createBookmarkStore(options) {
    var bookSections = new Map();
    if (options && Array.isArray(options.books)) options.books.forEach(function (book) {
      if (book && typeof book.id === 'string' && book.id && Number.isSafeInteger(book.sectionCount) && book.sectionCount > 0) {
        bookSections.set(book.id, book.sectionCount);
      }
    });
    var snapshot = [];
    // This overlay only contains changes whose last write failed. Null is a
    // deletion marker, so refreshing another tab cannot resurrect a deletion.
    var pending = new Map();

    function validReference(bookId, section) {
      return typeof bookId === 'string' && bookSections.has(bookId) && Number.isSafeInteger(section) && section >= 0 && section < bookSections.get(bookId);
    }
    function sanitize(entry) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
      var fields = ['bookId', 'section', 'textOffset', 'title', 'excerpt', 'createdAt', 'updatedAt'];
      if (!fields.every(function (field) { return own(entry, field); })) return null;
      if (!validReference(entry.bookId, entry.section) || !Number.isSafeInteger(entry.textOffset) || entry.textOffset < 0 || entry.textOffset > 5000000) return null;
      if (typeof entry.title !== 'string' || entry.title.length > 240 || typeof entry.excerpt !== 'string' || entry.excerpt.length > 160) return null;
      if (typeof entry.createdAt !== 'number' || !Number.isFinite(entry.createdAt) || entry.createdAt <= 0 || typeof entry.updatedAt !== 'number' || !Number.isFinite(entry.updatedAt) || entry.updatedAt <= 0) return null;
      var clean = { bookId: entry.bookId, section: entry.section, textOffset: entry.textOffset, title: entry.title, excerpt: entry.excerpt, createdAt: entry.createdAt, updatedAt: entry.updatedAt };
      if (entry.kind === 'clip') {
        if (!anchors || !anchors.valid(entry.anchor) || entry.anchor.start !== entry.textOffset) return null;
        var a = entry.anchor;
        clean.kind = 'clip';
        clean.anchor = {start: a.start, end: a.end, exact: a.exact, prefix: a.prefix, suffix: a.suffix};
      } else if (own(entry, 'kind') && entry.kind !== undefined) return null;
      return clean;
    }
    function validate(entries) {
      var result = [];
      var seen = new Set();
      if (!Array.isArray(entries)) return result;
      for (var i = 0; i < entries.length && result.length < LIMIT; i++) {
        var entry = sanitize(entries[i]);
        if (!entry) continue;
        var key = keyOf(entry);
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(entry);
      }
      return result;
    }
    function readSaved(storage, key, clips) {
      var raw = storage.getItem(key), saved;
      try { saved = raw === null ? null : JSON.parse(raw); } catch (error) { saved = null; }
      return saved && saved.version === 1 ? validate(saved.entries).filter(function (entry) {
        return (entry.kind === 'clip') === clips;
      }) : [];
    }
    function storageUpdates(entries) {
      return [STORAGE_KEY, CLIP_KEY].map(function (key) {
        var group = entries.filter(function (entry) { return (entry.kind === 'clip') === (key === CLIP_KEY); });
        return [key, JSON.stringify({version: 1, entries: group})];
      });
    }
    function current() {
      // Reading each time also observes storage events without a listener or a
      // lifecycle API. If access is denied, retain the last readable snapshot.
      try {
        var storage = root.localStorage;
        if (storage && typeof storage.getItem === 'function') {
          snapshot = readSaved(storage, STORAGE_KEY, false).concat(readSaved(storage, CLIP_KEY, true));
        }
      } catch (error) { /* Session use remains available. */ }
      var combined = new Map(snapshot.map(function (entry) { return [keyOf(entry), entry]; }));
      pending.forEach(function (entry, key) { if (entry === null) combined.delete(key); else combined.set(key, entry); });
      // Keep the complete merged state internally. A bounded display must never
      // become the source of a write that silently drops another tab's entries.
      return Array.from(combined.values());
    }
    function visible(entries) {
      if (entries.length <= LIMIT) return clone(entries);
      // While capacity conflicts are unresolved, show this session's pending
      // entries first. Other saved entries remain untouched in localStorage.
      var combined = new Map(entries.map(function (entry) { return [keyOf(entry), entry]; }));
      var bounded = new Map();
      pending.forEach(function (entry, key) { if (entry !== null && combined.has(key) && bounded.size < LIMIT) bounded.set(key, combined.get(key)); });
      combined.forEach(function (entry, key) { if (!bounded.has(key) && bounded.size < LIMIT) bounded.set(key, entry); });
      return clone(Array.from(bounded.values()));
    }
    function commit(entries, changes) {
      if (entries.length > LIMIT) {
        changes.forEach(function (entry, key) { pending.set(key, entry); });
        return { entries: visible(entries), persisted: false, reason: 'capacity' };
      }
      try {
        var storage = root.localStorage;
        if (!storage || typeof storage.setItem !== 'function') throw new Error('Storage unavailable');
        var touched = new Set();
        function mark(value, key) { touched.add(JSON.parse(key).length > 2 ? CLIP_KEY : STORAGE_KEY); }
        pending.forEach(mark);
        changes.forEach(mark);
        var written = [];
        try {
          storageUpdates(entries).forEach(function (update) {
            if (!touched.has(update[0])) return;
            var previous = storage.getItem(update[0]);
            storage.setItem(update[0], update[1]);
            written.push([update[0], previous]);
          });
        } catch (error) {
          written.reverse().forEach(function (saved) {
            try { if (saved[1] === null) storage.removeItem(saved[0]); else storage.setItem(saved[0], saved[1]); } catch (ignored) {}
          });
          throw error;
        }
        // Do not expose a successful write before storage has accepted it.
        snapshot = clone(entries);
        pending.clear();
        return { entries: clone(entries), persisted: true };
      } catch (error) {
        changes.forEach(function (entry, key) { pending.set(key, entry); });
        return { entries: clone(entries), persisted: false };
      }
    }
    function upsert(input) {
      var entries = current();
      var reference = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
      var key = keyOf(reference);
      var index = entries.findIndex(function (entry) { return keyOf(entry) === key; });
      var previous = index >= 0 ? entries[index] : null;
      var now = Math.max(Date.now(), previous ? previous.updatedAt : 1);
      var entry = sanitize(Object.assign({}, reference, {createdAt: previous ? previous.createdAt : now, updatedAt: now}));
      if (!entry) throw new TypeError('Invalid bookmark');
      if (index < 0 && entries.length >= LIMIT) throw new RangeError('Bookmark limit reached');
      if (index >= 0) entries[index] = entry;
      else entries.push(entry);
      return commit(entries, new Map([[keyOf(entry), entry]]));
    }
    function remove(bookId, section, anchor) {
      if (!validReference(bookId, section)) throw new TypeError('Invalid bookmark reference');
      var key = keyOf({ bookId: bookId, section: section, kind: anchor ? 'clip' : undefined, anchor: anchor });
      var entries = current().filter(function (entry) { return keyOf(entry) !== key; });
      return commit(entries, new Map([[key, null]]));
    }
    function merge(imported) {
      var entries = current();
      var existing = new Set(entries.map(keyOf));
      var changes = new Map();
      validate(imported).forEach(function (entry) {
        var key = keyOf(entry);
        if (existing.has(key) || entries.length >= LIMIT) return;
        existing.add(key);
        entries.push(entry);
        changes.set(key, entry);
      });
      return commit(entries, changes);
    }
    return {
      read: function () { return visible(current()); },
      hasPendingChanges: function () { return pending.size > 0; },
      // Backups must retain external entries hidden by the display limit while
      // a session has pending additions. This method never attempts a write.
      readForExport: function () { return clone(current()); },
      keyOf: keyOf, storageUpdates: storageUpdates, validate: validate, upsert: upsert, remove: remove, merge: merge
    };
  };
}));
