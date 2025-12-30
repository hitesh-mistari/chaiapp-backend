const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/chaiapp_db',
});

(async () => {
    try {
        const client = await pool.connect();
        console.log('✅ Connected to database');

        const result = await client.query('SELECT * FROM admin_shop_overview');
        console.log(`Found ${result.rows.length} rows in admin_shop_overview`);
        if (result.rows.length > 0) {
            console.log('Sample row:', result.rows[0]);
        } else {
            console.log('⚠️ View is empty!');

            // Debug: Check base tables
            const users = await client.query('SELECT COUNT(*) FROM users');
            console.log('Users count:', users.rows[0].count);

            const stores = await client.query('SELECT COUNT(*) FROM stores');
            console.log('Stores count:', stores.rows[0].count);
        }

        client.release();
        await pool.end();
    } catch (err) {
        console.error('❌ Query failed:', err);
        process.exit(1);
    }
})();
