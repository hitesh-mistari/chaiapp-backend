
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Manual .env load
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

console.log('Testing DB Connection...');
console.log(`CWD: ${process.cwd()}`);
console.log(`DATABASE_URL from env: ${process.env.DATABASE_URL}`);

const { Pool } = pg;
const pool = new Pool({
    user: 'postgres',
    password: 'password',
    host: '::1',
    port: 5432,
    database: 'chaiapp_db',
    connectionTimeoutMillis: 2000,
});

(async () => {
    try {
        const client = await pool.connect();
        console.log('✅ Successfully connected to Database!');
        const res = await client.query('SELECT NOW()');
        console.log('Query Result:', res.rows[0]);
        client.release();
        await pool.end();
    } catch (err) {
        console.error('❌ Failed to connect:', err);
    }
})();
