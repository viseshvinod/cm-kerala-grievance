# 06 · Setup and Testing

## Prerequisites

- Node.js **20+** (developed on 22) and npm
- PostgreSQL **12+** (developed on 16) — or Docker
- Optional: a free LLM API key (Google Gemini recommended, or Groq/OpenAI/Anthropic)

## Installation (local)

```bash
git clone <repo-url>
cd cm-kerala-grievance
cp .env.example .env
npm run install:all                     # installs server/ and client/
```

Create the database (example user `cmk` / password `cmk`):

```bash
psql -U postgres -c "CREATE USER cmk WITH PASSWORD 'cmk' CREATEDB;"
psql -U postgres -c "CREATE DATABASE cmk_grievance OWNER cmk;"
psql -U postgres -c "CREATE DATABASE cmk_test OWNER cmk;"      # for automated tests
```

Run in development (two terminals):

```bash
npm run dev:server      # http://localhost:4000 — applies schema & seeds demo data on first run
npm run dev:client      # http://localhost:5173 — Vite dev server, proxies /api to :4000
```

Production mode (single process):

```bash
npm run build           # installs prod deps + builds client/dist
npm start               # Express serves API + SPA on $PORT
```

Docker:

```bash
GEMINI_API_KEY=your-key docker compose up --build    # http://localhost:4000
```

Reseed demo data at any time: `npm run seed:reset`.

## Configuration — environment variables

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `production` enables secure cookies and requires a strong `JWT_SECRET` |
| `PORT` | `4000` | HTTP port |
| `DATABASE_URL` | `postgres://cmk:cmk@localhost:5432/cmk_grievance` | PostgreSQL connection string |
| `DATABASE_SSL` | `false` | `true` for hosted DBs that require TLS (Neon, Supabase, Render external URL) |
| `JWT_SECRET` | dev-only value | **≥ 32 random chars in production** (`openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | `8h` | Session lifetime |
| `SEED_ON_START` | `true` | Seed fictional data if the DB is empty |
| `CORS_ORIGIN` | *(empty)* | Comma-separated origins, only if the SPA is hosted separately |
| `MAX_UPLOAD_MB` | `5` | Per-file upload limit |
| `DEFAULT_SLA_DAYS` | `15` | Target date before a department is assigned |
| `AI_PROVIDER` | `auto` | `auto` / `gemini` / `openai` / `anthropic` / `fallback` |
| `AI_TIMEOUT_MS` | `20000` | LLM request timeout |
| `AI_DUPLICATE_THRESHOLD` | `0.42` | Cosine similarity needed to flag a duplicate |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | — , `gemini-2.5-flash` | Google Gemini |
| `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` | — , OpenAI URL, `gpt-4o-mini` | Any OpenAI-compatible API (e.g. Groq: `https://api.groq.com/openai/v1`, `llama-3.3-70b-versatile`) |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | — , `claude-haiku-4-5` | Anthropic |
| `TEST_DATABASE_URL` | `postgres://cmk:cmk@localhost:5432/cmk_test` | Used by `npm test` only |

`.env.example` contains every variable with no real secrets. `.env` is git-ignored.

## Deployment (Render)

1. Push to GitHub → Render → **New → Blueprint** → select repo (uses `render.yaml`).
2. Render creates the web service + free PostgreSQL, generates `JWT_SECRET`, runs `npm run build`, starts `npm start`. Schema and demo data are created on first boot.
3. Add `GEMINI_API_KEY` under *Environment* → *Save* (auto-redeploys).
4. Verify: `https://<app>.onrender.com/api/health` → `{"ok":true}`; open the site and log in with the demo accounts.

Note: free Render services sleep after inactivity — the first request may take ~30–50 s.

## Automated tests

```bash
npm test          # = cd server && NODE_ENV=test jest --runInBand
```

The suite resets and reseeds `cmk_test`, forces `AI_PROVIDER=fallback` (no external calls) and disables rate limits.

**`tests/unit.test.js`** (8 tests)
| Test | Verifies |
|---|---|
| reference format | `CMK-YY-DIS-XXXXXX` pattern, district code, 2000 generated IDs all unique |
| duplicate detection | near-duplicate flagged, unrelated complaint not flagged; stop-word removal |
| JSON extraction | handles fenced model output |
| normalisation + validation | case-insensitive enum matching |
| hallucination guard | unknown department code rejected |
| prompt safety | complaint wrapped in `<complaint>` delimiters, system prompt treats it as data |
| fallback | water complaint → Water Supply / WRD / High, labelled as fallback |

**`tests/workflow.test.js`** (16 tests, real HTTP + PostgreSQL)
| # | Scenario | Expected |
|---|---|---|
| 1 | Public departments, stats, contact (valid + invalid) | 200/201, invalid → 400 |
| 2 | Register: weak input, success, duplicate email (different case) | 400 → 201 → 409 |
| 3 | Wrong password; anonymous list | 401 |
| 4 | Citizen calls `/admin/stats` | 403 |
| 5 | AI analyze | Water Supply / High / WRD, flagged fallback |
| 6 | Submit with PNG attachment | 201, reference `CMK-..-KLM-…`, 1 attachment |
| 7 | Upload text file disguised as PNG | 415 |
| 8 | Public tracker | status shown, no citizen email in payload |
| 9 | Officer acts before assignment | 403 |
| 10 | CMO review → forward; other department reads record | Under Review, dept set; 404 for other dept |
| 11 | Citizen tries ATR review / early feedback | 403 / 409 |
| 12 | Officer start → progress → ATR with file; duplicate ATR | In Progress; second ATR 409 |
| 13 | CMO returns ATR without remarks, with remarks; officer resubmits; CMO accepts | 400 → 200 → Resolved |
| 14 | Citizen view hides internal remarks & ATR files; downloads own attachment; reopens; full ordered history with actor roles | ✓ |
| 15 | Escalate → re-forward → resolve → feedback; duplicate feedback | 409 on second feedback |
| 16 | CMO stats & combined filters include the new record | ✓ |

Latest run:
```
PASS tests/unit.test.js
PASS tests/workflow.test.js
Tests:       24 passed, 24 total
```

## Manual test checklist (UI)

| # | Steps | Expected |
|---|---|---|
| M1 | Home → *Submit grievance* while logged out | Redirect to login, then back to the form |
| M2 | Register with mobile `12345` | Inline error "Enter a valid 10-digit Indian mobile number" |
| M3 | Citizen → type a 60+ character description and pause | AI panel appears with suggestions; "Use suggested category" fills the dropdown |
| M4 | Edit description after analysis | "You edited the complaint after analysis" + Re-analyse |
| M5 | Attach a 6 MB file / a .docx | Rejected client-side with a message (server also enforces) |
| M6 | Submit | Success screen with reference + copy button |
| M7 | Track page with that reference (logged out) | Status stepper, department, public timeline |
| M8 | CMO → Overview | KPIs, charts; click *Overdue* tile → filtered list |
| M9 | CMO → open new grievance | AI triage panel; forward form pre-selects AI department marked ✦ AI |
| M10 | Forward to Water Resources with instructions | Timeline shows *Forwarded*; officer sees it under *New assignments* |
| M11 | Officer → Start investigation → Post public update → Submit ATR with PDF | Citizen sees update; CMO ATR queue count +1 |
| M12 | CMO → Return ATR with remarks | Officer sees "Returned by CMO" banner; resubmits |
| M13 | CMO → Accept & resolve with message | Citizen sees Resolved + message; feedback form |
| M14 | Citizen → 5★ feedback, then reopen another resolved case | Feedback shown to CMO; status Reopened |
| M15 | Officer of another department opens the grievance URL | "Grievance not found" |
| M16 | Phone width (390 px) | Collapsible menu, single-column layout, horizontal sidebar tabs |

## Security notes

- Passwords: bcrypt; login uses a constant-time dummy compare for unknown emails.
- Sessions: JWT in `httpOnly`, `SameSite=Lax`, `Secure` (production) cookie.
- Authorisation: role checks + SQL scoping on every grievance query; 404 for out-of-scope records.
- Input: zod schemas on all bodies/queries; parameterised SQL only (sort/pagination values are whitelisted/validated).
- Uploads: MIME whitelist + magic-byte verification, size and count limits, sanitised filenames, `Content-Disposition` + `nosniff` on download.
- Headers: helmet with a Content-Security-Policy; `x-powered-by` disabled.
- Abuse: per-IP rate limits on login/register, AI, contact and the API overall.
- Secrets: none in the repository; `.env` ignored; `render.yaml` generates `JWT_SECRET` and marks API keys `sync: false`.
