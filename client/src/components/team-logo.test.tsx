import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { getTeamLogoFont, TEAM_LOGO_FONTS, TeamLogo } from "./team-logo.tsx";

const TEAM = {
  id: "t1",
  name: "Minutemen",
  city: "Boston",
  abbreviation: "BOS",
  primaryColor: "#0B2240",
  secondaryColor: "#C41230",
  conference: "AFC",
  division: "AFC East",
};

afterEach(() => {
  cleanup();
});

describe("getTeamLogoFont", () => {
  it("returns one of the configured fonts", () => {
    const font = getTeamLogoFont("BOS");
    expect(TEAM_LOGO_FONTS.map((f) => f.key)).toContain(font.key);
  });

  it("returns the same font for the same abbreviation (deterministic)", () => {
    expect(getTeamLogoFont("BOS").key).toBe(getTeamLogoFont("BOS").key);
    expect(getTeamLogoFont("MIA").key).toBe(getTeamLogoFont("MIA").key);
  });

  it("distributes across multiple fonts across typical inputs", () => {
    const abbrs = [
      "BOS",
      "MIA",
      "GBL",
      "DAL",
      "NYG",
      "KCC",
      "SFO",
      "DEN",
      "CHI",
      "SEA",
    ];
    const fonts = new Set(abbrs.map((a) => getTeamLogoFont(a).key));
    expect(fonts.size).toBeGreaterThan(1);
  });
});

describe("TeamLogo", () => {
  it("renders the team abbreviation", () => {
    render(<TeamLogo team={TEAM} />);
    expect(screen.getByText("BOS")).toBeDefined();
  });

  it("uses the primary color as background and secondary as foreground", () => {
    const { container } = render(<TeamLogo team={TEAM} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.backgroundColor.toLowerCase()).toBe("#0b2240");
    expect(root.style.color.toLowerCase()).toBe("#c41230");
  });

  it("applies a font-family matching the assigned logo font", () => {
    const assigned = getTeamLogoFont(TEAM.abbreviation);
    const { container } = render(<TeamLogo team={TEAM} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.fontFamily).toContain(assigned.fontFamily);
  });

  it("exposes an accessible label by default", () => {
    render(<TeamLogo team={TEAM} />);
    expect(
      screen.getByRole("img", { name: "Boston Minutemen logo" }),
    ).toBeDefined();
  });

  it("hides from assistive tech when decorative", () => {
    const { container } = render(<TeamLogo team={TEAM} decorative />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("aria-hidden")).toBe("true");
    expect(root.getAttribute("role")).toBeNull();
  });

  it("forwards className for sizing overrides", () => {
    const { container } = render(
      <TeamLogo team={TEAM} className="size-16 text-2xl" />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("size-16");
    expect(root.className).toContain("text-2xl");
  });
});
