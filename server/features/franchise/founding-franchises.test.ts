import { assertEquals } from "@std/assert";
import { FOUNDING_FRANCHISES } from "./founding-franchises.ts";

const NFL_METRO_CITIES = new Set([
  "New York",
  "Los Angeles",
  "Chicago",
  "Houston",
  "Dallas",
  "Philadelphia",
  "Washington",
  "Indianapolis",
  "Jacksonville",
  "Nashville",
  "Miami",
  "Buffalo",
  "Boston",
  "Pittsburgh",
  "Baltimore",
  "Cleveland",
  "Cincinnati",
  "Denver",
  "Las Vegas",
  "Kansas City",
  "San Francisco",
  "Seattle",
  "Glendale",
  "Green Bay",
  "Minneapolis",
  "Detroit",
  "New Orleans",
  "Atlanta",
  "Tampa",
  "Charlotte",
]);

Deno.test("FOUNDING_FRANCHISES has exactly 8 entries", () => {
  assertEquals(FOUNDING_FRANCHISES.length, 8);
});

Deno.test("FOUNDING_FRANCHISES has unique cities", () => {
  const cities = FOUNDING_FRANCHISES.map((f) => f.city);
  assertEquals(new Set(cities).size, cities.length);
});

Deno.test("FOUNDING_FRANCHISES has unique names", () => {
  const names = FOUNDING_FRANCHISES.map((f) => f.name);
  assertEquals(new Set(names).size, names.length);
});

Deno.test("FOUNDING_FRANCHISES has unique abbreviations", () => {
  const abbreviations = FOUNDING_FRANCHISES.map((f) => f.abbreviation);
  assertEquals(new Set(abbreviations).size, abbreviations.length);
});

Deno.test("FOUNDING_FRANCHISES cities do not overlap with NFL metros", () => {
  for (const franchise of FOUNDING_FRANCHISES) {
    assertEquals(
      NFL_METRO_CITIES.has(franchise.city),
      false,
      `${franchise.city} overlaps with an NFL metro city`,
    );
  }
});

Deno.test("FOUNDING_FRANCHISES all have valid hex colors", () => {
  const hexRegex = /^#[0-9A-Fa-f]{6}$/;
  for (const franchise of FOUNDING_FRANCHISES) {
    assertEquals(
      hexRegex.test(franchise.primaryColor),
      true,
      `${franchise.name} has invalid primaryColor: ${franchise.primaryColor}`,
    );
    assertEquals(
      hexRegex.test(franchise.secondaryColor),
      true,
      `${franchise.name} has invalid secondaryColor: ${franchise.secondaryColor}`,
    );
    assertEquals(
      hexRegex.test(franchise.accentColor),
      true,
      `${franchise.name} has invalid accentColor: ${franchise.accentColor}`,
    );
  }
});

Deno.test("FOUNDING_FRANCHISES all have non-empty required fields", () => {
  for (const franchise of FOUNDING_FRANCHISES) {
    assertEquals(franchise.name.length > 0, true, "empty name");
    assertEquals(franchise.city.length > 0, true, "empty city");
    assertEquals(franchise.state.length > 0, true, "empty state");
    assertEquals(
      franchise.abbreviation.length >= 2 && franchise.abbreviation.length <= 3,
      true,
      `${franchise.name} abbreviation must be 2-3 chars: ${franchise.abbreviation}`,
    );
  }
});

Deno.test("FOUNDING_FRANCHISES all have non-empty backstory", () => {
  for (const franchise of FOUNDING_FRANCHISES) {
    assertEquals(
      typeof franchise.backstory === "string" && franchise.backstory.length > 0,
      true,
      `${franchise.name} must have a non-empty backstory`,
    );
  }
});

Deno.test("FOUNDING_FRANCHISES split evenly into Mountain and Pacific conferences", () => {
  const conferences = FOUNDING_FRANCHISES.map((f) => f.conference);
  const mountain = conferences.filter((c) => c === "Mountain");
  const pacific = conferences.filter((c) => c === "Pacific");
  assertEquals(mountain.length, 4);
  assertEquals(pacific.length, 4);
});

Deno.test("FOUNDING_FRANCHISES conference matches division name", () => {
  for (const franchise of FOUNDING_FRANCHISES) {
    assertEquals(
      franchise.conference,
      franchise.division,
      `${franchise.name} conference/division mismatch`,
    );
  }
});
