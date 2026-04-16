import { useParams } from "@tanstack/react-router";
import { useLeagueClock } from "../../hooks/use-league-clock.ts";
import type { LeaguePhase } from "../../types/league-phase.ts";
import { StubPage } from "./stub-page.tsx";

type PhaseView = { title: string; description: string };

const PHASE_VIEWS: Partial<Record<LeaguePhase, PhaseView>> = {
  initial_pool: {
    title: "Initial Pool",
    description:
      "Review the initial player pool — the talent that will feed the allocation draft.",
  },
  initial_draft: {
    title: "Allocation Draft",
    description:
      "Build your initial roster, pick by pick, from the initial player pool.",
  },
  initial_free_agency: {
    title: "Initial Free Agency",
    description:
      "Round out your roster from the unsigned initial pool before the league kicks off.",
  },
  initial_kickoff: {
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
