import { getCookies } from "@std/http";
import { sql } from "../db/mod.ts";

export type SessionForm = {
  username: string;
  password: string;
};

export type Session = {
  id: string;
  registrationId: string;
};

export const getSession = async (
  request: Request,
): Promise<Session | undefined> => {
  const sessionId = getCookies(request.headers)["session"];
  return sessionId
    ? (await sql<Session[]>`SELECT * FROM session WHERE id = ${sessionId}`)[0]
    : undefined;
};
