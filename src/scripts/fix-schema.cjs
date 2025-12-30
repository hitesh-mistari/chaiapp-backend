const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/chaiapp_db',
});

(async () => {
    try {
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS picture TEXT');
        console.log('✅ Added picture column to users table');

        await pool.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true');
        console.log('✅ Added is_active column to customers table');

        await pool.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS lat DECIMAL(10, 8)');
        await pool.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS lng DECIMAL(11, 8)');
        console.log('✅ Added lat/lng columns to customers table');

        await pool.query('ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS sound_enabled BOOLEAN DEFAULT true');
        console.log('✅ Added sound_enabled column to store_settings table');

        // Clean up test data
        await pool.query("DELETE FROM users WHERE email LIKE 'test_%@%' OR email LIKE 'guest_%@temp.local' OR email LIKE 'store%_owner@test.com'");
        console.log('✅ Cleaned up test data');

        await pool.end();
    } catch (err) {
        console.error('❌ Failed:', err.message);
        await pool.end();
        process.exit(1);
    }
})();
