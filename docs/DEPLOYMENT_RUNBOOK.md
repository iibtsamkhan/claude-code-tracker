# Deployment Runbook (Deferred Execution)

## Scope
This document prepares deployment but does not execute production deployment.

## Prerequisites
- Node.js 20+
- MySQL database
- Environment variables:
  - `DATABASE_URL`
  - `CLERK_SECRET_KEY`
  - `VITE_CLERK_PUBLISHABLE_KEY`
  - `VITE_CLERK_SIGN_IN_URL` (optional, default `/sign-in`)
  - `VITE_CLERK_SIGN_UP_URL` (optional, default `/sign-up`)
  - `OWNER_OPEN_ID` (optional, Clerk user id for admin auto-role)

## Build and verify
1. Install dependencies.
2. Run type checks/tests.
3. Run build.
4. Apply DB migrations (`drizzle/*.sql`).

## Recommended deployment targets
- Vercel (Node server + static client bundle)
- Container-based deployment (Docker + managed MySQL)

## Post-deploy checklist
1. Clerk app domain and allowed redirect URLs are configured.
2. Login/logout flow healthy.
3. Project creation and usage import work.
4. Analytics and exports return data.
5. No client third-party egress for usage payloads.

## Rollback
- Revert app image/build.
- Restore previous DB schema backup if migration rollback required.
