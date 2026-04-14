import { useEffect } from "react";
import { Link, Outlet, useParams } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  ArrowLeftRightIcon,
  CalendarIcon,
  ClipboardListIcon,
  CrownIcon,
  DollarSignIcon,
  HomeIcon,
  ListOrderedIcon,
  NewspaperIcon,
  SearchIcon,
  SettingsIcon,
  TrophyIcon,
  UserIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
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
import { useTouchLeague } from "../../hooks/use-leagues.ts";

type NavItem = {
  label: string;
  path: string;
  Icon: typeof HomeIcon;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "Team",
    items: [
      { label: "Home", path: "", Icon: HomeIcon },
      { label: "Roster", path: "roster", Icon: UsersIcon },
      { label: "Coaches", path: "coaches", Icon: ClipboardListIcon },
    ],
  },
  {
    label: "Team Building",
    items: [
      { label: "Scouts", path: "scouts", Icon: SearchIcon },
      { label: "Draft", path: "draft", Icon: ListOrderedIcon },
      { label: "Trades", path: "trades", Icon: ArrowLeftRightIcon },
      { label: "Free Agency", path: "free-agency", Icon: UserPlusIcon },
      { label: "Salary Cap", path: "salary-cap", Icon: DollarSignIcon },
    ],
  },
  {
    label: "League",
    items: [
      { label: "Standings", path: "standings", Icon: TrophyIcon },
      { label: "Schedule", path: "schedule", Icon: CalendarIcon },
      { label: "Media", path: "media", Icon: NewspaperIcon },
      { label: "Owner", path: "owner", Icon: CrownIcon },
    ],
  },
];

export function LeagueLayout() {
  const { leagueId } = useParams({ strict: false });
  const { data: league } = useLeague(leagueId ?? "");
  const touchLeague = useTouchLeague();

  useEffect(() => {
    if (leagueId) {
      touchLeague.mutate(leagueId);
    }
  }, [leagueId]);

  const basePath = `/leagues/${leagueId}`;

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <LeagueSidebarHeader name={league?.name} />
        <SidebarContent>
          {navGroups.map((group) => (
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
