import { useNavigate, useParams } from "@tanstack/react-router";
import { useTeams } from "../../hooks/use-teams.ts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
    <Button
      variant="outline"
      onClick={() => onSelect(team)}
      className="flex items-center gap-3 px-4 py-3 text-left h-auto w-full justify-start"
    >
      <div
        className="h-8 w-8 rounded-full shrink-0"
        style={{ backgroundColor: team.primaryColor }}
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-card-foreground truncate">
          {team.city} {team.name}
        </p>
        <p className="text-xs text-muted-foreground">{team.abbreviation}</p>
      </div>
    </Button>
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
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <Skeleton className="h-9 w-64 mx-auto" />
            <Skeleton className="h-5 w-80 mx-auto" />
          </div>
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error || !teams) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load teams</AlertDescription>
        </Alert>
      </div>
    );
  }

  const divisions = groupByDivision(teams as Team[]);
  const conferences = [...new Set((teams as Team[]).map((t) => t.conference))];

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Choose Your Team
          </h1>
          <p className="text-muted-foreground">
            Select the franchise you want to manage.
          </p>
        </div>

        {conferences.map((conference) => (
          <Card key={conference}>
            <CardHeader>
              <CardTitle className="text-xl">{conference}</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[...divisions.entries()]
                  .filter(([div]) => div.startsWith(conference))
                  .map(([division, divTeams]) => (
                    <div key={division} className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
