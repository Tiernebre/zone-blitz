import { useState } from "react";
import { User } from "lucide-react";
import { authClient } from "../lib/auth-client.ts";
import { useDeleteAccount } from "../hooks/use-delete-account.ts";

export function UserMenu({ dropDown = false }: { dropDown?: boolean } = {}) {
  const { data: session } = authClient.useSession();
  const deleteAccount = useDeleteAccount();
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const user = session?.user;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Profile"
        onClick={() => {
          setIsOpen(!isOpen);
          if (isOpen) setShowConfirm(false);
        }}
        className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-gray-100"
      >
        <User size={16} />
        Profile
      </button>

      {isOpen && (
        <div
          className={`absolute ${
            dropDown ? "top-full right-0 mt-2" : "bottom-full left-0 mb-2"
          } w-64 rounded border border-gray-700 bg-gray-900 p-4 shadow-lg`}
        >
          {user && (
            <div className="mb-3 border-b border-gray-700 pb-3">
              <p className="text-sm font-medium text-gray-100">{user.name}</p>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
          )}

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => authClient.signOut()}
              className="w-full rounded px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-gray-100"
            >
              Sign out
            </button>

            {!showConfirm
              ? (
                <button
                  type="button"
                  onClick={() => setShowConfirm(true)}
                  className="w-full rounded px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-800 hover:text-red-300"
                >
                  Delete account
                </button>
              )
              : (
                <div className="rounded border border-red-800 bg-red-950 p-3">
                  <p className="mb-2 text-xs text-red-300">
                    Are you sure? This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => deleteAccount.mutate()}
                      className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500"
                    >
                      Yes, delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowConfirm(false)}
                      className="rounded px-3 py-1 text-xs text-gray-400 hover:text-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
