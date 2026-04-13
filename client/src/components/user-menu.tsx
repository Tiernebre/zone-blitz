import { UserIcon } from "lucide-react";
import { authClient } from "../lib/auth-client.ts";
import { useDeleteAccount } from "../hooks/use-delete-account.ts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function UserMenu() {
  const { data: session } = authClient.useSession();
  const deleteAccount = useDeleteAccount();

  const user = session?.user;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton tooltip="Profile">
                <UserIcon />
                <span>Profile</span>
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent side="top" className="w-64">
            <DropdownMenuGroup>
              {user && (
                <>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.email}
                      </p>
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
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
