import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly loading env
dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000, // 5s connection timeout
});

async function runMigration() {
    try {
        console.log('CONNECTING...');
        const client = await pool.connect();
        console.log('CONNECTED');
        
        try {
            console.log('EXECUTING MIGRATION...');
            await client.query('SET lock_timeout = 5000;'); // 5s lock timeout
            
            const sql = `ALTER TABLE logs ADD COLUMN IF NOT EXISTS price_at_time DECIMAL(10, 2);`;
            await client.query(sql);

            console.log('SUCCESS: Migration executed.');
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('FAILURE:', error.message);
    } finally {
        console.log('ENDING POOL...');
        await pool.end();
        console.log('DONE');
    }
}

runMigration();
