import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useDeleteLeague } from "../../hooks/use-leagues.ts";

export function LeagueSettings() {
  const { leagueId } = useParams({ strict: false });
  const navigate = useNavigate();
  const deleteLeague = useDeleteLeague();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = () => {
    if (!leagueId) return;
    deleteLeague.mutate(leagueId, {
      onSuccess: () => {
        navigate({ to: "/" });
      },
    });
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>

      <section className="rounded border border-red-900 bg-red-950/30 p-6">
        <h2 className="mb-2 text-lg font-semibold text-red-400">
          Danger Zone
        </h2>
        <p className="mb-4 text-sm text-gray-400">
          Deleting a league is permanent and cannot be undone. All league data
          will be lost.
        </p>

        {!showConfirm
          ? (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="rounded border border-red-700 bg-red-900/50 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-900"
            >
              Delete League
            </button>
          )
          : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLeague.isPending}
                className="rounded bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleteLeague.isPending ? "Deleting..." : "Confirm Delete"}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200"
              >
                Cancel
              </button>
            </div>
          )}
      </section>
    </div>
  );
}
