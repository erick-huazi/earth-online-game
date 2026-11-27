'use strict';
const assert = require('node:assert/strict');
const fc = require('fast-check');
const {create} = require('./practice-history.js');

// The oracle stores numbered decisions in two stacks. The player-facing
// history holds immutable game states; give it a distinct object per decision.
function setup() {
  const real = create(Object.freeze({decision: 0}));
  assert.equal(real.position, 0);
  assert.equal(real.steps, 0);
  assert.equal(real.canUndo || real.canRedo, false);
  return {
    model: {before: [], current: 0, after: []},
    real
  };
}

function command(action, value) {
  return {
    // Boundary commands are intentional: another Undo at the first step must
    // leave the next Redo intact, and vice versa.
    check: () => true,
    run(model, real) {
      let actual;
      if (action === 'commit' || action === 'repeat') {
        model.before.push(model.current);
        model.current = action === 'repeat' ? model.current : value;
        model.after.length = 0;
        actual = real.commit(action === 'repeat' ? real.present : Object.freeze({decision: value}));
      } else if (action === 'undo') {
        if (model.before.length) {
          model.after.push(model.current);
          model.current = model.before.pop();
        }
        actual = real.undo();
      } else {
        if (model.after.length) {
          model.before.push(model.current);
          model.current = model.after.pop();
        }
        actual = real.redo();
      }
      assert.equal(actual, real.present);
      assert.equal(real.present.decision, model.current);
      assert.equal(real.position, model.before.length);
      assert.equal(real.steps, model.before.length + model.after.length);
      assert.equal(real.canUndo, model.before.length > 0);
      assert.equal(real.canRedo, model.after.length > 0);
    },
    toString: () => action === 'commit' ? 'commit(' + value + ')' : action
  };
}

const add = fc.integer({min: -12, max: 12}).map(value => command('commit', value));
const sequence = fc.commands([add, fc.constant(command('undo')), fc.constant(command('redo')),
  fc.constant(command('repeat'))], {maxCommands: 64, size: 'large', replayPath: process.env.FC_COMMAND_PATH});
const options = {numRuns: 256};
if (process.env.FC_SEED) options.seed = Number(process.env.FC_SEED);
if (process.env.FC_PATH) options.path = process.env.FC_PATH;
fc.assert(fc.property(sequence, steps => fc.modelRun(setup, steps)), options);
console.log('PASS practice history matches the reference model after each command',
  options.path ? '(replayed sequence)' : '(256 sequences)');
