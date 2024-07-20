import { sql } from "./postgres.ts";

export const createSchema = async () => {
  await sql`
    DROP TABLE IF EXISTS session;
  `;
  await sql`
    DROP TABLE IF EXISTS registration;
  `;
  await sql`
    DROP EXTENSION IF EXISTS "uuid-ossp";
  `;
  await sql`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS registration (
      id BIGSERIAL NOT NULL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS session (
      id UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
      registration_id BIGINT NOT NULL REFERENCES registration (id)
    );
  `;
};
