import { useParams } from "@tanstack/react-router";
import { useLeagueClock } from "../../hooks/use-league-clock.ts";
import type { LeaguePhase } from "../../types/league-phase.ts";
import { StubPage } from "./stub-page.tsx";

type PhaseView = { title: string; description: string };

const PHASE_VIEWS: Partial<Record<LeaguePhase, PhaseView>> = {
  genesis_charter: {
    title: "Charter",
    description:
      "Set the league's founding rules — name, scoring, and roster shape.",
  },
  genesis_franchise_establishment: {
    title: "Franchise Establishment",
    description:
      "The eight founding franchises take the field. Claim yours and meet your rivals.",
  },
  genesis_staff_hiring: {
    title: "Staff Hiring",
    description:
      "Hire the head coaches and scouts who will shape your franchise's first season.",
  },
  genesis_founding_pool: {
    title: "Founding Pool",
    description:
      "Review the founding player pool — the talent that will feed the allocation draft.",
  },
  genesis_allocation_draft: {
    title: "Allocation Draft",
    description:
      "Build your founding roster, pick by pick, from the founding player pool.",
  },
  genesis_free_agency: {
    title: "Founding Free Agency",
    description:
      "Round out your roster from the unsigned founding pool before the league kicks off.",
  },
  genesis_kickoff: {
    title: "Kickoff",
    description: "Final league checks before the inaugural season begins.",
  },
};

const FALLBACK: PhaseView = {
  title: "League Home",
  description:
    "Your league at a glance — standings, news, and what needs your attention.",
};

export function LeagueHome() {
  const { leagueId } = useParams({ strict: false });
  const { data: clock } = useLeagueClock(leagueId ?? "");
  const phase = clock?.phase as LeaguePhase | undefined;
  const view = (phase && PHASE_VIEWS[phase]) ?? FALLBACK;

  return <StubPage title={view.title} description={view.description} />;
}
