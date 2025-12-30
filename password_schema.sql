-- Add password_hash to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Remove NOT NULL constraint from google_id if it exists (since email/pass users won't have it)
ALTER TABLE users ALTER COLUMN google_id DROP NOT NULL;

-- Ensure email is unique
ALTER TABLE users ADD CONSTRAINT unique_email UNIQUE (email);
