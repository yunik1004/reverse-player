<script lang="ts">
  import { progressToAngle, angleToProgress, TIP_OFFSET } from '$lib/tonearm';

  let {
    motorOn = $bindable(false),
    armOnRecord = $bindable(false),
    tonearmAngle = $bindable(0),
    volume = $bindable(50),
    getPlaybackProgress,
    onSeek,
    onPause
  }: {
    motorOn: boolean;
    armOnRecord: boolean;
    tonearmAngle: number;
    volume: number;
    getPlaybackProgress: () => number | null;
    onSeek: () => void;
    onPause: () => void;
  } = $props();

  let spinning = $state(false);
  let platterAngle = $state(0);
  let animationId: number;
  let draggingArm = $state(false);
  let faderDragging = $state(false);
  let turntableEl: HTMLDivElement;
  let scale = $state(1);

  const ANGLE_MIN = progressToAngle(0);
  const ANGLE_MAX = progressToAngle(1);

  // Responsive scaling
  function updateScale() {
    scale = Math.min(1, (window.innerWidth - 32) / 500);
  }

  $effect(() => {
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  });

  // Motor
  function toggleMotor() {
    motorOn = !motorOn;
    if (motorOn) {
      spinning = true;
      spin();
      if (armOnRecord) onSeek();
    } else {
      spinning = false;
      cancelAnimationFrame(animationId);
      onPause();
    }
  }

  $effect(() => {
    if (!motorOn && spinning) {
      spinning = false;
      cancelAnimationFrame(animationId);
    }
  });

  // Arm on/off record detection
  $effect(() => {
    const onRecord = tonearmAngle >= ANGLE_MIN - 1;
    if (onRecord !== armOnRecord) {
      armOnRecord = onRecord;
      if (!draggingArm && motorOn) {
        if (armOnRecord) onSeek();
        else onPause();
      }
    }
  });

  // Animation loop
  function spin() {
    platterAngle += 0.5;

    if (!draggingArm && armOnRecord) {
      const progress = getPlaybackProgress();
      if (progress !== null) {
        const armProgress = angleToProgress(tonearmAngle);
        if (Math.abs(progress - armProgress) < 0.03) {
          tonearmAngle = progressToAngle(progress);
        }
      }
    }

    animationId = requestAnimationFrame(spin);
  }

  // Tonearm drag
  function getPivotScreen() {
    const rect = turntableEl.getBoundingClientRect();
    return {
      x: rect.left + 350 * (rect.width / 500),
      y: rect.top + 60 * (rect.height / 420)
    };
  }

  function onArmDown(e: PointerEvent) {
    draggingArm = true;
    (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
    onPause();
  }

  function onArmMove(e: PointerEvent) {
    if (!draggingArm) return;
    const pivot = getPivotScreen();
    const mouseAngle = (Math.atan2(e.clientX - pivot.x, e.clientY - pivot.y) * 180) / Math.PI;
    tonearmAngle = Math.max(ANGLE_MIN, Math.min(ANGLE_MAX, -mouseAngle - TIP_OFFSET));
  }

  function onArmUp() {
    draggingArm = false;
    if (motorOn && armOnRecord) onSeek();
  }

  // Volume fader
  function onFaderDown(e: PointerEvent) {
    faderDragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    updateVolumeFromPointer(e);
  }

  function onFaderMove(e: PointerEvent) {
    if (!faderDragging) return;
    updateVolumeFromPointer(e);
  }

  function onFaderUp() {
    faderDragging = false;
  }

  function updateVolumeFromPointer(e: PointerEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    volume = Math.round(Math.max(0, Math.min(1, (rect.bottom - e.clientY) / rect.height)) * 100);
  }
</script>

<div class="turntable-wrapper" style="transform: scale({scale}); transform-origin: center center">
  <div class="turntable" bind:this={turntableEl}>
    <div class="wood-grain"></div>
    <div class="metal-plate"></div>

    <div class="platter" style="transform: rotate({platterAngle}deg)">
      <div class="vinyl-sheen"></div>
      {#each Array.from({ length: 24 }, (_, i) => 280 - i * 6) as size (size)}
        <div class="groove" style="width: {size}px; height: {size}px"></div>
      {/each}
      <div class="label">
        <div class="label-inner">
          <span class="label-title">Reverse</span>
          <div class="label-divider"></div>
          <span class="label-subtitle">1999</span>
        </div>
      </div>
      <div class="spindle"></div>
    </div>

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <svg
      class="tonearm"
      width="50"
      height="220"
      viewBox="0 0 50 220"
      style="transform: rotate({tonearmAngle}deg); cursor: grab; touch-action: none"
      onpointerdown={onArmDown}
      onpointermove={onArmMove}
      onpointerup={onArmUp}
    >
      <line
        x1="25"
        y1="12"
        x2="25"
        y2="170"
        stroke="#b8b0a0"
        stroke-width="6"
        stroke-linecap="round"
      />
      <g transform="rotate(16, 25, 170)">
        <line
          x1="25"
          y1="170"
          x2="25"
          y2="205"
          stroke="#b8b0a0"
          stroke-width="6"
          stroke-linecap="round"
        />
        <rect x="18" y="198" width="14" height="12" rx="1.5" fill="#b8b0a0" />
      </g>
      <circle cx="25" cy="12" r="10" fill="#b8b0a0" />
    </svg>

    <div class="controls">
      <div class="control-unit">
        <div class="control-label">VOL</div>
        <div
          class="control-track"
          role="slider"
          tabindex="0"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={volume}
          aria-label="Volume"
          onpointerdown={onFaderDown}
          onpointermove={onFaderMove}
          onpointerup={onFaderUp}
        >
          <div class="track-groove"></div>
          <div class="track-lever" style="bottom: {8 + (volume / 100) * 56}px"></div>
        </div>
      </div>

      <div class="control-unit">
        <div class="control-label">PWR</div>
        <button
          class="control-track power-track"
          class:on={motorOn}
          onclick={toggleMotor}
          aria-label={motorOn ? 'Stop' : 'Play'}
        >
          <div class="track-groove"></div>
          <div
            class="track-lever"
            style="bottom: {motorOn ? 24 : 8}px; transition: bottom 0.2s ease"
          ></div>
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .turntable-wrapper {
    width: 500px;
    height: 420px;
  }

  .turntable {
    width: 500px;
    height: 420px;
    background: linear-gradient(170deg, #221a12, #1a1410, #16110c, #1a1410);
    border-radius: 8px;
    border: 1px solid rgba(60, 42, 22, 0.5);
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.9),
      0 2px 0 rgba(60, 42, 22, 0.3),
      0 30px 80px rgba(0, 0, 0, 0.8);
    position: relative;
    overflow: hidden;
  }

  .wood-grain {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      repeating-linear-gradient(
        176deg,
        transparent 0,
        transparent 14px,
        rgba(90, 55, 25, 0.035) 14px,
        rgba(90, 55, 25, 0.035) 15px,
        transparent 15px,
        transparent 32px
      ),
      repeating-linear-gradient(
        174deg,
        transparent 0,
        transparent 45px,
        rgba(50, 30, 12, 0.05) 45px,
        rgba(50, 30, 12, 0.05) 47px,
        transparent 47px,
        transparent 90px
      );
  }

  .metal-plate {
    position: absolute;
    top: 42px;
    left: 48px;
    width: 300px;
    height: 300px;
    border-radius: 50%;
    background: radial-gradient(circle, #1a1816 0%, #141210 100%);
    box-shadow:
      0 0 0 2px rgba(40, 30, 18, 0.8),
      inset 0 0 20px rgba(0, 0, 0, 0.4);
  }

  .platter {
    position: absolute;
    top: 50px;
    left: 56px;
    width: 284px;
    height: 284px;
    border-radius: 50%;
    background: radial-gradient(circle, #181818 20%, #111 60%, #0c0c0c 100%);
    box-shadow:
      0 0 0 3px rgba(25, 20, 14, 0.9),
      0 2px 8px rgba(0, 0, 0, 0.4),
      inset 0 0 50px rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
  }

  .vinyl-sheen {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    z-index: 5;
    pointer-events: none;
    background: linear-gradient(
      135deg,
      transparent 30%,
      rgba(255, 255, 255, 0.03) 45%,
      rgba(255, 255, 255, 0.06) 50%,
      rgba(255, 255, 255, 0.03) 55%,
      transparent 70%
    );
  }

  .groove {
    position: absolute;
    border-radius: 50%;
    box-shadow:
      inset 0 0.5px 0 rgba(255, 255, 255, 0.05),
      inset 0 -0.5px 0 rgba(0, 0, 0, 0.35);
  }

  .label {
    width: 86px;
    height: 86px;
    border-radius: 50%;
    background: radial-gradient(circle at 40% 38%, #2e2416, #1e1810);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    box-shadow:
      0 1px 6px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(255, 200, 100, 0.04);
  }

  .label-inner {
    width: 74px;
    height: 74px;
    border-radius: 50%;
    border: 1px solid rgba(212, 175, 55, 0.18);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
  }

  .label-title {
    font-family: 'Cinzel', serif;
    font-size: 9px;
    font-weight: 700;
    color: #d4af37;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }
  .label-divider {
    width: 28px;
    height: 1px;
    background: rgba(212, 175, 55, 0.25);
  }
  .label-subtitle {
    font-family: 'Cinzel', serif;
    font-size: 7px;
    color: rgba(212, 175, 55, 0.7);
    letter-spacing: 0.25em;
  }

  .spindle {
    position: absolute;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    z-index: 20;
    background: radial-gradient(circle at 40% 35%, #e0c870, #b89830);
    box-shadow: 0 0 4px rgba(212, 175, 55, 0.3);
  }

  .tonearm {
    position: absolute;
    top: 48px;
    right: 125px;
    z-index: 30;
    transform-origin: 25px 12px;
    filter: drop-shadow(2px 3px 4px rgba(0, 0, 0, 0.6));
  }

  .controls {
    position: absolute;
    bottom: 18px;
    right: 20px;
    display: flex;
    align-items: flex-end;
    gap: 18px;
    z-index: 2;
  }

  .control-unit {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
  }
  .control-label {
    font-family: 'Cinzel', serif;
    font-size: 7px;
    color: rgba(212, 175, 55, 0.35);
    letter-spacing: 0.15em;
  }

  .control-track {
    width: 28px;
    height: 80px;
    background: linear-gradient(180deg, #0c0a07, #0e0b08, #0c0a07);
    border: 1px solid rgba(60, 42, 22, 0.4);
    border-radius: 4px;
    cursor: pointer;
    position: relative;
    touch-action: none;
    box-shadow:
      inset 0 2px 6px rgba(0, 0, 0, 0.7),
      0 1px 0 rgba(100, 70, 35, 0.06);
  }

  .track-groove {
    position: absolute;
    top: 8px;
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);
    width: 3px;
    border-radius: 2px;
    background: linear-gradient(180deg, rgba(212, 175, 55, 0.15), rgba(60, 42, 22, 0.2));
  }

  .power-track {
    height: 40px;
  }

  .track-lever {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: 16px;
    height: 8px;
    border-radius: 1.5px;
    background: linear-gradient(180deg, #d0c8b8, #b0a898, #908878);
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.6),
      inset 0 1px 0 rgba(255, 255, 255, 0.12);
  }
</style>
