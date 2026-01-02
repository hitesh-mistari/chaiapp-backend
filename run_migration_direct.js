
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config(); // Loads .env from current dir

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
    console.log('--- STARTING DIRECT MIGRATION ---');
    console.log('DB URL:', process.env.DATABASE_URL);
  
    try {
        const client = await pool.connect();
        console.log('Connected to DB.');

        try {
            console.log('Adding customer_limit...');
            // Try adding column without IF NOT EXISTS if postgres version is old, but typically 9.6+ supports it.
            // Using exception catching is safer for very old versions, but IF NOT EXISTS is standard now.
            await client.query('ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS customer_limit INTEGER DEFAULT 10');
            console.log('✅ customer_limit column ensured.');
        } catch (e) {
             console.error('⚠️ Could not add customer_limit:', e.message);
        }
        
        try {
            console.log('Adding provider...');
            await client.query('ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider VARCHAR(50)');
             console.log('✅ provider column ensured.');
        } catch (e) {
            console.error('⚠️ Could not add provider:', e.message);
        }

        try {
             console.log('Adding subscription_id...');
            await client.query('ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255)');
             console.log('✅ subscription_id column ensured.');
        } catch (e) {
            console.error('⚠️ Could not add subscription_id:', e.message);
        }

        client.release();
    } catch (err) {
        console.error('❌ FATAL DB ERROR:', err.message);
    } finally {
        await pool.end();
        console.log('--- MIGRATION FINISHED ---');
    }
}

main();
