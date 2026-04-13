import { useState } from "react";
import { Link, Outlet, useParams } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HomeIcon,
  SettingsIcon,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { UserMenu } from "../../components/user-menu.tsx";

export function LeagueLayout() {
  const { leagueId } = useParams({ strict: false });
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <nav
        className={`flex ${
          collapsed ? "w-14" : "w-60"
        } flex-col border-r border-border p-4 transition-all duration-200`}
      >
        <div className="mb-4 flex items-center justify-between">
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  to="/"
                  className={cn(
                    buttonVariants({
                      variant: "ghost",
                      size: collapsed ? "icon-sm" : "sm",
                    }),
                  )}
                >
                  <ArrowLeftIcon />
                  {!collapsed && "All Leagues"}
                </Link>
              }
            />
            {collapsed && (
              <TooltipContent side="right">All Leagues</TooltipContent>
            )}
          </Tooltip>
        </div>
        <ul className="flex-1 space-y-1">
          <li>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    to={`/leagues/${leagueId}`}
                    className={cn(
                      buttonVariants({
                        variant: "ghost",
                        size: collapsed ? "icon-sm" : "sm",
                      }),
                      !collapsed && "w-full justify-start",
                    )}
                  >
                    <HomeIcon />
                    {!collapsed && "Home"}
                  </Link>
                }
              />
              {collapsed && <TooltipContent side="right">Home</TooltipContent>}
            </Tooltip>
          </li>
          <li>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    to={`/leagues/${leagueId}/settings`}
                    className={cn(
                      buttonVariants({
                        variant: "ghost",
                        size: collapsed ? "icon-sm" : "sm",
                      }),
                      !collapsed && "w-full justify-start",
                    )}
                  >
                    <SettingsIcon />
                    {!collapsed && "Settings"}
                  </Link>
                }
              />
              {collapsed && (
                <TooltipContent side="right">Settings</TooltipContent>
              )}
            </Tooltip>
          </li>
        </ul>
        <Separator className="my-2" />
        <UserMenu side="top" />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed(!collapsed)}
          className="mt-4 w-full"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </Button>
      </nav>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
