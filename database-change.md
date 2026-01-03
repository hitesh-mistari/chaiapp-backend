# Database Changes

This file documents all database schema changes.

## 2026-01-02

- **Change:** Added `price_at_time` column to `logs` table.
- **Reason:** Fix error `column "price_at_time" of relation "logs" does not exist` when creating new logs.
- **Migration:** `src/migrations/001_add_price_at_time_to_logs.sql`
