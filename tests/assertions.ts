import { getSetCookies, STATUS_CODE } from "@std/http";
import { assert, assertEquals } from "@std/assert";

export const assertOnLoggedIn = async (response: Response) => {
  await response.text();
  assertEquals(response.status, STATUS_CODE.MovedPermanently);
  assertEquals(response.headers.get("location"), "/");
  const [sessionCookie] = getSetCookies(response.headers);
  assert(sessionCookie);
  assertEquals(sessionCookie.name, "session");
  assert(sessionCookie.value);
};
