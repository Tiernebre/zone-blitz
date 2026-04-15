import { assertThrows } from "@std/assert";
import { assertJournalTimestampsMonotonic } from "./check-journal-order.ts";

Deno.test("assertJournalTimestampsMonotonic passes when timestamps are strictly increasing", () => {
  assertJournalTimestampsMonotonic([
    { idx: 0, when: 100, tag: "0000_first" },
    { idx: 1, when: 200, tag: "0001_second" },
    { idx: 2, when: 300, tag: "0002_third" },
  ]);
});

Deno.test("assertJournalTimestampsMonotonic throws when a timestamp goes backwards", () => {
  assertThrows(
    () =>
      assertJournalTimestampsMonotonic([
        { idx: 0, when: 100, tag: "0000_first" },
        { idx: 1, when: 300, tag: "0001_second" },
        { idx: 2, when: 200, tag: "0002_third" },
      ]),
    Error,
    "0002_third",
  );
});

Deno.test("assertJournalTimestampsMonotonic throws when timestamps are equal", () => {
  assertThrows(
    () =>
      assertJournalTimestampsMonotonic([
        { idx: 0, when: 100, tag: "0000_first" },
        { idx: 1, when: 100, tag: "0001_second" },
      ]),
    Error,
    "0001_second",
  );
});

Deno.test("assertJournalTimestampsMonotonic passes with a single entry", () => {
  assertJournalTimestampsMonotonic([{ idx: 0, when: 100, tag: "0000_first" }]);
});

Deno.test("assertJournalTimestampsMonotonic passes with an empty list", () => {
  assertJournalTimestampsMonotonic([]);
});

Deno.test("repository journal is monotonically increasing", () => {
  const journalPath = new URL("./meta/_journal.json", import.meta.url).pathname;
  const journal = JSON.parse(Deno.readTextFileSync(journalPath));
  assertJournalTimestampsMonotonic(journal.entries);
});
