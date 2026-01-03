-- Add price_at_time column to logs table
ALTER TABLE logs ADD COLUMN IF NOT EXISTS price_at_time DECIMAL(10, 2);
