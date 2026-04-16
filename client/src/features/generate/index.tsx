import { useEffect } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { useFoundLeague } from "../../hooks/use-leagues.ts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function Generate() {
  const { leagueId } = useParams({ strict: false });
  const foundLeague = useFoundLeague();
  const navigate = useNavigate();

  useEffect(() => {
    if (
      !leagueId || foundLeague.isPending || foundLeague.isSuccess ||
      foundLeague.isError
    ) return;
    foundLeague.mutate(leagueId, {
      onSuccess: () => {
        navigate({
          to: "/leagues/$leagueId",
          params: { leagueId },
        });
      },
    });
  }, [leagueId]);

  if (foundLeague.isError) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Generation failed</AlertTitle>
          <AlertDescription>
            {foundLeague.error?.message ?? "Something went wrong."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-6">
      <Loader2Icon className="size-12 animate-spin text-primary" />
      <div className="text-center space-y-2">
        <p className="text-2xl font-semibold">Founding your league</p>
        <p className="text-muted-foreground">
          Generating coaches, players, and a full season schedule...
        </p>
      </div>
    </div>
  );
}
