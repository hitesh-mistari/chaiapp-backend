import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    try {
        console.log('--- TRANSACTIONS COLUMNS ---');
        const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'transactions'");
        console.log(cols.rows);

        const count = await pool.query("SELECT count(*) FROM transactions");
        console.log('\nTotal transactions:', count.rows[0].count);

        await pool.end();
    } catch (e) {
        console.error(e);
        await pool.end();
    }
}
check();
