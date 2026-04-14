import { assertEquals } from "@std/assert";
import { DEFAULT_COLLEGES } from "./default-colleges.ts";

Deno.test("DEFAULT_COLLEGES has unique names", () => {
  const names = DEFAULT_COLLEGES.map((c) => c.name);
  const unique = new Set(names);
  assertEquals(unique.size, names.length);
});

Deno.test("DEFAULT_COLLEGES has only FBS or FCS subdivisions", () => {
  const valid = new Set(["FBS", "FCS"]);
  for (const college of DEFAULT_COLLEGES) {
    assertEquals(
      valid.has(college.subdivision),
      true,
      `${college.name} has invalid subdivision: ${college.subdivision}`,
    );
  }
});

Deno.test("DEFAULT_COLLEGES has both FBS and FCS programs", () => {
  const fbs = DEFAULT_COLLEGES.filter((c) => c.subdivision === "FBS");
  const fcs = DEFAULT_COLLEGES.filter((c) => c.subdivision === "FCS");
  assertEquals(fbs.length > 100, true, `expected >100 FBS, got ${fbs.length}`);
  assertEquals(fcs.length > 100, true, `expected >100 FCS, got ${fcs.length}`);
});

Deno.test("DEFAULT_COLLEGES all have non-empty required fields", () => {
  for (const college of DEFAULT_COLLEGES) {
    assertEquals(college.name.length > 0, true, "empty name");
    assertEquals(
      college.shortName.length > 0,
      true,
      `${college.name} has empty shortName`,
    );
    assertEquals(
      college.nickname.length > 0,
      true,
      `${college.name} has empty nickname`,
    );
    assertEquals(
      college.city.length > 0,
      true,
      `${college.name} has empty city`,
    );
    assertEquals(
      college.conference.length > 0,
      true,
      `${college.name} has empty conference`,
    );
  }
});

Deno.test("DEFAULT_COLLEGES all have 2-letter state codes", () => {
  const stateRegex = /^[A-Z]{2}$/;
  for (const college of DEFAULT_COLLEGES) {
    assertEquals(
      stateRegex.test(college.state),
      true,
      `${college.name} has invalid state: ${college.state}`,
    );
  }
});
