import type { SchemeFingerprint } from "../types/scheme-fingerprint.ts";

export type DepthChartSlotGroup = "offense" | "defense" | "special_teams";

export interface DepthChartSlotDefinition {
  code: string;
  label: string;
  group: DepthChartSlotGroup;
}

const SPECIAL_TEAMS: DepthChartSlotDefinition[] = [
  { code: "K", label: "Kicker", group: "special_teams" },
  { code: "P", label: "Punter", group: "special_teams" },
  { code: "LS", label: "Long Snapper", group: "special_teams" },
];

const DEFAULT_OFFENSE: DepthChartSlotDefinition[] = [
  { code: "QB", label: "Quarterback", group: "offense" },
  { code: "RB", label: "Running Back", group: "offense" },
  { code: "FB", label: "Fullback", group: "offense" },
  { code: "WR", label: "Wide Receiver", group: "offense" },
  { code: "TE", label: "Tight End", group: "offense" },
  { code: "OL", label: "Offensive Line", group: "offense" },
];

const DEFAULT_DEFENSE: DepthChartSlotDefinition[] = [
  { code: "DL", label: "Defensive Line", group: "defense" },
  { code: "LB", label: "Linebacker", group: "defense" },
  { code: "CB", label: "Cornerback", group: "defense" },
  { code: "S", label: "Safety", group: "defense" },
];

const HEAVY_PERSONNEL_THRESHOLD = 66;
const ODD_FRONT_THRESHOLD = 56;
const EVEN_FRONT_CEILING = 45;
const SUB_PACKAGE_THRESHOLD = 56;

function offenseSlots(
  fingerprint: SchemeFingerprint,
): DepthChartSlotDefinition[] {
  if (!fingerprint.offense) return DEFAULT_OFFENSE;

  const slots: DepthChartSlotDefinition[] = [
    { code: "QB", label: "Quarterback", group: "offense" },
    { code: "RB", label: "Running Back", group: "offense" },
  ];

  if (fingerprint.offense.personnelWeight >= HEAVY_PERSONNEL_THRESHOLD) {
    slots.push({ code: "FB", label: "Fullback", group: "offense" });
  }

  slots.push(
    { code: "WR", label: "Wide Receiver", group: "offense" },
    { code: "TE", label: "Tight End", group: "offense" },
    { code: "LT", label: "Left Tackle", group: "offense" },
    { code: "LG", label: "Left Guard", group: "offense" },
    { code: "C", label: "Center", group: "offense" },
    { code: "RG", label: "Right Guard", group: "offense" },
    { code: "RT", label: "Right Tackle", group: "offense" },
  );

  return slots;
}

function defenseSlots(
  fingerprint: SchemeFingerprint,
): DepthChartSlotDefinition[] {
  if (!fingerprint.defense) return DEFAULT_DEFENSE;

  const front = fingerprint.defense.frontOddEven;
  const slots: DepthChartSlotDefinition[] = [];

  if (front >= ODD_FRONT_THRESHOLD) {
    slots.push(
      { code: "OLB", label: "Outside Linebacker", group: "defense" },
      { code: "DE", label: "Defensive End", group: "defense" },
      { code: "NT", label: "Nose Tackle", group: "defense" },
      { code: "ILB", label: "Inside Linebacker", group: "defense" },
    );
  } else if (front <= EVEN_FRONT_CEILING) {
    slots.push(
      { code: "DE", label: "Defensive End", group: "defense" },
      { code: "DT", label: "Defensive Tackle", group: "defense" },
      { code: "LB", label: "Linebacker", group: "defense" },
    );
  } else {
    slots.push(
      { code: "EDGE", label: "Edge Rusher", group: "defense" },
      { code: "DL", label: "Defensive Line", group: "defense" },
      { code: "LB", label: "Linebacker", group: "defense" },
    );
  }

  slots.push({ code: "CB", label: "Cornerback", group: "defense" });

  if (fingerprint.defense.subPackageLean >= SUB_PACKAGE_THRESHOLD) {
    slots.push({ code: "NCB", label: "Nickel Corner", group: "defense" });
  }

  slots.push({ code: "S", label: "Safety", group: "defense" });

  return slots;
}

export function depthChartVocabulary(
  fingerprint: SchemeFingerprint,
): DepthChartSlotDefinition[] {
  return [
    ...offenseSlots(fingerprint),
    ...defenseSlots(fingerprint),
    ...SPECIAL_TEAMS,
  ];
}
