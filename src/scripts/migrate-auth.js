import pkg from 'pg';
const { Client } = pkg;

async function migrate() {
    const client = new Client('postgresql://postgres:postgres@localhost:5432/chaiapp_db');

    try {
        await client.connect();
        console.log('Connected to database');

        // Add email_verified if it doesn't exist
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
        `);
        console.log('Added email_verified column');

        // Add password_hash if it doesn't exist
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS password_hash TEXT;
        `);
        console.log('Added password_hash column');

        console.log('Migration completed successfully');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

migrate();
