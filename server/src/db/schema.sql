-- CM Kerala Grievance Redressal Portal (Recruitment Prototype)
-- PostgreSQL schema. Idempotent: safe to run on every boot.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('citizen', 'cmo_admin', 'dept_officer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE grievance_status AS ENUM ('Submitted', 'Under Review', 'In Progress', 'Resolved', 'Reopened');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE priority_level AS ENUM ('Low', 'Medium', 'High');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------- departments
CREATE TABLE IF NOT EXISTS departments (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(16)  NOT NULL UNIQUE,
  name          VARCHAR(160) NOT NULL,
  description   TEXT         NOT NULL,
  icon          VARCHAR(32)  NOT NULL DEFAULT 'building',
  categories    TEXT[]       NOT NULL DEFAULT '{}',   -- grievance categories this department usually handles
  sla_days      INTEGER      NOT NULL DEFAULT 15 CHECK (sla_days > 0),
  is_featured   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- users
CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(120) NOT NULL,
  email          VARCHAR(160) NOT NULL,
  mobile         VARCHAR(15)  NOT NULL,
  password_hash  VARCHAR(100) NOT NULL,
  role           user_role    NOT NULL DEFAULT 'citizen',
  department_id  INTEGER      REFERENCES departments(id) ON DELETE SET NULL,
  designation    VARCHAR(120),
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT officer_needs_department CHECK (role <> 'dept_officer' OR department_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uq ON users (lower(email));

-- ---------------------------------------------------------------- grievances
CREATE TABLE IF NOT EXISTS grievances (
  id                    SERIAL PRIMARY KEY,
  reference_no          VARCHAR(24)      NOT NULL UNIQUE,
  citizen_id            INTEGER          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  district              VARCHAR(40)      NOT NULL,
  category              VARCHAR(60)      NOT NULL,
  subject               VARCHAR(200)     NOT NULL,
  description           TEXT             NOT NULL,
  priority              priority_level   NOT NULL DEFAULT 'Medium',
  status                grievance_status NOT NULL DEFAULT 'Submitted',
  department_id         INTEGER          REFERENCES departments(id) ON DELETE SET NULL,  -- current department
  is_escalated          BOOLEAN          NOT NULL DEFAULT FALSE,
  escalated_at          TIMESTAMPTZ,
  due_date              TIMESTAMPTZ      NOT NULL,
  resolved_at           TIMESTAMPTZ,
  reopen_count          INTEGER          NOT NULL DEFAULT 0,
  -- AI suggestions are stored separately from official values; humans decide.
  ai_analysis_id        INTEGER,
  ai_summary            TEXT,
  ai_suggested_category VARCHAR(60),
  ai_suggested_priority priority_level,
  ai_suggested_department_id INTEGER     REFERENCES departments(id) ON DELETE SET NULL,
  ai_category_accepted  BOOLEAN,
  created_at            TIMESTAMPTZ      NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ      NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS grievances_citizen_idx   ON grievances (citizen_id);
CREATE INDEX IF NOT EXISTS grievances_status_idx    ON grievances (status);
CREATE INDEX IF NOT EXISTS grievances_dept_idx      ON grievances (department_id);
CREATE INDEX IF NOT EXISTS grievances_district_idx  ON grievances (district);
CREATE INDEX IF NOT EXISTS grievances_created_idx   ON grievances (created_at DESC);

-- ---------------------------------------------------------------- grievance history (audit trail)
CREATE TABLE IF NOT EXISTS grievance_history (
  id            SERIAL PRIMARY KEY,
  grievance_id  INTEGER          NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
  action        VARCHAR(40)      NOT NULL,     -- submitted, reviewed, forwarded, investigation_started, atr_submitted, ...
  from_status   grievance_status,
  to_status     grievance_status NOT NULL,
  remarks       TEXT,
  is_public     BOOLEAN          NOT NULL DEFAULT TRUE,  -- shown to citizen / public tracker
  actor_id      INTEGER          REFERENCES users(id) ON DELETE SET NULL,
  actor_role    user_role,
  created_at    TIMESTAMPTZ      NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS history_grievance_idx ON grievance_history (grievance_id, created_at);

-- ---------------------------------------------------------------- attachments (stored in DB so they survive stateless hosting)
CREATE TABLE IF NOT EXISTS attachments (
  id             SERIAL PRIMARY KEY,
  grievance_id   INTEGER      NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
  uploaded_by    INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  kind           VARCHAR(16)  NOT NULL DEFAULT 'evidence' CHECK (kind IN ('evidence', 'atr')),
  original_name  VARCHAR(255) NOT NULL,
  mime_type      VARCHAR(100) NOT NULL,
  size_bytes     INTEGER      NOT NULL,
  sha256         CHAR(64)     NOT NULL,
  data           BYTEA        NOT NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attachments_grievance_idx ON attachments (grievance_id);

-- ---------------------------------------------------------------- department assignments (+ action-taken reports)
CREATE TABLE IF NOT EXISTS department_assignments (
  id                   SERIAL PRIMARY KEY,
  grievance_id         INTEGER     NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
  department_id        INTEGER     NOT NULL REFERENCES departments(id),
  officer_id           INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  assigned_by          INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  instructions         TEXT,
  is_current           BOOLEAN     NOT NULL DEFAULT TRUE,
  assigned_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date             TIMESTAMPTZ NOT NULL,
  -- action-taken report (ATR)
  atr_text             TEXT,
  atr_attachment_id    INTEGER     REFERENCES attachments(id) ON DELETE SET NULL,
  atr_submitted_by     INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  atr_submitted_at     TIMESTAMPTZ,
  review_status        VARCHAR(16) NOT NULL DEFAULT 'awaiting_atr'
                       CHECK (review_status IN ('awaiting_atr', 'pending_review', 'accepted', 'returned', 'withdrawn')),
  reviewed_by          INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at          TIMESTAMPTZ,
  review_remarks       TEXT
);
CREATE INDEX IF NOT EXISTS assignments_grievance_idx ON department_assignments (grievance_id);
CREATE INDEX IF NOT EXISTS assignments_dept_current_idx ON department_assignments (department_id) WHERE is_current;
CREATE UNIQUE INDEX IF NOT EXISTS assignments_one_current_uq ON department_assignments (grievance_id) WHERE is_current;

-- ---------------------------------------------------------------- remarks (internal notes vs. citizen-visible updates)
CREATE TABLE IF NOT EXISTS remarks (
  id            SERIAL PRIMARY KEY,
  grievance_id  INTEGER     NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
  author_id     INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  author_role   user_role   NOT NULL,
  visibility    VARCHAR(10) NOT NULL CHECK (visibility IN ('internal', 'public')),
  body          TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS remarks_grievance_idx ON remarks (grievance_id, created_at);

-- ---------------------------------------------------------------- citizen feedback
CREATE TABLE IF NOT EXISTS feedback (
  id            SERIAL PRIMARY KEY,
  grievance_id  INTEGER     NOT NULL UNIQUE REFERENCES grievances(id) ON DELETE CASCADE,
  citizen_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating        SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comments      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- contact enquiries
CREATE TABLE IF NOT EXISTS contact_enquiries (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  email       VARCHAR(160) NOT NULL,
  subject     VARCHAR(200) NOT NULL,
  message     TEXT         NOT NULL,
  status      VARCHAR(12)  NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'closed')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- AI analysis log (every model call is auditable)
CREATE TABLE IF NOT EXISTS ai_analyses (
  id             SERIAL PRIMARY KEY,
  requested_by   INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  grievance_id   INTEGER     REFERENCES grievances(id) ON DELETE SET NULL,
  input_hash     CHAR(64)    NOT NULL,
  provider       VARCHAR(30) NOT NULL,
  model          VARCHAR(80),
  is_fallback    BOOLEAN     NOT NULL DEFAULT FALSE,
  result         JSONB       NOT NULL,
  duplicates     JSONB       NOT NULL DEFAULT '[]',
  latency_ms     INTEGER,
  error          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE grievances ADD CONSTRAINT grievances_ai_analysis_fk
    FOREIGN KEY (ai_analysis_id) REFERENCES ai_analyses(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
