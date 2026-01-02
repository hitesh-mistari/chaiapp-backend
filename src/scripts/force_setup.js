import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SQL_PATH = path.join(__dirname, '../../database/setup_chai_db.sql');

async function setup() {
    console.log('🚀 Starting Full Database Setup (Hardcoded Creds)...');

    // Hardcoded known credentials
    const password = 'Hassan@1216';
    const encodedPassword = encodeURIComponent(password);
    
    // 1. Connect to default 'postgres' database
    const rootUrl = `postgresql://postgres:${encodedPassword}@localhost:5432/postgres`;
    const client = new Client({ connectionString: rootUrl });

    try {
        await client.connect();
        console.log('✅ Connected to Postgres root.');

        // 2. Create chai_db if not exists
        const dbCheck = await client.query("SELECT 1 FROM pg_database WHERE datname = 'chai_db'");
        if (dbCheck.rows.length === 0) {
            console.log('📦 Creating database chai_db...');
            await client.query('CREATE DATABASE chai_db');
            console.log('✅ Database created.');
        } else {
            console.log('ℹ️  Database chai_db already exists.');
        }
        await client.end();

        // 3. Connect to chai_db
        const dbUrl = `postgresql://postgres:${encodedPassword}@localhost:5432/chai_db`;
        const dbClient = new Client({ connectionString: dbUrl });
        await dbClient.connect();
        console.log('✅ Connected to chai_db.');

        // 4. Run SQL Schema
        console.log('📜 Running Schema...');
        const sql = fs.readFileSync(SQL_PATH, 'utf8');
        await dbClient.query(sql);
        console.log('✅ Schema applied successfully!');
        await dbClient.end();

        console.log('\n🎉 Setup Complete!');

    } catch (error) {
        console.error('❌ Setup failed:', error);
    }
}

setup();
