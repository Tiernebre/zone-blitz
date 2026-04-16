import {
  ArrowLeftRightIcon,
  CalendarIcon,
  ClipboardListIcon,
  DollarSignIcon,
  GavelIcon,
  HomeIcon,
  LayersIcon,
  ListOrderedIcon,
  NewspaperIcon,
  ScrollTextIcon,
  SearchIcon,
  TrophyIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import type { LeaguePhase } from "../../types/league-phase.ts";
import { LEAGUE_PHASES } from "../../types/league-phase.ts";

export type NavItem = {
  label: string;
  path: string;
  Icon: typeof HomeIcon;
  visibleInPhases: (phase: LeaguePhase) => boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

const phaseIndex = Object.fromEntries(
  LEAGUE_PHASES.map((p, i) => [p, i]),
) as Record<LeaguePhase, number>;

function fromPhaseOnward(
  startPhase: LeaguePhase,
): (phase: LeaguePhase) => boolean {
  const startIdx = phaseIndex[startPhase];
  return (phase) => phaseIndex[phase] >= startIdx;
}

function inPhases(...phases: LeaguePhase[]): (phase: LeaguePhase) => boolean {
  const set = new Set<LeaguePhase>(phases);
  return (phase) => set.has(phase);
}

function always(): boolean {
  return true;
}

const fromStaffHiring = fromPhaseOnward("genesis_staff_hiring");
const fromAllocationDraft = fromPhaseOnward("genesis_allocation_draft");
const fromEstablishment = fromPhaseOnward("genesis_franchise_establishment");
const fromPreseason = fromPhaseOnward("preseason");
const fromRegularSeason = fromPhaseOnward("regular_season");

const draftPhases = inPhases(
  "genesis_allocation_draft",
  "pre_draft",
  "draft",
  "udfa",
);

const freeAgencyPhases = inPhases(
  "genesis_free_agency",
  "legal_tampering",
  "free_agency",
  "udfa",
  "regular_season",
);

const genesisCharter = inPhases("genesis_charter");
const genesisFoundingPool = inPhases("genesis_founding_pool");
const genesisAllocationDraft = inPhases("genesis_allocation_draft");

export const navGroups: NavGroup[] = [
  {
    label: "Team",
    items: [
      { label: "Home", path: "", Icon: HomeIcon, visibleInPhases: always },
      {
        label: "Roster",
        path: "roster",
        Icon: UsersIcon,
        visibleInPhases: fromAllocationDraft,
      },
      {
        label: "Coaches",
        path: "coaches",
        Icon: ClipboardListIcon,
        visibleInPhases: fromStaffHiring,
      },
      {
        label: "Scouts",
        path: "scouts",
        Icon: SearchIcon,
        visibleInPhases: fromStaffHiring,
      },
    ],
  },
  {
    label: "Team Building",
    items: [
      {
        label: "Draft",
        path: "draft",
        Icon: ListOrderedIcon,
        visibleInPhases: draftPhases,
      },
      {
        label: "Allocation Draft",
        path: "allocation-draft",
        Icon: GavelIcon,
        visibleInPhases: genesisAllocationDraft,
      },
      {
        label: "Founding Pool",
        path: "founding-pool",
        Icon: LayersIcon,
        visibleInPhases: genesisFoundingPool,
      },
      {
        label: "Trades",
        path: "trades",
        Icon: ArrowLeftRightIcon,
        visibleInPhases: fromPreseason,
      },
      {
        label: "Free Agency",
        path: "free-agency",
        Icon: UserPlusIcon,
        visibleInPhases: freeAgencyPhases,
      },
      {
        label: "Salary Cap",
        path: "salary-cap",
        Icon: DollarSignIcon,
        visibleInPhases: fromAllocationDraft,
      },
    ],
  },
  {
    label: "League",
    items: [
      {
        label: "Charter",
        path: "charter",
        Icon: ScrollTextIcon,
        visibleInPhases: genesisCharter,
      },
      {
        label: "Standings",
        path: "standings",
        Icon: TrophyIcon,
        visibleInPhases: fromRegularSeason,
      },
      {
        label: "Schedule",
        path: "schedule",
        Icon: CalendarIcon,
        visibleInPhases: fromPreseason,
      },
      {
        label: "Opponents",
        path: "opponents",
        Icon: UsersIcon,
        visibleInPhases: fromPreseason,
      },
      {
        label: "Media",
        path: "media",
        Icon: NewspaperIcon,
        visibleInPhases: fromEstablishment,
      },
    ],
  },
];
