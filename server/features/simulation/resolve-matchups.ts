import type { PlayerAttributes } from "@zone-blitz/shared";
import type { DefensiveCall, OffensiveCall } from "./events.ts";
import type { Matchup, PlayerRuntime } from "./resolve-play.ts";
import type { SeededRng } from "./rng.ts";

export type OffensiveRole =
  | "primary_route"
  | "secondary_route"
  | "check_down"
  | "ball_carrier"
  | "pass_protect"
  | "run_block";

export type DefensiveRole =
  | "man_shadow"
  | "zone_flat"
  | "zone_hook"
  | "zone_deep"
  | "pass_rush"
  | "gap_defend";

export interface OffensiveAssignment {
  player: PlayerRuntime;
  role: OffensiveRole;
}

export interface DefensiveAssignment {
  player: PlayerRuntime;
  role: DefensiveRole;
  manTarget?: string;
}

type RouteDepth = "short" | "medium" | "deep";

const RUN_CONCEPTS = new Set([
  "inside_zone",
  "outside_zone",
  "power",
  "counter",
  "draw",
]);
const MAN_COVERAGES = new Set(["cover_0", "cover_1"]);
const SHORT_CONCEPTS = new Set(["screen", "quick_pass"]);
const DEEP_CONCEPTS = new Set(["deep_shot"]);

const RANKING_ATTRS: Record<string, readonly (keyof PlayerAttributes)[]> = {
  receiver: ["routeRunning", "speed", "catching"],
  coverage: ["manCoverage", "zoneCoverage", "speed"],
  rushing: ["speed", "acceleration", "agility"],
  passRush: ["passRushing", "acceleration", "strength"],
  blocking: ["passBlocking", "runBlocking", "strength"],
  runDefense: ["blockShedding", "tackling", "runDefense"],
  safety: ["zoneCoverage", "speed", "tackling"],
};

export function rankPlayers(
  players: PlayerRuntime[],
  attrs: readonly (keyof PlayerAttributes)[],
): PlayerRuntime[] {
  return [...players].sort((a, b) => {
    const aScore = attrs.reduce((sum, k) => sum + (a.attributes[k] ?? 0), 0);
    const bScore = attrs.reduce((sum, k) => sum + (b.attributes[k] ?? 0), 0);
    return bScore - aScore;
  });
}

export function assignOffense(
  call: OffensiveCall,
  offenseOnField: PlayerRuntime[],
): OffensiveAssignment[] {
  const isRunPlay = RUN_CONCEPTS.has(call.concept);
  const assignments: OffensiveAssignment[] = [];

  const wrs = rankPlayers(
    offenseOnField.filter((p) => p.neutralBucket === "WR"),
    RANKING_ATTRS.receiver,
  );
  const tes = rankPlayers(
    offenseOnField.filter((p) => p.neutralBucket === "TE"),
    RANKING_ATTRS.receiver,
  );
  const rbs = rankPlayers(
    offenseOnField.filter((p) => p.neutralBucket === "RB"),
    RANKING_ATTRS.rushing,
  );
  const oLinemen = rankPlayers(
    offenseOnField.filter(
      (p) => p.neutralBucket === "OT" || p.neutralBucket === "IOL",
    ),
    RANKING_ATTRS.blocking,
  );

  if (isRunPlay) {
    if (rbs.length > 0) {
      assignments.push({ player: rbs[0], role: "ball_carrier" });
      for (let i = 1; i < rbs.length; i++) {
        assignments.push({ player: rbs[i], role: "run_block" });
      }
    }
    for (const ol of oLinemen) {
      assignments.push({ player: ol, role: "run_block" });
    }
    for (const te of tes) {
      assignments.push({ player: te, role: "run_block" });
    }
  } else {
    const routeRoles: OffensiveRole[] = [
      "primary_route",
      "secondary_route",
      "check_down",
    ];
    for (let i = 0; i < wrs.length; i++) {
      assignments.push({
        player: wrs[i],
        role: routeRoles[Math.min(i, routeRoles.length - 1)],
      });
    }
    for (const te of tes) {
      assignments.push({ player: te, role: "check_down" });
    }
    for (const rb of rbs) {
      assignments.push({ player: rb, role: "pass_protect" });
    }
    for (const ol of oLinemen) {
      assignments.push({ player: ol, role: "pass_protect" });
    }
  }

  return assignments;
}

export function assignDefense(
  coverage: DefensiveCall,
  defenseOnField: PlayerRuntime[],
  offensiveReceivers: PlayerRuntime[],
): DefensiveAssignment[] {
  const isManCoverage = MAN_COVERAGES.has(coverage.coverage);
  const isBlitz = coverage.pressure !== "four_man";
  const assignments: DefensiveAssignment[] = [];

  const cbs = rankPlayers(
    defenseOnField.filter((p) => p.neutralBucket === "CB"),
    RANKING_ATTRS.coverage,
  );
  const safeties = rankPlayers(
    defenseOnField.filter((p) => p.neutralBucket === "S"),
    RANKING_ATTRS.safety,
  );
  const edges = rankPlayers(
    defenseOnField.filter((p) => p.neutralBucket === "EDGE"),
    RANKING_ATTRS.passRush,
  );
  const idls = rankPlayers(
    defenseOnField.filter((p) => p.neutralBucket === "IDL"),
    RANKING_ATTRS.runDefense,
  );
  const lbs = rankPlayers(
    defenseOnField.filter((p) => p.neutralBucket === "LB"),
    RANKING_ATTRS.runDefense,
  );

  for (const edge of edges) {
    assignments.push({ player: edge, role: "pass_rush" });
  }
  for (const idl of idls) {
    assignments.push({ player: idl, role: "pass_rush" });
  }

  if (isManCoverage) {
    for (let i = 0; i < cbs.length; i++) {
      const target = offensiveReceivers[i];
      assignments.push({
        player: cbs[i],
        role: "man_shadow",
        manTarget: target?.playerId,
      });
    }
    for (let i = 0; i < safeties.length; i++) {
      const targetIdx = cbs.length + i;
      const target = offensiveReceivers[targetIdx];
      if (target) {
        assignments.push({
          player: safeties[i],
          role: "man_shadow",
          manTarget: target.playerId,
        });
      } else {
        assignments.push({ player: safeties[i], role: "zone_deep" });
      }
    }
  } else {
    assignZoneRoles(coverage.coverage, cbs, safeties, assignments);
  }

  if (isBlitz) {
    for (const lb of lbs) {
      assignments.push({ player: lb, role: "pass_rush" });
    }
  } else {
    for (const lb of lbs) {
      assignments.push({ player: lb, role: "zone_hook" });
    }
  }

  return assignments;
}

function assignZoneRoles(
  coverage: string,
  cbs: PlayerRuntime[],
  safeties: PlayerRuntime[],
  assignments: DefensiveAssignment[],
): void {
  switch (coverage) {
    case "cover_2":
      for (const cb of cbs) {
        assignments.push({ player: cb, role: "zone_flat" });
      }
      for (const s of safeties) {
        assignments.push({ player: s, role: "zone_deep" });
      }
      break;
    case "cover_3":
      for (const cb of cbs) {
        assignments.push({ player: cb, role: "zone_deep" });
      }
      if (safeties.length > 0) {
        assignments.push({ player: safeties[0], role: "zone_deep" });
      }
      if (safeties.length > 1) {
        assignments.push({ player: safeties[1], role: "zone_hook" });
      }
      break;
    case "cover_4":
      for (const cb of cbs) {
        assignments.push({ player: cb, role: "zone_deep" });
      }
      for (const s of safeties) {
        assignments.push({ player: s, role: "zone_deep" });
      }
      break;
    case "cover_6":
      if (cbs.length > 0) {
        assignments.push({ player: cbs[0], role: "zone_flat" });
      }
      if (cbs.length > 1) {
        assignments.push({ player: cbs[1], role: "zone_deep" });
      }
      for (const s of safeties) {
        assignments.push({ player: s, role: "zone_deep" });
      }
      break;
    default:
      for (const cb of cbs) {
        assignments.push({ player: cb, role: "zone_deep" });
      }
      for (const s of safeties) {
        assignments.push({ player: s, role: "zone_hook" });
      }
  }
}

function routeDepthFromConcept(concept: string): RouteDepth {
  if (SHORT_CONCEPTS.has(concept)) return "short";
  if (DEEP_CONCEPTS.has(concept)) return "deep";
  return "medium";
}

function receiverRouteDepth(
  concept: string,
  receiverIndex: number,
): RouteDepth {
  const baseDepth = routeDepthFromConcept(concept);
  if (receiverIndex === 0) return baseDepth;
  if (receiverIndex === 1) {
    if (baseDepth === "deep") return "medium";
    return "short";
  }
  return "short";
}

const ZONE_DEPTH_PRIORITY: Record<
  string,
  Record<RouteDepth, ("CB" | "S" | "LB")[]>
> = {
  cover_2: {
    short: ["CB", "LB", "S"],
    medium: ["LB", "CB", "S"],
    deep: ["S", "CB", "LB"],
  },
  cover_3: {
    short: ["LB", "S", "CB"],
    medium: ["LB", "S", "CB"],
    deep: ["CB", "S", "LB"],
  },
  cover_4: {
    short: ["LB", "CB", "S"],
    medium: ["LB", "CB", "S"],
    deep: ["CB", "S", "LB"],
  },
  cover_6: {
    short: ["CB", "LB", "S"],
    medium: ["LB", "CB", "S"],
    deep: ["S", "CB", "LB"],
  },
};

function pickUnused(
  players: PlayerRuntime[],
  used: Set<string>,
): PlayerRuntime | undefined {
  return players.find((p) => !used.has(p.playerId));
}

function resolveZoneRouteMatchups(
  receivers: PlayerRuntime[],
  cbs: PlayerRuntime[],
  safeties: PlayerRuntime[],
  lbs: PlayerRuntime[],
  concept: string,
  coverage: string,
  matchups: Matchup[],
): void {
  const usedDefenders = new Set<string>();
  const priorities = ZONE_DEPTH_PRIORITY[coverage] ??
    ZONE_DEPTH_PRIORITY["cover_3"];

  const positionGroups: Record<string, PlayerRuntime[]> = {
    CB: cbs,
    S: safeties,
    LB: lbs,
  };

  for (let i = 0; i < receivers.length; i++) {
    const depth = receiverRouteDepth(concept, i);
    const priority = priorities[depth];
    let defender: PlayerRuntime | undefined;

    for (const group of priority) {
      defender = pickUnused(positionGroups[group], usedDefenders);
      if (defender) break;
    }

    if (defender) {
      usedDefenders.add(defender.playerId);
      matchups.push({
        type: "route_coverage",
        attacker: receivers[i],
        defender,
      });
    }
  }
}

export function resolveMatchups(
  call: OffensiveCall,
  coverage: DefensiveCall,
  offenseOnField: PlayerRuntime[],
  defenseOnField: PlayerRuntime[],
  _rng: SeededRng,
): Matchup[] {
  const matchups: Matchup[] = [];
  const isRunPlay = RUN_CONCEPTS.has(call.concept);
  const isBlitz = coverage.pressure !== "four_man";
  const isManCoverage = MAN_COVERAGES.has(coverage.coverage);

  const wrs = rankPlayers(
    offenseOnField.filter((p) => p.neutralBucket === "WR"),
    RANKING_ATTRS.receiver,
  );
  const tes = rankPlayers(
    offenseOnField.filter((p) => p.neutralBucket === "TE"),
    RANKING_ATTRS.receiver,
  );
  const rbs = rankPlayers(
    offenseOnField.filter((p) => p.neutralBucket === "RB"),
    RANKING_ATTRS.rushing,
  );
  const oLinemen = rankPlayers(
    offenseOnField.filter(
      (p) => p.neutralBucket === "OT" || p.neutralBucket === "IOL",
    ),
    RANKING_ATTRS.blocking,
  );

  const edges = rankPlayers(
    defenseOnField.filter((p) => p.neutralBucket === "EDGE"),
    RANKING_ATTRS.passRush,
  );
  const idls = rankPlayers(
    defenseOnField.filter((p) => p.neutralBucket === "IDL"),
    RANKING_ATTRS.runDefense,
  );
  const lbs = rankPlayers(
    defenseOnField.filter((p) => p.neutralBucket === "LB"),
    RANKING_ATTRS.runDefense,
  );
  const cbs = rankPlayers(
    defenseOnField.filter((p) => p.neutralBucket === "CB"),
    RANKING_ATTRS.coverage,
  );
  const safeties = rankPlayers(
    defenseOnField.filter((p) => p.neutralBucket === "S"),
    RANKING_ATTRS.safety,
  );

  if (isRunPlay) {
    const runBlockers = [...oLinemen, ...tes, ...rbs];
    const runDefenders = [
      ...rankPlayers([...idls, ...edges], RANKING_ATTRS.runDefense),
      ...lbs,
    ];
    const pairCount = Math.min(runBlockers.length, runDefenders.length);
    for (let i = 0; i < pairCount; i++) {
      matchups.push({
        type: "run_block",
        attacker: runBlockers[i],
        defender: runDefenders[i],
      });
    }
  } else {
    const passRushers = rankPlayers(
      [...edges, ...idls],
      RANKING_ATTRS.passRush,
    );
    const protectionPairs = Math.min(oLinemen.length, passRushers.length);
    for (let i = 0; i < protectionPairs; i++) {
      matchups.push({
        type: "pass_protection",
        attacker: oLinemen[i],
        defender: passRushers[i],
      });
    }

    if (isBlitz) {
      const blitzPairs = Math.min(lbs.length, rbs.length);
      for (let i = 0; i < blitzPairs; i++) {
        matchups.push({
          type: "pass_rush",
          attacker: lbs[i],
          defender: rbs[i],
        });
      }
    }

    const receivers = [...wrs, ...tes];

    if (isManCoverage) {
      const manDefenders = [...cbs, ...safeties];
      const routePairs = Math.min(receivers.length, manDefenders.length);
      for (let i = 0; i < routePairs; i++) {
        matchups.push({
          type: "route_coverage",
          attacker: receivers[i],
          defender: manDefenders[i],
        });
      }
    } else {
      const zoneLbs = isBlitz ? [] : lbs;
      resolveZoneRouteMatchups(
        receivers,
        cbs,
        safeties,
        zoneLbs,
        call.concept,
        coverage.coverage,
        matchups,
      );
    }
  }

  return matchups;
}
