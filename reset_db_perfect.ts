
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function resetDb() {
    console.log('🔌 Connecting to database...');
    const client = await pool.connect();
    try {
        console.log('⚠️  Resetting Database (DROP SCHEMA public CASCADE)...');
        // Read the schema file
        const schema = fs.readFileSync(path.join(__dirname, 'perfect_schema.sql'), 'utf8');

        // Execute it
        await client.query(schema);

        console.log('✅ Database reset successfully with PERFECT schema!');
    } catch (err) {
        console.error('❌ Error resetting database:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

resetDb();
