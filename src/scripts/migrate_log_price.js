import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/chaiapp_db',
});

async function migrate() {
    try {
        console.log('🔄 Adding price_at_time column to chai_logs...');

        await pool.query(`
            ALTER TABLE chai_logs 
            ADD COLUMN IF NOT EXISTS price_at_time DECIMAL(10, 2);
        `);

        console.log('✅ Migration successful.');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await pool.end();
    }
}

migrate();
