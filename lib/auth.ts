import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";

// Roles that a user may choose during signup. "admin" must NEVER be
// assignable through public input — it is granted manually in the database.
const PUBLIC_ROLES = ["passenger", "driver"] as const;

export const auth = betterAuth({
  basePath: "/api/auth",

  trustedOrigins: [
    "http://localhost:3000",
    "https://abosseyokaimacho-git-main-didas-projects-b98f58ad.vercel.app",
    "https://abosseyokaimacho-*.vercel.app",
  ],

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },

  session: {
    expiresIn: 7 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "passenger",
        input: true,
      },
    },
  },

  databaseHooks: {
    user: {
      create: {
        // Defensively sanitize the role on every user creation so that a
        // crafted signup request can never self-assign "admin" (or any other
        // value outside PUBLIC_ROLES). Legitimate passenger/driver selection
        // from the register page is preserved.
        async before(user, ctx) {
          const requestedRole = (user as { role?: unknown }).role;
          if (typeof requestedRole !== "string" || !PUBLIC_ROLES.includes(requestedRole as (typeof PUBLIC_ROLES)[number])) {
            return {
              data: {
                ...user,
                role: "passenger",
              },
            };
          }
          return { data: user };
        },
      },
    },
  },
});
