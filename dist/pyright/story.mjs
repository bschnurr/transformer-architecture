import {genericOverloadTrace} from './overload-scenarios.mjs';

// Story data mirrors the original visualizer's timed chapter model.
// Targets are evaluator module ids; the new scene renderer will map them
// to spatial regions rather than Transformer component meshes.
export const chapters = [
  {
    id: 'call',
    name: 'The call',
    title: 'Start at the expression',
    duration: 7,
    cues: [
      {
        at: 0,
        overview: true,
        targets: ['expressionEvaluation'],
        event: 'generic-enter',
        caption: 'Pyright begins with the CallNode: transform("hello").',
      },
      {
        at: 3,
        targets: ['evaluatorCore', 'expressionEvaluation'],
        event: 'specific-test',
        caption: 'The callee type contains two overload candidates, considered in declaration order.',
      },
    ],
  },
  {
    id: 'reject',
    name: 'Reject',
    title: 'Test the specific overload',
    duration: 8,
    cues: [
      {
        at: 0,
        targets: ['expressionEvaluation', 'assignFunctions'],
        event: 'specific-reject',
        caption: 'The first candidate expects int, but the argument has type str.',
      },
      {
        at: 4,
        targets: ['assignFunctions', 'diagnostics'],
        event: 'specific-rejected',
        caption: 'The candidate is rejected and its reason is retained as diagnostic evidence.',
      },
    ],
  },
  {
    id: 'solve',
    name: 'Solve',
    title: 'Solve the generic overload',
    duration: 10,
    cues: [
      {
        at: 0,
        targets: ['expressionEvaluation', 'typeVarHandling'],
        event: 'generic-test',
        caption: 'Matching continues with the generic overload (value: T) -> list[T].',
      },
      {
        at: 4,
        targets: ['typeVarHandling'],
        event: 'generic-constraint',
        caption: 'The argument contributes a constraint and T is solved as str.',
      },
      {
        at: 7,
        targets: ['typeVarHandling', 'assignFunctions'],
        event: 'generic-compatible',
        caption: 'The specialized parameter accepts the argument.',
      },
    ],
  },
  {
    id: 'result',
    name: 'Result',
    title: 'Specialize the return type',
    duration: 8,
    cues: [
      {
        at: 0,
        targets: ['expressionEvaluation'],
        event: 'generic-accepted',
        caption: 'The selected signature is now (value: str) -> list[str].',
      },
      {
        at: 4,
        targets: ['expressionEvaluation', 'evaluatorCore'],
        event: 'generic-result',
        caption: 'The CallNode receives list[str], which can then be cached and reused.',
      },
    ],
  },
];

let offset = 0;
for (const chapter of chapters) {
  chapter.start = offset;
  offset += chapter.duration;
}

export const duration = offset;
export const cues = chapters.flatMap((chapter, chapterIndex) =>
  chapter.cues.map((cue, cueIndex) => ({
    ...cue,
    time: chapter.start + cue.at,
    chapterIndex,
    cueIndex,
  }))
);

export function storyPosition(seconds) {
  const time = Math.max(0, Math.min(duration, seconds));
  const index = chapters.findLastIndex((chapter) => time >= chapter.start);
  const chapter = chapters[index];
  const local = Math.min(chapter.duration, time - chapter.start);
  const cueIndex = chapter.cues.findLastIndex((cue) => local >= cue.at);
  const cue = chapter.cues[cueIndex];
  return {
    time,
    index,
    chapter,
    local,
    cueIndex,
    cue,
    traceEvent: genericOverloadTrace.events.find((event) => event.id === cue.event),
    complete: time === duration,
  };
}

export class StoryClock {
  constructor() {
    this.time = 0;
    this.playing = false;
    this.last = null;
  }

  tick(now, visible = true) {
    if (this.playing && visible && this.last !== null) {
      this.time = Math.min(duration, this.time + Math.max(0, now - this.last) / 1000);
    }
    this.last = now;
    if (this.time >= duration) this.playing = false;
    return storyPosition(this.time);
  }

  play(now) {
    if (this.time >= duration) this.time = 0;
    this.playing = true;
    this.last = now;
  }

  pause(now) {
    this.tick(now);
    this.playing = false;
    this.last = null;
  }

  seek(time, now) {
    this.time = Math.max(0, Math.min(duration, time));
    this.last = now;
    if (this.time >= duration) this.playing = false;
    return storyPosition(this.time);
  }

  resetVisibility() {
    this.last = null;
  }
}
