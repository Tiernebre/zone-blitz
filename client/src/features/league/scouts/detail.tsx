import { useParams } from "@tanstack/react-router";

export function ScoutDetail() {
  const { scoutId } = useParams({ strict: false });
  return (
    <div className="flex flex-col gap-2 p-6">
      <h1 className="text-2xl font-bold tracking-tight">Scout</h1>
      <p className="text-sm text-muted-foreground">
        Detail view coming soon — scout {scoutId}.
      </p>
    </div>
  );
}
