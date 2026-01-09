
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fixColumns() {
    console.log('🔌 Connecting to database...');
    const client = await pool.connect();
    try {
        console.log('🛠️ Fixing missing columns...');

        // 1. Fix Payments Table
        await client.query(`
            ALTER TABLE payments ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completed';
            ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_url TEXT;
            ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP WITH TIME ZONE; -- Legacy support if needed
        `);
        console.log('✅ Payments table patched (added status, receipt_url)');

        // 2. Fix Logs Table
        await client.query(`
            ALTER TABLE logs ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
            ALTER TABLE logs ADD COLUMN IF NOT EXISTS price_at_time DECIMAL(10, 2);
            ALTER TABLE logs ADD COLUMN IF NOT EXISTS drink_type VARCHAR(50);
            ALTER TABLE logs ADD COLUMN IF NOT EXISTS notes TEXT;
            ALTER TABLE logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        `);

        // Backfill store_id for logs if missing (using customer's store_id)
        await client.query(`
            UPDATE logs l
            SET store_id = c.store_id
            FROM customers c
            WHERE l.customer_id = c.id AND l.store_id IS NULL;
        `);

        console.log('✅ Logs table patched (added store_id, price_at_time, etc)');

        console.log('\n🎉 Database columns fixed successfully!');
    } catch (err) {
        console.error('❌ Error fixing columns:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

fixColumns();
