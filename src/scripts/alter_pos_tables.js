import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    try {
        console.log('🔄 Adding store_id to POS tables...');

        await pool.query('ALTER TABLE chai_logs ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE');
        await pool.query('ALTER TABLE payments ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE');

        console.log('✅ store_id added');
        await pool.end();
    } catch (error) {
        console.error('❌ Alter failed:', error);
        await pool.end();
        process.exit(1);
    }
}

run();
