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
});

async function verify() {
    try {
        console.log('check_start'); 
        const result = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'logs' AND column_name = 'price_at_time';
        `);

        if (result.rows.length > 0) {
            console.log('EXISTS');
        } else {
            console.log('MISSING');
        }
    } catch (error) {
        console.log('ERROR: ' + error.message);
    } finally {
        await pool.end();
    }
}

verify();
