import { useState } from "react";
import {
  AlertTriangleIcon,
  CalendarIcon,
  ChevronRightIcon,
  InfoIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  useAdvanceLeagueClock,
  useLeagueClock,
} from "../../hooks/use-league-clock.ts";

function formatSlug(slug: string): string {
  return slug
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatPhase(phase: string): string {
  return phase
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface LeagueClockDisplayProps {
  leagueId: string;
  isCommissioner: boolean;
}

export function LeagueClockDisplay({
  leagueId,
  isCommissioner,
}: LeagueClockDisplayProps) {
  const { data: clock } = useLeagueClock(leagueId);
  const advanceMutation = useAdvanceLeagueClock();
  const [error, setError] = useState<string | null>(null);

  if (!clock) return null;

  const showInauguralYearNote = !clock.hasCompletedGenesis &&
    !clock.phase.startsWith("genesis_");

  const handleAdvance = () => {
    setError(null);
    advanceMutation.mutate(
      {
        leagueId,
        isCommissioner,
        gateState: {
          teams: [],
          draftOrderResolved: true,
          superBowlPlayed: true,
          priorPhaseComplete: true,
        },
      },
      {
        onError: (err) => {
          setError(err.message);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            {clock.seasonYear}
          </span>
          <Badge variant="outline">{formatPhase(clock.phase)}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {formatSlug(clock.slug)}
          </span>
          {clock.flavorDate && (
            <span className="text-xs text-muted-foreground">
              {clock.flavorDate}
            </span>
          )}
        </div>
        {isCommissioner && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleAdvance}
            disabled={advanceMutation.isPending}
          >
            <ChevronRightIcon />
            Advance
          </Button>
        )}
      </div>
      {showInauguralYearNote && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <InfoIcon className="size-3" />
          <span>No preseason (inaugural year)</span>
        </div>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>Cannot Advance</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
