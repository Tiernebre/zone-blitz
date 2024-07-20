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
  });

export const register = async () => {
  const registration: RegistrationForm = {
    username: crypto.randomUUID(),
    password: crypto.randomUUID(),
  };
  const response = await post(REGISTRATION_URL, registration);
  await response.text();
  return registration;
};
