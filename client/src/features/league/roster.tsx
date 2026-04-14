import { useParams } from "@tanstack/react-router";
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
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import type {
  PlayerPositionGroup,
  RosterPlayer,
} from "@zone-blitz/shared/types/roster.ts";
import { useLeague } from "../../hooks/use-league.ts";
import { useActiveRoster } from "../../hooks/use-active-roster.ts";

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
  status: RosterPlayer["injuryStatus"],
): "secondary" | "destructive" | "outline" {
  if (status === "healthy") return "secondary";
  if (status === "out" || status === "ir") return "destructive";
  return "outline";
}

function formatInjury(status: RosterPlayer["injuryStatus"]) {
  return status.replace(/_/g, " ");
}

const rosterColumns: ColumnDef<RosterPlayer>[] = [
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
    accessorKey: "position",
    header: ({ column }) => (
      <SortableHeader column={column}>
        Pos
      </SortableHeader>
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
      <SortableHeader column={column}>
        Age
      </SortableHeader>
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

export function Roster() {
  const { leagueId } = useParams({ strict: false }) as { leagueId: string };
  const { data: league } = useLeague(leagueId);
  const teamId = league?.userTeamId ?? null;
  const {
    data: roster,
    isLoading,
    isError,
  } = useActiveRoster(leagueId, teamId);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Roster</h1>
        <p className="max-w-2xl text-muted-foreground">
          The 53-man active roster. You control who's on the team; the coaching
          staff sets the depth chart.
        </p>
      </div>

      {!teamId
        ? (
          <p className="text-muted-foreground">
            Select a team for this league to view its roster.
          </p>
        )
        : isLoading
        ? <RosterLoading />
        : isError || !roster
        ? (
          <p className="text-destructive">
            Failed to load roster. Try again in a moment.
          </p>
        )
        : <RosterContent roster={roster} />}
    </div>
  );
}

function RosterLoading() {
  return (
    <div data-testid="roster-loading" className="flex flex-col gap-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function RosterContent({
  roster,
}: {
  roster: {
    players: RosterPlayer[];
    totalCap: number;
    salaryCap: number;
    capSpace: number;
  };
}) {
  return (
    <>
      <Card data-testid="roster-cap-summary">
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

      <DataTable
        columns={rosterColumns}
        data={roster.players}
        getRowTestId={(player) => `roster-row-${player.id}`}
        toolbar={(table) => {
          const groupFilter =
            (table.getColumn("positionGroup")?.getFilterValue() as
              | PlayerPositionGroup
              | "all"
              | undefined) ?? "all";
          return (
            <div
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              data-testid="roster-toolbar"
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
                      data-testid={`roster-group-filter-${option}`}
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

function CapStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold">{value}</dd>
    </div>
  );
}
