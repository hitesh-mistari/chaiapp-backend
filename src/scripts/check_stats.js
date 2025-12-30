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

async function check() {
    try {
        const stores = await pool.query('SELECT count(*) FROM stores');
        const settings = await pool.query('SELECT count(*) FROM store_settings');
        console.log('Stores:', stores.rows[0].count);
        console.log('Store Settings:', settings.rows[0].count);

        console.log('\n--- Store Settings Detail ---');
        const detail = await pool.query('SELECT store_id, shop_name, upi_id FROM store_settings');
        console.table(detail.rows);

    } catch (error) {
        console.error('❌ Check failed:', error);
    } finally {
        await pool.end();
    }
}

check();
