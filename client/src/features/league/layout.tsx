import { Link, Outlet, useParams } from "@tanstack/react-router";

export function LeagueLayout() {
  const { leagueId } = useParams({ strict: false });

  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-100">
      <nav className="w-60 border-r border-gray-800 p-4">
        <ul>
          <li>
            <Link
              to={`/leagues/${leagueId}`}
              className="block rounded px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-gray-100"
            >
              Home
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
