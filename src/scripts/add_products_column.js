import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    try {
        console.log('🔄 Adding products column to store_settings...');

        await pool.query('ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS products JSONB DEFAULT \'[]\'::jsonb');

        console.log('✅ products column added');

        // Optional: Update existing settings with default products
        const defaultProducts = JSON.stringify([
            { id: 'chai', name: 'Chai', price: 10, color: '#f59e0b', icon: '☕' },
            { id: 'coffee', name: 'Coffee', price: 15, color: '#451a03', icon: '☕' }
        ]);

        await pool.query(`UPDATE store_settings SET products = $1 WHERE products = '[]'::jsonb OR products IS NULL`, [defaultProducts]);
        console.log('✅ Updated existing settings with default products');

        await pool.end();
    } catch (error) {
        console.error('❌ Alter failed:', error);
        await pool.end();
        process.exit(1);
    }
}

run();
