-- Admin approval for open registration — schema change for the live database.
--
-- Run this INSTEAD of `pnpm db:push`.
--
-- `db:push` compares the live database against the Drizzle schema and offers to drop
-- anything it does not recognise. `user_sessions` is created at runtime by
-- connect-pg-simple and is not declared in the schema, so push offers to delete it —
-- which would sign out every logged-in user at once. This file makes only the
-- additions that are actually needed.
--
-- Safe to run more than once. Adds three columns; drops nothing; deletes no rows.
--
--   psql "$DATABASE_URL" -f scripts/db-add-admin-approval.sql

BEGIN;

-- The column is created with DEFAULT 'approved', so every row that already exists is
-- back-filled to 'approved' in the same statement. Without that, adding the gate would
-- lock out every existing account — including the super admins — at the next sign-in.
ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved';
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at     timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by     text;

-- Belt and braces: if the column already existed from an earlier partial run, make
-- sure no existing account is left in a non-approved state by this migration.
UPDATE users SET approval_status = 'approved' WHERE approval_status IS NULL;

COMMIT;

-- Verify:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'users' AND column_name LIKE 'approv%';
--   SELECT approval_status, count(*) FROM users GROUP BY approval_status;
--     -- every pre-existing user should read 'approved'
