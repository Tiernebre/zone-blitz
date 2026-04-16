import type {
  DefensiveCall,
  OffensiveCall,
  PlayEvent,
  PlayOutcome,
  PlayParticipant,
  PlayTag,
} from "./events.ts";

export type BuildPlayEventArgs = {
  gameId: string;
  driveIndex: number;
  playIndex: number;
  quarter: 1 | 2 | 3 | 4 | "OT";
  clock: string;
  situation: { down: 1 | 2 | 3 | 4; distance: number; yardLine: number };
  offenseTeamId: string;
  defenseTeamId: string;
  call: OffensiveCall;
  coverage: DefensiveCall;
  outcome: PlayOutcome;
  yardage: number;
  tags?: PlayTag[];
  participants?: PlayParticipant[];
};

export function buildPlayEvent(args: BuildPlayEventArgs): PlayEvent {
  return {
    gameId: args.gameId,
    driveIndex: args.driveIndex,
    playIndex: args.playIndex,
    quarter: args.quarter,
    clock: args.clock,
    situation: args.situation,
    offenseTeamId: args.offenseTeamId,
    defenseTeamId: args.defenseTeamId,
    call: args.call,
    coverage: args.coverage,
    outcome: args.outcome,
    yardage: args.yardage,
    tags: args.tags ?? [],
    participants: args.participants ?? [],
  };
}
