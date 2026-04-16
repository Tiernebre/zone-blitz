import { assertEquals } from "@std/assert";
import { scouts } from "./scout.schema.ts";

Deno.test("scouts table exposes preference columns (ADR 0032)", () => {
  const columns = Object.keys(scouts);
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

Deno.test("scouts preference columns are nullable integers", () => {
  for (
    const col of [
      scouts.marketTierPref,
      scouts.philosophyFitPref,
      scouts.staffFitPref,
      scouts.compensationPref,
      scouts.minimumThreshold,
    ]
  ) {
    assertEquals(col.notNull, false);
    assertEquals(col.columnType, "PgInteger");
  }
});
