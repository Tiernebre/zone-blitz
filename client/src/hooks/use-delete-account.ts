import { useMutation } from "@tanstack/react-query";
import { api } from "../api.ts";
import { authClient } from "../lib/auth-client.ts";

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      await api.api.users.me.$delete();
    },
    onSuccess: () => {
      authClient.signOut();
    },
  });
}
