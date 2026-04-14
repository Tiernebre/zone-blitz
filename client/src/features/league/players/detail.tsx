import { useParams } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";

export function PlayerDetail() {
  const { playerId } = useParams({ strict: false }) as { playerId: string };

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Player</h1>
        <p className="text-sm text-muted-foreground">
          Public record only — origin, contract history, career log,
          transactions, and accolades.
        </p>
      </header>

      <Card data-testid="player-detail-placeholder">
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>Player detail view is coming soon.</p>
          <p
            className="text-xs"
            data-testid={`player-detail-id-${playerId}`}
          >
            Player ID: {playerId}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
