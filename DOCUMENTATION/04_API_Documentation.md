# 04 · API Documentation

Base URL: `https://<host>/api` (local: `http://localhost:4000/api`). All bodies are JSON unless marked **multipart**.

## Conventions

- **Authentication:** `POST /auth/login` sets an `httpOnly`, `SameSite=Lax` cookie `cmk_token` (JWT, 8 h). API clients may instead send `Authorization: Bearer <token>` using the `token` returned by login/register.
- **Roles:** `citizen`, `cmo_admin`, `dept_officer`. 🔓 public · 👤 any logged-in user · 🧑 citizen · 🏛 CMO admin · 🛠 department officer.
- **Scoping:** grievance endpoints only return records the caller may see (own / own department / all). Others → `404`.
- **Errors:** `{ "error": "message", "details": [{ "field": "email", "message": "Enter a valid email" }] }`

| Status | Meaning |
|---|---|
| 400 | Validation failed (`details` lists fields) |
| 401 | Not logged in / bad credentials |
| 403 | Logged in but wrong role or not your department |
| 404 | Not found or out of scope |
| 409 | Action not allowed in the grievance's current state (e.g. feedback before resolution) or duplicate |
| 413 / 415 | Upload too large / wrong or spoofed file type |
| 429 | Rate limit exceeded |

## Endpoint summary

| # | Method | Path | Access | Purpose |
|---|---|---|---|---|
| 1 | POST | `/auth/register` | 🔓 | Citizen registration |
| 2 | POST | `/auth/login` | 🔓 | Login (all roles) |
| 3 | POST | `/auth/logout` | 🔓 | Clear session cookie |
| 4 | GET | `/auth/me` | 🔓 | Current user or `null` |
| 5 | GET | `/meta` | 🔓 | Districts, categories, statuses, priorities, AI provider status |
| 6 | GET | `/departments` | 🔓 | **Retrieve departments** |
| 7 | GET | `/stats/public` | 🔓 | Home-page statistics |
| 8 | GET | `/track/:reference` | 🔓 | **Track grievance by ID** (no personal data) |
| 9 | POST | `/contact` | 🔓 | Save contact enquiry |
| 10 | POST | `/ai/analyze` | 🧑 🏛 | **AI grievance analysis** |
| 11 | GET | `/ai/status` | 🔓 | Which AI provider/model is active |
| 12 | POST | `/grievances` | 🧑 | **Submit grievance** (multipart, ≤3 files) |
| 13 | GET | `/grievances` | 👤 | **List grievances** (scoped, filters, pagination) |
| 14 | GET | `/grievances/summary` | 👤 | Counts for the caller's dashboard |
| 15 | GET | `/grievances/:id` | 👤 | Full record: history, remarks, attachments, assignments, feedback, AI |
| 16 | GET | `/grievances/:id/attachments/:attachmentId` | 👤 | Download/view a file |
| 17 | POST | `/grievances/:id/review` | 🏛 | **Status → Under Review** |
| 18 | POST | `/grievances/:id/forward` | 🏛 | Forward / reassign to department (+officer) |
| 19 | POST | `/grievances/:id/escalate` | 🏛 | Escalate (priority High) |
| 20 | POST | `/grievances/:id/review-atr` | 🏛 | Accept (→ Resolved) or return an ATR |
| 21 | POST | `/grievances/:id/resolve` | 🏛 | Close at CMO level (→ Resolved) |
| 22 | PATCH | `/grievances/:id` | 🏛 | Change priority / category |
| 23 | POST | `/grievances/:id/ai/reanalyse` | 🏛 | Re-run AI analysis |
| 24 | POST | `/grievances/:id/start` | 🛠 | **Status → In Progress** |
| 25 | POST | `/grievances/:id/progress` | 🛠 | Investigation remark (public/internal) |
| 26 | POST | `/grievances/:id/atr` | 🛠 | Submit action-taken report (multipart, optional file) |
| 27 | POST | `/grievances/:id/return` | 🛠 | Return mis-routed grievance to CMO |
| 28 | POST | `/grievances/:id/reopen` | 🧑 | **Status → Reopened** (≤30 days after resolution) |
| 29 | POST | `/grievances/:id/feedback` | 🧑 | Rate resolution (1–5) |
| 30 | POST | `/grievances/:id/remarks` | 🏛 🛠 | Add internal or public remark |
| 31 | GET | `/admin/stats` | 🏛 | **CMO statistics** |
| 32 | GET | `/admin/officers?departmentId=` | 🏛 | Officers with open-case counts |
| 33 | GET | `/admin/enquiries` | 🏛 | Contact enquiries |
| 34 | PATCH | `/admin/enquiries/:id` | 🏛 | Update enquiry status |
| 35 | GET | `/health` | 🔓 | Liveness probe |

"Update grievance status" from the brief is implemented as explicit, validated transitions (17, 20, 21, 24, 28) rather than a free-form status setter, so invalid jumps (e.g. Submitted → Resolved by an officer) are impossible.

---

## Authentication

### `POST /auth/register`
```json
{ "name": "Anjali Menon", "email": "anjali@example.com", "mobile": "9847000001", "password": "Passw0rd!" }
```
Rules: name 2–120 chars; valid email (unique, case-insensitive); Indian mobile `[6-9]XXXXXXXXX` (optional `+91`); password ≥ 8 with a letter and a digit.
`201`
```json
{ "user": { "id": 17, "name": "Anjali Menon", "email": "anjali@example.com", "mobile": "9847000001", "role": "citizen", "departmentId": null, "departmentName": null, "designation": null }, "token": "eyJhbGciOi..." }
```
`409` if the email exists.

### `POST /auth/login`
```json
{ "email": "admin@cmkportal.test", "password": "Admin@123" }
```
`200` → same shape as register (+ `Set-Cookie: cmk_token=…; HttpOnly; SameSite=Lax`). `401` `{ "error": "Invalid email or password" }`.

### `GET /auth/me` → `{ "user": {…} }` or `{ "user": null }`

---

## Public

### `GET /departments`
```json
{ "departments": [ { "id": 2, "code": "WRD", "name": "Water Resources Department", "description": "Drinking water supply, …", "icon": "droplet", "categories": ["Water Supply"], "sla_days": 10, "is_featured": true, "resolved_count": 3 } ] }
```

### `GET /stats/public`
```json
{ "total": 56, "resolved": 22, "pending": 34, "avg_resolution_days": 8.6, "departments": 14, "districts": 13 }
```

### `GET /track/CMK-26-KKD-GMXPAN`
```json
{
  "grievance": { "reference_no": "CMK-26-KKD-GMXPAN", "district": "Kozhikode", "category": "Electricity", "subject": "Streetlights not working on beach road",
                 "status": "Resolved", "priority": "High", "department_name": "Power Department", "created_at": "2026-11-12T07:08:30Z", "resolved_at": "2026-11-12T07:08:32Z", "due_date": "2026-11-19T07:08:31Z" },
  "history": [
    { "action": "submitted", "from_status": null, "to_status": "Submitted", "remarks": "Grievance submitted online. Reference CMK-26-KKD-GMXPAN generated.", "created_at": "…", "actor": "Citizen" },
    { "action": "forwarded", "from_status": "Submitted", "to_status": "Under Review", "remarks": "Forwarded to Power Department. Target date: 2026-11-19.", "created_at": "…", "actor": "CMO" }
  ]
}
```
`400` invalid format · `404` unknown reference. Only `is_public` history entries are returned; no names, emails or phone numbers.

### `POST /contact`
```json
{ "name": "Kiran", "email": "kiran@example.com", "subject": "Upload limit", "message": "What is the maximum file size?" }
```
`201 { "ok": true, "id": 3 }`

---

## AI

### `POST /ai/analyze`  🧑 🏛 (12 requests/min)
```json
{ "subject": "No water", "district": "Kollam",
  "description": "No drinking water from the tap in our colony for 10 days; elderly residents are suffering." }
```
`200`
```json
{ "analysis": {
    "analysisId": 60, "provider": "gemini", "model": "gemini-2.5-flash", "isFallback": false, "latencyMs": 1430,
    "category": "Water Supply", "priority": "High",
    "department": { "id": 2, "code": "WRD", "name": "Water Resources Department" },
    "summary": "Residents of a colony in Kollam have had no piped drinking water for 10 days; elderly residents are affected.",
    "rationale": "Essential water supply cut off for over a week affecting vulnerable residents.",
    "keywords": ["drinking water", "no supply", "elderly"], "confidence": 0.9,
    "duplicates": [ { "id": 41, "reference_no": "CMK-26-KLM-8H2QWE", "subject": "No drinking water supply for 12 days", "status": "In Progress", "district": "Kollam", "score": 0.61 } ],
    "createdAt": "2026-11-12T07:11:07.616Z" } }
```
When no model is configured or the call fails: `"provider": "fallback", "isFallback": true, "model": null` and a rationale beginning *"Heuristic fallback"*.

---

## Grievances

### `POST /grievances`  🧑  **multipart/form-data**
| Field | Required | Notes |
|---|---|---|
| district | ✓ | one of the 14 districts (`GET /meta`) |
| category | ✓ | one of the categories |
| subject | ✓ | 5–200 chars |
| description | ✓ | 20–5000 chars |
| aiAnalysisId | | id from `/ai/analyze`; reused only if it belongs to the caller and the text is unchanged, otherwise a fresh analysis is run |
| attachments | | 0–3 files, JPG/PNG/WEBP/PDF, ≤ 5 MB each, content verified |

```bash
curl -b cookies -F district=Kollam -F category="Water Supply" -F subject="No drinking water" \
     -F description="No drinking water from the tap in our colony for 10 days." \
     -F attachments=@photo.jpg http://localhost:4000/api/grievances
```
`201`
```json
{ "grievance": { "id": 57, "reference_no": "CMK-26-KLM-7K3F9Q", "status": "Submitted", "created_at": "…",
  "attachments": [ { "id": 12, "kind": "evidence", "original_name": "photo.jpg", "mime_type": "image/jpeg", "size_bytes": 182344 } ] } }
```

### `GET /grievances`
Query parameters (all optional): `status`, `district`, `category`, `priority`, `departmentId`, `overdue=true`, `escalated=true`, `unassigned=true`, `atr=pending_review|awaiting_atr|returned`, `q` (reference/subject search), `sort=newest|oldest|due|priority|updated`, `page` (1+), `pageSize` (1–100).
```json
{ "items": [ { "id": 57, "reference_no": "CMK-26-KLM-7K3F9Q", "district": "Kollam", "category": "Water Supply", "subject": "No drinking water",
               "priority": "High", "status": "Under Review", "is_escalated": false, "is_overdue": false, "department_name": "Water Resources Department",
               "atr_status": "awaiting_atr", "created_at": "…", "updated_at": "…", "due_date": "…" } ],
  "total": 1, "page": 1, "pageSize": 20 }
```

### `GET /grievances/summary`
```json
{ "total": 12, "submitted": 5, "under_review": 1, "in_progress": 2, "resolved": 4, "reopened": 0, "pending": 8, "overdue": 2, "escalated": 1 }
```
Officers additionally receive `atr_pending`, `atr_returned`, `new_assignments`.

### `GET /grievances/:id`
```json
{ "grievance": { "...": "all columns + department_name, citizen_name, is_overdue, ai_suggested_department_name (staff also get citizen_email/mobile)" },
  "history": [ { "action": "reviewed", "from_status": "Submitted", "to_status": "Under Review", "remarks": "…", "is_public": true, "actor_name": "Priya Raghavan", "actor_role": "cmo_admin", "created_at": "…" } ],
  "remarks": [ { "id": 3, "visibility": "public", "body": "Site inspection completed.", "author_name": "Department Officer", "created_at": "…" } ],
  "attachments": [ { "id": 12, "kind": "evidence", "original_name": "photo.jpg", "mime_type": "image/jpeg", "size_bytes": 182344 } ],
  "assignments": [ { "department_name": "Water Resources Department", "officer_name": "Deepa Mohan", "is_current": true, "due_date": "…", "atr_text": null, "review_status": "awaiting_atr" } ],
  "feedback": null,
  "ai": { "provider": "gemini", "model": "gemini-2.5-flash", "is_fallback": false, "result": { "category": "Water Supply", "department_code": "WRD", "priority": "High", "summary": "…" }, "duplicates": [] } }
```
Citizens receive only public history/remarks and evidence attachments; `assignments` is empty for citizens.

### Workflow actions

| Endpoint | Body | Allowed from | Result |
|---|---|---|---|
| `POST /:id/review` 🏛 | `{ "remarks"?, "priority"?, "category"? }` | Submitted, Reopened | Under Review |
| `POST /:id/forward` 🏛 | `{ "departmentId": 2, "officerId"?: 5, "priority"?: "High", "instructions"?: "…" }` | Submitted, Under Review, Reopened, In Progress | Under Review; new current assignment, due date = now + department SLA (halved if escalated) |
| `POST /:id/start` 🛠 | `{ "remarks"? }` | Under Review (assigned to caller's dept) | In Progress |
| `POST /:id/progress` 🛠 | `{ "remarks": "…", "visibility": "public" \| "internal" }` | In Progress | history + remark |
| `POST /:id/atr` 🛠 multipart | `report` (20–8000 chars), `attachment`? | In Progress, ATR not already pending | assignment `pending_review` |
| `POST /:id/review-atr` 🏛 | `{ "decision": "accept", "publicMessage"? }` or `{ "decision": "return", "remarks": "…" }` | ATR pending | Resolved / In Progress (`returned`) |
| `POST /:id/resolve` 🏛 | `{ "publicMessage": "…" }` | any open status | Resolved |
| `POST /:id/escalate` 🏛 | `{ "reason": "…" }` | any open status, not already escalated | priority High, internal history |
| `POST /:id/return` 🛠 | `{ "reason": "…" }` | Under Review, In Progress | Under Review, department cleared |
| `POST /:id/reopen` 🧑 | `{ "reason": "≥10 chars" }` | Resolved (≤ 30 days) | Reopened, feedback cleared |
| `POST /:id/feedback` 🧑 | `{ "rating": 1-5, "comments"? }` | Resolved, once | feedback row |
| `POST /:id/remarks` 🏛🛠 | `{ "body": "…", "visibility": "internal" \| "public" }` | any | remark |
| `PATCH /:id` 🏛 | `{ "priority"?, "category"? }` | any | history entry |

All return:
```json
{ "ok": true, "grievance": { "id": 57, "reference_no": "CMK-26-KLM-7K3F9Q", "status": "In Progress", "priority": "High", "department_id": 2, "is_escalated": false, "updated_at": "…" } }
```
Invalid transition example: `409 { "error": "Cannot give feedback on a grievance that is \"In Progress\"" }`.

---

## CMO administration

### `GET /admin/stats` 🏛
```json
{
  "kpi": { "total": 56, "pending": 34, "resolved": 22, "overdue": 14, "escalated": 3, "new_submissions": 5, "unassigned": 9,
           "last_7_days": 6, "avg_resolution_days": 8.6, "atr_pending": 9 },
  "byStatus":     [ { "status": "Resolved", "count": 22 } ],
  "byDistrict":   [ { "district": "Thrissur", "total": 9, "resolved": 1, "pending": 8, "overdue": 3 } ],
  "byDepartment": [ { "id": 2, "code": "WRD", "name": "Water Resources Department", "total": 5, "resolved": 2, "pending": 3, "overdue": 2, "avg_days": 7, "atr_pending": 1 } ],
  "byCategory":   [ { "category": "Water Supply", "count": 6 } ],
  "byPriority":   [ { "priority": "High", "count": 20 } ],
  "trend":        [ { "month": "Jun 26", "submitted": 10, "resolved": 2 } ],
  "ai":           { "analyses": 14, "live_model": 12, "fallback": 2, "avg_latency_ms": 1380, "category_agreement_pct": 93, "department_agreement_pct": 88 },
  "feedback":     { "responses": 15, "avg_rating": 4.2 }
}
```

### `GET /admin/officers?departmentId=2`
`{ "officers": [ { "id": 5, "name": "Deepa Mohan", "email": "wrd.officer@cmkportal.test", "designation": "…", "department_id": 2, "department_name": "Water Resources Department", "open_cases": 3 } ] }`

### `GET /admin/enquiries` · `PATCH /admin/enquiries/:id` `{ "status": "read" }`
