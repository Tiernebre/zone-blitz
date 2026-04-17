import type { NeutralBucket } from "@zone-blitz/shared";

/**
 * Per-bucket active-age weight tables sourced from
 * `data/bands/career-length.json` (field `p_active_by_age`). The values
 * are fraction of the age-22 cohort still on an NFL roster at each
 * older age — a cohort survival curve. Used as sampling weights they
 * reproduce the population's age distribution: modal age 23–24 across
 * most buckets, with bucket-specific tails (RB/CB cliff at 28, OL
 * plateau into mid-30s, QB long tail past 36, specialists effectively
 * indefinite). We extend the curve downward to age 21 with a small
 * weight — rare but real for early-declaring draftees — and upward
 * past the raw data for specialists whose real-world careers run past
 * age 40 (K/P/LS retirement p90 is 38).
 */

interface RawCurve {
  /** age → raw relative weight (p_active from real data). */
  ageWeights: Readonly<Record<number, number>>;
  /** Relative weight for age 21 (not covered by the age-22 cohort). */
  age21Weight: number;
}

const NON_SPECIALIST_AGE_21_WEIGHT = 0.3;
const SPECIALIST_AGE_21_WEIGHT = 0.05;

const QB_CURVE: Readonly<Record<number, number>> = {
  22: 1,
  23: 0.8454,
  24: 0.7835,
  25: 0.6495,
  26: 0.5155,
  27: 0.4845,
  28: 0.3814,
  29: 0.299,
  30: 0.2371,
  31: 0.1856,
  32: 0.1443,
  33: 0.1134,
  34: 0.0825,
  35: 0.0825,
  36: 0.0515,
  37: 0.0309,
  38: 0.0309,
  39: 0.0103,
  40: 0.0103,
};

const RB_CURVE: Readonly<Record<number, number>> = {
  22: 1,
  23: 0.7839,
  24: 0.6734,
  25: 0.5251,
  26: 0.4271,
  27: 0.2864,
  28: 0.206,
  29: 0.1482,
  30: 0.0879,
  31: 0.0503,
  32: 0.0226,
  33: 0.0176,
  34: 0.0101,
  35: 0.0075,
  36: 0.0075,
};

const WR_CURVE: Readonly<Record<number, number>> = {
  22: 1,
  23: 0.7875,
  24: 0.6638,
  25: 0.5436,
  26: 0.4251,
  27: 0.3293,
  28: 0.2282,
  29: 0.1603,
  30: 0.1028,
  31: 0.0732,
  32: 0.0401,
  33: 0.0209,
  34: 0.0122,
  35: 0.007,
  36: 0.0035,
};

const TE_CURVE: Readonly<Record<number, number>> = {
  22: 1,
  23: 0.8466,
  24: 0.7354,
  25: 0.6085,
  26: 0.4815,
  27: 0.381,
  28: 0.291,
  29: 0.1905,
  30: 0.127,
  31: 0.0741,
  32: 0.0582,
  33: 0.037,
  34: 0.0265,
  35: 0.0212,
  36: 0.0106,
};

const OL_CURVE: Readonly<Record<number, number>> = {
  22: 1,
  23: 0.8345,
  24: 0.7324,
  25: 0.6349,
  26: 0.5125,
  27: 0.3991,
  28: 0.2925,
  29: 0.2132,
  30: 0.1655,
  31: 0.1066,
  32: 0.0567,
  33: 0.0317,
  34: 0.0159,
  35: 0.0068,
  36: 0.0023,
};

const EDGE_CURVE: Readonly<Record<number, number>> = {
  22: 1,
  23: 0.6906,
  24: 0.518,
  25: 0.3669,
  26: 0.2518,
  27: 0.1871,
  28: 0.1295,
  29: 0.0863,
  30: 0.0576,
  31: 0.036,
  32: 0.0144,
  // Empirical retirement p90 for EDGE reaches age 32 — pad the tail a
  // little past the raw cohort endpoint so the occasional 33-34 year
  // old outlier can occur.
  33: 0.007,
  34: 0.003,
};

const IDL_CURVE: Readonly<Record<number, number>> = {
  22: 1,
  23: 0.7879,
  24: 0.6616,
  25: 0.5429,
  26: 0.4318,
  27: 0.3232,
  28: 0.2677,
  29: 0.1995,
  30: 0.1212,
  31: 0.0606,
  32: 0.0379,
  33: 0.0152,
  34: 0.0152,
  35: 0.0101,
  36: 0.0025,
};

const LB_CURVE: Readonly<Record<number, number>> = {
  22: 1,
  23: 0.8073,
  24: 0.6744,
  25: 0.5665,
  26: 0.4451,
  27: 0.3468,
  28: 0.264,
  29: 0.1965,
  30: 0.1175,
  31: 0.0771,
  32: 0.0366,
  33: 0.0212,
  34: 0.0154,
  35: 0.0058,
  36: 0.0019,
};

const CB_CURVE: Readonly<Record<number, number>> = {
  22: 1,
  23: 0.8006,
  24: 0.6935,
  25: 0.5674,
  26: 0.4663,
  27: 0.3446,
  28: 0.2463,
  29: 0.1584,
  30: 0.1085,
  31: 0.0645,
  32: 0.0425,
  33: 0.0293,
  34: 0.0103,
  35: 0.0029,
};

const S_CURVE: Readonly<Record<number, number>> = {
  22: 1,
  23: 0.8092,
  24: 0.6489,
  25: 0.5038,
  26: 0.3664,
  27: 0.2748,
  28: 0.1527,
  29: 0.084,
  30: 0.0458,
  31: 0.0153,
  // Pad the tail — real safeties show up past 32 on retirement curves
  // even though this cohort's raw p_active drops off at 31.
  32: 0.008,
  33: 0.004,
};

const K_CURVE: Readonly<Record<number, number>> = {
  22: 1,
  23: 0.7805,
  24: 0.6829,
  25: 0.6098,
  26: 0.5854,
  27: 0.561,
  28: 0.5122,
  29: 0.4146,
  30: 0.3415,
  31: 0.2439,
  32: 0.2195,
  33: 0.1707,
  34: 0.1707,
  35: 0.1463,
  36: 0.122,
  37: 0.0976,
  38: 0.0732,
  39: 0.0488,
  40: 0.025,
  41: 0.02,
  42: 0.015,
  43: 0.01,
  44: 0.005,
};

const P_CURVE: Readonly<Record<number, number>> = {
  22: 1,
  23: 0.875,
  24: 0.8333,
  25: 0.75,
  26: 0.6667,
  27: 0.5417,
  28: 0.375,
  29: 0.25,
  30: 0.1667,
  31: 0.125,
  32: 0.0833,
  33: 0.0833,
  34: 0.0833,
  35: 0.0417,
  36: 0.0417,
  37: 0.03,
  38: 0.02,
  39: 0.015,
  40: 0.01,
};

const LS_CURVE: Readonly<Record<number, number>> = {
  22: 1,
  23: 0.8889,
  24: 0.6667,
  25: 0.5556,
  26: 0.5556,
  27: 0.5556,
  28: 0.5556,
  29: 0.5556,
  30: 0.4444,
  31: 0.3333,
  32: 0.2222,
  33: 0.1111,
  34: 0.1111,
  35: 0.08,
  36: 0.06,
  37: 0.05,
  38: 0.04,
  39: 0.02,
};

const RAW_CURVES: Record<NeutralBucket, RawCurve> = {
  QB: { ageWeights: QB_CURVE, age21Weight: NON_SPECIALIST_AGE_21_WEIGHT },
  RB: { ageWeights: RB_CURVE, age21Weight: NON_SPECIALIST_AGE_21_WEIGHT },
  WR: { ageWeights: WR_CURVE, age21Weight: NON_SPECIALIST_AGE_21_WEIGHT },
  TE: { ageWeights: TE_CURVE, age21Weight: NON_SPECIALIST_AGE_21_WEIGHT },
  OT: { ageWeights: OL_CURVE, age21Weight: NON_SPECIALIST_AGE_21_WEIGHT },
  IOL: { ageWeights: OL_CURVE, age21Weight: NON_SPECIALIST_AGE_21_WEIGHT },
  EDGE: { ageWeights: EDGE_CURVE, age21Weight: NON_SPECIALIST_AGE_21_WEIGHT },
  IDL: { ageWeights: IDL_CURVE, age21Weight: NON_SPECIALIST_AGE_21_WEIGHT },
  LB: { ageWeights: LB_CURVE, age21Weight: NON_SPECIALIST_AGE_21_WEIGHT },
  CB: { ageWeights: CB_CURVE, age21Weight: NON_SPECIALIST_AGE_21_WEIGHT },
  S: { ageWeights: S_CURVE, age21Weight: NON_SPECIALIST_AGE_21_WEIGHT },
  K: { ageWeights: K_CURVE, age21Weight: SPECIALIST_AGE_21_WEIGHT },
  P: { ageWeights: P_CURVE, age21Weight: SPECIALIST_AGE_21_WEIGHT },
  LS: { ageWeights: LS_CURVE, age21Weight: SPECIALIST_AGE_21_WEIGHT },
};

export interface BucketAgeCurve {
  readonly ages: readonly number[];
  readonly weights: readonly number[];
  readonly cumulative: readonly number[];
  readonly totalWeight: number;
}

export interface BucketAgePrior {
  readonly meanAge: number;
  readonly p50Age: number;
  readonly p90Age: number;
}

function buildCurve(raw: RawCurve): BucketAgeCurve {
  const entries: Array<{ age: number; weight: number }> = [
    { age: 21, weight: raw.age21Weight },
  ];
  for (const [ageKey, weight] of Object.entries(raw.ageWeights)) {
    entries.push({ age: Number(ageKey), weight });
  }
  entries.sort((a, b) => a.age - b.age);
  const ages = entries.map((e) => e.age);
  const weights = entries.map((e) => e.weight);
  const cumulative: number[] = [];
  let running = 0;
  for (const w of weights) {
    running += w;
    cumulative.push(running);
  }
  return {
    ages,
    weights,
    cumulative,
    totalWeight: running,
  };
}

function buildPrior(curve: BucketAgeCurve): BucketAgePrior {
  const total = curve.totalWeight;
  let weightedSum = 0;
  for (let i = 0; i < curve.ages.length; i++) {
    weightedSum += curve.ages[i] * curve.weights[i];
  }
  const meanAge = weightedSum / total;
  const percentileAge = (p: number): number => {
    const target = (p / 100) * total;
    for (let i = 0; i < curve.cumulative.length; i++) {
      if (curve.cumulative[i] >= target) return curve.ages[i];
    }
    return curve.ages[curve.ages.length - 1];
  };
  return {
    meanAge,
    p50Age: percentileAge(50),
    p90Age: percentileAge(90),
  };
}

const entries = Object.entries(RAW_CURVES) as Array<[NeutralBucket, RawCurve]>;

export const BUCKET_AGE_CURVES: Record<NeutralBucket, BucketAgeCurve> = Object
  .fromEntries(
    entries.map(([bucket, raw]) => [bucket, buildCurve(raw)]),
  ) as Record<NeutralBucket, BucketAgeCurve>;

export const AGE_CURVE_PRIORS: Record<NeutralBucket, BucketAgePrior> = Object
  .fromEntries(
    entries.map((
      [bucket],
    ) => [bucket, buildPrior(BUCKET_AGE_CURVES[bucket])]),
  ) as Record<NeutralBucket, BucketAgePrior>;

/**
 * Weighted-sample an age for a player in the given neutral bucket using
 * a cohort survival curve derived from real NFL rosters (2005–2024).
 * Cumulative-binary-search over the precomputed CDF keeps the per-call
 * cost constant — important because the generator rolls thousands of
 * ages per league.
 */
export function sampleBucketAge(
  random: () => number,
  bucket: NeutralBucket,
): number {
  const curve = BUCKET_AGE_CURVES[bucket];
  const target = random() * curve.totalWeight;
  let lo = 0;
  let hi = curve.cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (curve.cumulative[mid] >= target) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return curve.ages[lo];
}
