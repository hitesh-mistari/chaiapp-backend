
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyFix() {
    console.log('🔌 Connecting to database...');
    const client = await pool.connect();
    try {
        console.log('🛠️ Applying Schema Fixes...');

        // 1. Fix Users Table
        await client.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_id UUID REFERENCES users(id) ON DELETE SET NULL;
        `);
        console.log('✅ Users table patched (added email_verified, password_hash, referral_code, etc)');

        // 2. Fix Subscriptions Table (just in case)
        await client.query(`
            ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS customer_limit INTEGER DEFAULT 10;
            ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider VARCHAR(50);
            ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255);
        `);
        console.log('✅ Subscriptions table verified');

        console.log('\n🎉 Database fixed successfully!');
    } catch (err) {
        console.error('❌ Error fixing database:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

applyFix();
