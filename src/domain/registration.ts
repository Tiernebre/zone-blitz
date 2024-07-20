export type RegistrationForm = {
  username: string;
  password: string;
};

export type Registration = RegistrationForm & {
  id: string;
};
