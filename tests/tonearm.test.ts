import { describe, it, expect } from 'vitest';
import { progressToAngle, angleToProgress, TIP_OFFSET } from '$lib/tonearm';

describe('progressToAngle', () => {
  it('returns outer edge angle at progress 0', () => {
    const angle = progressToAngle(0);
    expect(angle).toBeCloseTo(4, 0);
  });

  it('returns inner edge angle at progress 1', () => {
    const angle = progressToAngle(1);
    expect(angle).toBeCloseTo(34, 0);
  });

  it('is monotonically increasing (outer to inner)', () => {
    const steps = 20;
    let prev = progressToAngle(0);
    for (let i = 1; i <= steps; i++) {
      const curr = progressToAngle(i / steps);
      expect(curr).toBeGreaterThan(prev);
      prev = curr;
    }
  });

  it('mid-progress angle is between outer and inner', () => {
    const outer = progressToAngle(0);
    const inner = progressToAngle(1);
    const mid = progressToAngle(0.5);
    expect(mid).toBeGreaterThan(outer);
    expect(mid).toBeLessThan(inner);
  });

  it('clamps cosAlpha to [-1, 1] for out-of-range input', () => {
    expect(() => progressToAngle(-0.5)).not.toThrow();
    expect(() => progressToAngle(1.5)).not.toThrow();
  });
});

describe('angleToProgress', () => {
  it('returns 0 at outer edge angle', () => {
    const outerAngle = progressToAngle(0);
    expect(angleToProgress(outerAngle)).toBeCloseTo(0, 2);
  });

  it('returns 1 at inner edge angle', () => {
    const innerAngle = progressToAngle(1);
    expect(angleToProgress(innerAngle)).toBeCloseTo(1, 2);
  });

  it('clamps to [0, 1] for out-of-range angles', () => {
    const result1 = angleToProgress(-50);
    const result2 = angleToProgress(90);
    expect(result1).toBeGreaterThanOrEqual(0);
    expect(result1).toBeLessThanOrEqual(1);
    expect(result2).toBeGreaterThanOrEqual(0);
    expect(result2).toBeLessThanOrEqual(1);
  });
});

describe('progressToAngle and angleToProgress roundtrip', () => {
  it('angleToProgress(progressToAngle(p)) ≈ p', () => {
    for (const p of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      const angle = progressToAngle(p);
      const recovered = angleToProgress(angle);
      expect(recovered).toBeCloseTo(p, 3);
    }
  });

  it('progressToAngle(angleToProgress(θ)) ≈ θ for valid angles', () => {
    const outer = progressToAngle(0);
    const inner = progressToAngle(1);
    for (const theta of [outer, (outer + inner) / 2, inner]) {
      const progress = angleToProgress(theta);
      const recovered = progressToAngle(progress);
      expect(recovered).toBeCloseTo(theta, 3);
    }
  });
});

describe('non-linear groove model', () => {
  it('arm moves slower at outer edge (larger radius = more time)', () => {
    // First 10% of progress should cover less angle than last 10%
    const angleAt0 = progressToAngle(0);
    const angleAt10 = progressToAngle(0.1);
    const angleAt90 = progressToAngle(0.9);
    const angleAt100 = progressToAngle(1);

    const outerDelta = angleAt10 - angleAt0;
    const innerDelta = angleAt100 - angleAt90;
    expect(innerDelta).toBeGreaterThan(outerDelta);
  });
});

describe('TIP_OFFSET', () => {
  it('is a small positive number', () => {
    expect(TIP_OFFSET).toBeGreaterThan(0);
    expect(TIP_OFFSET).toBeLessThan(10);
  });
});
