# Pyright Type Evaluator Explorer

An interactive explanation of how [Pyright](https://github.com/microsoft/pyright) turns Python syntax into types, overload decisions, narrowed unions, and diagnostics.

This project is derived from Peter Gostev's MIT-licensed [Transformer Architecture](https://github.com/petergpt/transformer-architecture) visualizer. Its Three.js scene, spatial navigation, camera tours, and story controls provide the presentation framework. The model and explanations are being replaced with a source-grounded view of Pyright's type evaluator.

## Current prototype

The first implementation slice defines the explanation data layer:

- a versioned evaluator event format
- a catalog of evaluator subsystems
- two overload-resolution traces
- a timed guided story
- validation and state-reconstruction tests

The scenario explains these calls:

~~~python
from typing import overload, TypeVar

T = TypeVar("T")

@overload
def transform(value: int) -> str: ...
@overload
def transform(value: T) -> list[T]: ...

first = transform(1)        # str
second = transform("hello") # list[str]
~~~

The second call demonstrates candidate rejection, diagnostic evidence, TypeVar constraint solving, signature specialization, and the resulting list[str] type.

## Source model

The visualization follows the module boundaries in Bill Schnurr's experimental [typeEval-explained](https://github.com/bschnurr/pyright/tree/typeEval-explained/packages/pyright-internal/src/analyzer/typeEvaluator) branch:

| Visual region | Pyright source | Responsibility |
| --- | --- | --- |
| Evaluator core | evaluatorCore.ts | Shared evaluator state and coordination |
| Expression evaluation | expressionEvaluation.ts | Expression-shaped parse nodes and call evaluation |
| Type compatibility | assignFunctions.ts | Source-to-destination compatibility |
| Type variables | typeVarHandling.ts | TypeVar binding and specialization |
| Flow analysis | flowAnalysis.ts | Effective types from control flow |
| Narrowing | narrowing.ts | Union narrowing from conditions and guards |
| Member resolution | memberResolution.ts | Lookup and binding |
| Collection inference | collectionInference.ts | List, tuple, set, and dictionary inference |
| Diagnostics | diagnostics.ts | Rule configuration and diagnostic output |

These are educational boundaries. The trace remains explicit about which details are schematic and which correspond to concrete evaluator operations.

## Trace format

dist/pyright/trace-model.mjs defines events understood by the future renderer:

- enter and leave
- dispatch
- candidate
- compatibility
- constraint
- cache
- result
- diagnostic

Curated examples can use this format now. A later instrumented Pyright adapter can emit the same format, allowing the viewer to explain arbitrary expressions.

## Run locally

No dependency installation is required. Serve dist/ with Python:

~~~bash
python3 -m http.server 8000 --directory dist
~~~

Run the existing visualization and trace checks with Node.js 22 or later:

~~~bash
npm test
~~~

The active renderer is now a procedural Three.js map of the evaluator modules. It supports orbit and zoom controls, clickable source-grounded modules, scenario switching, step-by-step playback, animated evaluator traffic, overload candidate state, TypeVar constraints, and inferred-result display.

## Roadmap

1. Build a lightweight evaluator scene from the module catalog.
2. Render the selected Python expression and its parse-node path.
3. Animate overload candidates as parallel lanes.
4. Show TypeVar constraints and solutions as they change.
5. Add normal and speculative cache views.
6. Add flow-narrowing and member-resolution scenarios.
7. Define an optional trace emitter for the Pyright branch.

## Attribution

The original visualization, Blender assets, and interaction system are from [petergpt/transformer-architecture](https://github.com/petergpt/transformer-architecture). Pyright is licensed under the MIT License. See the inherited license and third-party notices.
