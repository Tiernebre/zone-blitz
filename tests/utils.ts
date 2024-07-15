export const URL = "http://0.0.0.0:8000";

export const urlWithPath = (path: string) => `${URL}/${path}`;
export const REGISTRATION_URL = urlWithPath("registration");
