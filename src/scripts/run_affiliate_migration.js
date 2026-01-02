import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SQL_PATH = path.join(__dirname, 'migrate_affiliate.sql');

async function migrate() {
    console.log('🚀 Starting Affiliate Migration...');

    // Hardcoded known credentials (from your prev context)
    const password = 'Hassan@1216';
    const encodedPassword = encodeURIComponent(password);
    const dbUrl = `postgresql://postgres:${encodedPassword}@localhost:5432/chai_db`;

    const client = new Client({ connectionString: dbUrl });

    try {
        await client.connect();
        console.log('✅ Connected to chai_db.');

        console.log('📜 Reading SQL...');
        const sql = fs.readFileSync(SQL_PATH, 'utf8');
        
        console.log('⚙️ Executing Migration...');
        // We use split(';') to run commands one by one if preferred, but pg driver handles simple scripts well usually.
        // For safety with 'pgcrypto' extension and complex logic, running as block is fine.
        await client.query(sql);
        
        console.log('✅ Affiliate Migration Applied Successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await client.end();
    }
}

migrate();
