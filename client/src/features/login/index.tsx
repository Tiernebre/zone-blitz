import { authClient } from "../../lib/auth-client.ts";

export function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
      <div className="text-center space-y-6 max-w-lg w-full px-4">
        <h1 className="text-5xl font-bold tracking-tight">Zone Blitz</h1>
        <p className="text-lg text-gray-400 max-w-md mx-auto">
          Football franchise simulation. Scout, draft, trade, and build your
          dynasty.
        </p>
        <button
          type="button"
          onClick={() =>
            authClient.signIn.social({
              provider: "google",
              callbackURL: "/",
            })}
          className="rounded bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-500"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
