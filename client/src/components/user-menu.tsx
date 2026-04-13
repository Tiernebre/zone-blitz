import { UserIcon } from "lucide-react";
import { authClient } from "../lib/auth-client.ts";
import { useDeleteAccount } from "../hooks/use-delete-account.ts";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  side = "bottom",
  trigger,
}: {
  side?: "top" | "bottom";
  trigger?: React.ReactElement;
} = {}) {
  const { data: session } = authClient.useSession();
  const deleteAccount = useDeleteAccount();

  const user = session?.user;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={trigger ?? (
          <Button variant="ghost" className="w-full justify-start gap-2">
            <UserIcon className="size-4" />
            Profile
          </Button>
        )}
      />
      <DropdownMenuContent side={side} className="w-64">
        <DropdownMenuGroup>
          {user && (
            <>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={() => authClient.signOut()}>
            Sign out
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => deleteAccount.mutate()}
          >
            Delete account
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
