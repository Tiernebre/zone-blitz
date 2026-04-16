import { useNavigate, useParams } from "@tanstack/react-router";
import { useDeleteLeague } from "../../hooks/use-leagues.ts";
import { useLeague } from "../../hooks/use-league.ts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";

const ADVANCE_POLICY_LABELS: Record<string, string> = {
  commissioner: "Commissioner",
  ready_check: "Ready Check",
};

function formatCurrency(value: number): string {
  return `$${value.toLocaleString("en-US")}`;
}

export function LeagueSettings() {
  const { leagueId } = useParams({ strict: false });
  const navigate = useNavigate();
  const deleteLeague = useDeleteLeague();
  const { data: league, isLoading } = useLeague(leagueId ?? "");

  const handleDelete = () => {
    if (!leagueId) return;
    deleteLeague.mutate(leagueId, {
      onSuccess: () => {
        navigate({ to: "/" });
      },
    });
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-2 mb-6 max-w-2xl text-muted-foreground">
        Manage your league's configuration and lifecycle.
      </p>

      {isLoading
        ? (
          <div data-testid="league-config-loading" className="mb-6 max-w-2xl">
            <Skeleton className="h-64 w-full" />
          </div>
        )
        : league
        ? (
          <Card className="mb-6 max-w-2xl" data-testid="league-config">
            <CardHeader>
              <CardTitle>League Configuration</CardTitle>
              <CardDescription>
                The settings chosen when this league was created. These are
                read-only for now.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <ConfigItem
                  label="Teams"
                  value={String(league.numberOfTeams)}
                />
                <ConfigItem
                  label="Season Games"
                  value={String(league.seasonLength)}
                />
                <ConfigItem
                  label="Roster Size"
                  value={String(league.rosterSize)}
                />
                <ConfigItem
                  label="Salary Cap"
                  value={formatCurrency(league.salaryCap)}
                />
                <ConfigItem
                  label="Salary Floor"
                  value={formatCurrency(
                    Math.round(
                      league.salaryCap * (league.capFloorPercent / 100),
                    ),
                  )}
                />
                <ConfigItem
                  label="Cap Growth Rate"
                  value={`${league.capGrowthRate}%`}
                />
                <ConfigItem
                  label="Advance Policy"
                  value={ADVANCE_POLICY_LABELS[league.advancePolicy] ??
                    league.advancePolicy}
                />
              </dl>
            </CardContent>
          </Card>
        )
        : null}

      <Card className="max-w-2xl border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Deleting a league is permanent and cannot be undone. All league data
            will be lost.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button variant="destructive" />}
            >
              Delete League
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this league?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. All league data including teams,
                  players, and seasons will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteLeague.isPending}
                >
                  {deleteLeague.isPending ? "Deleting..." : "Confirm Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
    </div>
  );
}
