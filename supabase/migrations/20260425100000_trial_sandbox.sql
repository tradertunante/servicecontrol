-- Trial sandbox: campo trial_hotel_name en profiles + tabla trial_leads

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS trial_hotel_name text DEFAULT NULL;

CREATE TABLE IF NOT EXISTS trial_leads (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  email       text        NOT NULL UNIQUE,
  hotel_name  text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);