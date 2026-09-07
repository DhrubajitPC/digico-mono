import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@digico/design-system";
import { authClient } from "../../auth-client.js";

const ROLE_LABELS = {
  super_admin: "Super Admin",
  admin: "Admin",
  order_manager: "Order Manager",
  order_viewer: "Order Viewer",
} as const;

type Role = keyof typeof ROLE_LABELS;

type UserListResponse = NonNullable<Awaited<ReturnType<typeof authClient.admin.listUsers>>["data"]>;

type ManagedUser = UserListResponse["users"][number];

interface EditUserRoleModalProps {
  user: ManagedUser;
  roles: readonly Role[];
  onClose: () => void;
  onUpdated: () => Promise<void>;
}

export function EditUserRoleModal({ user, roles, onClose, onUpdated }: EditUserRoleModalProps) {
  const currentRole = (roles.includes(user.role as Role) ? user.role : "order_viewer") as Role;

  const [role, setRole] = useState<Role>(currentRole);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setError("");
    setIsSubmitting(true);

    const result = await authClient.admin.setRole({
      userId: user.id,
      role,
    });

    if (result.error) {
      setError(result.error.message || "Failed to update user role.");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);

    await onUpdated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Change User Role</h2>

            <p className="text-sm text-gray-500 mt-0.5">Update the role for {user.name}.</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
            <div className="text-sm font-medium text-gray-900">{user.name}</div>

            <div className="text-sm text-gray-500">{user.email}</div>
          </div>

          <div>
            <label
              htmlFor="edit-user-role"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Role
            </label>

            <select
              id="edit-user-role"
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {roles.map((availableRole) => (
                <option key={availableRole} value={availableRole}>
                  {ROLE_LABELS[availableRole]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>

          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSubmitting || role === currentRole}
          >
            {isSubmitting ? "Saving..." : "Save role"}
          </Button>
        </div>
      </div>
    </div>
  );
}
