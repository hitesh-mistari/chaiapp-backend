
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function runDiagnostics() {
    console.log('--- DB DIAGNOSTICS ---');
    console.log('Connection String:', process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':****@')); // Hide password

    try {
        const client = await pool.connect();
        console.log('✅ Connectivity: OK');

        // Check Extensions
        const extRes = await client.query("SELECT * FROM pg_extension WHERE extname = 'uuid-ossp'");
        console.log('UUID Extension:', extRes.rows.length > 0 ? 'INSTALLED' : 'MISSING');

        if (extRes.rows.length === 0) {
            console.log('Attempting to install uuid-ossp...');
            try {
                await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
                console.log('✅ Extension installed.');
            } catch (e) {
                console.error('❌ Failed to install extension:', e.message);
            }
        }

        // Check Tables
        const tablesRes = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        const tables = tablesRes.rows.map(r => r.table_name);
        console.log('Tables found:', tables.join(', '));

        if (tables.includes('subscriptions')) {
            const colsRes = await client.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'subscriptions'
            `);
            console.log('Subscriptions Columns:', colsRes.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
        } else {
            console.log('❌ Table "subscriptions" is MISSING');
        }

        client.release();
    } catch (err: any) {
        console.error('❌ Connection or Query Error:', err.message);
    } finally {
        await pool.end();
    }
}

runDiagnostics();
