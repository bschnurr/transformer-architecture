// Event model for source-grounded Pyright Type Evaluator explanations.
//
// The renderer consumes these events without depending on Pyright internals.
// A future trace adapter can emit the same shape from an instrumented evaluator.

export const TRACE_VERSION = 1;

export const moduleCatalog = Object.freeze({
  evaluatorCore: {
    label: 'Evaluator core',
    source: 'typeEvaluator/evaluatorCore.ts',
    role: 'Coordinates evaluator state, calls, constraints, and shared services.',
    color: '#65d9ce',
  },
  expressionEvaluation: {
    label: 'Expression evaluation',
    source: 'typeEvaluator/expressionEvaluation.ts',
    role: 'Evaluates expression-shaped parse nodes and produces TypeResults.',
    color: '#70adf0',
  },
  assignFunctions: {
    label: 'Type compatibility',
    source: 'typeEvaluator/assignFunctions.ts',
    role: 'Checks whether source types can be assigned to destination types.',
    color: '#edb565',
  },
  typeVarHandling: {
    label: 'Type variable handling',
    source: 'typeEvaluator/typeVarHandling.ts',
    role: 'Binds, specializes, and applies TypeVar solutions.',
    color: '#c093dd',
  },
  flowAnalysis: {
    label: 'Flow analysis',
    source: 'typeEvaluator/flowAnalysis.ts',
    role: 'Uses control-flow state when determining the effective type.',
    color: '#62c58f',
  },
  narrowing: {
    label: 'Narrowing',
    source: 'typeEvaluator/narrowing.ts',
    role: 'Narrows unions from conditions, patterns, and guards.',
    color: '#4cc7c0',
  },
  memberResolution: {
    label: 'Member resolution',
    source: 'typeEvaluator/memberResolution.ts',
    role: 'Finds and binds members on classes, objects, unions, and protocols.',
    color: '#e09bd5',
  },
  collectionInference: {
    label: 'Collection inference',
    source: 'typeEvaluator/collectionInference.ts',
    role: 'Infers list, set, tuple, and dictionary element types.',
    color: '#9fb7ff',
  },
  diagnostics: {
    label: 'Diagnostics',
    source: 'typeEvaluator/diagnostics.ts',
    role: 'Applies rule configuration and records user-facing diagnostics.',
    color: '#ef7d80',
  },
});

const eventKinds = new Set([
  'enter',
  'leave',
  'dispatch',
  'candidate',
  'compatibility',
  'constraint',
  'cache',
  'result',
  'diagnostic',
]);

export function defineTrace(trace) {
  if (!trace || trace.version !== TRACE_VERSION) {
    throw new Error(`Expected evaluator trace version ${TRACE_VERSION}`);
  }
  if (!trace.id || !Array.isArray(trace.events) || trace.events.length === 0) {
    throw new Error('A trace needs an id and at least one event');
  }

  const ids = new Set();
  for (const [index, event] of trace.events.entries()) {
    if (!event.id || ids.has(event.id)) {
      throw new Error(`Trace event ${index} has a missing or duplicate id`);
    }
    ids.add(event.id);
    if (!eventKinds.has(event.kind)) {
      throw new Error(`Unknown trace event kind: ${event.kind}`);
    }
    if (event.module && !moduleCatalog[event.module]) {
      throw new Error(`Unknown evaluator module: ${event.module}`);
    }
  }

  return Object.freeze({
    ...trace,
    events: Object.freeze(trace.events.map((event, index) =>
      Object.freeze({time: index, ...event})
    )),
  });
}

export function traceStateAt(trace, eventIndex) {
  const state = {
    activeModules: [],
    candidates: new Map(),
    constraints: new Map(),
    cache: [],
    result: undefined,
    diagnostics: [],
  };

  for (const event of trace.events.slice(0, eventIndex + 1)) {
    if (event.kind === 'enter' && event.module) state.activeModules.push(event.module);
    if (event.kind === 'leave' && event.module) {
      const index = state.activeModules.lastIndexOf(event.module);
      if (index >= 0) state.activeModules.splice(index, 1);
    }
    if (event.kind === 'candidate') {
      state.candidates.set(event.candidate, {
        status: event.status,
        signature: event.signature,
        reason: event.reason,
      });
    }
    if (event.kind === 'constraint') {
      state.constraints.set(event.typeVar, {
        lowerBound: event.lowerBound,
        upperBound: event.upperBound,
        solution: event.solution,
      });
    }
    if (event.kind === 'cache') state.cache.push(event);
    if (event.kind === 'result') state.result = event.type;
    if (event.kind === 'diagnostic') state.diagnostics.push(event);
  }

  return state;
}
