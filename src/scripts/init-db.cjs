const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres',
    connectionTimeoutMillis: 5000,
});

(async () => {
    try {
        const client = await pool.connect();
        console.log('connected to postgres db');

        try {
            await client.query('CREATE DATABASE chaiapp_db');
            console.log('✅ Created database "chaiapp_db"');
        } catch (err) {
            if (err.code === '42P04') {
                console.log('⚠️ Database "chaiapp_db" already exists');
            } else {
                throw err;
            }
        }

        client.release();
        await pool.end();
    } catch (err) {
        console.error('❌ Failed:', err);
        process.exit(1);
    }
})();
