import { useEffect, useMemo } from "react";
import { Link, Outlet, useParams } from "@tanstack/react-router";
import { ArrowLeftIcon, SettingsIcon, UserIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { UserMenu } from "../../components/user-menu.tsx";
import { useLeague } from "../../hooks/use-league.ts";
import { useLeagueClock } from "../../hooks/use-league-clock.ts";
import { useTouchLeague } from "../../hooks/use-leagues.ts";
import type { LeaguePhase } from "../../types/league-phase.ts";
import { LeagueClockDisplay } from "./league-clock-display.tsx";
import { navGroups } from "./nav-config.ts";
import type { NavGroup } from "./nav-config.ts";

function filterNavGroups(
  groups: NavGroup[],
  phase: LeaguePhase | undefined,
): NavGroup[] {
  if (!phase) return groups;
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.visibleInPhases(phase)),
    }))
    .filter((group) => group.items.length > 0);
}

export function LeagueLayout() {
  const { leagueId } = useParams({ strict: false });
  const { data: league } = useLeague(leagueId ?? "");
  const { data: clock } = useLeagueClock(leagueId ?? "");
  const touchLeague = useTouchLeague();

  useEffect(() => {
    if (leagueId) {
      touchLeague.mutate(leagueId);
    }
  }, [leagueId]);

  const phase = clock?.phase as LeaguePhase | undefined;
  const filteredGroups = useMemo(
    () => filterNavGroups(navGroups, phase),
    [phase],
  );

  const basePath = `/leagues/${leagueId}`;

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <LeagueSidebarHeader name={league?.name} />
        <SidebarContent>
          {filteredGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        tooltip={item.label}
                        render={
                          <Link
                            to={item.path
                              ? `${basePath}/${item.path}`
                              : basePath}
                          />
                        }
                      >
                        <item.Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Settings"
                    render={<Link to={`${basePath}/settings`} />}
                  >
                    <SettingsIcon />
                    <span>Settings</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="All Leagues" render={<Link to="/" />}>
                <ArrowLeftIcon />
                <span>All Leagues</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <UserMenu
                side="top"
                trigger={
                  <SidebarMenuButton tooltip="Profile">
                    <UserIcon />
                    <span>Profile</span>
                  </SidebarMenuButton>
                }
              />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex items-center gap-2 border-b px-4 py-2">
          <SidebarTrigger className="-ml-1" />
          {leagueId && (
            <LeagueClockDisplay
              leagueId={leagueId}
              isCommissioner={!!league?.userTeamId}
            />
          )}
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}

function LeagueSidebarHeader({ name }: { name?: string }) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  if (isCollapsed) {
    return (
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarTrigger className="w-full" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
    );
  }

  return (
    <SidebarHeader>
      <div className="flex items-center justify-between gap-2 px-2 py-1">
        <span className="truncate text-sm font-semibold">
          {name ?? "League"}
        </span>
        <SidebarTrigger />
      </div>
    </SidebarHeader>
  );
}
