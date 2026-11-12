# CM Kerala — Chief Minister's Public Grievance Redressal Portal

> **Recruitment prototype** built for the WhiteMatrix Software Solutions *AI Full Stack Engineer* machine test.
> It is **not** an official website and is **not** affiliated with or endorsed by the Government of Kerala or the Chief Minister's Office. All data is fictional.

A full-stack web application through which citizens submit grievances to the Chief Minister's Office (CMO), the CMO reviews and forwards them to departments, department officers investigate and file action-taken reports, and the CMO verifies and closes them — with an **AI Grievance Assistant** that suggests category, department and priority, writes a summary for the CMO and flags possible duplicates.

| | |
|---|---|
| **Hosted app** | `https://<your-app>.onrender.com` ← *replace after deploying (see below)* |
| **Stack** | React 18 + Vite · Node.js 22 + Express 4 · PostgreSQL 16 · Gemini / OpenAI-compatible / Claude LLM APIs |
| **Tests** | 24 automated tests (unit + full end-to-end workflow over the real API and database) |

![Architecture](DOCUMENTATION/diagrams/architecture.png)

---

## Demo login credentials (test accounts only)

| Role | Email | Password |
|---|---|---|
| Citizen | `citizen@cmkportal.test` | `Citizen@123` |
| CMO Administrator | `admin@cmkportal.test` | `Admin@123` |
| CMO Administrator (2) | `cmo.reviewer@cmkportal.test` | `Admin@123` |
| Department Officer — Water Resources | `wrd.officer@cmkportal.test` | `Officer@123` |
| Department Officer — Public Works | `pwd.officer@cmkportal.test` | `Officer@123` |
| Officer of any department | `<code>.officer@cmkportal.test` (`pwr`, `hfw`, `ged`, `rev`, `hom`, `sjd`, `agr`, `lsg`, `trn`, `fcs`, `for`, `gad`) | `Officer@123` |

The login page also has one-click demo buttons. You can register your own citizen account too.

---

## Feature checklist (mapped to the brief)

**1. Public website** — Home (hero, Submit/Track CTAs, live statistics, featured departments, footer) · About (purpose, vision, mission, objectives) · How It Works · Departments · Contact (saved to DB) · FAQ · public Track page.

**2. Citizen portal** — Register (name, email, mobile, password) / login / logout · submit grievance (district, category, subject, description, up to 3 image/PDF attachments) · unique reference ID (`CMK-26-TVM-7K3F9Q`) · track by reference with status history · dashboard with pending/resolved counts · officials' public remarks · star-rating feedback · reopen within 30 days.

**3. CMO dashboard** — all grievances · total / pending / resolved / overdue KPIs · filter by district, category, priority, status, department, overdue, escalated, ATR state, free-text search · open records and view attachments · forward/reassign to department and optionally a specific officer · internal vs citizen-visible remarks · escalation · ATR review queue (accept → Resolved, or return with remarks) · district-wise and department-wise charts and tables · monthly trend · AI agreement and citizen-satisfaction metrics · contact enquiries inbox.

**4. Department officer dashboard** — officer login · grievances forwarded to their department only · details + attachments · start investigation (status → In Progress) · investigation remarks (public or internal) · upload/enter action-taken report · submit to CMO for review · return mis-routed grievances to the CMO.

**5. Workflow** — `Submitted → Under Review → In Progress → Resolved / Reopened`, enforced by a server-side state machine. Every action writes a `grievance_history` row with timestamp, actor and role, inside a transaction with a row lock.

**6. AI integration** — real LLM call (Gemini, any OpenAI-compatible API, or Anthropic Claude) with a strict JSON contract, schema validation, prompt-injection guard, timeout/retry, and a **clearly labelled** fallback. TF-IDF duplicate detection. Suggestions are stored separately from official fields; humans decide. See [05_AI_Integration.md](DOCUMENTATION/05_AI_Integration.md).

**Security** — bcrypt passwords · JWT in httpOnly SameSite cookie · role-based access + per-record scoping · zod validation on every input · parameterised SQL · helmet CSP · rate limiting · upload type + magic-byte verification · public tracker exposes no personal data · unguessable reference numbers.

---

## Quick start (local)

Requirements: Node.js ≥ 20, PostgreSQL ≥ 14.

```bash
git clone <repo-url> && cd cm-kerala-grievance
cp .env.example .env              # edit DATABASE_URL; optionally add GEMINI_API_KEY
createdb cmk_grievance            # or: psql -c "CREATE DATABASE cmk_grievance"
npm run install:all
npm run dev:server                # API on :4000 — creates schema + seeds demo data
npm run dev:client                # UI on http://localhost:5173 (proxies /api)
```

Or with Docker: `docker compose up --build` → http://localhost:4000

Production-style single process: `npm run build && npm start` (Express serves the built React app).

Tests: `createdb cmk_test && npm test` (uses `TEST_DATABASE_URL`, default `postgres://cmk:cmk@localhost:5432/cmk_test`).

## Deploy (Render, free tier — ~10 minutes)

1. Push this repo to GitHub.
2. On [render.com](https://render.com): **New → Blueprint** → pick the repo. `render.yaml` creates the web service **and** a free PostgreSQL database, generates `JWT_SECRET`, and seeds demo data on first boot.
3. (Recommended) In the web service → *Environment*, set `GEMINI_API_KEY` (free key from Google AI Studio) so the assistant uses a live model. Without a key the app still works and shows the fallback badge.
4. Open the `.onrender.com` URL, log in with the demo accounts, and paste the URL at the top of this README.

Other hosts: any Node host + any Postgres (Neon, Supabase, Railway). Set `DATABASE_URL`, `DATABASE_SSL=true` for external TLS databases, `JWT_SECRET`, `NODE_ENV=production`; build `npm run build`, start `npm start`.

---

## Repository structure

```
├── client/                     React SPA (Vite)
│   └── src/
│       ├── components/         Layouts, AiPanel, UI kit (badges, timeline, tables), icons
│       ├── lib/                api client, auth & metadata contexts, formatters
│       └── pages/              public/, citizen/, cmo/, officer/, GrievanceDetail (role-aware)
├── server/                     Express API
│   ├── src/
│   │   ├── db/                 schema.sql, migrate, seed (fictional data), pool
│   │   ├── middleware/         auth (JWT + RBAC), errors, rate limits
│   │   ├── routes/             auth, public, grievances, admin, ai
│   │   └── services/           workflow (state machine), ai, aiAssistant, similarity, uploads, reference
│   └── tests/                  unit + end-to-end workflow tests (jest + supertest)
├── DOCUMENTATION/              01–07 docs + diagrams/ (architecture, ER, workflow)
├── render.yaml · Dockerfile · docker-compose.yml · .env.example
```

## Documentation

1. [Project Overview](DOCUMENTATION/01_Project_Overview.md)
2. [System Architecture](DOCUMENTATION/02_System_Architecture.md)
3. [Database Design](DOCUMENTATION/03_Database_Design.md) — ER diagram: [`diagrams/er-diagram.png`](DOCUMENTATION/diagrams/er-diagram.png)
4. [API Documentation](DOCUMENTATION/04_API_Documentation.md)
5. [AI Integration](DOCUMENTATION/05_AI_Integration.md)
6. [Setup and Testing](DOCUMENTATION/06_Setup_and_Testing.md)
7. [User Guide](DOCUMENTATION/07_User_Guide.md)

## Tools & third-party services disclosure

- **AI coding assistant:** Claude (Anthropic) was used to help write code and documentation. All design decisions were reviewed and the implementation can be explained end to end.
- **Libraries:** React, React Router, Recharts, Vite, Express, pg, bcryptjs, jsonwebtoken, multer, zod, helmet, express-rate-limit, cors, morgan, dotenv, Jest, Supertest.
- **External APIs (optional, configurable):** Google Gemini API, OpenAI-compatible APIs (e.g. Groq), Anthropic API.
- **Fonts:** Inter and Source Serif 4 via Google Fonts. Icons are drawn in-house as inline SVG.
- **No real citizen data, government credentials, emblems or logos are used.**

## Offline demo preview (no server needed)

`npm --prefix client run build:demo` produces `client/dist-demo/index.html`, one self-contained file that runs the same React UI against an **in-browser mock of the API** (`client/src/demo/mockApi.js`) with fictional data. Open it in any browser to click through every role. It is only a preview: the evaluated application is the real Express + PostgreSQL + LLM stack above, and the preview uses the labelled AI fallback.
