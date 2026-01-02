import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function checkDb() {
    console.log('Checking database connection...');
    console.log('URL:', process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':****@')); // Hide password

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('✅ Connected to database successfully!');

        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);

        console.log('Tables found:', res.rows.map(r => r.table_name));

        if (res.rows.length === 0) {
            console.log('⚠️ No tables found! You need to run the setup script.');
        } else {
            console.log('✅ Tables exist.');
        }

    } catch (err: any) {
        console.error('❌ Database connection failed:', err.message);
        if (err.message.includes('password authentication failed')) {
            console.log('👉 Hint: Check your password in .env');
        } else if (err.message.includes('database') && err.message.includes('does not exist')) {
            console.log('👉 Hint: The database name in .env does not exist. Create it or fix the name.');
        }
    } finally {
        await client.end();
    }
}

checkDb();
