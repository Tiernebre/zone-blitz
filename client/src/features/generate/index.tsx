import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { useFoundLeague } from "../../hooks/use-leagues.ts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export const MILESTONE_COPY = [
  "Creating coaches and league foundation…",
  "Assembling the founding player pool…",
  "Founding the league…",
] as const;

const MILESTONE_INTERVAL_MS = 2500;

export function Generate() {
  const { leagueId } = useParams({ strict: false });
  const foundLeague = useFoundLeague();
  const navigate = useNavigate();
  const [milestoneIndex, setMilestoneIndex] = useState(0);

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

  useEffect(() => {
    const interval = setInterval(() => {
      setMilestoneIndex((index) =>
        Math.min(index + 1, MILESTONE_COPY.length - 1)
      );
    }, MILESTONE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const handleRetry = () => {
    if (!leagueId) return;
    setMilestoneIndex(0);
    foundLeague.reset();
    foundLeague.mutate(leagueId, {
      onSuccess: () => {
        navigate({
          to: "/leagues/$leagueId",
          params: { leagueId },
        });
      },
    });
  };

  if (foundLeague.isError) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
        <div className="max-w-md w-full space-y-4">
          <Alert variant="destructive">
            <AlertTitle>Generation failed</AlertTitle>
            <AlertDescription>
              {foundLeague.error?.message ?? "Something went wrong."}
            </AlertDescription>
          </Alert>
          <Button onClick={handleRetry} className="w-full">
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-6">
      <Loader2Icon className="size-12 animate-spin text-primary" />
      <div className="text-center space-y-2">
        <p className="text-2xl font-semibold">Founding your league</p>
        <p className="text-muted-foreground" aria-live="polite">
          {MILESTONE_COPY[milestoneIndex]}
        </p>
      </div>
    </div>
  );
}
