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

async function check() {
    try {
        console.log('🔄 Checking store_settings columns...');
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'store_settings'
            ORDER BY column_name;
        `);
        console.table(res.rows);

        console.log('\n🔄 Checking existing data for upi_id...');
        const dataRes = await pool.query('SELECT store_id, shop_name, upi_id FROM store_settings LIMIT 5');
        console.table(dataRes.rows);

    } catch (error) {
        console.error('❌ Check failed:', error);
    } finally {
        await pool.end();
    }
}

check();
