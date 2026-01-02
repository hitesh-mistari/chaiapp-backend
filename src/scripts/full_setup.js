import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENV_PATH = path.join(__dirname, '../../.env');
const SQL_PATH = path.join(__dirname, '../../database/setup_chai_db.sql');

async function setup() {
    console.log('🚀 Starting Full Database Setup...');

    // 1. Read .env to get password
    let envContent = fs.readFileSync(ENV_PATH, 'utf8');
    const passwordMatch = envContent.match(/postgresql:\/\/postgres:(.+?)@/);
    
    if (!passwordMatch) {
        console.error('❌ Could not find password in .env');
        process.exit(1);
    }
    
    // Decode if it was already encoded, then re-encode for safety
    let password = decodeURIComponent(passwordMatch[1]);
    const encodedPassword = encodeURIComponent(password);
    
    console.log('🔑 Password retrieved.');

    // 2. Connect to default 'postgres' database to create new DB
    const rootUrl = `postgresql://postgres:${encodedPassword}@localhost:5432/postgres`;
    const client = new Client({ connectionString: rootUrl });

    try {
        await client.connect();
        console.log('✅ Connected to Postgres root.');

        // 3. Create chai_db if not exists
        const dbCheck = await client.query("SELECT 1 FROM pg_database WHERE datname = 'chai_db'");
        if (dbCheck.rows.length === 0) {
            console.log('📦 Creating database chai_db...');
            await client.query('CREATE DATABASE chai_db');
            console.log('✅ Database created.');
        } else {
            console.log('ℹ️  Database chai_db already exists.');
        }
        await client.end();

        // 4. Connect to new chai_db
        const dbUrl = `postgresql://postgres:${encodedPassword}@localhost:5432/chai_db`;
        const dbClient = new Client({ connectionString: dbUrl });
        await dbClient.connect();
        console.log('✅ Connected to chai_db.');

        // 5. Run SQL Schema
        console.log('📜 Running Schema...');
        const sql = fs.readFileSync(SQL_PATH, 'utf8');
        await dbClient.query(sql);
        console.log('✅ Schema applied successfully!');
        await dbClient.end();

        // 6. Update .env to point to chai_db
        if (!envContent.includes('chai_db')) {
            console.log('📝 Updating .env to use chai_db...');
            envContent = envContent.replace(/DATABASE_URL=.*/, `DATABASE_URL=postgresql://postgres:${encodedPassword}@localhost:5432/chai_db`);
            fs.writeFileSync(ENV_PATH, envContent);
            console.log('✅ .env updated.');
        } else {
            console.log('✅ .env is already pointing to chai_db (or similar).');
        }

        console.log('\n🎉 Setup Complete! restarting might be required.');

    } catch (error) {
        console.error('❌ Setup failed:', error);
    }
}

setup();
