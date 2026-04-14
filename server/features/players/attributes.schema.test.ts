import { assertEquals } from "@std/assert";
import { getTableConfig } from "drizzle-orm/pg-core";
import { getTableName } from "drizzle-orm";
import { PLAYER_ATTRIBUTE_KEYS } from "@zone-blitz/shared";
import { playerAttributes } from "./attributes.schema.ts";

Deno.test("player_attributes table has a column per attribute plus potential", () => {
  const config = getTableConfig(playerAttributes);
  const names = new Set(config.columns.map((c) => c.name));

  assertEquals(names.has("player_id"), true);
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    const snake = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    assertEquals(names.has(snake), true);
    assertEquals(names.has(`${snake}_potential`), true);
  }
});

Deno.test("player_attributes cascades from players", () => {
  const playerConfig = getTableConfig(playerAttributes);
  const playerFks = playerConfig.foreignKeys.map((fk) => fk.reference());
  assertEquals(playerFks.length, 1);
  assertEquals(getTableName(playerFks[0].foreignTable), "players");
});

Deno.test("player_attributes has range checks for every rating column", () => {
  const config = getTableConfig(playerAttributes);
  const checkNames = new Set(config.checks.map((c) => c.name));

  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    const snake = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    assertEquals(
      checkNames.has(`player_attributes_${snake}_range`),
      true,
    );
    assertEquals(
      checkNames.has(`player_attributes_${snake}_potential_range`),
      true,
    );
  }
});
