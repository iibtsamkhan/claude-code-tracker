# AI Cost Tracker User Guide

## What this app does
- Import usage history files from Claude, OpenAI, and Gemini.
- Store usage records in your account under a selected project.
- Analyze spend with filters, charts, recommendations, and detailed row inspection.
- Export filtered usage data as CSV or JSON.

## Quick start
1. Sign in.
2. Open Dashboard.
3. Create your first project.
4. Select the project in the filter bar.
5. Upload a provider history JSON file.
6. Review Overview, Breakdown, Forecast, Recommendations, and Analysis tabs.

## Filters
- Project (required for analytics)
- Provider
- Model
- Search (model / conversation / prompt IDs)
- Min/Max cost
- Date range

Filter state is synced to URL query params for shareable views.

## Detailed analysis
- Open the `Analysis` tab.
- Sort by timestamp, cost, or total tokens.
- Click a row (or press Enter/Space) to open a right-side detail drawer.

## Exports
- Use `CSV` or `JSON` actions in the Dashboard header.
- Exports use current filters and account timezone preference.

## Settings
- Currency
- Theme
- Timezone
- Forecast horizon days

## Privacy model
- Usage payloads are sent only to this application backend.
- Third-party egress is blocked in client API calls.
