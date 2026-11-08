(function (root, factory) {
  'use strict';
  var createBookmarkStore = factory(root);
  root.createBookmarkStore = createBookmarkStore;
  if (typeof module === 'object' && module.exports) module.exports = createBookmarkStore;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  var STORAGE_KEY = 'earth-online-bookmarks-v1';
  var LIMIT = 500;
  var own = function (object, key) { return Object.prototype.hasOwnProperty.call(object, key); };
  var clone = function (entries) { return entries.map(function (entry) { return Object.assign({}, entry); }); };
  var keyOf = function (entry) { return JSON.stringify([entry.bookId, entry.section]); };

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
      return { bookId: entry.bookId, section: entry.section, textOffset: entry.textOffset, title: entry.title, excerpt: entry.excerpt, createdAt: entry.createdAt, updatedAt: entry.updatedAt };
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
    function current() {
      // Reading each time also observes storage events without a listener or a
      // lifecycle API. If access is denied, retain the last readable snapshot.
      try {
        var storage = root.localStorage;
        if (storage && typeof storage.getItem === 'function') {
          var raw = storage.getItem(STORAGE_KEY);
          var saved;
          try { saved = raw === null ? null : JSON.parse(raw); } catch (error) { saved = null; }
          snapshot = saved && saved.version === 1 ? validate(saved.entries) : [];
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
        storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries: entries }));
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
      var index = entries.findIndex(function (entry) { return entry.bookId === reference.bookId && entry.section === reference.section; });
      var previous = index >= 0 ? entries[index] : null;
      var now = Math.max(Date.now(), previous ? previous.updatedAt : 1);
      var entry = sanitize({ bookId: reference.bookId, section: reference.section, textOffset: reference.textOffset, title: reference.title, excerpt: reference.excerpt, createdAt: previous ? previous.createdAt : now, updatedAt: now });
      if (!entry) throw new TypeError('Invalid bookmark');
      if (index < 0 && entries.length >= LIMIT) throw new RangeError('Bookmark limit reached');
      if (index >= 0) entries[index] = entry;
      else entries.push(entry);
      return commit(entries, new Map([[keyOf(entry), entry]]));
    }
    function remove(bookId, section) {
      if (!validReference(bookId, section)) throw new TypeError('Invalid bookmark reference');
      var key = keyOf({ bookId: bookId, section: section });
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
      // Backups must retain external entries hidden by the display limit while
      // a session has pending additions. This method never attempts a write.
      readForExport: function () { return clone(current()); },
      validate: validate, upsert: upsert, remove: remove, merge: merge
    };
  };
}));
