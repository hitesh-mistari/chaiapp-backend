const pg = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
});

async function updateSchema() {
    try {
        console.log('--- Updating Schema: Adding Email Verification Columns ---');

        // Add email_verified and verification_token to users table
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS verification_token TEXT;
        `);
        console.log('✅ Added email_verified and verification_token columns to users table.');

        // Update existing users to be verified (so we don't lock out the developer)
        await pool.query(`
            UPDATE users SET email_verified = TRUE WHERE email_verified IS FALSE;
        `);
        console.log('✅ Marked existing users as verified.');

        console.log('--- Schema Update Complete ---');
    } catch (err) {
        console.error('❌ Error updating schema:', err);
    } finally {
        await pool.end();
    }
}

updateSchema();
