import { useNavigate, useParams } from "@tanstack/react-router";
import { useDeleteLeague } from "../../hooks/use-leagues.ts";
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

export function LeagueSettings() {
  const { leagueId } = useParams({ strict: false });
  const navigate = useNavigate();
  const deleteLeague = useDeleteLeague();

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
