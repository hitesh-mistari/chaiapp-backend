import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function migrate() {
    try {
        console.log('🔄 Checking payments table for status and receipt_url columns...');

        // Ensure paid_at exists (if it was intended to use this instead of payment_date)
        // or just add it if missing.
        await pool.query(`
            ALTER TABLE payments 
            ADD COLUMN IF NOT EXISTS paid_at BIGINT,
            ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completed',
            ADD COLUMN IF NOT EXISTS receipt_url TEXT;
        `);

        // Migrate data from payment_date to paid_at if paid_at is empty
        await pool.query(`
            UPDATE payments 
            SET paid_at = EXTRACT(EPOCH FROM payment_date) * 1000 
            WHERE paid_at IS NULL AND payment_date IS NOT NULL;
        `);

        console.log('✅ Migration successful.');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await pool.end();
    }
}

migrate();
