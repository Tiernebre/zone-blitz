import { cn } from "@/lib/utils";

export interface TeamLogoFont {
  key: string;
  fontFamily: string;
}

export const TEAM_LOGO_FONTS: readonly TeamLogoFont[] = [
  { key: "rye", fontFamily: "Rye" },
  { key: "unifrakturcook", fontFamily: "UnifrakturCook" },
  { key: "bungee", fontFamily: "Bungee" },
  { key: "bebas", fontFamily: "Bebas Neue" },
  { key: "staatliches", fontFamily: "Staatliches" },
] as const;

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function getTeamLogoFont(abbreviation: string): TeamLogoFont {
  const index = hash(abbreviation) % TEAM_LOGO_FONTS.length;
  return TEAM_LOGO_FONTS[index];
}

interface TeamLogoTeam {
  name: string;
  city: string;
  abbreviation: string;
  primaryColor: string;
  secondaryColor: string;
}

type TeamLogoProps = {
  team: TeamLogoTeam;
  className?: string;
  decorative?: boolean;
};

export function TeamLogo({ team, className, decorative }: TeamLogoProps) {
  const font = getTeamLogoFont(team.abbreviation);
  const a11y = decorative ? { "aria-hidden": true as const } : {
    role: "img" as const,
    "aria-label": `${team.city} ${team.name} logo`,
  };

  return (
    <span
      {...a11y}
      className={cn(
        "inline-flex items-center justify-center rounded-full shrink-0 size-10 text-sm font-bold leading-none ring-1 ring-inset ring-black/10 select-none overflow-hidden",
        className,
      )}
      style={{
        backgroundColor: team.primaryColor,
        color: team.secondaryColor,
        fontFamily: `"${font.fontFamily}", system-ui, sans-serif`,
      }}
    >
      <span className="pt-[0.05em]">{team.abbreviation}</span>
    </span>
  );
}
