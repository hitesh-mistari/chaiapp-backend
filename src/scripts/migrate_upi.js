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
        console.log('🔄 Checking for upi_id column in store_settings...');
        const res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'store_settings' AND column_name = 'upi_id';
        `);

        if (res.rows.length === 0) {
            console.log('➕ Adding upi_id column...');
            await pool.query('ALTER TABLE store_settings ADD COLUMN upi_id VARCHAR(255);');
            console.log('✅ Column added successfully.');
        } else {
            console.log('ℹ️ upi_id column already exists.');
        }
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await pool.end();
    }
}

migrate();
