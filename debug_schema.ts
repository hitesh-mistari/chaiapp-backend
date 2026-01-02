
import { pool } from './src/config/database.js';

async function checkSchema() {
    try {
        const res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'subscriptions';
        `);
        console.log('Columns in subscriptions table:', res.rows.map(r => r.column_name));
        process.exit(0);
    } catch (err) {
        console.error('Check failed:', err);
        process.exit(1);
    }
}

checkSchema();
