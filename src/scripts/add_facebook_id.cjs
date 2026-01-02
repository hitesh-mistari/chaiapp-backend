const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function migrate() {
    try {
        await client.connect();
        console.log('Connected to database...');

        console.log('Adding facebook_id column to users table...');

        // Check if column exists
        const checkRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='facebook_id'
    `);

        if (checkRes.rows.length === 0) {
            await client.query('ALTER TABLE users ADD COLUMN facebook_id VARCHAR(255) UNIQUE');
            console.log('✅ Added facebook_id column successfully.');
        } else {
            console.log('ℹ️ facebook_id column already exists.');
        }

    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

migrate();
