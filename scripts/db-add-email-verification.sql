-- Email verification — schema change for the live database.
--
-- Run this INSTEAD of `pnpm db:push`.
--
-- `db:push` compares the live database against the Drizzle schema and offers to drop
-- anything it does not recognise. `user_sessions` is created at runtime by
-- connect-pg-simple and is not declared in the schema, so push offers to delete it —
-- which would sign out every logged-in user at once. This file makes only the two
-- additions that are actually needed.
--
-- Safe to run more than once. Adds two columns; drops nothing; deletes no rows.
--
--   psql "$DATABASE_URL" -f scripts/db-add-email-verification.sql

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token   text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_sent_at timestamptz;

-- Everyone who already has an account keeps signing in exactly as before. Without
-- this, switching on a mail provider would lock out every existing user — including
-- the super admins — because `is_email_verified` defaults to false.
UPDATE users SET is_email_verified = true WHERE is_email_verified = false;

COMMIT;

-- Verify:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'users' AND column_name LIKE 'email_verification%';
--   SELECT count(*) FROM users WHERE is_email_verified = false;   -- expect 0
