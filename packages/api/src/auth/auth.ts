import { betterAuth } from "better-auth";
import { getMariaDbPool } from "@digico/db";

export const auth = betterAuth({
  database: getMariaDbPool(),

  trustedOrigins: ["http://localhost:5173"],

  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
  },
});
