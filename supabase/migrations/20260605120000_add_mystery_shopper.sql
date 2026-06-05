-- Add mystery_shopper role and access_expires_at to profiles

-- 1. Add access_expires_at column
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS access_expires_at timestamptz DEFAULT NULL;

-- 2. Drop existing role check constraint and recreate with mystery_shopper
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check CHECK (
    role IN (
      'superadmin',
      'admin',
      'general_manager',
      'manager',
      'auditor',
      'quality',
      'engineering',
      'it',
      'systems',
      'mystery_shopper'
    )
  );

-- 3. Grant mystery_shopper access to all hotel areas on creation is handled at
--    app level (API creates user_area_access rows). No DB trigger needed.

-- 4. RLS: mystery_shopper can read their own profile and see their hotel data
-- (existing policies cover this via hotel_id match — no additional policies needed)