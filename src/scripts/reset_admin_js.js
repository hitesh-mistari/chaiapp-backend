
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Use hardcoded connection string if env var not working or loaded
// Use hardcoded connection string with correct password
const connectionString = 'postgresql://postgres:Hassan@1216@127.0.0.1:5432/chaiapp_db';

const pool = new Pool({
    connectionString: connectionString,
});

async function resetAdmin() {
    console.log('Connecting to DB...');
    const client = await pool.connect();
    try {
        console.log('Connected. Resetting Admin User...');

        const email = 'admin@chaiapp.com';
        const password = 'admin123';
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        console.log('Hash generated. Inserting/Updating...');

        await client.query(`
            INSERT INTO admin_users (email, password_hash, name, role, is_active)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (email) 
            DO UPDATE SET password_hash = $2, is_active = true, role = 'super_admin';
        `, [email, passwordHash, 'Super Admin', 'super_admin', true]);

        console.log('✅ Admin user reset successfully!');
        
        // Verify it exists
        const res = await client.query('SELECT * FROM admin_users WHERE email = $1', [email]);
        console.log('User found in DB:', res.rows[0]);

    } catch (err) {
        console.error('❌ Failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

resetAdmin();
