import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function runSetup() {
    const client = await pool.connect();
    console.log('🔌 Connected to database...');

    try {
        await client.query('BEGIN');

        // 1. Core Schema
        console.log('📄 Running schema.sql...');
        const schemaSql = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');
        await client.query(schemaSql);

        // 2. Auth Schema
        console.log('🔒 Running auth_schema.sql...');
        const authSql = fs.readFileSync(path.join(__dirname, '../auth_schema.sql'), 'utf8');
        await client.query(authSql);

        // 3. Admin Schema
        console.log('👑 Running admin_schema.sql...');
        const adminSql = fs.readFileSync(path.join(__dirname, '../admin_schema.sql'), 'utf8');
        await client.query(adminSql);

        await client.query('COMMIT');
        console.log('✅ Database setup completed successfully!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Database setup failed:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runSetup();
