import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
} from "@tanstack/react-router";
import { authClient } from "./lib/auth-client.ts";
import { LoginPage } from "./features/login/index.tsx";
import { LeagueSelect } from "./features/league-select/index.tsx";
import { CreateLeague } from "./features/create-league/index.tsx";
import { LeagueLayout } from "./features/league/layout.tsx";
import { LeagueHome } from "./features/league/index.tsx";
import { LeagueSettings } from "./features/league/settings.tsx";
import { Roster } from "./features/league/roster.tsx";
import { Coaches } from "./features/league/coaches/index.tsx";
import { CoachDetail } from "./features/league/coaches/detail.tsx";
import { Scouts } from "./features/league/scouts/index.tsx";
import { ScoutDetail } from "./features/league/scouts/detail.tsx";
import { Opponents } from "./features/league/opponents/index.tsx";
import { OpponentRoster } from "./features/league/opponents/detail.tsx";
import { PlayerDetail } from "./features/league/players/detail.tsx";
import { Draft } from "./features/league/draft.tsx";
import { Trades } from "./features/league/trades.tsx";
import { FreeAgency } from "./features/league/free-agency.tsx";
import { SalaryCap } from "./features/league/salary-cap.tsx";
import { Standings } from "./features/league/standings.tsx";
import { Schedule } from "./features/league/schedule.tsx";
import { Media } from "./features/league/media.tsx";
import { Hiring } from "./features/league/hiring/index.tsx";
import { CandidateDetail } from "./features/league/hiring/candidate-detail.tsx";
import { TeamSelect } from "./features/team-select/index.tsx";
import { Generate } from "./features/generate/index.tsx";

const rootRoute = createRootRoute();

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "login",
  component: LoginPage,
});

function AuthenticatedLayout() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" />;
  }

  return <Outlet />;
}

const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "authenticated",
  component: AuthenticatedLayout,
});

const leagueSelectRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/",
  component: LeagueSelect,
});

const createLeagueRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "leagues/new",
  component: CreateLeague,
});

const teamSelectRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "leagues/$leagueId/team-select",
  component: TeamSelect,
});

const generateRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "leagues/$leagueId/generate",
  component: Generate,
});

const leagueLayoutRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "leagues/$leagueId",
  component: LeagueLayout,
});

const leagueHomeRoute = createRoute({
  getParentRoute: () => leagueLayoutRoute,
  path: "/",
  component: LeagueHome,
});

const leagueSettingsRoute = createRoute({
  getParentRoute: () => leagueLayoutRoute,
  path: "settings",
  component: LeagueSettings,
});

const rosterRoute = createRoute({
  getParentRoute: () => leagueLayoutRoute,
  path: "roster",
  component: Roster,
});

const coachesRoute = createRoute({
  getParentRoute: () => leagueLayoutRoute,
  path: "coaches",
  component: Coaches,
});

const coachDetailRoute = createRoute({
  getParentRoute: () => leagueLayoutRoute,
  path: "coaches/$coachId",
  component: CoachDetail,
});

const scoutsRoute = createRoute({
  getParentRoute: () => leagueLayoutRoute,
  path: "scouts",
  component: Scouts,
});

const scoutDetailRoute = createRoute({
  getParentRoute: () => leagueLayoutRoute,
  path: "scouts/$scoutId",
  component: ScoutDetail,
});

const draftRoute = createRoute({
  getParentRoute: () => leagueLayoutRoute,
  path: "draft",
  component: Draft,
});

const tradesRoute = createRoute({
  getParentRoute: () => leagueLayoutRoute,
  path: "trades",
  component: Trades,
});

const freeAgencyRoute = createRoute({
  getParentRoute: () => leagueLayoutRoute,
  path: "free-agency",
  component: FreeAgency,
});

const salaryCapRoute = createRoute({
  getParentRoute: () => leagueLayoutRoute,
  path: "salary-cap",
  component: SalaryCap,
});

const standingsRoute = createRoute({
  getParentRoute: () => leagueLayoutRoute,
  path: "standings",
  component: Standings,
});

const scheduleRoute = createRoute({
  getParentRoute: () => leagueLayoutRoute,
  path: "schedule",
  component: Schedule,
});

const mediaRoute = createRoute({
  getParentRoute: () => leagueLayoutRoute,
  path: "media",
  component: Media,
});

const hiringRoute = createRoute({
  getParentRoute: () => leagueLayoutRoute,
  path: "hiring",
  component: Hiring,
});

const candidateDetailRoute = createRoute({
  getParentRoute: () => leagueLayoutRoute,
  path: "hiring/$candidateId",
  component: CandidateDetail,
});

const opponentsRoute = createRoute({
  getParentRoute: () => leagueLayoutRoute,
  path: "opponents",
  component: Opponents,
});

const opponentDetailRoute = createRoute({
  getParentRoute: () => leagueLayoutRoute,
  path: "opponents/$teamId",
  component: OpponentRoster,
});

const playerDetailRoute = createRoute({
  getParentRoute: () => leagueLayoutRoute,
  path: "players/$playerId",
  component: PlayerDetail,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  authenticatedRoute.addChildren([
    leagueSelectRoute,
    createLeagueRoute,
    teamSelectRoute,
    generateRoute,
    leagueLayoutRoute.addChildren([
      leagueHomeRoute,
      leagueSettingsRoute,
      rosterRoute,
      coachesRoute,
      coachDetailRoute,
      scoutsRoute,
      scoutDetailRoute,
      draftRoute,
      tradesRoute,
      freeAgencyRoute,
      salaryCapRoute,
      standingsRoute,
      scheduleRoute,
      mediaRoute,
      hiringRoute,
      candidateDetailRoute,
      opponentsRoute,
      opponentDetailRoute,
      playerDetailRoute,
    ]),
  ]),
]);

export function createAppRouter() {
  return createRouter({ routeTree });
}

export function createTestRouter(initialPath: string) {
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
}
