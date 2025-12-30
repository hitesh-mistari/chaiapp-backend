const { Pool } = require('pg');

const pool = new Pool({
    // Explicitly connect to 'chaiapp'
    connectionString: 'postgresql://postgres:postgres@localhost:5432/chaiapp',
});

(async () => {
    try {
        const client = await pool.connect();
        console.log('✅ Connected to database "chaiapp"');

        // Check stores table
        const stores = await client.query('SELECT COUNT(*) FROM stores');
        console.log(`Stores count in table: ${stores.rows[0].count}`);

        // Check if view exists
        try {
            const view = await client.query('SELECT COUNT(*) FROM admin_shop_overview');
            console.log(`Rows in admin_shop_overview: ${view.rows[0].count}`);
        } catch (e) {
            console.log('⚠️ View admin_shop_overview does NOT exist');
        }

        client.release();
        await pool.end();
    } catch (err) {
        console.error('❌ Connection failed:', err);
        process.exit(1);
    }
})();
