import { DomainError } from "@zone-blitz/shared";
import type pino from "pino";
import type {
  HiringDecisionRow,
  HiringInterestRow,
  HiringInterviewRow,
  HiringOfferRow,
  HiringRepository,
  StaffType,
  UnassignedCandidate,
} from "./hiring.repository.ts";

export interface InterestTarget {
  staffType: StaffType;
  staffId: string;
}

export interface DraftOffer {
  staffType: StaffType;
  staffId: string;
  salary: number;
  contractYears: number;
  buyoutMultiplier: string;
  incentives?: unknown;
}

export interface HiringState {
  leagueId: string;
  interests: HiringInterestRow[];
  interviews: HiringInterviewRow[];
  offers: HiringOfferRow[];
  decisions: HiringDecisionRow[];
  unassignedCoaches: UnassignedCandidate[];
  unassignedScouts: UnassignedCandidate[];
}

export interface HiringService {
  openMarket(leagueId: string): Promise<void>;
  expressInterest(input: {
    leagueId: string;
    teamId: string;
    staffType: StaffType;
    staffId: string;
    stepSlug: string;
  }): Promise<HiringInterestRow>;
  requestInterviews(input: {
    leagueId: string;
    teamId: string;
    stepSlug: string;
    targets: InterestTarget[];
  }): Promise<HiringInterviewRow[]>;
  resolveInterviewDeclines(
    leagueId: string,
    stepSlug: string,
  ): Promise<HiringInterviewRow[]>;
  submitOffers(input: {
    leagueId: string;
    teamId: string;
    stepSlug: string;
    offers: DraftOffer[];
  }): Promise<HiringOfferRow[]>;
  resolveDecisions(
    leagueId: string,
    wave: number,
  ): Promise<HiringDecisionRow[]>;
  finalize(leagueId: string): Promise<HiringDecisionRow[]>;
  getHiringState(leagueId: string): Promise<HiringState>;
}

function notImplemented<T>(step: string): Promise<T> {
  return Promise.reject(
    new DomainError(
      "NOT_IMPLEMENTED",
      `Hiring step "${step}" is not yet implemented`,
    ),
  );
}

export function createHiringService(deps: {
  repo: HiringRepository;
  log: pino.Logger;
}): HiringService {
  const log = deps.log.child({ module: "hiring.service" });

  return {
    openMarket(_leagueId) {
      return notImplemented("openMarket");
    },

    expressInterest(_input) {
      return notImplemented("expressInterest");
    },

    requestInterviews(_input) {
      return notImplemented("requestInterviews");
    },

    resolveInterviewDeclines(_leagueId, _stepSlug) {
      return notImplemented("resolveInterviewDeclines");
    },

    submitOffers(_input) {
      return notImplemented("submitOffers");
    },

    resolveDecisions(_leagueId, _wave) {
      return notImplemented("resolveDecisions");
    },

    finalize(_leagueId) {
      return notImplemented("finalize");
    },

    async getHiringState(leagueId) {
      log.debug({ leagueId }, "fetching hiring state");
      const [
        interests,
        interviews,
        offers,
        decisions,
        unassignedCoaches,
        unassignedScouts,
      ] = await Promise.all([
        deps.repo.listInterestsByLeague(leagueId),
        deps.repo.listInterviewsByLeague(leagueId),
        deps.repo.listOffersByLeague(leagueId),
        deps.repo.listDecisionsByLeague(leagueId),
        deps.repo.listUnassignedCoaches(leagueId),
        deps.repo.listUnassignedScouts(leagueId),
      ]);
      return {
        leagueId,
        interests,
        interviews,
        offers,
        decisions,
        unassignedCoaches,
        unassignedScouts,
      };
    },
  };
}
