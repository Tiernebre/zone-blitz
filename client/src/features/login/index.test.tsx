import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "./index.tsx";

const mockSignInSocial = vi.fn();

vi.mock("../../lib/auth-client.ts", () => ({
  authClient: {
    signIn: {
      social: (...args: unknown[]) => mockSignInSocial(...args),
    },
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LoginPage", () => {
  it("renders the Zone Blitz heading", () => {
    render(<LoginPage />);
    expect(
      screen.getByRole("heading", { name: "Zone Blitz" }),
    ).toBeDefined();
  });

  it("renders a sign-in with Google button", () => {
    render(<LoginPage />);
    expect(
      screen.getByRole("button", { name: /sign in with google/i }),
    ).toBeDefined();
  });

  it("renders the official Google G logo inside the sign-in button", () => {
    render(<LoginPage />);
    const button = screen.getByRole("button", { name: /sign in with google/i });
    const logo = button.querySelector('svg[aria-label="Google logo"]');
    expect(logo).not.toBeNull();
  });

  it("calls signIn.social with google provider when button is clicked", () => {
    render(<LoginPage />);
    fireEvent.click(
      screen.getByRole("button", { name: /sign in with google/i }),
    );
    expect(mockSignInSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/",
    });
  });
});
