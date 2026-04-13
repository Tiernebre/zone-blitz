import { useState } from "react";
import { Link, Outlet, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Home,
  Settings,
} from "lucide-react";
import { UserMenu } from "../../components/user-menu.tsx";

export function LeagueLayout() {
  const { leagueId } = useParams({ strict: false });
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-100">
      <nav
        className={`flex ${
          collapsed ? "w-14" : "w-60"
        } flex-col border-r border-gray-800 p-4 transition-all duration-200`}
      >
        <div className="flex items-center justify-between mb-4">
          {!collapsed && (
            <Link
              to="/"
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200"
            >
              <ArrowLeft size={16} />
              All Leagues
            </Link>
          )}
          {collapsed && (
            <Link
              to="/"
              className="flex items-center justify-center text-sm text-gray-400 hover:text-gray-200"
              title="All Leagues"
            >
              <ArrowLeft size={16} />
            </Link>
          )}
        </div>
        <ul className="flex-1">
          <li>
            <Link
              to={`/leagues/${leagueId}`}
              className={`flex items-center ${
                collapsed ? "justify-center" : "gap-2 px-3"
              } rounded py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-gray-100`}
              title={collapsed ? "Home" : undefined}
            >
              <Home size={16} />
              {!collapsed && "Home"}
            </Link>
          </li>
          <li>
            <Link
              to={`/leagues/${leagueId}/settings`}
              className={`flex items-center ${
                collapsed ? "justify-center" : "gap-2 px-3"
              } rounded py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-gray-100`}
              title={collapsed ? "Settings" : undefined}
            >
              <Settings size={16} />
              {!collapsed && "Settings"}
            </Link>
          </li>
        </ul>
        <div className="border-t border-gray-800 pt-2">
          <UserMenu />
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="mt-4 flex w-full items-center justify-center rounded py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </nav>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
