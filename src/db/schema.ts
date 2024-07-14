import { sql } from "./postgres.ts";

export const createSchema = async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS registration (
      id BIGSERIAL NOT NULL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS session (
      id BIGSERIAL NOT NULL PRIMARY KEY
    );
  `;
};
