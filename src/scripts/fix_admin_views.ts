import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function updateViews() {
    const client = await pool.connect();
    try {
        console.log('🔄 Update Admin Views...');

        // DROP existing views first to avoid type conflicts
        await client.query('DROP VIEW IF EXISTS admin_affiliate_overview CASCADE');
        await client.query('DROP VIEW IF EXISTS admin_referral_details CASCADE');

        // 1. admin_affiliate_overview
        // We join Users with Commissions to get real affiliate data
        await client.query(`
            CREATE OR REPLACE VIEW admin_affiliate_overview AS
            SELECT 
                u.id AS affiliate_id,
                u.name AS affiliate_name,
                u.email,
                u.referral_code,
                'active' AS status,
                u.created_at AS joined_date,
                COUNT(c.id) AS total_signups,
                SUM(CASE WHEN c.status = 'PAID' THEN 1 ELSE 0 END) AS paid_signups,
                COALESCE(SUM(CASE WHEN c.status = 'PENDING' THEN c.amount ELSE 0 END), 0) AS pending_amount,
                COALESCE(SUM(CASE WHEN c.status = 'PAID' THEN c.amount ELSE 0 END), 0) AS paid_amount,
                COALESCE(SUM(CASE WHEN c.status = 'APPROVED' THEN c.amount ELSE 0 END), 0) AS available_balance
            FROM users u
            JOIN commissions c ON u.id = c.referrer_id
            GROUP BY u.id, u.name, u.email, u.referral_code, u.created_at;
        `);
        console.log('✅ View created: admin_affiliate_overview');

        // 2. admin_referral_details
        await client.query(`
            CREATE OR REPLACE VIEW admin_referral_details AS
            SELECT 
                c.id AS id,
                c.referrer_id AS affiliate_id,
                u_ref.name AS affiliate_name,
                s.id AS store_id,
                s.store_name AS store_name,
                c.created_at AS referral_date,
                c.created_at AS signup_date,
                'paid' AS payment_status,
                c.amount AS commission_amount,
                c.status AS commission_status,
                c.status AS referral_status
            FROM commissions c
            JOIN users u_ref ON c.referrer_id = u_ref.id
            JOIN users u_new ON c.referred_user_id = u_new.id
            LEFT JOIN stores s ON s.user_id = u_new.id;
        `);
        console.log('✅ View created: admin_referral_details');

    } catch (err) {
        console.error('❌ Failed to update views:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

updateViews();
