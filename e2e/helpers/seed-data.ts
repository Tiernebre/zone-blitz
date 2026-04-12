const now = new Date();

export const TEST_USER = {
  id: "e2e-test-user-1",
  name: "E2E Test User",
  email: "e2e@test.local",
  emailVerified: true,
  image: null,
  createdAt: now,
  updatedAt: now,
};

export const TEST_SESSION = {
  id: "e2e-test-session-1",
  token: "e2e-test-session-token",
  expiresAt: new Date("2099-01-01"),
  createdAt: now,
  updatedAt: now,
  ipAddress: "127.0.0.1",
  userAgent: "Playwright",
  userId: TEST_USER.id,
};

export const TEST_ACCOUNT = {
  id: "e2e-test-account-1",
  accountId: "e2e-google-account-id",
  providerId: "google",
  userId: TEST_USER.id,
  accessToken: null,
  refreshToken: null,
  idToken: null,
  accessTokenExpiresAt: null,
  refreshTokenExpiresAt: null,
  scope: null,
  password: null,
  createdAt: now,
  updatedAt: now,
};

/**
 * Cookie name used by Better Auth to store the session token.
 */
export const SESSION_COOKIE_NAME = "better-auth.session_token";
