import { assertEquals } from "@std/assert";
import { coaches } from "./coach.schema.ts";

Deno.test("coaches table exposes preference columns (ADR 0032)", () => {
  const columns = Object.keys(coaches);
  for (
    const col of [
      "marketTierPref",
      "philosophyFitPref",
      "staffFitPref",
      "compensationPref",
      "minimumThreshold",
    ]
  ) {
    assertEquals(columns.includes(col), true, `missing ${col}`);
  }
});

Deno.test("coaches preference columns are nullable integers", () => {
  for (
    const col of [
      coaches.marketTierPref,
      coaches.philosophyFitPref,
      coaches.staffFitPref,
      coaches.compensationPref,
      coaches.minimumThreshold,
    ]
  ) {
    assertEquals(col.notNull, false);
    assertEquals(col.columnType, "PgInteger");
  }
});
