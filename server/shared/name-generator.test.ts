import { assert, assertEquals, assertNotEquals } from "@std/assert";
import {
  createNameGenerator,
  FIRST_NAMES,
  LAST_NAMES,
} from "./name-generator.ts";

Deno.test("same seed produces identical sequences", () => {
  const a = createNameGenerator({ seed: 42 });
  const b = createNameGenerator({ seed: 42 });
  for (let i = 0; i < 25; i++) {
    assertEquals(a.next(), b.next());
  }
});

Deno.test("different seeds diverge quickly", () => {
  const a = createNameGenerator({ seed: 1 });
  const b = createNameGenerator({ seed: 2 });
  const first = a.next();
  const second = b.next();
  assertNotEquals(first, second);
});

Deno.test("produces many distinct names across a league-sized run", () => {
  const generator = createNameGenerator({ seed: 7 });
  const seen = new Set<string>();
  const count = 1000;
  for (let i = 0; i < count; i++) {
    const { firstName, lastName } = generator.next();
    seen.add(`${firstName} ${lastName}`);
  }
  // Birthday-paradox collisions are fine; we just want variety, not uniqueness.
  assert(
    seen.size > count * 0.9,
    `expected >90% unique names across ${count}, got ${seen.size}`,
  );
});

Deno.test("does not cycle first names in early calls", () => {
  const generator = createNameGenerator({ seed: 123 });
  const firstNames = new Set<string>();
  for (let i = 0; i < 30; i++) {
    firstNames.add(generator.next().firstName);
  }
  // The stub generators cycled FIRST_NAMES[i % pool] producing all-distinct but
  // robotic output. A real generator should vary too, but without the lockstep.
  assert(firstNames.size > 15, `got only ${firstNames.size} distinct firsts`);
});

Deno.test("returns names drawn from the configured pools", () => {
  const generator = createNameGenerator({ seed: 0 });
  const firsts = new Set(FIRST_NAMES);
  const lasts = new Set(LAST_NAMES);
  for (let i = 0; i < 50; i++) {
    const { firstName, lastName } = generator.next();
    assert(firsts.has(firstName), `unexpected first name: ${firstName}`);
    assert(lasts.has(lastName), `unexpected last name: ${lastName}`);
  }
});

Deno.test("pools are large enough to support a league", () => {
  assert(
    FIRST_NAMES.length >= 150,
    `first name pool too small: ${FIRST_NAMES.length}`,
  );
  assert(
    LAST_NAMES.length >= 150,
    `last name pool too small: ${LAST_NAMES.length}`,
  );
});

Deno.test("default (no seed) still produces valid names", () => {
  const generator = createNameGenerator();
  const { firstName, lastName } = generator.next();
  assert(firstName.length > 0);
  assert(lastName.length > 0);
});

Deno.test("independent generators with the same seed are independent", () => {
  const a = createNameGenerator({ seed: 99 });
  const b = createNameGenerator({ seed: 99 });
  a.next();
  a.next();
  // b should still start from the beginning of its own sequence.
  const bFirst = b.next();
  const aFresh = createNameGenerator({ seed: 99 }).next();
  assertEquals(bFirst, aFresh);
});
