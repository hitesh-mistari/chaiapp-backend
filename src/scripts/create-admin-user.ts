import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function createAdmin() {
    const client = await pool.connect();
    try {
        console.log('Creating Admin User...');

        const email = 'admin@chaiapp.com';
        const password = 'admin123';
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        await client.query(`
            INSERT INTO admin_users (email, password_hash, name, role, is_active)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (email) 
            DO UPDATE SET password_hash = $2, is_active = true;
        `, [email, passwordHash, 'Super Admin', 'super_admin', true]);

        console.log('✅ Admin user created/updated successfully!');
        console.log(`📧 Email: ${email}`);
        console.log(`🔑 Password: ${password}`);

    } catch (err) {
        console.error('❌ Failed to create admin:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

createAdmin();
