import type {
  DefensiveTendencies,
  OffensiveTendencies,
  SchemeFingerprint,
} from "@zone-blitz/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

interface OffensiveSpectrum {
  key: keyof OffensiveTendencies;
  lowLabel: string;
  highLabel: string;
  title: string;
}

interface DefensiveSpectrum {
  key: keyof DefensiveTendencies;
  lowLabel: string;
  highLabel: string;
  title: string;
}

// Spectrum labels are taken verbatim from the tendency table
// so the panel never drifts from the data model's defined poles.
const OFFENSIVE_SPECTRUMS: readonly OffensiveSpectrum[] = [
  {
    key: "runPassLean",
    title: "Run / Pass lean",
    lowLabel: "Run-heavy",
    highLabel: "Pass-heavy",
  },
  {
    key: "tempo",
    title: "Tempo",
    lowLabel: "Methodical",
    highLabel: "Up-tempo",
  },
  {
    key: "personnelWeight",
    title: "Personnel weight",
    lowLabel: "Light (10/11)",
    highLabel: "Heavy (12/21/22)",
  },
  {
    key: "formationUnderCenterShotgun",
    title: "Formation",
    lowLabel: "Under center",
    highLabel: "Shotgun / pistol",
  },
  {
    key: "preSnapMotionRate",
    title: "Pre-snap motion",
    lowLabel: "Static",
    highLabel: "Motion-heavy",
  },
  {
    key: "passingStyle",
    title: "Passing style",
    lowLabel: "Timing",
    highLabel: "Improvisation",
  },
  {
    key: "passingDepth",
    title: "Passing depth",
    lowLabel: "Short / intermediate",
    highLabel: "Vertical",
  },
  {
    key: "runGameBlocking",
    title: "Run blocking",
    lowLabel: "Zone",
    highLabel: "Gap / power",
  },
  {
    key: "rpoIntegration",
    title: "RPO integration",
    lowLabel: "None",
    highLabel: "Heavy",
  },
];

const DEFENSIVE_SPECTRUMS: readonly DefensiveSpectrum[] = [
  {
    key: "frontOddEven",
    title: "Front",
    lowLabel: "Odd (3-down)",
    highLabel: "Even (4-down)",
  },
  {
    key: "gapResponsibility",
    title: "Gap responsibility",
    lowLabel: "One-gap penetrate",
    highLabel: "Two-gap control",
  },
  {
    key: "subPackageLean",
    title: "Sub-package lean",
    lowLabel: "Base-committed",
    highLabel: "Sub-package heavy",
  },
  {
    key: "coverageManZone",
    title: "Coverage",
    lowLabel: "Man",
    highLabel: "Zone",
  },
  {
    key: "coverageShell",
    title: "Shell",
    lowLabel: "Single-high",
    highLabel: "Two-high",
  },
  {
    key: "cornerPressOff",
    title: "Corner technique",
    lowLabel: "Press",
    highLabel: "Off",
  },
  {
    key: "pressureRate",
    title: "Pressure rate",
    lowLabel: "Four-man rush",
    highLabel: "Blitz-heavy",
  },
  {
    key: "disguiseRate",
    title: "Disguise",
    lowLabel: "Static looks",
    highLabel: "Heavy disguise",
  },
];

interface SpectrumBarProps {
  title: string;
  lowLabel: string;
  highLabel: string;
  value: number;
}

function SpectrumBar({ title, lowLabel, highLabel, value }: SpectrumBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium">{title}</p>
      <div className="relative h-2 rounded bg-muted">
        <div
          className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-sm bg-primary"
          style={{ left: `calc(${clamped}% - 2px)` }}
          aria-label={`${title}: ${lowLabel} to ${highLabel}`}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

interface FingerprintPanelProps {
  fingerprint?: SchemeFingerprint;
  isLoading?: boolean;
}

export function FingerprintPanel({
  fingerprint,
  isLoading,
}: FingerprintPanelProps) {
  return (
    <Card data-testid="fingerprint-panel">
      <CardHeader>
        <CardTitle>Scheme fingerprint</CardTitle>
        <CardDescription>
          Emergent identity from the current OC and DC. Updates the moment a
          coordinator changes — there is no stored scheme.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {isLoading && (
          <div
            className="flex flex-col gap-3"
            data-testid="fingerprint-skeleton"
          >
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        )}

        {!isLoading && (
          <>
            <FingerprintSide
              heading="Offense"
              emptyLabel="No offensive coordinator hired yet."
              entries={fingerprint?.offense
                ? OFFENSIVE_SPECTRUMS.map((s) => ({
                  ...s,
                  value: fingerprint.offense![s.key],
                }))
                : null}
            />
            <Separator />
            <FingerprintSide
              heading="Defense"
              emptyLabel="No defensive coordinator hired yet."
              entries={fingerprint?.defense
                ? DEFENSIVE_SPECTRUMS.map((s) => ({
                  ...s,
                  value: fingerprint.defense![s.key],
                }))
                : null}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface FingerprintSideProps {
  heading: string;
  emptyLabel: string;
  entries:
    | ({ title: string; lowLabel: string; highLabel: string; value: number })[]
    | null;
}

function FingerprintSide({
  heading,
  emptyLabel,
  entries,
}: FingerprintSideProps) {
  return (
    <section className="flex flex-col gap-3" aria-label={heading}>
      <h3 className="text-sm font-semibold uppercase text-muted-foreground">
        {heading}
      </h3>
      {entries === null
        ? <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        : (
          <div className="grid gap-4 sm:grid-cols-2">
            {entries.map((entry) => (
              <SpectrumBar
                key={entry.title}
                title={entry.title}
                lowLabel={entry.lowLabel}
                highLabel={entry.highLabel}
                value={entry.value}
              />
            ))}
          </div>
        )}
    </section>
  );
}
