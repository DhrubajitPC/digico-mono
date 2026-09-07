import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Shield, UserPlus, Users } from "lucide-react";
import { Button } from "@digico/design-system";
import { authClient } from "../../auth-client.js";
import { CreateUserModal } from "./CreateUserModal.js";
import { EditUserRoleModal } from "./EditUserRoleModal.js";

const ROLES = ["super_admin", "admin", "order_manager", "order_viewer"] as const;

type Role = (typeof ROLES)[number];

type UserListResponse = NonNullable<Awaited<ReturnType<typeof authClient.admin.listUsers>>["data"]>;

type ManagedUser = UserListResponse["users"][number];

function roleLabel(role: string | null | undefined) {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "admin":
      return "Admin";
    case "order_manager":
      return "Order Manager";
    case "order_viewer":
      return "Order Viewer";
    default:
      return role || "Unknown";
  }
}

function roleBadgeClass(role: string | null | undefined) {
  switch (role) {
    case "super_admin":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "admin":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "order_manager":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "order_viewer":
      return "bg-gray-50 text-gray-700 border-gray-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

export function UserManagement() {
  const { data: session } = authClient.useSession();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);

  const currentUserId = session?.user?.id;

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError("");

    const result = await authClient.admin.listUsers({
      query: {
        limit: 100,
        offset: 0,
      },
    });

    if (result.error) {
      setError(result.error.message || "Failed to load users.");
      setUsers([]);
      setTotal(0);
      setIsLoading(false);
      return;
    }

    setUsers(result.data?.users ?? []);
    setTotal(result.data?.total ?? 0);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleUserCreated = async () => {
    setShowCreateModal(false);
    await loadUsers();
  };

  const handleRoleUpdated = async () => {
    setSelectedUser(null);
    await loadUsers();
  };

  if (session?.user?.role !== "super_admin") {
    return null;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-7 h-7 text-primary" />

            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">User Management</h1>
          </div>

          <p className="text-sm text-gray-500 mt-1">Create users and manage application roles.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadUsers()} disabled={isLoading}>
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            <UserPlus className="w-4 h-4" />
            Add user
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Users</h2>

              <p className="text-sm text-gray-500">
                {total} user{total === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-500">
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-500">
            No users found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold text-gray-600">User</th>

                  <th className="px-5 py-3 text-left font-semibold text-gray-600">Username</th>

                  <th className="px-5 py-3 text-left font-semibold text-gray-600">Email</th>

                  <th className="px-5 py-3 text-left font-semibold text-gray-600">Role</th>

                  <th className="px-5 py-3 text-right font-semibold text-gray-600">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {users.map((managedUser) => {
                  const isCurrentUser = managedUser.id === currentUserId;

                  return (
                    <tr key={managedUser.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-full bg-gray-800 text-white flex items-center justify-center font-semibold">
                            {managedUser.name?.slice(0, 1).toUpperCase() || "U"}
                          </div>

                          <div>
                            <div className="font-medium text-gray-900">{managedUser.name}</div>

                            {isCurrentUser && <div className="text-xs text-gray-500">You</div>}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-gray-700">
                        {"username" in managedUser ? String(managedUser.username ?? "") : "—"}
                      </td>

                      <td className="px-5 py-4 text-gray-700">{managedUser.email}</td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${roleBadgeClass(
                            managedUser.role,
                          )}`}
                        >
                          <Shield className="w-3 h-3" />
                          {roleLabel(managedUser.role)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        {isCurrentUser ? (
                          <span className="text-xs text-gray-400">Current account</span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedUser(managedUser)}
                          >
                            Change role
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateUserModal
          roles={ROLES}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleUserCreated}
        />
      )}

      {selectedUser && (
        <EditUserRoleModal
          user={selectedUser}
          roles={ROLES}
          onClose={() => setSelectedUser(null)}
          onUpdated={handleRoleUpdated}
        />
      )}
    </div>
  );
}
