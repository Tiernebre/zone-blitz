import { describe, expect, it } from "vitest";
import { stepDescription, stepHeadline, stepViewFor } from "./step-view.ts";

describe("stepViewFor", () => {
  it("maps market_survey slug", () => {
    expect(stepViewFor("hiring_market_survey")).toBe("market_survey");
  });
  it.each([
    "hiring_interview_1",
    "hiring_interview_2",
    "hiring_second_wave_interview",
  ])("maps %s to interview", (slug) => {
    expect(stepViewFor(slug)).toBe("interview");
  });
  it("maps offers slug", () => {
    expect(stepViewFor("hiring_offers")).toBe("offers");
  });
  it.each([
    "hiring_decisions",
    "hiring_second_wave_decisions",
  ])("maps %s to decisions", (slug) => {
    expect(stepViewFor(slug)).toBe("decisions");
  });
  it("maps finalization slug", () => {
    expect(stepViewFor("hiring_finalization")).toBe("finalize");
  });
  it("maps unknown slugs to not_in_phase", () => {
    expect(stepViewFor("regular_season_week_1")).toBe("not_in_phase");
    expect(stepViewFor("")).toBe("not_in_phase");
  });
});

describe("stepHeadline", () => {
  it.each([
    ["hiring_market_survey", "Market Survey"],
    ["hiring_interview_1", "Interview Round 1"],
    ["hiring_interview_2", "Interview Round 2"],
    ["hiring_offers", "Offers"],
    ["hiring_decisions", "Decisions — Wave 1"],
    ["hiring_second_wave_interview", "Second-Wave Interviews"],
    ["hiring_second_wave_decisions", "Decisions — Wave 2"],
    ["hiring_finalization", "Finalization"],
    ["unknown", "Hiring"],
  ])("headline for %s", (slug, expected) => {
    expect(stepHeadline(slug)).toBe(expected);
  });
});

describe("stepDescription", () => {
  it("returns a non-empty description for every hiring slug", () => {
    const slugs = [
      "hiring_market_survey",
      "hiring_interview_1",
      "hiring_interview_2",
      "hiring_offers",
      "hiring_decisions",
      "hiring_second_wave_interview",
      "hiring_second_wave_decisions",
      "hiring_finalization",
    ];
    for (const slug of slugs) {
      expect(stepDescription(slug).length).toBeGreaterThan(0);
    }
  });
  it("falls back for unknown slugs", () => {
    expect(stepDescription("foo")).toContain("coaching carousel");
  });
});
