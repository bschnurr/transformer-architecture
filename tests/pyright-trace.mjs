import assert from 'node:assert/strict';

import {genericOverloadTrace, overloadResolutionTrace, scenarios} from '../dist/pyright/overload-scenarios.mjs';
import {moduleCatalog, traceStateAt} from '../dist/pyright/trace-model.mjs';
import {chapters, duration, storyPosition} from '../dist/pyright/story.mjs';

assert.equal(scenarios.length, 2);
assert.equal(overloadResolutionTrace.events.at(-2).type, 'str');
assert.equal(genericOverloadTrace.events.at(-2).type, 'list[str]');

const solvedIndex = genericOverloadTrace.events.findIndex((event) => event.id === 'generic-constraint');
const solvedState = traceStateAt(genericOverloadTrace, solvedIndex);
assert.equal(solvedState.constraints.get('T').solution, 'str');

const finalState = traceStateAt(genericOverloadTrace, genericOverloadTrace.events.length - 1);
assert.equal(finalState.candidates.get(1).status, 'rejected');
assert.equal(finalState.candidates.get(2).status, 'accepted');
assert.equal(finalState.result, 'list[str]');

for (const event of genericOverloadTrace.events) {
  if (event.module) assert.ok(moduleCatalog[event.module], event.module);
}

assert.ok(chapters.length >= 4);
assert.equal(storyPosition(0).cue.event, 'generic-enter');
assert.equal(storyPosition(duration).complete, true);
assert.equal(storyPosition(duration).traceEvent.type, 'list[str]');

console.log('Pyright evaluator trace checks passed.');
