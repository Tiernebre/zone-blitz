import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { LeagueSelect } from "./features/league-select/index.tsx";
import { LeagueLayout } from "./features/league/layout.tsx";
import { LeagueHome } from "./features/league/index.tsx";

const rootRoute = createRootRoute();

const leagueSelectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LeagueSelect,
});

const leagueLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "leagues/$leagueId",
  component: LeagueLayout,
});

const leagueHomeRoute = createRoute({
  getParentRoute: () => leagueLayoutRoute,
  path: "/",
  component: LeagueHome,
});

const routeTree = rootRoute.addChildren([
  leagueSelectRoute,
  leagueLayoutRoute.addChildren([leagueHomeRoute]),
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
