import { useState } from "react";
import type { FormEvent } from "react";
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

interface CreateUserModalProps {
  roles: readonly Role[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}

export function CreateUserModal({ roles, onClose, onCreated }: CreateUserModalProps) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("order_viewer");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsSubmitting(true);

    const result = await authClient.admin.createUser({
      name: name.trim(),
      email: email.trim(),
      password,
      role,

      data: {
        username: username.trim(),
      },
    });

    if (result.error) {
      setError(result.error.message || "Failed to create user.");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);

    await onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Create User</h2>

            <p className="text-sm text-gray-500 mt-0.5">Create a new Digico application user.</p>
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

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 py-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="create-user-name"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Name
              </label>

              <input
                id="create-user-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                autoComplete="name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label
                htmlFor="create-user-username"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Username
              </label>

              <input
                id="create-user-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                minLength={3}
                autoComplete="username"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="john.doe"
              />

              <p className="mt-1 text-xs text-gray-500">Used for username login.</p>
            </div>

            <div>
              <label
                htmlFor="create-user-email"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Email
              </label>

              <input
                id="create-user-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="create-user-password"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Password
              </label>

              <input
                id="create-user-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Minimum 8 characters"
              />
            </div>

            <div>
              <label
                htmlFor="create-user-role"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Role
              </label>

              <select
                id="create-user-role"
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
              type="submit"
              disabled={
                isSubmitting ||
                !name.trim() ||
                !username.trim() ||
                !email.trim() ||
                password.length < 8
              }
            >
              {isSubmitting ? "Creating..." : "Create user"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
