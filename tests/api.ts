import { getSetCookies } from "@std/http";
import { RegistrationForm } from "../src/domain/registration.ts";
import { REGISTRATION_URL } from "./utils.ts";

export const post = (url: string, body: Record<string, string>) =>
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
    credentials: "include",
    redirect: "manual",
  });

export const register = async (): Promise<
  { account: RegistrationForm; sessionId: string }
> => {
  const account: RegistrationForm = {
    username: crypto.randomUUID(),
    password: crypto.randomUUID(),
  };
  const response = await post(REGISTRATION_URL, account);
  await response.text();
  return {
    account,
    sessionId: getSetCookies(response.headers)[0].value,
  };
};

export const login = async (): Promise<string> => (await register()).sessionId;
