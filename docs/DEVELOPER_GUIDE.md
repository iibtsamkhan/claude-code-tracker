# AI Cost Tracker Developer Guide

## Architecture overview
- Frontend: React + wouter + TanStack Query + tRPC client.
- Backend: Express + tRPC server + Drizzle ORM (MySQL).
- Shared contracts: `shared/usage.ts` and `shared/analyticsEngine.ts`.

## Key backend APIs
- `projects`: CRUD + project report.
- `preferences`: get/update user preferences.
- `usage`: import/list/detail/delete usage entries.
- `analytics`: summary, provider breakdown, top conversations, forecast, recommendations, dashboard bundle, filter options.
- `exports`: filtered CSV/JSON export.

## Data flow
1. User uploads provider history JSON.
2. Client parser normalizes records.
3. `usage.import` persists records under selected project.
4. Dashboard queries server analytics using current filters.
5. User inspects details and exports filtered data.

## Database notes
- `usageHistories` table stores normalized rows.
- Added indexes:
  - `userId`
  - `projectId`
  - `(userId, projectId)`
  - `timestamp`
  - `provider`
  - `model`
  - `conversationId`

## Testing
- Unit tests:
  - `client/src/lib/parsers.test.ts`
  - `client/src/lib/analytics.test.ts`
  - `client/src/lib/networkPolicy.test.ts`
- Integration tests:
  - `server/routers.integration.test.ts`
  - `server/file-upload.workflow.test.ts`
  - `server/auth.logout.test.ts`

`vitest.config.ts` includes both server and client test files.

## Performance notes
- Route-level code splitting in `client/src/App.tsx`.
- Dashboard analytics moved server-side.
- Client requests aggregated analytics payload (`analytics.dashboard`) to reduce recomputation/renders.

## Troubleshooting
- If DB is unavailable, many server APIs return empty data or throw explicit database errors.
- Ensure `DATABASE_URL` is set for persistence features.
- Run migrations including `drizzle/0002_brisk_observer.sql` for indexes.
