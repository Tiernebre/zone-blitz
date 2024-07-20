import { RegistrationForm } from "../src/domain/registration.ts";
import { REGISTRATION_URL } from "./utils.ts";

export const post = (url: string, body: Record<string, string>) =>
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });

export const register = async () => {
  const registration: RegistrationForm = {
    username: crypto.randomUUID(),
    password: crypto.randomUUID(),
  };
  await post(REGISTRATION_URL, registration);
  return registration;
};