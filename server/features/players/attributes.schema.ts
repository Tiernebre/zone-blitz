import { check, pgTable, smallint, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { PLAYER_ATTRIBUTE_KEYS } from "@zone-blitz/shared";
import { players } from "./player.schema.ts";

export function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export function attributeColumns() {
  const columns: Record<string, ReturnType<typeof smallint>> = {};
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    const snake = camelToSnake(key);
    columns[key] = smallint(snake).notNull();
    columns[`${key}Potential`] = smallint(`${snake}_potential`).notNull();
  }
  return columns;
}

export function attributeRangeChecks(tableAlias: string) {
  const checks: Record<string, ReturnType<typeof check>> = {};
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    const snake = camelToSnake(key);
    checks[`${tableAlias}_${snake}_range`] = check(
      `${tableAlias}_${snake}_range`,
      sql.raw(`${snake} BETWEEN 0 AND 100`),
    );
    checks[`${tableAlias}_${snake}_potential_range`] = check(
      `${tableAlias}_${snake}_potential_range`,
      sql.raw(`${snake}_potential BETWEEN 0 AND 100`),
    );
  }
  return checks;
}

export const playerAttributes = pgTable(
  "player_attributes",
  {
    playerId: uuid("player_id")
      .primaryKey()
      .references(() => players.id, { onDelete: "cascade" }),
    ...attributeColumns(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  () => attributeRangeChecks("player_attributes"),
);
