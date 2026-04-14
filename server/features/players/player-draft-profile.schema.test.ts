import { assertEquals, assertExists } from "@std/assert";
import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { PLAYER_ATTRIBUTE_KEYS } from "@zone-blitz/shared";
import { playerDraftProfile } from "./player-draft-profile.schema.ts";

Deno.test("player_draft_profile is keyed 1:1 by player_id", () => {
  const config = getTableConfig(playerDraftProfile);
  const playerIdCol = config.columns.find((c) => c.name === "player_id");
  assertExists(playerIdCol);
  assertEquals(playerIdCol.primary, true);
});

Deno.test("player_draft_profile carries pre-draft metadata and attribute snapshot", () => {
  const config = getTableConfig(playerDraftProfile);
  const names = new Set(config.columns.map((c) => c.name));
  assertEquals(names.has("season_id"), true);
  assertEquals(names.has("draft_class_year"), true);
  assertEquals(names.has("projected_round"), true);
  assertEquals(names.has("scouting_notes"), true);
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    const snake = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    assertEquals(names.has(snake), true);
    assertEquals(names.has(`${snake}_potential`), true);
  }
});

Deno.test("player_draft_profile cascades from players and seasons", () => {
  const config = getTableConfig(playerDraftProfile);
  const fkTargets = config.foreignKeys
    .map((fk) => getTableName(fk.reference().foreignTable))
    .sort();
  assertEquals(fkTargets, ["players", "seasons"]);
});
