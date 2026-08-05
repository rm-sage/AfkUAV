export type Needle = { width: number; height: number; data: Uint8ClampedArray };
export type MatchResult = { score: number; matched: number; comparable: number };

/** Below this many opaque pixels a template carries too little signal to trust. */
export const MIN_COMPARABLE_PIXELS = 24;

/** Fraction of a needle's own opaque pixels that must match to count as a hit. */
export const MATCH_THRESHOLD = 0.85;

/** Templates below this are surfaced to the user as degraded before they fail. */
export const LOW_COVERAGE_PIXELS = 60;

/** Per-channel tolerance. RS icons are alpha-blended, so exact equality is too strict. */
const CHANNEL_TOLERANCE = 24;

export function coverage(needle: Needle): number {
  let n = 0;
  for (let i = 3; i < needle.data.length; i += 4) {
    if (needle.data[i] === 255) n++;
  }
  return n;
}

export function isLowCoverage(needle: Needle): boolean {
  return coverage(needle) < LOW_COVERAGE_PIXELS;
}

/**
 * Score a candidate against a template as the FRACTION of the template's own
 * opaque pixels that match.
 *
 * The alt1 buffs library scores against an absolute floor:
 *
 *     if (bestscore < 50) { return null; }
 *     if (buffinfo.canimprove) { BuffReader.isolateBuffer(...); }
 *
 * ...while re-masking the template on every successful match. Since `isolateBuffer`
 * only ever removes pixels, that is a ratchet: templates decay monotonically toward
 * the 50-pixel floor and then begin failing intermittently, with no error and no way
 * back. Measured in the wild, a real Overload-timer template had eroded to 53 opaque
 * pixels -- three above the cliff.
 *
 * Scoring relatively removes half the problem: a sparse template is judged on what it
 * actually claims to know rather than on an absolute count it can never reach. Keeping
 * needles immutable removes the other half.
 */
export function scoreNeedle(needle: Needle, hay: Needle): MatchResult {
  if (needle.width !== hay.width || needle.height !== hay.height) {
    return { score: 0, matched: 0, comparable: 0 };
  }

  let matched = 0;
  let comparable = 0;

  for (let i = 0; i < needle.data.length; i += 4) {
    // Transparent template pixels are "don't care" -- that is how the mask encodes
    // which parts of the icon are stable.
    if (needle.data[i + 3] !== 255) continue;
    comparable++;

    if (
      Math.abs(needle.data[i]! - hay.data[i]!) <= CHANNEL_TOLERANCE &&
      Math.abs(needle.data[i + 1]! - hay.data[i + 1]!) <= CHANNEL_TOLERANCE &&
      Math.abs(needle.data[i + 2]! - hay.data[i + 2]!) <= CHANNEL_TOLERANCE
    ) {
      matched++;
    }
  }

  if (comparable < MIN_COMPARABLE_PIXELS) {
    return { score: 0, matched, comparable };
  }

  return { score: matched / comparable, matched, comparable };
}

/** Best-scoring candidate above threshold, or null. Never mutates the needle. */
export function bestMatch(needle: Needle, candidates: readonly Needle[]): { index: number; result: MatchResult } | null {
  let bestIndex = -1;
  let best: MatchResult = { score: 0, matched: 0, comparable: 0 };

  for (const [i, candidate] of candidates.entries()) {
    const r = scoreNeedle(needle, candidate);
    if (r.score > best.score) {
      best = r;
      bestIndex = i;
    }
  }

  if (bestIndex === -1 || best.score < MATCH_THRESHOLD) return null;
  return { index: bestIndex, result: best };
}
