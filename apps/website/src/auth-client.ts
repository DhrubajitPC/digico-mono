import { createAuthClient } from "better-auth/react";
import { adminClient, usernameClient } from "better-auth/client/plugins";
import { ac, superAdmin, adminRole, orderManager, orderViewer } from "@digico/api/auth/permissions";

export const authClient = createAuthClient({
  baseURL: "http://localhost:8787",

  // plugins: [usernameClient()],
  plugins: [
    usernameClient({
      displayUsername: false,
    }),

    adminClient({
      ac,
      roles: {
        super_admin: superAdmin,
        admin: adminRole,
        order_manager: orderManager,
        order_viewer: orderViewer,
      },
    }),
  ],
});
