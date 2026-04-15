import type {
  BoxScore,
  DriveResult,
  DriveSummary,
  InjuryEntry,
  InjurySeverity,
  PlayEvent,
  TeamBoxScore,
} from "./events.ts";

const INJURY_SEVERITY_PREFIX = "injury_";

const INJURY_SEVERITIES: InjurySeverity[] = [
  "shake_off",
  "miss_drive",
  "miss_quarter",
  "miss_game",
  "miss_weeks",
  "miss_season",
  "career_ending",
];

function makeEmptyTeamBoxScore(): TeamBoxScore {
  return {
    totalYards: 0,
    passingYards: 0,
    rushingYards: 0,
    turnovers: 0,
    sacks: 0,
    penalties: 0,
  };
}

export function deriveBoxScore(
  events: PlayEvent[],
  homeTeamId: string,
  _awayTeamId: string,
): BoxScore {
  const box: BoxScore = {
    home: makeEmptyTeamBoxScore(),
    away: makeEmptyTeamBoxScore(),
  };

  for (const event of events) {
    if (event.outcome === "kickoff") continue;

    const isHome = event.offenseTeamId === homeTeamId;
    const offenseBox = isHome ? box.home : box.away;
    const defenseBox = isHome ? box.away : box.home;

    if (
      event.outcome === "xp" || event.outcome === "two_point"
    ) {
      continue;
    }

    if (event.outcome === "pass_complete") {
      offenseBox.passingYards += event.yardage;
      offenseBox.totalYards += event.yardage;
    } else if (event.outcome === "rush") {
      offenseBox.rushingYards += event.yardage;
      offenseBox.totalYards += event.yardage;
    } else if (event.outcome === "sack") {
      offenseBox.passingYards += event.yardage;
      offenseBox.totalYards += event.yardage;
    } else if (event.outcome === "touchdown") {
      offenseBox.totalYards += event.yardage;
    }

    if (event.tags.includes("turnover")) {
      offenseBox.turnovers++;
    }
    if (event.tags.includes("sack")) {
      defenseBox.sacks++;
    }
    if (event.tags.includes("penalty")) {
      offenseBox.penalties++;
    }
  }

  return box;
}

function inferDriveResult(lastEvent: PlayEvent): DriveResult {
  if (lastEvent.outcome === "touchdown") return "touchdown";
  if (lastEvent.tags.includes("safety")) return "safety";
  if (lastEvent.tags.includes("turnover")) return "turnover";
  if (lastEvent.outcome === "missed_field_goal") return "missed_field_goal";
  if (
    lastEvent.outcome === "field_goal" ||
    lastEvent.call.concept === "field_goal"
  ) {
    return "field_goal";
  }
  if (lastEvent.outcome === "punt") return "punt";
  return "end_of_half";
}

export function deriveDriveLog(events: PlayEvent[]): DriveSummary[] {
  if (events.length === 0) return [];

  const driveMap = new Map<number, PlayEvent[]>();
  for (const event of events) {
    if (event.outcome === "kickoff") continue;
    const list = driveMap.get(event.driveIndex);
    if (list) {
      list.push(event);
    } else {
      driveMap.set(event.driveIndex, [event]);
    }
  }

  const drives: DriveSummary[] = [];
  for (const [driveIndex, driveEvents] of driveMap) {
    const first = driveEvents[0];
    const last = driveEvents[driveEvents.length - 1];
    let yards = 0;
    for (const e of driveEvents) {
      yards += e.yardage;
    }

    drives.push({
      driveIndex,
      offenseTeamId: first.offenseTeamId,
      startYardLine: first.situation.yardLine,
      plays: driveEvents.length,
      yards,
      result: inferDriveResult(last),
    });
  }

  return drives;
}

export function deriveInjuryReport(events: PlayEvent[]): InjuryEntry[] {
  const report: InjuryEntry[] = [];

  for (const event of events) {
    if (!event.tags.includes("injury")) continue;

    const severityTag = event.tags.find(
      (t) => t.startsWith(INJURY_SEVERITY_PREFIX) && t !== "injury",
    );
    if (!severityTag) continue;

    const severity = severityTag.slice(INJURY_SEVERITY_PREFIX.length) as string;
    if (!INJURY_SEVERITIES.includes(severity as InjurySeverity)) continue;

    const injuredParticipant = event.participants.find((p) =>
      p.tags.includes("injury")
    );
    if (!injuredParticipant) continue;

    report.push({
      playerId: injuredParticipant.playerId,
      playIndex: event.playIndex,
      driveIndex: event.driveIndex,
      quarter: event.quarter,
      severity: severity as InjurySeverity,
    });
  }

  return report;
}
