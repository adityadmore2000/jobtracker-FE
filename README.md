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

## Transcript Command

Phase 3 adds a manual transcript text area that sends typed English text to the local backend parser. Parsed output appears as an editable structured draft preview.

- Drafts are never saved automatically.
- `Save Application` uses the existing `POST /applications` endpoint.
- Correction transcripts patch only the active draft.
- `Use current link` fills `JOB LINK` only when the transcript explicitly asks for the latest captured URL and a captured URL exists.
- `Current Stage`, `NEXT ACTION`, `COMMENTS`, and `ENGAGED (# OF DAYS)` are only populated when explicitly dictated.

## New Company Confirmation

Application creation now asks the backend whether the submitted company is already known.

- Existing-company creates keep the current low-friction path and save immediately.
- Existing edits still use the current fast `PATCH` path and do not show the popup.
- New-company creates show an editable confirmation modal before the row is persisted.
- Transcript draft saves follow the same rule as manual creates.
- Canceling the popup leaves the form or draft intact and does not create an application.

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
[ ] Transcript parses into an editable draft
[ ] Save Application creates a tracker row only after explicit click
[ ] Correction transcript updates the draft without saving
[ ] Use current link in a transcript fills JOB LINK only when a captured URL exists
[ ] Current Stage remains independent from STATUS, COMMENTS, and NEXT ACTION
[ ] Existing-company create saves without a confirmation popup
[ ] New-company create shows the confirmation popup
[ ] Correcting a new company name in the popup saves the canonical name
[ ] Canceling the confirmation popup does not create an application
[ ] Transcript draft save uses the same new-company confirmation flow
```

## Scope

This frontend contains the Phase 1 tracker table, add/edit form, delete confirmation, search, filters, the Phase 2 captured URL integration, and the Phase 3 manual transcript draft workflow. It does not include AI, voice recording, speech-to-text, CSV import/export, reminders, analytics, timelines, event sourcing, scraping, or metadata inference.
