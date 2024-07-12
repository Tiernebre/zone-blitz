import { sql } from "./postgres.ts";

export const createSchema = () =>
  sql`
  CREATE TABLE IF NOT EXISTS registration (
    id BIGSERIAL NOT NULL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );
`;
