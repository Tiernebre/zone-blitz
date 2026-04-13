import { useNavigate, useParams } from "@tanstack/react-router";
import { useTeams } from "../../hooks/use-teams.ts";

interface Team {
  id: string;
  name: string;
  city: string;
  abbreviation: string;
  primaryColor: string;
  secondaryColor: string;
  conference: string;
  division: string;
}

function groupByDivision(teams: Team[]) {
  const grouped = new Map<string, Team[]>();
  for (const team of teams) {
    if (!grouped.has(team.division)) {
      grouped.set(team.division, []);
    }
    grouped.get(team.division)!.push(team);
  }
  return grouped;
}

function TeamCard({
  team,
  onSelect,
}: {
  team: Team;
  onSelect: (team: Team) => void;
}) {
  return (
    <button
      onClick={() => onSelect(team)}
      className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-left transition hover:border-gray-500 hover:bg-gray-750 w-full"
    >
      <div
        className="h-8 w-8 rounded-full shrink-0"
        style={{ backgroundColor: team.primaryColor }}
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-100 truncate">
          {team.city} {team.name}
        </p>
        <p className="text-xs text-gray-400">{team.abbreviation}</p>
      </div>
    </button>
  );
}

export function TeamSelect() {
  const { leagueId } = useParams({ strict: false });
  const { data: teams, isLoading, error } = useTeams();
  const navigate = useNavigate();

  const handleSelect = (_team: Team) => {
    navigate({
      to: "/leagues/$leagueId",
      params: { leagueId: leagueId! },
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <p className="text-gray-400">Loading teams...</p>
      </div>
    );
  }

  if (error || !teams) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <p className="text-red-400">Failed to load teams</p>
      </div>
    );
  }

  const divisions = groupByDivision(teams as Team[]);
  const conferences = [...new Set((teams as Team[]).map((t) => t.conference))];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Choose Your Team
          </h1>
          <p className="text-gray-400">
            Select the franchise you want to manage.
          </p>
        </div>

        {conferences.map((conference) => (
          <div key={conference} className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-200 border-b border-gray-700 pb-2">
              {conference}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...divisions.entries()]
                .filter(([div]) =>
                  div.startsWith(conference)
                )
                .map(([division, divTeams]) => (
                  <div key={division} className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                      {division}
                    </h3>
                    <div className="space-y-1">
                      {divTeams.map((team) => (
                        <TeamCard
                          key={team.id}
                          team={team}
                          onSelect={handleSelect}
                        />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
