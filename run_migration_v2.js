
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
    console.log('--- MIGRATION V2 ---');
    fs.writeFileSync('migration_log_v2.txt', 'Started\n');
    
    try {
        const client = await pool.connect();
        fs.appendFileSync('migration_log_v2.txt', 'Connected\n');
        
        await client.query('ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS customer_limit INTEGER DEFAULT 10');
        await client.query('ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider VARCHAR(50)');
        await client.query('ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255)');
        
        fs.appendFileSync('migration_log_v2.txt', 'Columns Added\n');
        
        client.release();
    } catch (err) {
        fs.appendFileSync('migration_log_v2.txt', 'Error: ' + err.message + '\n');
        console.error(err);
    } finally {
        await pool.end();
        fs.appendFileSync('migration_log_v2.txt', 'Done\n');
    }
}

main();
