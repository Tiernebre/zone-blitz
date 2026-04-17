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
import { TeamLogo } from "../../components/team-logo.tsx";
import { UserMenu } from "../../components/user-menu.tsx";
import { readableTextColor } from "../../lib/readable-text-color.ts";
import { useLeague } from "../../hooks/use-league.ts";
import { useLeagueClock } from "../../hooks/use-league-clock.ts";
import { useTouchLeague } from "../../hooks/use-leagues.ts";
import { type UserTeam, useUserTeam } from "../../hooks/use-user-team.ts";
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
  const userTeam = useUserTeam(leagueId ?? "");
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
  const teamStyle = userTeam
    ? ({
      "--team-primary": userTeam.primaryColor,
      "--team-secondary": userTeam.secondaryColor,
      "--team-accent": userTeam.accentColor,
    } as React.CSSProperties)
    : undefined;

  return (
    <SidebarProvider
      style={teamStyle}
      data-team-themed={userTeam ? "" : undefined}
    >
      <Sidebar collapsible="icon">
        <LeagueSidebarHeader name={league?.name} team={userTeam} />
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
        <header
          className="sticky top-0 z-10 flex items-center gap-2 border-b-2 bg-background px-4 py-2"
          style={userTeam
            ? { borderBottomColor: userTeam.primaryColor }
            : undefined}
          data-testid="league-header"
        >
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

function LeagueSidebarHeader(
  { name, team }: { name?: string; team?: UserTeam },
) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  if (isCollapsed) {
    return null;
  }

  return (
    <SidebarHeader
      className="gap-0 p-0"
      style={team
        ? {
          background:
            `linear-gradient(135deg, ${team.primaryColor}, ${team.secondaryColor})`,
          color: readableTextColor(team.primaryColor, team.secondaryColor),
        }
        : undefined}
      data-testid="league-sidebar-header"
    >
      <div className="flex items-center gap-3 px-3 py-3">
        {team && <TeamLogo team={team} className="size-9 text-xs" decorative />}
        <div className="min-w-0 flex flex-col">
          {team
            ? (
              <>
                <span className="truncate text-xs opacity-90">{team.city}</span>
                <span className="truncate text-sm font-bold leading-tight">
                  {team.name}
                </span>
              </>
            )
            : (
              <span className="truncate text-sm font-semibold">
                {name ?? "League"}
              </span>
            )}
        </div>
      </div>
      {team && name && (
        <div className="truncate border-t border-white/15 bg-black/20 px-3 py-1 text-[10px] uppercase tracking-wide opacity-90">
          {name}
        </div>
      )}
    </SidebarHeader>
  );
}
