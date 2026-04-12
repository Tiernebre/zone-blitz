import { useState } from "react";
import { useCreateLeague, useLeagues } from "./hooks/use-leagues.ts";

export function App() {
  const { data: leagues, isLoading, error } = useLeagues();
  const createLeague = useCreateLeague();
  const [newName, setNewName] = useState("");

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
      <div className="text-center space-y-6 max-w-lg w-full px-4">
        <h1 className="text-5xl font-bold tracking-tight">Zone Blitz</h1>
        <p className="text-lg text-gray-400 max-w-md mx-auto">
          Football franchise simulation. Scout, draft, trade, and build your
          dynasty.
        </p>

        <div className="space-y-4 text-left">
          <h2 className="text-xl font-semibold text-gray-200">Leagues</h2>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim()) return;
              createLeague.mutate({ name: newName.trim() });
              setNewName("");
            }}
          >
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="League name..."
              className="flex-1 rounded bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={createLeague.isPending || !newName.trim()}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createLeague.isPending ? "Creating..." : "Create"}
            </button>
          </form>

          {isLoading && (
            <p className="text-sm text-gray-500">Loading leagues...</p>
          )}
          {error && (
            <p className="text-sm text-red-400">
              Failed to load leagues
            </p>
          )}
          {leagues && leagues.length === 0 && (
            <p className="text-sm text-gray-500">
              No leagues yet. Create one to get started.
            </p>
          )}
          {leagues && leagues.length > 0 && (
            <ul className="space-y-2">
              {leagues.map((league) => (
                <li
                  key={league.id}
                  className="rounded bg-gray-800 border border-gray-700 px-4 py-3"
                >
                  <span className="font-medium">{league.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
