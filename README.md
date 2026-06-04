# ApplicationOps Web

Standalone Next.js frontend for the ApplicationOps manual job application tracker.

## Setup

```bash
npm install
```

## Environment

Create a local environment from `.env.example` if needed:

```text
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

## Run

```bash
npm run dev
```

## Validate

```bash
npm run lint
npm run build
```

## Manual Validation

```text
[ ] Frontend loads
[ ] Create application works
[ ] Edit application works
[ ] STATUS dropdown works
[ ] Current Stage persists
[ ] Search works
[ ] Filters work
[ ] Cancel modal works
```

## Scope

This frontend contains only the Phase 1 tracker table, add/edit form, delete confirmation, search, and filters. It does not include AI, voice, CSV import/export, browser extension code, reminders, analytics, timelines, or event sourcing.
