import { betterAuth } from "better-auth";
import { getMariaDbPool } from "@digico/db";
import { username, admin } from "better-auth/plugins";
import { ac, superAdmin, adminRole, orderManager, orderViewer } from "./permissions.ts";

export const auth = betterAuth({
  database: getMariaDbPool(),

  trustedOrigins: ["http://localhost:5173"],

  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
  },
  plugins: [
    username({
      displayUsername: false,
    }),
    admin({
      ac,
      defaultRole: "order_viewer",
      roles: {
        super_admin: superAdmin,
        admin: adminRole,
        order_manager: orderManager,
        order_viewer: orderViewer,
      },
    }),
  ],
});
