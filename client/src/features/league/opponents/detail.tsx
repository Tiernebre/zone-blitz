import { Link, useParams } from "@tanstack/react-router";
import type { ColumnDef, Row } from "@tanstack/react-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import type {
  ActiveRoster,
  PlayerPositionGroup,
  RosterPlayer,
  Team,
} from "@zone-blitz/shared";
import type { PlayerInjuryStatus } from "@zone-blitz/shared/types/player.ts";
import { useActiveRoster } from "../../../hooks/use-active-roster.ts";
import { useTeams } from "../../../hooks/use-teams.ts";
import { TeamLogo } from "../../../components/team-logo.tsx";

const groupLabels: Record<PlayerPositionGroup, string> = {
  offense: "Offense",
  defense: "Defense",
  special_teams: "Special Teams",
};

const groupFilterOptions: (PlayerPositionGroup | "all")[] = [
  "all",
  "offense",
  "defense",
  "special_teams",
];

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currency.format(value);
}

function injuryBadgeVariant(
  status: PlayerInjuryStatus,
): "secondary" | "destructive" | "outline" {
  if (status === "healthy") return "secondary";
  if (status === "out" || status === "ir") return "destructive";
  return "outline";
}

function formatInjury(status: PlayerInjuryStatus) {
  return status.replace(/_/g, " ");
}

function createRosterColumns(leagueId: string): ColumnDef<RosterPlayer>[] {
  return [
    {
      id: "player",
      accessorFn: (p) => `${p.firstName} ${p.lastName}`,
      header: ({ column }) => (
        <SortableHeader column={column}>Player</SortableHeader>
      ),
      cell: ({ row }) => (
        <Link
          to="/leagues/$leagueId/players/$playerId"
          params={{ leagueId, playerId: row.original.id }}
          className="font-medium underline-offset-2 hover:underline"
          data-testid={`opponent-player-link-${row.original.id}`}
        >
          {row.original.firstName} {row.original.lastName}
        </Link>
      ),
    },
    {
      accessorKey: "position",
      header: ({ column }) => (
        <SortableHeader column={column}>Pos</SortableHeader>
      ),
    },
    {
      accessorKey: "positionGroup",
      header: ({ column }) => (
        <SortableHeader column={column}>Group</SortableHeader>
      ),
      cell: ({ row }) => groupLabels[row.original.positionGroup],
      filterFn: (row: Row<RosterPlayer>, _id, value) =>
        value === "all" || row.original.positionGroup === value,
    },
    {
      accessorKey: "age",
      header: ({ column }) => (
        <SortableHeader column={column}>Age</SortableHeader>
      ),
    },
    {
      accessorKey: "capHit",
      header: ({ column }) => (
        <SortableHeader column={column}>Cap Hit</SortableHeader>
      ),
      cell: ({ row }) => formatCurrency(row.original.capHit),
    },
    {
      accessorKey: "contractYearsRemaining",
      header: ({ column }) => (
        <SortableHeader column={column}>Contract</SortableHeader>
      ),
      cell: ({ row }) => `${row.original.contractYearsRemaining} yrs`,
    },
    {
      accessorKey: "injuryStatus",
      header: ({ column }) => (
        <SortableHeader column={column}>Status</SortableHeader>
      ),
      cell: ({ row }) => (
        <Badge variant={injuryBadgeVariant(row.original.injuryStatus)}>
          {formatInjury(row.original.injuryStatus)}
        </Badge>
      ),
    },
  ];
}

export function OpponentRoster() {
  const { leagueId, teamId } = useParams({ strict: false }) as {
    leagueId: string;
    teamId: string;
  };
  const { data: teams } = useTeams();
  const team = teams?.find((t: Team) => t.id === teamId) ?? null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          {team && (
            <TeamLogo
              team={team}
              className="size-14 text-lg"
              decorative
            />
          )}
          <h1
            className="text-3xl font-bold tracking-tight"
            data-testid="opponent-heading"
          >
            {team ? `${team.city} ${team.name}` : "Opposing Team"}
          </h1>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          Public record only — contracts and box scores. What your scouts think
          of this team lives in the scouting room.
        </p>
      </div>

      <Tabs defaultValue="roster" className="gap-6">
        <TabsList>
          <TabsTrigger value="roster">Roster</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
        </TabsList>
        <TabsContent value="roster" className="flex flex-col gap-6">
          <OpponentRosterView leagueId={leagueId} teamId={teamId} />
        </TabsContent>
        <TabsContent value="statistics" className="flex flex-col gap-6">
          <StatisticsPlaceholder />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OpponentRosterView(
  { leagueId, teamId }: { leagueId: string; teamId: string },
) {
  const { data: roster, isLoading, isError } = useActiveRoster(
    leagueId,
    teamId,
  );

  if (isLoading) {
    return (
      <div
        data-testid="opponent-roster-loading"
        className="flex flex-col gap-4"
      >
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !roster) {
    return (
      <p className="text-destructive">
        Failed to load roster. Try again in a moment.
      </p>
    );
  }
  return <OpponentRosterContent roster={roster} leagueId={leagueId} />;
}

function OpponentRosterContent(
  { roster, leagueId }: { roster: ActiveRoster; leagueId: string },
) {
  return (
    <>
      <Card data-testid="opponent-cap-summary">
        <CardHeader>
          <CardTitle>Cap Summary</CardTitle>
          <CardDescription>
            Roster spend against the league salary cap.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <CapStat
              label="Total Cap"
              value={formatCurrency(roster.totalCap)}
            />
            <CapStat
              label="Salary Cap"
              value={formatCurrency(roster.salaryCap)}
            />
            <CapStat
              label="Cap Space"
              value={formatCurrency(roster.capSpace)}
            />
          </dl>
        </CardContent>
      </Card>

      <Card data-testid="opponent-position-groups">
        <CardHeader>
          <CardTitle>Position groups</CardTitle>
          <CardDescription>Headcount and cap spend by group.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {roster.positionGroups.map((group) => (
              <div
                key={group.group}
                className="flex flex-col gap-1"
                data-testid={`opponent-position-group-${group.group}`}
              >
                <dt className="text-sm text-muted-foreground">
                  {groupLabels[group.group]}
                </dt>
                <dd className="text-lg font-semibold">
                  {group.headcount} players · {formatCurrency(group.totalCap)}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <DataTable
        columns={createRosterColumns(leagueId)}
        data={roster.players}
        getRowTestId={(player) => `opponent-row-${player.id}`}
        toolbar={(table) => {
          const groupFilter =
            (table.getColumn("positionGroup")?.getFilterValue() as
              | PlayerPositionGroup
              | "all"
              | undefined) ?? "all";
          return (
            <div
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              data-testid="opponent-toolbar"
            >
              <Input
                aria-label="Search roster"
                placeholder="Search players…"
                className="sm:max-w-xs"
                value={(table.getState().globalFilter as string) ?? ""}
                onChange={(event) => table.setGlobalFilter(event.target.value)}
              />
              <div
                className="flex flex-wrap gap-1"
                role="group"
                aria-label="Filter by position group"
              >
                {groupFilterOptions.map((option) => {
                  const active = groupFilter === option;
                  return (
                    <Button
                      key={option}
                      type="button"
                      size="sm"
                      variant={active ? "secondary" : "ghost"}
                      data-testid={`opponent-group-filter-${option}`}
                      aria-pressed={active}
                      onClick={() =>
                        table
                          .getColumn("positionGroup")
                          ?.setFilterValue(option)}
                    >
                      {option === "all" ? "All" : groupLabels[option]}
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        }}
      />
    </>
  );
}

function StatisticsPlaceholder() {
  return (
    <Card data-testid="opponent-statistics-placeholder">
      <CardContent className="py-8 text-center text-muted-foreground">
        <p>Per-player statistics aren't recorded yet.</p>
        <p className="text-sm">
          Once games are simulated and box scores persist, current and prior
          season stat lines will show up here.
        </p>
      </CardContent>
    </Card>
  );
}

function CapStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold">{value}</dd>
    </div>
  );
}
