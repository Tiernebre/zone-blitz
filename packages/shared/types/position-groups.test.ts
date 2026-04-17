import { assertEquals } from "@std/assert";
import {
  POSITION_GROUPS,
  positionGroupLabel,
  SCOUT_REGIONS,
  scoutRegionLabel,
} from "./position-groups.ts";

Deno.test("positionGroupLabel returns a human label for every known group", () => {
  // Every value in the vocabulary must have a label — otherwise the UI
  // would silently fall back to the raw enum name for that case.
  for (const group of POSITION_GROUPS) {
    const label = positionGroupLabel(group);
    assertEquals(typeof label, "string");
    assertEquals(label !== group, true);
  }
});

Deno.test("positionGroupLabel returns null when the value is null", () => {
  assertEquals(positionGroupLabel(null), null);
});

Deno.test("positionGroupLabel echoes unknown values back so forgotten enum entries surface visibly", () => {
  // An unknown value reaching the UI should surface as the raw token —
  // not crash, and not be silently hidden — so the omission is caught.
  assertEquals(positionGroupLabel("MASCOT"), "MASCOT");
});

Deno.test("scoutRegionLabel returns a human label for every known region", () => {
  for (const region of SCOUT_REGIONS) {
    const label = scoutRegionLabel(region);
    assertEquals(typeof label, "string");
    assertEquals(label !== region, true);
  }
});

Deno.test("scoutRegionLabel returns null when the value is null", () => {
  assertEquals(scoutRegionLabel(null), null);
});

Deno.test("scoutRegionLabel echoes unknown values back", () => {
  assertEquals(scoutRegionLabel("MARS"), "MARS");
});
