import { getCookies, setCookie, STATUS_CODE } from "@std/http";
import { sql } from "../db/mod.ts";
import { Registration } from "./registration.ts";

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

export const createSession = async ({ id }: Registration) => {
  const [session] = await sql<
    Session[]
  >`INSERT INTO session (registration_id) VALUES (${id}) RETURNING *`;
  if (!session) {
    throw new Error("Could not create session for the provided account.");
  }
  return session;
};

export const respondWithSession = (session: Session) => {
  const headers = new Headers();
  setCookie(headers, {
    name: "session",
    value: session.id,
    httpOnly: true,
    sameSite: "Strict",
  });
  headers.set("Location", "/");
  return new Response(
    null,
    {
      headers,
      status: STATUS_CODE.MovedPermanently,
    },
  );
};
