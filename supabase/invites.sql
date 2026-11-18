-- ==============================================================================
-- SSC 2027 — INVITE-ONLY REGISTRATIONS
-- ==============================================================================
-- Adds a SEPARATE invites table for the exclusive re-launch.
-- The existing public.registrations table and its backup trigger are NOT
-- modified in any way — run this alongside the original schema.sql.
--
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)

CREATE TABLE IF NOT EXISTS public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  label TEXT,                          -- optional note: who this invite was sent to
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,              -- NULL = never expires
  used_at TIMESTAMPTZ,                 -- set the moment a registration redeems it
  registration_id UUID                 -- set after the successful registrations insert
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS invites_code_idx ON public.invites (code);
CREATE INDEX IF NOT EXISTS invites_used_idx ON public.invites (used_at);

-- Lock down: RLS enabled with ZERO policies. The public anon key cannot read,
-- write, or even confirm which codes exist. Only the server (service role)
-- touches this table via /api/invite/verify and /api/register.
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Lifecycle (all handled by the API):
--   1. Admin mints a code  -> row exists with used_at = NULL
--   2. Student opens link  -> /api/invite/verify checks it (read-only)
--   3. Form submitted      -> /api/register atomically claims the code
--                             (UPDATE ... WHERE used_at IS NULL) before the
--                             insert; released again if the insert fails
--   4. Success             -> registration_id links the invite to the row
--
-- Revoke an invite: DELETE the row (or set used_at to any non-null value).
-- Extend a batch:   UPDATE invites SET expires_at = '2026-12-31' WHERE ...
