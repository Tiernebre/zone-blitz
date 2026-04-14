import { useNavigate } from "@tanstack/react-router";
import { PlusIcon, Trash2Icon } from "lucide-react";
import type { SeasonPhase } from "@zone-blitz/shared";
import { useDeleteLeague, useLeagues } from "../../hooks/use-leagues.ts";
import { UserMenu } from "../../components/user-menu.tsx";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const PHASE_LABELS: Record<SeasonPhase, string> = {
  preseason: "Preseason",
  regular_season: "Regular Season",
  playoffs: "Playoffs",
  offseason: "Offseason",
};

const PHASE_DOT_CLASSES: Record<SeasonPhase, string> = {
  preseason: "bg-sky-500",
  regular_season: "bg-emerald-500",
  playoffs: "bg-amber-500",
  offseason: "bg-muted-foreground",
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return dateFormatter.format(date);
}

export function LeagueSelect() {
  const { data: leagues, isLoading, error } = useLeagues();
  const deleteLeague = useDeleteLeague();
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen flex-col items-center bg-background px-4 pt-16 pb-24 text-foreground">
      <div className="absolute top-4 right-4">
        <UserMenu />
      </div>

      <header className="w-full max-w-3xl space-y-4 text-center">
        <h1 className="text-5xl font-bold tracking-tight">Zone Blitz</h1>
        <p className="mx-auto max-w-md text-lg text-muted-foreground">
          Football franchise simulation. Scout, draft, trade, and build your
          dynasty.
        </p>
      </header>

      <section className="mt-12 w-full max-w-4xl space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Leagues</h2>
            <p className="text-sm text-muted-foreground">
              Pick up where you left off, or start a new franchise.
            </p>
          </div>

          <Button
            onClick={() => navigate({ to: "/leagues/new" })}
            className="sm:self-end"
          >
            <PlusIcon className="size-4" />
            Create League
          </Button>
        </div>

        {isLoading && (
          <div className="space-y-2" data-testid="leagues-loading">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Failed to load leagues</AlertDescription>
          </Alert>
        )}

        {leagues && leagues.length === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No leagues yet. Create one to get started.
            </p>
            <Button onClick={() => navigate({ to: "/leagues/new" })}>
              <PlusIcon className="size-4" />
              Create League
            </Button>
          </div>
        )}

        {leagues && leagues.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Assigned Team</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leagues.map((league) => {
                  const phase = league.currentSeason?.phase;
                  const year = league.currentSeason?.year;
                  return (
                    <TableRow
                      key={league.id}
                      onClick={() =>
                        navigate({
                          to: "/leagues/$leagueId",
                          params: { leagueId: String(league.id) },
                        })}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-medium">
                        {league.name}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {league.userTeam
                          ? (
                            <span className="inline-flex items-center gap-2">
                              <span
                                aria-hidden
                                className="size-3 rounded-full border border-border"
                                style={{
                                  backgroundColor: league.userTeam.primaryColor,
                                }}
                              />
                              <span>
                                {league.userTeam.city} {league.userTeam.name}
                              </span>
                            </span>
                          )
                          : (
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-muted-foreground"
                              onClick={() =>
                                navigate({
                                  to: "/leagues/$leagueId/team-select",
                                  params: { leagueId: String(league.id) },
                                })}
                            >
                              No assigned team yet
                            </Button>
                          )}
                      </TableCell>
                      <TableCell>
                        {phase
                          ? (
                            <span className="inline-flex items-center gap-2">
                              <span
                                aria-hidden
                                className={`size-2 rounded-full ${
                                  PHASE_DOT_CLASSES[phase]
                                }`}
                              />
                              <span>
                                Season {year} · {PHASE_LABELS[phase]}
                              </span>
                            </span>
                          )
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDate(league.createdAt)}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) =>
                          e.stopPropagation()}
                      >
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete ${league.name}`}
                                className="text-muted-foreground hover:text-destructive"
                              />
                            }
                          >
                            <Trash2Icon className="size-4" />
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete {league.name}?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. All league data
                                including teams, players, and seasons will be
                                permanently deleted.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                onClick={() =>
                                  deleteLeague.mutate(String(league.id))}
                                disabled={deleteLeague.isPending}
                              >
                                {deleteLeague.isPending
                                  ? "Deleting..."
                                  : "Confirm Delete"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
