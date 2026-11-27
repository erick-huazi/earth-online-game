// Practice transitions return fresh game states. Keep references for this run
// only: a full 12-station expedition has 36 moves and up to two relic picks.
(() => {
  'use strict';
  function create(initial) {
    const states = [initial];
    let cursor = 0;
    return {
      get present() { return states[cursor]; },
      get position() { return cursor; },
      get steps() { return states.length - 1; },
      get canUndo() { return cursor > 0; },
      get canRedo() { return cursor < states.length - 1; },
      commit(next) {
        states.length = cursor + 1;
        states.push(next);
        cursor++;
        return next;
      },
      undo() {
        if (cursor > 0) cursor--;
        return states[cursor];
      },
      redo() {
        if (cursor < states.length - 1) cursor++;
        return states[cursor];
      }
    };
  }
  const api = {create};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else window.EarthPracticeHistory = api;
})();
