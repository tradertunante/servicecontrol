-- Add photo_paths array column to support multiple photos per audit answer (max 5).
-- Keeps photo_path (text) for backward compat with existing RPC validation.
-- photo_path is kept in sync with photo_paths[1] by application layer.

ALTER TABLE audit_answers
  ADD COLUMN IF NOT EXISTS photo_paths text[] NOT NULL DEFAULT '{}';

-- Backfill: convert existing single photo_path to array
UPDATE audit_answers
SET photo_paths = ARRAY[photo_path]
WHERE photo_path IS NOT NULL
  AND array_length(photo_paths, 1) IS NULL;