
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function patch() {
    console.log('Connecting to DB...');
    const client = await pool.connect();
    try {
        console.log('Checking columns in subscriptions...');
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'subscriptions'
        `);
        console.log('Current columns:', res.rows.map(r => r.column_name).join(', '));

        const hasLimit = res.rows.some(r => r.column_name === 'customer_limit');
        if (!hasLimit) {
            console.log('Adding missing column: customer_limit');
            await client.query('ALTER TABLE subscriptions ADD COLUMN customer_limit INTEGER DEFAULT 10');
            console.log('Column added.');
        } else {
            console.log('Column customer_limit already exists.');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

patch();
