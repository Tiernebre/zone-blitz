import { useMemo } from "react";
import { useParams } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import type {
  ActiveRoster,
  NeutralBucketGroup,
  RosterPlayer,
  RosterPositionGroupSummary,
} from "@zone-blitz/shared/types/roster.ts";
import { useLeague } from "../../hooks/use-league.ts";
import { useActiveRoster } from "../../hooks/use-active-roster.ts";

const groupLabels: Record<NeutralBucketGroup, string> = {
  offense: "Offense",
  defense: "Defense",
  special_teams: "Special Teams",
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currency.format(value);
}

const capColumns: ColumnDef<RosterPlayer>[] = [
  {
    id: "player",
    accessorFn: (p) => `${p.firstName} ${p.lastName}`,
    header: ({ column }) => (
      <SortableHeader column={column}>Player</SortableHeader>
    ),
    cell: ({ row }) => (
      <span className="font-medium">
        {row.original.firstName} {row.original.lastName}
      </span>
    ),
  },
  {
    accessorKey: "neutralBucket",
    header: ({ column }) => (
      <SortableHeader column={column}>
        Pos
      </SortableHeader>
    ),
  },
  {
    accessorKey: "neutralBucketGroup",
    header: ({ column }) => (
      <SortableHeader column={column}>Group</SortableHeader>
    ),
    cell: ({ row }) => groupLabels[row.original.neutralBucketGroup],
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
];

export function SalaryCap() {
  const { leagueId } = useParams({ strict: false }) as { leagueId: string };
  const { data: league } = useLeague(leagueId);
  const teamId = league?.userTeamId ?? null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Salary Cap</h1>
        <p className="max-w-2xl text-muted-foreground">
          Contract structure, dead money, and multi-year financial planning.
        </p>
      </div>

      {!teamId
        ? (
          <p className="text-muted-foreground">
            Select a team for this league to view its salary cap.
          </p>
        )
        : <SalaryCapView leagueId={leagueId} teamId={teamId} />}
    </div>
  );
}

function SalaryCapView(
  { leagueId, teamId }: { leagueId: string; teamId: string },
) {
  const { data: roster, isLoading, isError } = useActiveRoster(
    leagueId,
    teamId,
  );

  if (isLoading) {
    return (
      <div data-testid="salary-cap-loading" className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !roster) {
    return (
      <p className="text-destructive">
        Failed to load salary cap. Try again in a moment.
      </p>
    );
  }
  return <SalaryCapContent roster={roster} />;
}

function SalaryCapContent({ roster }: { roster: ActiveRoster }) {
  const sortedPlayers = useMemo(
    () => [...roster.players].sort((a, b) => b.capHit - a.capHit),
    [roster.players],
  );

  return (
    <>
      <Card data-testid="salary-cap-summary">
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

      <PositionGroupBreakdown groups={roster.positionGroups} />

      <DataTable
        columns={capColumns}
        data={sortedPlayers}
        getRowTestId={(player) => `salary-cap-row-${player.id}`}
        toolbar={(table) => (
          <div
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            data-testid="salary-cap-toolbar"
          >
            <Input
              aria-label="Search players"
              placeholder="Search players…"
              className="sm:max-w-xs"
              value={(table.getState().globalFilter as string) ?? ""}
              onChange={(event) => table.setGlobalFilter(event.target.value)}
            />
          </div>
        )}
      />
    </>
  );
}

function PositionGroupBreakdown(
  { groups }: { groups: RosterPositionGroupSummary[] },
) {
  return (
    <div
      data-testid="salary-cap-position-groups"
      className="grid grid-cols-1 gap-4 sm:grid-cols-3"
    >
      {groups.map((group) => (
        <Card
          key={group.group}
          data-testid={`salary-cap-group-${group.group}`}
        >
          <CardHeader>
            <CardTitle>{groupLabels[group.group]}</CardTitle>
            <CardDescription>{group.headcount} players</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCurrency(group.totalCap)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
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
