const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/chaiapp_db',
});

(async () => {
    try {
        const client = await pool.connect();
        console.log('✅ Connected to database');

        const sql = fs.readFileSync(path.join(__dirname, '../admin_schema.sql'), 'utf8');

        console.log('🔄 Enabling uuid-ossp extension...');
        await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

        console.log('🔄 Running admin schema migration...');
        await client.query(sql);
        console.log('✅ Admin schema applied successfully');

        client.release();
        await pool.end();
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
})();
