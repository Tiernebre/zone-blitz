import type { SchemeFitLabel } from "@zone-blitz/shared";
import { Badge } from "./badge.tsx";

const schemeFitLabels: Record<SchemeFitLabel, string> = {
  ideal: "Ideal fit",
  fits: "Fits",
  neutral: "Neutral",
  poor: "Poor fit",
  miscast: "Miscast",
};

function schemeFitBadgeVariant(
  label: SchemeFitLabel,
): "secondary" | "destructive" | "outline" | "default" {
  if (label === "ideal") return "default";
  if (label === "fits") return "secondary";
  if (label === "miscast" || label === "poor") return "destructive";
  return "outline";
}

export function SchemeFitBadge(
  { fit, testId }: { fit: SchemeFitLabel | null; testId: string },
) {
  if (fit === null) {
    return (
      <span className="text-muted-foreground" data-testid={testId}>
        —
      </span>
    );
  }
  return (
    <Badge variant={schemeFitBadgeVariant(fit)} data-testid={testId}>
      {schemeFitLabels[fit]}
    </Badge>
  );
}
