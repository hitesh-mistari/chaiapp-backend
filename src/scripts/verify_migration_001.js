import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function verify() {
    try {
        console.log('🔍 Verifying price_at_time column in logs table...');
        
        const result = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'logs' AND column_name = 'price_at_time';
        `);

        if (result.rows.length > 0) {
            console.log('✅ Column price_at_time exists in logs table.');
            process.exit(0);
        } else {
            console.error('❌ Column price_at_time COMPONENT MISSING in logs table.');
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

verify();
