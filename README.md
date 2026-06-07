# Job Tracker Web

Standalone Next.js frontend for the Job Tracker manual job application tracker.

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

Phase 3 adds a manual transcript text area that sends typed commands to the backend semantic interpreter. The Transcript Command area now behaves like a conversational form editor over one active unsaved draft.

- Drafts are never saved automatically.
- `save it` can prepare the existing preview for persistence, but it still requires the user to click the existing `Save Application` or `Save Update` button.
- The frontend sends compact `active_draft`, `active_application`, and bounded `recent_actions` context with each transcript turn.
- Create previews keep unmentioned fields unchanged between turns.
- Partial unsaved drafts are valid. Missing role, type, status, or stage does not immediately require clarification.
- Create previews use the existing candidate-confirmation flow before persistence.
- Existing-company update previews save through the existing `PATCH /applications/{id}` path.
- Multi-role transcript edits stay inside one draft by updating `roles_json`.
- Context follow-ups such as `Applied stage thev` can resolve against the active draft context.
- `active_draft` is only for unsaved-draft enrichment.
- `active_application` is only for an explicitly selected persisted tracker row in the UI.
- `recent_actions` are prompt context only and do not authorize persisted-row mutation.
- If the local interpreter is unavailable, the UI shows a recoverable error and nothing is saved.
- The frontend no longer uses regex-based transcript templates.
- LiveKit has not been added yet.

Supported transcript examples:

Conversational draft examples:

- `Neilsoft sathi application add kar`
- `GENAI Engineer only, fulltime ani onsite`
- `Applied stage thev`
- `and yeah, we're applying there for fulltime, GENAI Engineer only, i'll have to go onsite for that job, the current state for it is applied only`
- `Add Neilsoft for AI Engineer and RAG roles`

Unsupported or incomplete commands:

- `Add application` without a company
- `Make it high priority` without an active draft and without an explicitly selected persisted row
- Unknown-company updates
- Unsupported status or priority values
- Free-form narration that the semantic interpreter cannot map safely

## New Company Confirmation

Application creation now asks the backend whether the submitted company is already known.

- Existing-company creates keep the current low-friction path and save immediately.
- Existing edits still use the current fast `PATCH` path and do not show the popup.
- New-company creates show an editable confirmation modal before the row is persisted.
- Transcript draft saves follow the same rule as manual creates.
- Canceling the popup leaves the form or draft intact and does not create an application.

## Immediate Adaptation Loop

The frontend now participates in the immediate local adaptation loop like this:

```text
manual transcript text
    -> backend semantic interpreter
    -> validated backend tool result
    -> active unsaved draft merge or existing-row preview
    -> create preview: backend candidate check
    -> confirmation popup only for genuinely new companies
    -> create preview: confirmed save
    -> update preview: PATCH save
    -> later backend hotword refresh for new transcriptions
```

The popup is not a generic extra confirmation step. It appears only when the backend says the create flow introduced a new company candidate.

## Current Limitations

- The frontend does not trigger Whisper fine-tuning or model deployment.
- The confirmation popup protects create flows only; edits intentionally keep the fast existing path.
- Audio references are not captured by the current frontend flow.
- Read/delete transcript tools have not been added yet.
- Regex parsing remains removed.
- LiveKit has still not been added.

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
[ ] Transcript parses into an editable preview
[ ] `I have a requirement. I want to add an application neilsoft` patches only the Company field
[ ] Active draft keeps company and other untouched fields across multiple transcript turns
[ ] Existing-company transcript update parses into an editable update preview
[ ] Save Application creates a tracker row only after explicit click
[ ] Save Update patches only the resolved existing tracker row after explicit click
[ ] Multi-role transcript updates one draft with both roles selected
[ ] Context-based transcript follow-up resolves only when an active draft context exists
[ ] `GENAI Engineer` selects the `Generative AI Engineer` checkbox
[ ] `fulltime` selects the `Full Time` checkbox
[ ] `onsite` selects the `onsite` location option
[ ] `Applied stage thev` selects only the `Applied` current-stage checkbox
[ ] `status is full time` does not set `STATUS` and shows the backend warning if returned
[ ] `Make it high priority` without an active draft and without a selected saved row asks which company to use
[ ] `save it` without an active draft shows that there is no active draft to save
[ ] `active_application` is sent only for an explicitly selected persisted row
[ ] Current Stage remains independent from STATUS, COMMENTS, and NEXT ACTION
[ ] Existing-company create saves without a confirmation popup
[ ] New-company create shows the confirmation popup
[ ] Correcting a new company name in the popup saves the canonical name
[ ] Canceling the confirmation popup does not create an application
[ ] Transcript draft save uses the same new-company confirmation flow
[ ] `save it` does not directly persist from the LLM tool call
[ ] `save it` clearly routes the user back to the existing Save button flow
```

## Scope

This frontend contains the Phase 1 tracker table, add/edit form, delete confirmation, search, filters, the Phase 2 captured URL integration, and the Phase 3 semantic transcript draft workflow. It does not include LiveKit, voice recording, speech-to-text in the browser, CSV import/export, reminders, analytics, timelines, event sourcing, scraping, or automatic workflow inference.
