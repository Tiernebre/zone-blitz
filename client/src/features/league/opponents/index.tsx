import { Link, useParams } from "@tanstack/react-router";
import type { Team } from "@zone-blitz/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamLogo } from "../../../components/team-logo.tsx";
import { useLeague } from "../../../hooks/use-league.ts";
import { useLeagueTeams } from "../../../hooks/use-teams.ts";

export function Opponents() {
  const { leagueId: rawLeagueId } = useParams({ strict: false });
  const leagueId = rawLeagueId ?? "";
  const { data: league } = useLeague(leagueId);
  const { data: teams, isLoading, error } = useLeagueTeams(leagueId);
  const userTeamId = league?.userTeamId ?? null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Opponents</h1>
        <p className="max-w-2xl text-muted-foreground">
          How the rest of the league is built. Contracts and public box scores —
          nothing your scouts haven't already put on the record.
        </p>
      </header>

      {isLoading && (
        <div className="flex flex-col gap-3" data-testid="opponents-skeleton">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {error && !isLoading && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load the league.</AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && teams && (
        <TeamPicker
          teams={teams}
          leagueId={leagueId}
          userTeamId={userTeamId}
        />
      )}
    </div>
  );
}

function TeamPicker(
  { teams, leagueId, userTeamId }: {
    teams: Team[];
    leagueId: string;
    userTeamId: string | null;
  },
) {
  const opponents = teams.filter((t) => t.id !== userTeamId);
  if (opponents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No opposing teams found.
      </p>
    );
  }

  const byConference = new Map<string, Map<string, Team[]>>();
  for (const team of opponents) {
    const conf = byConference.get(team.conference) ??
      new Map<string, Team[]>();
    const div = conf.get(team.division) ?? [];
    div.push(team);
    conf.set(team.division, div);
    byConference.set(team.conference, conf);
  }

  const conferences = [...byConference.keys()].sort();

  return (
    <div className="flex flex-col gap-6">
      {conferences.map((conference) => {
        const divisions = [...byConference.get(conference)!.keys()].sort();
        return (
          <section
            key={conference}
            className="flex flex-col gap-3"
            data-testid={`opponents-conference-${conference}`}
          >
            <h2 className="text-xl font-semibold">{conference}</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {divisions.map((division) => {
                const divisionTeams = [
                  ...byConference.get(conference)!.get(division)!,
                ].sort((a, b) => a.name.localeCompare(b.name));
                return (
                  <Card
                    key={division}
                    data-testid={`opponents-division-${conference}-${division}`}
                  >
                    <CardContent className="flex flex-col gap-2 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {division}
                      </p>
                      <ul className="flex flex-col gap-1">
                        {divisionTeams.map((team) => (
                          <li key={team.id}>
                            <Link
                              to="/leagues/$leagueId/opponents/$teamId"
                              params={{ leagueId, teamId: team.id }}
                              className="flex items-center gap-2 text-sm font-medium underline-offset-2 hover:underline"
                              data-testid={`opponents-team-${team.id}`}
                            >
                              <TeamLogo
                                team={team}
                                className="size-7 text-[0.65rem]"
                                decorative
                              />
                              <span>{team.city} {team.name}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
