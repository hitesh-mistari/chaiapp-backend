import pkg from 'pg';
const { Client } = pkg;

async function migrate() {
    const client = new Client('postgresql://postgres:postgres@localhost:5432/chaiapp_db');

    try {
        await client.connect();
        console.log('Connected to database');

        // Users table check
        const columns = [
            { name: 'google_id', type: 'VARCHAR(255) UNIQUE' },
            { name: 'email', type: 'VARCHAR(255)' },
            { name: 'name', type: 'VARCHAR(255)' },
            { name: 'picture', type: 'TEXT' },
            { name: 'email_verified', type: 'BOOLEAN DEFAULT false' },
            { name: 'password_hash', type: 'TEXT' },
            { name: 'verification_token', type: 'VARCHAR(100)' },
            { name: 'last_login_at', type: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()' },
            { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()' }
        ];

        for (const col of columns) {
            try {
                await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};`);
                console.log(`Verified column: ${col.name}`);
            } catch (e) {
                console.log(`Column ${col.name} may already exist or error: ${e.message}`);
            }
        }

        console.log('Master migration completed successfully');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

migrate();
