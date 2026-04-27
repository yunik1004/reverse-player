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
let chibiSrcs: string[][] = []; // 각 wrap 요소에 대응하는 chibi 이미지 목록

/** flip 시 각 chibi 이미지를 랜덤 변경 */
function randomizeChibiImages(els: HTMLElement[]) {
  els.forEach((el, i) => {
    const srcs = chibiSrcs[i];
    if (!srcs || srcs.length <= 1) return;
    const img = el.querySelector('img');
    if (!img) return;
    const current = img.src;
    const others = srcs.filter((s) => !current.endsWith(s));
    if (others.length > 0) {
      img.src = others[Math.floor(Math.random() * others.length)];
    }
  });
}

function resetState() {
  flipped = false;
  hopPos = 0;
}

// --- Routines ---

/** 바운스 1회 */
const basicBounce: RoutineFactory = (els, beatMs) => {
  return bounce(els, beatMs);
};

/** 좌우반전 — scaleX는 playNextRoutine에서 자동 주입 */
const flip: RoutineFactory = (els, beatMs) => {
  flipped = !flipped;
  randomizeChibiImages(els);
  return bounce(els, beatMs, -10);
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

/** 진자 흔들기 — 발밑 축으로 좌우 회전 (2~3왕복) */
const pendulum: RoutineFactory = (els, beatMs) => {
  const d = beatMs / 1000;
  const reps = 2;
  const steps: Step[] = [];
  for (let i = 0; i < reps; i++) {
    steps.push([els, { rotate: 5 }, { duration: d, ease: EASE_OUT }]);
    steps.push([els, { rotate: -5 }, { duration: d, ease: EASE_OUT }]);
  }
  steps.push([els, { rotate: 0 }, { duration: d * 0.5, ease: EASE_BACK }]);
  return steps;
};

/** allSpin은 controller에서 타이밍 제어 */
const allSpin = 'allSpin' as const;

// --- Routine list ---

type Routine = RoutineFactory | 'allSpin';

const ALL_ROUTINES: Routine[] = [basicBounce, flip, hopMove, pendulum, allSpin];

// --- Controller ---

export class ChibiDanceController {
  private els: HTMLElement[] = [];
  private animation: AnimationPlaybackControlsWithThen | null = null;
  private shuffled: Routine[] = [];
  private shuffleIdx = 0;
  private active: 'idle' | 'dance' | 'none' = 'none';

  setElements(els: HTMLElement[]): void {
    this.els = els;
  }

  setChibiSrcs(srcs: string[][]): void {
    chibiSrcs = srcs;
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

    const routine = this.shuffled[this.shuffleIdx++];

    if (routine === 'allSpin') {
      this.doFlips(this.els, beatMs, 2);
      return;
    }

    const sequence = routine(this.els, beatMs);
    // 모든 스텝에 현재 flip 상태의 scaleX + rotate 리셋 주입
    const sx = flipped ? -1 : 1;
    for (const step of sequence) {
      if (!('scaleX' in step[1])) step[1] = { ...step[1], scaleX: sx };
      if (!('rotate' in step[1])) step[1] = { ...step[1], rotate: 0 };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.animation = animate(sequence as any);
    this.animation.then(() => this.playNextRoutine(beatMs)).catch(() => {});
  }

  private doFlips(els: HTMLElement[], beatMs: number, count: number): void {
    let i = 0;

    const flipDur = (beatMs * 0.6) / 1000;

    const doOne = () => {
      if (this.active !== 'dance' || i >= count) {
        this.playNextRoutine(beatMs);
        return;
      }
      i++;
      flipped = !flipped;
      const sx = flipped ? -1 : 1;
      const seq: Step[] = [
        [els, { scaleX: 0, rotate: 0 }, { duration: flipDur / 2, ease: EASE_OUT }],
        [els, { scaleX: sx, rotate: 0 }, { duration: flipDur / 2, ease: EASE_OUT }]
      ];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.animation = animate(seq as any);
      this.animation.then(() => doOne()).catch(() => {});
    };
    doOne();
  }

  private cancelAll(): void {
    this.animation?.cancel();
    this.animation = null;
  }
}
