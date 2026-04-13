import { Link, Outlet, useParams } from "@tanstack/react-router";
import { ArrowLeftIcon, HomeIcon, SettingsIcon, UserIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
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

export function LeagueLayout() {
  const { leagueId } = useParams({ strict: false });
  const { data: league } = useLeague(leagueId ?? "");

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <LeagueSidebarHeader name={league?.name} />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Home"
                    render={<Link to={`/leagues/${leagueId}`} />}
                  >
                    <HomeIcon />
                    <span>Home</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Settings"
                    render={<Link to={`/leagues/${leagueId}/settings`} />}
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
