import {
  DEFENSIVE_BUCKETS,
  type DefensiveTendencies,
  type NeutralBucket,
  OFFENSIVE_BUCKETS,
  type OffensiveTendencies,
  type PlayerAttributes,
  type SchemeFingerprint,
  type SchemeLensResult,
  SPECIALIST_BUCKETS,
} from "@zone-blitz/shared";

export interface PlayerForLens {
  neutralBucket: NeutralBucket;
  attributes: PlayerAttributes;
}

function isLow(value: number): boolean {
  return value < 40;
}

function isHigh(value: number): boolean {
  return value > 60;
}

function mapQB(o: OffensiveTendencies): SchemeLensResult {
  if (isHigh(o.passingStyle) || isHigh(o.rpoIntegration)) {
    return "dual-threat QB";
  }
  if (isHigh(o.passingDepth)) return "gunslinger";
  return "pocket passer";
}

function mapRB(o: OffensiveTendencies): SchemeLensResult {
  if (isHigh(o.runPassLean)) return "receiving RB";
  if (isLow(o.runGameBlocking)) return "zone RB";
  if (isHigh(o.runGameBlocking)) return "power RB";
  return "zone RB";
}

function mapWR(o: OffensiveTendencies): SchemeLensResult {
  if (isHigh(o.passingDepth)) return "X receiver";
  if (isLow(o.passingDepth) && isHigh(o.preSnapMotionRate)) {
    return "slot receiver";
  }
  if (isLow(o.passingDepth)) return "possession receiver";
  return "possession receiver";
}

function mapTE(o: OffensiveTendencies): SchemeLensResult {
  if (isHigh(o.personnelWeight)) return "blocking TE";
  if (isLow(o.personnelWeight)) return "move TE";
  return "move TE";
}

function mapOT(o: OffensiveTendencies): SchemeLensResult {
  if (isLow(o.runGameBlocking)) return "zone OT";
  if (isHigh(o.runGameBlocking)) return "power OT";
  return "zone OT";
}

function mapIOL(o: OffensiveTendencies): SchemeLensResult {
  if (isLow(o.runGameBlocking)) return "zone guard";
  if (isHigh(o.runGameBlocking)) return "power guard";
  return "zone guard";
}

function mapEDGE(d: DefensiveTendencies): SchemeLensResult {
  if (isLow(d.frontOddEven)) return "stand-up OLB";
  if (isHigh(d.frontOddEven)) return "speed DE";
  return "speed DE";
}

function mapIDL(d: DefensiveTendencies): SchemeLensResult {
  if (isLow(d.frontOddEven)) return "nose tackle";
  if (isHigh(d.frontOddEven)) return "3-tech";
  return "3-tech";
}

function mapLB(d: DefensiveTendencies): SchemeLensResult {
  if (isHigh(d.subPackageLean)) return "coverage LB";
  if (isLow(d.subPackageLean)) return "run-stuff LB";
  return "run-stuff LB";
}

function mapCB(d: DefensiveTendencies): SchemeLensResult {
  if (
    isHigh(d.subPackageLean) && !isLow(d.coverageManZone) &&
    !isLow(d.cornerPressOff)
  ) {
    return "slot CB";
  }
  if (isLow(d.coverageManZone) || isLow(d.cornerPressOff)) {
    return "press-man CB";
  }
  if (isHigh(d.coverageManZone) || isHigh(d.cornerPressOff)) return "zone CB";
  return "zone CB";
}

function mapS(d: DefensiveTendencies): SchemeLensResult {
  if (isLow(d.coverageShell)) return "box safety";
  if (isHigh(d.coverageShell)) return "free safety";
  return "free safety";
}

const OFFENSIVE_MAPPERS: Record<
  string,
  (o: OffensiveTendencies) => SchemeLensResult
> = {
  QB: mapQB,
  RB: mapRB,
  WR: mapWR,
  TE: mapTE,
  OT: mapOT,
  IOL: mapIOL,
};

const DEFENSIVE_MAPPERS: Record<
  string,
  (d: DefensiveTendencies) => SchemeLensResult
> = {
  EDGE: mapEDGE,
  IDL: mapIDL,
  LB: mapLB,
  CB: mapCB,
  S: mapS,
};

export function schemeLens(
  player: PlayerForLens,
  fingerprint: SchemeFingerprint,
): SchemeLensResult {
  if (
    SPECIALIST_BUCKETS.includes(
      player.neutralBucket as typeof SPECIALIST_BUCKETS[number],
    )
  ) {
    return null;
  }

  if (
    OFFENSIVE_BUCKETS.includes(
      player.neutralBucket as typeof OFFENSIVE_BUCKETS[number],
    )
  ) {
    if (!fingerprint.offense) return null;
    const mapper = OFFENSIVE_MAPPERS[player.neutralBucket];
    return mapper ? mapper(fingerprint.offense) : null;
  }

  if (
    DEFENSIVE_BUCKETS.includes(
      player.neutralBucket as typeof DEFENSIVE_BUCKETS[number],
    )
  ) {
    if (!fingerprint.defense) return null;
    const mapper = DEFENSIVE_MAPPERS[player.neutralBucket];
    return mapper ? mapper(fingerprint.defense) : null;
  }

  return null;
}
