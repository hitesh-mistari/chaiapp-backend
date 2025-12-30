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
        console.log('🔄 Creating POS tables...');

        // Create logs table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS logs (
                id UUID PRIMARY KEY,
                customer_id VARCHAR(50) NOT NULL, -- Use VARCHAR to allow 'walk-in'
                timestamp BIGINT NOT NULL,
                count INTEGER NOT NULL,
                product_type VARCHAR(50) DEFAULT 'chai',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ logs table created');

        // Create payments table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id UUID PRIMARY KEY,
                customer_id VARCHAR(50) NOT NULL,
                month_str VARCHAR(20) NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                paid_at BIGINT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ payments table created');

        // Create indexes
        await pool.query('CREATE INDEX IF NOT EXISTS idx_logs_customer_id ON logs(customer_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id)');

        console.log('✅ Successfully setup POS tables');
        await pool.end();
    } catch (error) {
        console.error('❌ Setup failed:', error);
        await pool.end();
        process.exit(1);
    }
}

run();
