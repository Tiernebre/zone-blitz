interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

export function assertJournalTimestampsMonotonic(
  entries: JournalEntry[],
): void {
  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1];
    const curr = entries[i];
    if (curr.when <= prev.when) {
      throw new Error(
        `Migration journal timestamps are not monotonically increasing: ` +
          `"${curr.tag}" (idx ${curr.idx}, when ${curr.when}) <= ` +
          `"${prev.tag}" (idx ${prev.idx}, when ${prev.when}). ` +
          `Fix the "when" field in meta/_journal.json so entries are strictly increasing.`,
      );
    }
  }
}

if (import.meta.main) {
  const journalPath = new URL("./meta/_journal.json", import.meta.url)
    .pathname;
  const journal = JSON.parse(Deno.readTextFileSync(journalPath));
  assertJournalTimestampsMonotonic(journal.entries);
  console.log(
    `All ${journal.entries.length} migration timestamps are monotonically increasing.`,
  );
}
