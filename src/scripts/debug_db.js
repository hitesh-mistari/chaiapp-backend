import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    try {
        console.log('--- TABLES ---');
        const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log(tables.rows.map(r => r.table_name));

        console.log('\n--- CUSTOMERS COUNT ---');
        const custCount = await pool.query("SELECT count(*) FROM customers");
        console.log(custCount.rows[0].count);

        console.log('\n--- LOGS COUNT ---');
        // Try both possible names
        try {
            const logsCount = await pool.query("SELECT count(*) FROM chai_logs");
            console.log('chai_logs count:', logsCount.rows[0].count);
        } catch (e) { console.log('chai_logs table does not exist'); }

        try {
            const logsCount2 = await pool.query("SELECT count(*) FROM logs");
            console.log('logs count:', logsCount2.rows[0].count);
        } catch (e) { console.log('logs table does not exist'); }

        if (custCount.rows[0].count > 0) {
            console.log('\n--- SAMPLE CUSTOMER ---');
            const sampleCust = await pool.query("SELECT * FROM customers LIMIT 1");
            console.log(sampleCust.rows[0]);
        }

        await pool.end();
    } catch (e) {
        console.error(e);
        await pool.end();
    }
}
check();
