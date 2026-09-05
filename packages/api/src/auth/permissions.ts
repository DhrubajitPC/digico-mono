import { TRPCError } from "@trpc/server";

export type UserRole = "admin" | "manager" | "staff";

export type Permission = "orders.read" | "orders.update" | "orders.setStatus" | "orders.merge";

const rolePermissions: Record<UserRole, Permission[]> = {
  admin: ["orders.read", "orders.update", "orders.setStatus", "orders.merge"],

  manager: ["orders.read", "orders.update", "orders.setStatus", "orders.merge"],

  staff: ["orders.read", "orders.update"],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function requirePermission(role: UserRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to perform this action",
    });
  }
}
