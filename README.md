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

## Captured URL Integration

Phase 2 adds a small browser-context section near the `JOB LINK` field in the Add/Edit form.

When the local backend has a captured browser page from the Chrome extension, the form shows:

```text
Latest captured page:
<Page title>
<URL>
```

Click `Use captured URL` to copy the captured URL into the existing `JOB LINK` field. This is always an explicit action:

- The frontend never overwrites `JOB LINK` automatically.
- Manual `JOB LINK` entry remains fully usable.
- Captured title and URL do not infer Company, Role, STATUS, Current Stage, NEXT ACTION, COMMENTS, or ENGAGED days.

The backend must be running for the captured page section to load:

```bash
cd ../jobtracker-BE
source .venv/bin/activate
uvicorn app.main:app --reload
```

## Manual Validation

```text
[ ] Frontend loads
[ ] Create application works
[ ] Edit application works
[ ] STATUS dropdown works
[ ] Current Stage persists
[ ] Latest captured title and URL appear after extension capture
[ ] Use captured URL fills JOB LINK only after explicit click
[ ] Search works
[ ] Filters work
[ ] Cancel modal works
```

## Scope

This frontend contains the Phase 1 tracker table, add/edit form, delete confirmation, search, filters, and the Phase 2 captured URL integration. It does not include AI, voice, CSV import/export, reminders, analytics, timelines, event sourcing, scraping, or metadata inference.
