# Deployment Runbook (Deferred Execution)

## Scope
This document prepares deployment but does not execute production deployment.

## Prerequisites
- Node.js 20+
- MySQL database
- Environment variables:
  - `DATABASE_URL`
  - OAuth/session envs used by `server/_core/env.ts`

## Build and verify
1. Install dependencies.
2. Run type checks/tests.
3. Run build.
4. Apply DB migrations (`drizzle/*.sql`).

## Recommended deployment targets
- Vercel (Node server + static client bundle)
- Container-based deployment (Docker + managed MySQL)

## Post-deploy checklist
1. OAuth callback URL configured correctly.
2. Login/logout flow healthy.
3. Project creation and usage import work.
4. Analytics and exports return data.
5. No client third-party egress for usage payloads.

## Rollback
- Revert app image/build.
- Restore previous DB schema backup if migration rollback required.
