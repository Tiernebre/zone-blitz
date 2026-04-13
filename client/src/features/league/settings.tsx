import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useDeleteLeague } from "../../hooks/use-leagues.ts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Deleting a league is permanent and cannot be undone. All league data
            will be lost.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showConfirm
            ? (
              <Button
                variant="destructive"
                onClick={() => setShowConfirm(true)}
              >
                Delete League
              </Button>
            )
            : (
              <div className="flex items-center gap-3">
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteLeague.isPending}
                >
                  {deleteLeague.isPending ? "Deleting..." : "Confirm Delete"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
