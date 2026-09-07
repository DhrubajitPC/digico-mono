import { createAccessControl } from "better-auth/plugins/access";

export const statement = {
  orders: ["read", "update", "setStatus", "merge"],
} as const;

export const ac = createAccessControl(statement);

export const superAdmin = ac.newRole({
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
