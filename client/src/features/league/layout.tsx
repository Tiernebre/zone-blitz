import { Link, Outlet, useParams } from "@tanstack/react-router";
import { ArrowLeft, Home, Settings } from "lucide-react";

export function LeagueLayout() {
  const { leagueId } = useParams({ strict: false });

  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-100">
      <nav className="w-60 border-r border-gray-800 p-4">
        <Link
          to="/"
          className="mb-4 flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200"
        >
          <ArrowLeft size={16} />
          All Leagues
        </Link>
        <ul>
          <li>
            <Link
              to={`/leagues/${leagueId}`}
              className="flex items-center gap-2 rounded px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-gray-100"
            >
              <Home size={16} />
              Home
            </Link>
          </li>
          <li>
            <Link
              to={`/leagues/${leagueId}/settings`}
              className="flex items-center gap-2 rounded px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-gray-100"
            >
              <Settings size={16} />
              Settings
            </Link>
          </li>
        </ul>
      </nav>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
