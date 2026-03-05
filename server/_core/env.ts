export const ENV = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  clerkSecretKey: process.env.CLERK_SECRET_KEY ?? "",
  clerkPublishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY ?? "",
  clerkSignInUrl: process.env.VITE_CLERK_SIGN_IN_URL ?? "/sign-in",
  clerkSignUpUrl: process.env.VITE_CLERK_SIGN_UP_URL ?? "/sign-up",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? process.env.CLERK_OWNER_USER_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
