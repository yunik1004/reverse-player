// Tonearm geometry constants
// Pivot at turntable coords (350, 60), platter center (198, 192)
const R_OUTER = 142; // platter outer edge radius
const R_INNER = 43; // label radius
const PIVOT_DIST = 201; // pivot to platter center distance
const ARM_LEN = 192; // effective tonearm length
const GAMMA = 46.3; // pivot-to-center direction angle (degrees)

export const TIP_OFFSET = 2.87; // headshell bent offset in degrees

const R_OUTER_SQ = R_OUTER * R_OUTER;
const R_INNER_SQ = R_INNER * R_INNER;
const R_RANGE_SQ = R_OUTER_SQ - R_INNER_SQ;
const D_SQ = PIVOT_DIST * PIVOT_DIST;
const L_SQ = ARM_LEN * ARM_LEN;
const TWO_DL = 2 * PIVOT_DIST * ARM_LEN;
const D_SQ_PLUS_L_SQ = D_SQ + L_SQ;

/** Convert playback progress [0,1] to tonearm angle (degrees) */
export function progressToAngle(p: number): number {
  const rSq = R_OUTER_SQ - p * R_RANGE_SQ;
  const cosAlpha = (D_SQ_PLUS_L_SQ - rSq) / TWO_DL;
  const alpha = (Math.acos(Math.max(-1, Math.min(1, cosAlpha))) * 180) / Math.PI;
  return GAMMA - alpha;
}

/** Convert tonearm angle (degrees) to playback progress [0,1] */
export function angleToProgress(theta: number): number {
  const alphaRad = ((GAMMA - theta) * Math.PI) / 180;
  const rSq = D_SQ_PLUS_L_SQ - TWO_DL * Math.cos(alphaRad);
  return Math.max(0, Math.min(1, (R_OUTER_SQ - rSq) / R_RANGE_SQ));
}
