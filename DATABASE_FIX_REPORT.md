# Database Error Report & Fix

## The Issue
You encountered a `42703` error from PostgreSQL:
```
error: column "email_verified" of relation "users" does not exist
```

### Explanation
The backend code (specifically `auth.service.ts`) was trying to insert data into columns that **did not exist** in your database table `users`.
This happened because the initial database schema (`schema.sql`) created a basic version of the table, but the authentication code was updated to use newer features like Email Verification and Referral Codes, which require extra columns.

**Missing Columns:**
- `email_verified` (Boolean)
- `password_hash` (String)
- `verification_token` (String)
- `referral_code` (String)
- `referred_by_id` (UUID)

## The Solution
I created and ran a patch script (`apply_db_fix.ts`) that executed the following SQL commands to update your live database without losing data:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_id UUID REFERENCES users(id) ON DELETE SET NULL;
```

## Status
✅ **Fix Applied Successfully.**
The database now matches what the backend code expects.

## Next Steps
1. Restart your backend server (`npm run dev`).
2. Log in again. It will work now.
