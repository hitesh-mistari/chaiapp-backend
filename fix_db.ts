
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const LOG_FILE = path.join(__dirname, 'fix_db_log.txt');

function log(msg: string) {
    console.log(msg);
    fs.appendFileSync(LOG_FILE, msg + '\n');
}

async function fix() {
    log('Starting DB Fix...');
    try {
        const client = await pool.connect();
        log('Connected to DB.');

        // 1. Install Extension
        try {
            await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
            log('UUID extension ensured.');
        } catch (e: any) {
            log('Extension error: ' + e.message);
        }

        // 2. Read and Run Schema
        const schemaPath = path.join(__dirname, 'subscription_schema.sql');
        const sql = fs.readFileSync(schemaPath, 'utf8');

        log('Running schema SQL...');
        try {
            await client.query(sql);
            log('Schema SQL executed successfully.');
        } catch (e: any) {
            log('Schema SQL error: ' + e.message);
            // If it failed because Types already exist (and IF NOT EXISTS is not supported for types in older pg), ignore or handle?
            // "type ... already exists"
        }

        // 3. Verify Table
        const check = await client.query("SELECT to_regclass('public.subscriptions')");
        if (check.rows[0].to_regclass) {
            log('Table "subscriptions" EXISTS.');

            // Check Column
            const colCheck = await client.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'subscriptions' AND column_name = 'customer_limit'
            `);
            if (colCheck.rows.length > 0) {
                log('Column "customer_limit" EXISTS.');
            } else {
                log('Column "customer_limit" MISSING. Attempting add...');
                await client.query('ALTER TABLE subscriptions ADD COLUMN customer_limit INTEGER DEFAULT 10');
                log('Column added.');
            }
        } else {
            log('Table "subscriptions" MISSING! Attempting explicit create...');
            // Fallback create if schema failed
            await client.query(`
                CREATE TABLE IF NOT EXISTS subscriptions (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    store_id UUID REFERENCES stores(id),
                    plan_type VARCHAR(50) DEFAULT 'free',
                    status VARCHAR(50) DEFAULT 'active',
                    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    end_date TIMESTAMP WITH TIME ZONE,
                    provider VARCHAR(50), 
                    subscription_id VARCHAR(255),
                    customer_limit INTEGER DEFAULT 10,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
             `);
            log('Fallback create executed.');
        }

        client.release();
    } catch (err: any) {
        log('Fatal Error: ' + err.message);
    } finally {
        await pool.end();
        log('Done.');
    }
}

fix();
