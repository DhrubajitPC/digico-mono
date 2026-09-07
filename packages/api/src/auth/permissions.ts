import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

export const statement = {
  ...defaultStatements,
  orders: ["read", "update", "setStatus", "merge"],
} as const;

export const ac = createAccessControl(statement);

export const superAdmin = ac.newRole({
  user: ["create", "list", "set-role"],
  session: ["list", "revoke", "delete"],
  orders: ["read", "update", "setStatus", "merge"],
});

export const adminRole = ac.newRole({
  orders: ["read", "update", "setStatus", "merge"],
});

export const orderManager = ac.newRole({
  orders: ["read", "update", "setStatus", "merge"],
});

export const orderViewer = ac.newRole({
  orders: ["read"],
});
