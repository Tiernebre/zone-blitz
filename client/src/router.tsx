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
import { LeagueLayout } from "./features/league/layout.tsx";
import { LeagueHome } from "./features/league/index.tsx";
import { LeagueSettings } from "./features/league/settings.tsx";
import { TeamSelect } from "./features/team-select/index.tsx";

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
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
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

const teamSelectRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "leagues/$leagueId/team-select",
  component: TeamSelect,
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

const routeTree = rootRoute.addChildren([
  loginRoute,
  authenticatedRoute.addChildren([
    leagueSelectRoute,
    teamSelectRoute,
    leagueLayoutRoute.addChildren([leagueHomeRoute, leagueSettingsRoute]),
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
