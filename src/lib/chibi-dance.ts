import { animate } from 'motion';
import type { AnimationPlaybackControlsWithThen } from 'motion-dom';

// --- Types ---

type Step = [
  target: string | HTMLElement[],
  values: Record<string, unknown>,
  options?: Record<string, unknown>
];
type RoutineFactory = (els: HTMLElement[], beatMs: number) => Step[];

// --- Easing ---

const EASE_OUT = [0.33, 1, 0.68, 1] as const;
const EASE_BACK = [0.34, 1.56, 0.64, 1] as const;
const EASE_INOUT = [0.45, 0, 0.55, 1] as const;

// --- Helpers ---

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** beat duration helpers */
function b4(beatMs: number) {
  return (beatMs * 0.4) / 1000;
}
function b6(beatMs: number) {
  return (beatMs * 0.6) / 1000;
}
function b1(beatMs: number) {
  return beatMs / 1000;
}
function bHalf(beatMs: number) {
  return (beatMs * 0.5) / 1000;
}

/** Generate a bounce step (up + land) */
function bounce(els: HTMLElement[], beatMs: number, height = -12): Step[] {
  return [
    [els, { y: height }, { duration: b4(beatMs), ease: EASE_OUT }],
    [els, { y: 0 }, { duration: b6(beatMs), ease: EASE_BACK }]
  ];
}

// --- Persistent state ---

let flipped = false;
let hopPos = 0; // -1 | 0 | 1

function resetState() {
  flipped = false;
  hopPos = 0;
}

// --- Routines ---

/** 전원 동시 바운스 (4회) */
const syncBounce: RoutineFactory = (els, beatMs) => {
  const steps: Step[] = [];
  for (let i = 0; i < 4; i++) steps.push(...bounce(els, beatMs));
  return steps;
};

/** Y축 180도 뒤집기 (CSS rotate, 상태 유지) */
const yFlip: RoutineFactory = (els, beatMs) => {
  flipped = !flipped;
  els.forEach((el) => {
    el.style.rotate = flipped ? 'y 180deg' : '';
  });
  return bounce(els, beatMs, -10);
};

/** 뒤집기 + 연속 바운스 */
const spinHop: RoutineFactory = (els, beatMs) => {
  flipped = !flipped;
  els.forEach((el) => {
    el.style.rotate = flipped ? 'y 180deg' : '';
  });
  return [...bounce(els, beatMs, -14), ...bounce(els, beatMs, -10)];
};

/** 홀짝 번갈아 바운스 */
const callResponse: RoutineFactory = (els, beatMs) => {
  const odd = els.filter((_, i) => i % 2 === 1);
  const even = els.filter((_, i) => i % 2 === 0);
  return [...bounce(odd, beatMs), ...bounce(even, beatMs), ...bounce(els, beatMs, -10)];
};

/** 진자 흔들기 (2~3왕복) */
const pendulum: RoutineFactory = (els, beatMs) => {
  const d = b1(beatMs);
  const reps = 2 + Math.floor(Math.random() * 2);
  const steps: Step[] = [];
  for (let i = 0; i < reps; i++) {
    steps.push([els, { rotate: 7 }, { duration: d, ease: EASE_INOUT }]);
    steps.push([els, { rotate: -7 }, { duration: d, ease: EASE_INOUT }]);
  }
  steps.push([els, { rotate: 0 }, { duration: d * 0.5, ease: EASE_INOUT }]);
  return steps;
};

/** 통통 2번 튀면서 좌/우 이동 (위치 기억) */
const hopMove: RoutineFactory = (els, beatMs) => {
  const dir = hopPos === 1 ? -1 : hopPos === -1 ? 1 : Math.random() < 0.5 ? -1 : 1;
  const fromX = hopPos * 16;
  hopPos += dir;
  const toX = hopPos * 16;

  const steps: Step[] = [];
  for (let i = 1; i <= 2; i++) {
    const x = fromX + (toX - fromX) * (i / 2);
    steps.push([els, { x, y: -12 }, { duration: b4(beatMs), ease: EASE_OUT }]);
    steps.push([els, { x, y: 0 }, { duration: b6(beatMs), ease: EASE_BACK }]);
  }
  return steps;
};

/** Y축 스핀 헬퍼 — style.rotate로 직접 회전, flip 상태 유지 */
function spinTargets(targets: HTMLElement[], beatMs: number, spins: number): Step[] {
  // 스핀은 style.rotate를 직접 조작. 바운스로 시간 채움.
  const dir = Math.random() < 0.5 ? 1 : -1;
  const base = flipped ? 180 : 0;
  const steps: Step[] = [];
  for (let i = 0; i < spins; i++) {
    // 반바퀴씩 나눠서 transition으로 회전
    const mid = base + dir * (360 * i + 180);
    const end = base + dir * 360 * (i + 1);
    steps.push([
      targets,
      { y: -6 },
      {
        duration: bHalf(beatMs),
        ease: EASE_OUT,
        onStart: () => {
          targets.forEach((el) => {
            el.style.rotate = `y ${mid}deg`;
          });
        }
      }
    ]);
    steps.push([
      targets,
      { y: 0 },
      {
        duration: bHalf(beatMs),
        ease: EASE_BACK,
        onStart: () => {
          targets.forEach((el) => {
            el.style.rotate = `y ${end}deg`;
          });
        }
      }
    ]);
  }
  // 최종 상태를 flip 상태에 맞게 정리
  steps.push([
    targets,
    { y: 0 },
    {
      duration: 0.01,
      onComplete: () => {
        targets.forEach((el) => {
          el.style.rotate = flipped ? 'y 180deg' : '';
        });
      }
    }
  ]);
  return steps;
}

/** 가운데 chibi Y축 2바퀴 회전 */
const centerSpin: RoutineFactory = (els, beatMs) => {
  return spinTargets([els[Math.floor(els.length / 2)]], beatMs, 2);
};

/** 전원 Y축 2바퀴 회전 */
const allSpin: RoutineFactory = (els, beatMs) => {
  return spinTargets(els, beatMs, 2);
};

/** 쪼그려 튀기 (2회) */
const squatJump: RoutineFactory = (els, beatMs) => {
  const d = b1(beatMs);
  const steps: Step[] = [];
  for (let i = 0; i < 2; i++) {
    steps.push([els, { scaleY: 0.85, scaleX: 1.08 }, { duration: d * 0.6, ease: EASE_INOUT }]);
    steps.push([
      els,
      { scaleY: 1.05, scaleX: 0.95, y: -18 },
      { duration: d * 0.3, ease: EASE_OUT }
    ]);
    steps.push([els, { scaleY: 0.9, scaleX: 1.05, y: 0 }, { duration: d * 0.3, ease: EASE_BACK }]);
    steps.push([els, { scaleY: 1, scaleX: 1 }, { duration: d * 0.3, ease: EASE_INOUT }]);
  }
  return steps;
};

/** 점프 후 포즈 */
const jumpPose: RoutineFactory = (els, beatMs) => {
  const d = b1(beatMs);
  return [
    [els, { scaleY: 0.9, scaleX: 1.05 }, { duration: d * 0.5, ease: EASE_INOUT }],
    [els, { y: -22, scaleY: 1, scaleX: 1, rotate: 5 }, { duration: d * 0.4, ease: EASE_OUT }],
    [els, { y: -22, rotate: 5 }, { duration: d * 0.8 }],
    [els, { y: 0, rotate: 0, scaleY: 0.9, scaleX: 1.05 }, { duration: d * 0.3, ease: EASE_BACK }],
    [els, { scaleY: 1, scaleX: 1 }, { duration: d * 0.4, ease: EASE_INOUT }]
  ];
};

/** 좌우 스텝터치 (4회) */
const stepTouch: RoutineFactory = (els, beatMs) => {
  const d = b1(beatMs);
  const steps: Step[] = [];
  for (let i = 0; i < 4; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    steps.push([
      els,
      { rotate: dir * 5, x: dir * 6, y: -4 },
      { duration: d * 0.4, ease: EASE_OUT }
    ]);
    steps.push([
      els,
      { rotate: dir * 5, x: dir * 6, y: 0 },
      { duration: d * 0.6, ease: EASE_BACK }
    ]);
  }
  steps.push([els, { rotate: 0, x: 0 }, { duration: d * 0.3, ease: EASE_INOUT }]);
  return steps;
};

// --- Routine list ---

const ALL_ROUTINES: RoutineFactory[] = [
  syncBounce,
  yFlip,
  spinHop,
  callResponse,
  pendulum,
  hopMove,
  centerSpin,
  allSpin,
  squatJump,
  jumpPose,
  stepTouch
];

// --- Controller ---

export class ChibiDanceController {
  private els: HTMLElement[] = [];
  private animation: AnimationPlaybackControlsWithThen | null = null;
  private shuffled: RoutineFactory[] = [];
  private shuffleIdx = 0;
  private active: 'idle' | 'dance' | 'none' = 'none';

  setElements(els: HTMLElement[]): void {
    this.els = els;
  }

  startIdle(bpm?: number): void {
    if (this.els.length === 0) return;
    this.cancelAll();
    this.active = 'idle';

    const beatSec = 60 / (bpm || 120);
    const dur = beatSec * 2;
    const steps = 20;
    const scaleX: number[] = [];
    const scaleY: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = Math.sin((i / steps) * Math.PI * 2);
      scaleX.push(1 + 0.03 * t);
      scaleY.push(1 - 0.03 * t);
    }

    this.animation = animate(
      this.els as Parameters<typeof animate>[0],
      { scaleX, scaleY },
      {
        duration: dur * 2,
        ease: 'linear',
        repeat: Infinity
      }
    );
  }

  startDance(bpm: number): void {
    if (this.els.length === 0) return;
    this.cancelAll();
    this.active = 'dance';
    this.playNextRoutine(60000 / (bpm || 120));
  }

  stop(): void {
    this.cancelAll();
    this.active = 'none';
    resetState();
    this.els.forEach((el) => {
      el.style.transform = '';
      el.style.rotate = '';
    });
  }

  destroy(): void {
    this.stop();
    this.els = [];
  }

  private playNextRoutine(beatMs: number): void {
    if (this.active !== 'dance' || this.els.length === 0) return;

    if (this.shuffleIdx >= this.shuffled.length) {
      this.shuffled = shuffleArray(ALL_ROUTINES);
      this.shuffleIdx = 0;
    }

    const sequence = this.shuffled[this.shuffleIdx++](this.els, beatMs);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.animation = animate(sequence as any);
    this.animation.then(() => this.playNextRoutine(beatMs)).catch(() => {});
  }

  private cancelAll(): void {
    this.animation?.cancel();
    this.animation = null;
  }
}
