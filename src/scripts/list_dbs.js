import { Client } from 'pg';

async function listDatabases() {
    console.log('🔍 Checking existing databases...');
    
    // Connect to default 'postgres' database
    // Decoded password for debugging if needed, but using encoded for URL
    const password = 'Hassan@1216';
    const encodedPassword = encodeURIComponent(password);
    const dbUrl = `postgresql://postgres:${encodedPassword}@localhost:5432/postgres`;

    const client = new Client({ connectionString: dbUrl });

    try {
        await client.connect();
        const res = await client.query('SELECT datname FROM pg_database WHERE datistemplate = false;');
        console.log('📂 Available Databases:');
        res.rows.forEach(row => console.log(` - ${row.datname}`));
    } catch (err) {
        console.error('❌ Could not connect to Postgres:', err);
    } finally {
        await client.end();
    }
}

listDatabases();
