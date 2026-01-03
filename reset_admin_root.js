
const fs = require('fs');
try {
    var { Pool } = require('pg');
    var bcrypt = require('bcryptjs');
} catch (e) {
    try { fs.writeFileSync('reset_log.txt', 'MODULE MISSING: ' + e.message); } catch (_) {}
    process.exit(1);
}

// Trying to be robust with connection string
// URL Encode the '@' in the password: Hassan@1216 -> Hassan%401216
const connectionString = 'postgresql://postgres:Hassan%401216@localhost:5432/chaiapp_db';

const pool = new Pool({
    connectionString: connectionString,
    connectionTimeoutMillis: 5000, // Fail fast
});

const fs = require('fs');

function log(msg) {
    console.log(msg);
    try { fs.appendFileSync('reset_log.txt', msg + '\n'); } catch (e) {}
}

async function resetAdmin() {
    log('Connecting to DB... ' + connectionString);
    try {
        const client = await pool.connect();
        log('Connected. Resetting Admin User...');

        const email = 'admin@chaiapp.com';
        const password = 'admin123';
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        await client.query(`
            INSERT INTO admin_users (email, password_hash, name, role, is_active)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (email) 
            DO UPDATE SET password_hash = $2, is_active = true, role = 'super_admin';
        `, [email, passwordHash, 'Super Admin', 'super_admin', true]);

        log('✅ Admin user reset successfully!');
        
        const res = await client.query('SELECT * FROM admin_users WHERE email = $1', [email]);
        log('User: ' + JSON.stringify(res.rows[0]));

        client.release();
    } catch (err) {
        log('❌ Failed: ' + err.message);
    } finally {
        await pool.end();
    }
}

resetAdmin();
