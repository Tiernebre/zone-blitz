import { authClient } from "../../lib/auth-client.ts";
import { Button } from "@/components/ui/button";

export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-lg space-y-6 px-4 text-center">
        <h1 className="text-5xl font-bold tracking-tight">Zone Blitz</h1>
        <p className="mx-auto max-w-md text-lg text-muted-foreground">
          Football franchise simulation. Scout, draft, trade, and build your
          dynasty.
        </p>
        <Button
          size="lg"
          onClick={() =>
            authClient.signIn.social({
              provider: "google",
              callbackURL: "/",
            })}
        >
          Sign in with Google
        </Button>
      </div>
    </div>
  );
}
