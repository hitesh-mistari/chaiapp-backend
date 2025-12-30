
import { query } from '../config/database';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function migrate() {
    try {
        console.log('Adding price_at_time column to logs table...');

        // Check if column exists
        const check = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='logs' AND column_name='price_at_time';
        `);

        if (check.rows.length === 0) {
            await query(`
                ALTER TABLE logs 
                ADD COLUMN price_at_time DECIMAL(10, 2);
            `);
            console.log('✅ Column price_at_time added successfully.');
        } else {
            console.log('ℹ️ Column price_at_time already exists.');
        }

    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
