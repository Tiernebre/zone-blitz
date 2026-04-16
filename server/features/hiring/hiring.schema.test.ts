import { assertEquals } from "@std/assert";
import {
  hiringDecisions,
  hiringInterests,
  hiringInterestStatusEnum,
  hiringInterviews,
  hiringInterviewStatusEnum,
  hiringOffers,
  hiringOfferStatusEnum,
  staffTypeEnum,
} from "./hiring.schema.ts";

Deno.test("staffTypeEnum has coach and scout", () => {
  assertEquals(staffTypeEnum.enumValues, ["coach", "scout"]);
});

Deno.test("hiringInterestStatusEnum values", () => {
  assertEquals(hiringInterestStatusEnum.enumValues, ["active", "withdrawn"]);
});

Deno.test("hiringInterviewStatusEnum values", () => {
  assertEquals(hiringInterviewStatusEnum.enumValues, [
    "requested",
    "accepted",
    "declined",
    "completed",
  ]);
});

Deno.test("hiringOfferStatusEnum values", () => {
  assertEquals(hiringOfferStatusEnum.enumValues, [
    "pending",
    "accepted",
    "rejected",
    "expired",
  ]);
});

Deno.test("hiring_interests table has expected columns", () => {
  const columns = Object.keys(hiringInterests);
  for (
    const col of [
      "id",
      "leagueId",
      "teamId",
      "staffType",
      "staffId",
      "stepSlug",
      "status",
      "createdAt",
      "updatedAt",
    ]
  ) {
    assertEquals(columns.includes(col), true, `missing ${col}`);
  }
});

Deno.test("hiring_interviews table has expected columns", () => {
  const columns = Object.keys(hiringInterviews);
  for (
    const col of [
      "id",
      "leagueId",
      "teamId",
      "staffType",
      "staffId",
      "stepSlug",
      "status",
      "philosophyReveal",
      "staffFitReveal",
      "createdAt",
      "updatedAt",
    ]
  ) {
    assertEquals(columns.includes(col), true, `missing ${col}`);
  }
});

Deno.test("hiring_offers table has expected columns", () => {
  const columns = Object.keys(hiringOffers);
  for (
    const col of [
      "id",
      "leagueId",
      "teamId",
      "staffType",
      "staffId",
      "stepSlug",
      "status",
      "salary",
      "contractYears",
      "buyoutMultiplier",
      "incentives",
      "preferenceScore",
      "createdAt",
      "updatedAt",
    ]
  ) {
    assertEquals(columns.includes(col), true, `missing ${col}`);
  }
});

Deno.test("hiring_decisions table has expected columns", () => {
  const columns = Object.keys(hiringDecisions);
  for (
    const col of [
      "id",
      "leagueId",
      "staffType",
      "staffId",
      "chosenOfferId",
      "wave",
      "decidedAt",
      "createdAt",
      "updatedAt",
    ]
  ) {
    assertEquals(columns.includes(col), true, `missing ${col}`);
  }
});

Deno.test("hiring_offers.preferenceScore is nullable", () => {
  assertEquals(hiringOffers.preferenceScore.notNull, false);
});

Deno.test("hiring_decisions.chosenOfferId is nullable", () => {
  assertEquals(hiringDecisions.chosenOfferId.notNull, false);
});

Deno.test("hiring_interviews philosophy and staff fit reveals are jsonb and nullable", () => {
  assertEquals(hiringInterviews.philosophyReveal.notNull, false);
  assertEquals(hiringInterviews.staffFitReveal.notNull, false);
});
