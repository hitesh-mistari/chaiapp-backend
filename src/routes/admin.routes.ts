import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import {
    verifyAdminEmail,
    verifyAdminIP,
    getClientIP,
    adminLoginRateLimiter,
    logSecurityEvent
} from '../middleware/security';

const router = Router();

// JWT Secret (should be in environment variables in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-admin-jwt-key-change-in-production';
const ADMIN_TOKEN_EXPIRY = '7d'; // Increased for development convenience

// Middleware to verify admin token
export const verifyAdminToken = async (req: Request, res: Response, next: any) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logSecurityEvent('ADMIN_AUTH_FAILED', {
                ip: getClientIP(req),
                reason: 'No token provided',
                path: req.path
            });

            res.status(401).json({ error: 'No token provided' });
            return;
        }

        const token = authHeader.substring(7);
        const decoded: any = jwt.verify(token, JWT_SECRET);

        // Verify admin still exists and is active
        const result = await pool.query(
            'SELECT id, email, name, role, is_active FROM admin_users WHERE id = $1',
            [decoded.adminId]
        );

        if (result.rows.length === 0 || !result.rows[0].is_active) {
            logSecurityEvent('ADMIN_AUTH_FAILED', {
                ip: getClientIP(req),
                reason: 'Invalid or inactive admin',
                adminId: decoded.adminId
            });

            res.status(401).json({ error: 'Invalid token' });
            return;
        }

        const admin = result.rows[0];

        // Verify email is still in whitelist
        if (!verifyAdminEmail(admin.email)) {
            logSecurityEvent('ADMIN_WHITELIST_VIOLATION', {
                ip: getClientIP(req),
                email: admin.email,
                adminId: admin.id
            });

            res.status(403).json({ error: 'Access denied' });
            return;
        }

        // Verify IP if IP allowlist is configured
        if (!verifyAdminIP(req)) {
            logSecurityEvent('ADMIN_IP_BLOCKED', {
                ip: getClientIP(req),
                email: admin.email,
                adminId: admin.id
            });

            res.status(403).json({ error: 'Access denied from this IP' });
            return;
        }

        (req as any).admin = admin;
        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            logSecurityEvent('ADMIN_TOKEN_EXPIRED', {
                ip: getClientIP(req),
                path: req.path
            });

            res.status(401).json({ error: 'Token expired, please login again' });
            return;
        }

        console.error('Admin token verification error:', error);
        logSecurityEvent('ADMIN_AUTH_ERROR', {
            ip: getClientIP(req),

            error: error instanceof Error ? error.message : 'Unknown error'
        });
        res.status(401).json({ error: 'Invalid token' });
    }
};

// ==================== AUTH ROUTES ====================

// Admin Login - WITH STRICT RATE LIMITING
router.post('/auth/login', adminLoginRateLimiter, async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        const clientIP = getClientIP(req);

        if (!email || !password) {
            logSecurityEvent('ADMIN_LOGIN_FAILED', {
                ip: clientIP,
                reason: 'Missing credentials'
            });
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // CRITICAL: Check email whitelist FIRST
        if (!verifyAdminEmail(email)) {
            logSecurityEvent('ADMIN_LOGIN_UNAUTHORIZED', {
                ip: clientIP,
                email: email
            });
            // Return generic error to prevent email enumeration
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        // Check IP allowlist if configured
        if (!verifyAdminIP(req)) {
            logSecurityEvent('ADMIN_LOGIN_IP_BLOCKED', {
                ip: clientIP,
                email: email
            });

            res.status(403).json({ error: 'Access denied from this IP' });
            return;
        }

        // Get admin user
        const result = await pool.query(
            'SELECT id, email, password_hash, name, role, is_active FROM admin_users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            logSecurityEvent('ADMIN_LOGIN_FAILED', {
                ip: clientIP,
                email: email,
                reason: 'User not found'
            });
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const admin = result.rows[0];

        // Check if admin is active
        if (!admin.is_active) {
            logSecurityEvent('ADMIN_LOGIN_INACTIVE', {
                ip: clientIP,
                email: email,
                adminId: admin.id
            });

            res.status(401).json({ error: 'Account is disabled' });
            return;
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(password, admin.password_hash);
        if (!passwordMatch) {
            logSecurityEvent('ADMIN_LOGIN_FAILED', {
                ip: clientIP,
                email: email,
                reason: 'Invalid password'
            });
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        // Update last login
        await pool.query(
            'UPDATE admin_users SET last_login_at = NOW() WHERE id = $1',
            [admin.id]
        );

        // Log successful login
        await pool.query(
            `INSERT INTO admin_activity_logs (admin_id, action, details, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                admin.id,
                'login',
                JSON.stringify({ email: admin.email, success: true }),
                clientIP,
                req.headers['user-agent']
            ]
        );

        logSecurityEvent('ADMIN_LOGIN_SUCCESS', {
            ip: clientIP,
            email: admin.email,
            adminId: admin.id
        });

        // Generate SHORT-LIVED JWT token (30 minutes)
        const token = jwt.sign(
            {
                adminId: admin.id,
                email: admin.email,
                role: admin.role
            },
            JWT_SECRET,
            { expiresIn: ADMIN_TOKEN_EXPIRY }
        );

        res.json({
            token,
            expiresIn: ADMIN_TOKEN_EXPIRY,
            admin: {
                id: admin.id,
                email: admin.email,
                name: admin.name,
                role: admin.role
            }
        });
        return;
    } catch (error) {
        console.error('Admin login error:', error);
        logSecurityEvent('ADMIN_LOGIN_ERROR', {
            ip: getClientIP(req),
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        res.status(500).json({ error: 'Login failed' });
        return;
    }
});


// Verify Token (for checking if user is still authenticated)
router.get('/auth/verify', verifyAdminToken, async (req: Request, res: Response) => {
    res.json({
        admin: (req as any).admin
    });
});

// Logout (client-side token removal, but we can log it)
router.post('/auth/logout', verifyAdminToken, async (req: Request, res: Response) => {
    try {
        const admin = (req as any).admin;

        // Log the logout activity
        await pool.query(
            `INSERT INTO admin_activity_logs (admin_id, action, details, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                admin.id,
                'logout',
                JSON.stringify({ email: admin.email }),
                req.ip,
                req.headers['user-agent']
            ]
        );

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Admin logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// ==================== STATS ROUTES ====================

router.get('/stats', verifyAdminToken, async (_req: Request, res: Response) => {
    try {
        // Get total shops
        const shopsResult = await pool.query('SELECT COUNT(*) as total FROM stores');
        const totalShops = parseInt(shopsResult.rows[0].total);

        // Get paid shops
        const paidShopsResult = await pool.query(
            `SELECT COUNT(DISTINCT s.id) as total 
             FROM stores s 
             JOIN subscriptions sub ON sub.store_id = s.id 
             WHERE sub.plan_type = 'paid' AND sub.status = 'active'`
        );
        const paidShops = parseInt(paidShopsResult.rows[0].total);

        // Get total revenue from payments table
        const revenueResult = await pool.query(
            'SELECT COALESCE(SUM(amount), 0) as total FROM payments'
        );
        const totalRevenue = parseFloat(revenueResult.rows[0].total);

        // Get revenue today from payments
        const todayRevenueResult = await pool.query(
            `SELECT COALESCE(SUM(amount), 0) as total 
             FROM payments 
             WHERE DATE(paid_at / 1000) = CURRENT_DATE`
        );
        const revenueToday = parseFloat(todayRevenueResult.rows[0].total);

        // Get revenue this month
        const monthRevenueResult = await pool.query(
            `SELECT COALESCE(SUM(amount), 0) as total 
             FROM payments 
             WHERE DATE_TRUNC('month', TO_TIMESTAMP(paid_at / 1000)) = DATE_TRUNC('month', CURRENT_DATE)`
        );
        const revenueThisMonth = parseFloat(monthRevenueResult.rows[0].total);

        // Get total cups from chai_logs
        const cupsResult = await pool.query(
            'SELECT COALESCE(SUM(count), 0) as total FROM chai_logs'
        );
        const totalCupsSold = parseInt(cupsResult.rows[0].total);

        // Get active affiliates
        const affiliatesResult = await pool.query(
            `SELECT COUNT(*) as total FROM affiliates WHERE status = 'active'`
        );
        const activeAffiliates = parseInt(affiliatesResult.rows[0].total);

        // Calculate conversion rate (paid shops / total shops)
        const conversionRate = totalShops > 0 ? paidShops / totalShops : 0;

        res.json({
            total_shops: totalShops,
            active_paid_shops: paidShops,
            free_shops: totalShops - paidShops,
            total_revenue: totalRevenue,
            revenue_today: revenueToday,
            revenue_this_month: revenueThisMonth,
            total_cups_sold: totalCupsSold,
            conversion_rate: conversionRate,
            active_affiliates: activeAffiliates
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

router.get('/stats/revenue', verifyAdminToken, async (req: Request, res: Response) => {
    try {
        const days = parseInt(req.query.days as string) || 30;

        // Generate all dates in the range
        const result = await pool.query(
            `WITH date_series AS (
                SELECT generate_series(
                    CURRENT_DATE - INTERVAL '${days} days',
                    CURRENT_DATE,
                    '1 day'::interval
                )::date as date
            ),
            daily_revenue AS (
                SELECT 
                    DATE(TO_TIMESTAMP(paid_at / 1000)) as date,
                    COALESCE(SUM(amount), 0) as revenue,
                    COUNT(*) as transactions
                FROM payments
                WHERE TO_TIMESTAMP(paid_at / 1000) >= CURRENT_DATE - INTERVAL '${days} days'
                GROUP BY DATE(TO_TIMESTAMP(paid_at / 1000))
            ),
            daily_shops AS (
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as new_shops
                FROM stores
                WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
                GROUP BY DATE(created_at)
            )
            SELECT 
                ds.date,
                COALESCE(dr.revenue, 0) as revenue,
                COALESCE(dr.transactions, 0) as transactions,
                COALESCE(dsh.new_shops, 0) as new_shops
            FROM date_series ds
            LEFT JOIN daily_revenue dr ON ds.date = dr.date
            LEFT JOIN daily_shops dsh ON ds.date = dsh.date
            ORDER BY ds.date ASC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Revenue chart error:', error);
        res.status(500).json({ error: 'Failed to fetch revenue data' });
    }
});

// ==================== SHOPS ROUTES ====================

router.get('/shops', verifyAdminToken, async (req: Request, res: Response) => {
    try {
        const { plan, status, search } = req.query;

        let query = `
            SELECT * FROM admin_shop_overview
            WHERE 1=1
        `;
        const params: any[] = [];
        let paramCount = 1;

        if (plan) {
            query += ` AND plan = $${paramCount}`;
            params.push(plan);
            paramCount++;
        }

        if (status === 'blocked') {
            query += ` AND is_blocked = true`;
        } else if (status === 'active') {
            query += ` AND is_blocked = false`;
        }

        if (search) {
            query += ` AND (store_name ILIKE $${paramCount} OR owner_name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        query += ' ORDER BY signup_date DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Shops fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch shops' });
    }
});

router.get('/shops/:storeId', verifyAdminToken, async (req: Request, res: Response) => {
    try {
        const { storeId } = req.params;

        const result = await pool.query(
            'SELECT * FROM admin_shop_overview WHERE store_id = $1',
            [storeId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Shop not found' });
            return;
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Shop details error:', error);
        res.status(500).json({ error: 'Failed to fetch shop details' });
    }
});

router.post('/shops/:storeId/block', verifyAdminToken, async (req: Request, res: Response) => {
    try {
        const { storeId } = req.params;
        const { reason } = req.body;
        const admin = (req as any).admin;

        // Update store
        await pool.query('UPDATE stores SET is_blocked = true WHERE id = $1', [storeId]);

        // Log the block
        await pool.query(
            `INSERT INTO store_blocks (store_id, blocked_by, reason)
             VALUES ($1, $2, $3)`,
            [storeId, admin.id, reason]
        );

        // Log activity
        await pool.query(
            `INSERT INTO admin_activity_logs (admin_id, action, target_type, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [admin.id, 'block_shop', 'shop', storeId, JSON.stringify({ reason })]
        );

        res.json({ message: 'Shop blocked successfully' });
    } catch (error) {
        console.error('Block shop error:', error);
        res.status(500).json({ error: 'Failed to block shop' });
    }
});

router.post('/shops/:storeId/unblock', verifyAdminToken, async (req: Request, res: Response) => {
    try {
        const { storeId } = req.params;
        const admin = (req as any).admin;

        // Update store
        await pool.query('UPDATE stores SET is_blocked = false WHERE id = $1', [storeId]);

        // Update block record
        await pool.query(
            `UPDATE store_blocks 
             SET is_active = false, unblocked_at = NOW()
             WHERE store_id = $1 AND is_active = true`,
            [storeId]
        );

        // Log activity
        await pool.query(
            `INSERT INTO admin_activity_logs (admin_id, action, target_type, target_id)
             VALUES ($1, $2, $3, $4)`,
            [admin.id, 'unblock_shop', 'shop', storeId]
        );

        res.json({ message: 'Shop unblocked successfully' });
    } catch (error) {
        console.error('Unblock shop error:', error);
        res.status(500).json({ error: 'Failed to unblock shop' });
    }
});

// ==================== ACTIVITY LOGS ====================

router.get('/logs', verifyAdminToken, async (req: Request, res: Response) => {
    try {
        const { action, limit = 100 } = req.query;

        let query = `
            SELECT 
                al.*,
                au.name as admin_name,
                au.email as admin_email
            FROM admin_activity_logs al
            LEFT JOIN admin_users au ON au.id = al.admin_id
            WHERE 1=1
        `;
        const params: any[] = [];
        let paramCount = 1;

        if (action) {
            query += ` AND al.action = $${paramCount}`;
            params.push(action);
            paramCount++;
        }

        query += ` ORDER BY al.created_at DESC LIMIT $${paramCount}`;
        params.push(limit);

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Activity logs error:', error);
        res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
});

// ==================== AFFILIATE MANAGEMENT ====================

/**
 * GET /api/admin/affiliates
 * Get all affiliates with filtering
 */
router.get('/affiliates', verifyAdminToken, async (req: Request, res: Response) => {
    try {
        const { status, search } = req.query;

        let query = 'SELECT * FROM admin_affiliate_overview WHERE 1=1';
        const params: any[] = [];
        let paramCount = 1;

        if (status) {
            query += ` AND status = $${paramCount}`;
            params.push(status);
            paramCount++;
        }

        if (search) {
            query += ` AND (affiliate_name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR referral_code ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        query += ' ORDER BY joined_date DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Affiliates fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch affiliates' });
    }
});

/**
 * GET /api/admin/affiliates/:affiliateId
 * Get detailed affiliate information
 */
router.get('/affiliates/:affiliateId', verifyAdminToken, async (req: Request, res: Response) => {
    try {
        const { affiliateId } = req.params;

        const result = await pool.query(
            'SELECT * FROM admin_affiliate_overview WHERE affiliate_id = $1',
            [affiliateId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Affiliate not found' });
            return;
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Affiliate details error:', error);
        res.status(500).json({ error: 'Failed to fetch affiliate details' });
    }
});

/**
 * POST /api/admin/affiliates/:affiliateId/suspend
 * Suspend an affiliate
 */
router.post('/affiliates/:affiliateId/suspend', verifyAdminToken, async (req: Request, res: Response) => {
    try {
        const { affiliateId } = req.params;
        const { reason } = req.body;
        const admin = (req as any).admin;

        await pool.query(
            'UPDATE affiliates SET status = $1 WHERE id = $2',
            ['suspended', affiliateId]
        );

        // Log activity
        await pool.query(
            `INSERT INTO admin_activity_logs (admin_id, action, target_type, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [admin.id, 'suspend_affiliate', 'affiliate', affiliateId, JSON.stringify({ reason })]
        );

        res.json({ message: 'Affiliate suspended successfully' });
    } catch (error) {
        console.error('Suspend affiliate error:', error);
        res.status(500).json({ error: 'Failed to suspend affiliate' });
    }
});

/**
 * POST /api/admin/affiliates/:affiliateId/activate
 * Activate a suspended affiliate
 */
router.post('/affiliates/:affiliateId/activate', verifyAdminToken, async (req: Request, res: Response) => {
    try {
        const { affiliateId } = req.params;
        const admin = (req as any).admin;

        await pool.query(
            'UPDATE affiliates SET status = $1 WHERE id = $2',
            ['active', affiliateId]
        );

        // Log activity
        await pool.query(
            `INSERT INTO admin_activity_logs (admin_id, action, target_type, target_id)
             VALUES ($1, $2, $3, $4)`,
            [admin.id, 'activate_affiliate', 'affiliate', affiliateId]
        );

        res.json({ message: 'Affiliate activated successfully' });
    } catch (error) {
        console.error('Activate affiliate error:', error);
        res.status(500).json({ error: 'Failed to activate affiliate' });
    }
});

// ==================== REFERRAL MANAGEMENT ====================

/**
 * GET /api/admin/referrals
 * Get all referrals with filtering
 */
router.get('/referrals', verifyAdminToken, async (req: Request, res: Response) => {
    try {
        const { status, commissionStatus } = req.query;

        let query = 'SELECT * FROM admin_referral_details WHERE 1=1';
        const params: any[] = [];
        let paramCount = 1;

        if (status) {
            query += ` AND referral_status = $${paramCount}`;
            params.push(status);
            paramCount++;
        }

        if (commissionStatus) {
            query += ` AND commission_status = $${paramCount}`;
            params.push(commissionStatus);
            paramCount++;
        }

        query += ' ORDER BY referral_date DESC LIMIT 500';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Referrals fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch referrals' });
    }
});

// ==================== PAYOUT MANAGEMENT ====================

/**
 * GET /api/admin/payouts
 * Get all payout requests
 */
router.get('/payouts', verifyAdminToken, async (req: Request, res: Response) => {
    try {
        const { status } = req.query;

        let query = `
            SELECT 
                ap.*,
                u.name AS user_name,
                u.email AS user_email,
                a.referral_code,
                a.available_balance
            FROM affiliate_payouts ap
            JOIN users u ON u.id = ap.user_id
            JOIN affiliates a ON a.id = ap.affiliate_id
            WHERE 1=1
        `;
        const params: any[] = [];
        let paramCount = 1;

        if (status) {
            query += ` AND ap.status = $${paramCount}`;
            params.push(status);
            paramCount++;
        }

        query += ' ORDER BY ap.created_at DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Payouts fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch payouts' });
    }
});

/**
 * POST /api/admin/payouts/:payoutId/approve
 * Approve and mark payout as paid
 */
router.post('/payouts/:payoutId/approve', verifyAdminToken, async (req: Request, res: Response) => {
    try {
        const { payoutId } = req.params;
        const { payoutReference, payoutNote } = req.body;
        const admin = (req as any).admin;

        if (!payoutReference) {
            res.status(400).json({ error: 'Payout reference (UTR) is required' });
            return;
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Get payout details
            const payoutResult = await client.query(
                'SELECT * FROM affiliate_payouts WHERE id = $1',
                [payoutId]
            );

            if (payoutResult.rows.length === 0) {
                throw new Error('Payout not found');
            }

            const payout = payoutResult.rows[0];

            if (payout.status !== 'pending') {
                throw new Error('Payout is not in pending status');
            }

            // Update payout status
            await client.query(
                `UPDATE affiliate_payouts 
                 SET status = 'paid', 
                     payout_reference = $1, 
                     payout_note = $2,
                     processed_by = $3,
                     processed_at = NOW()
                 WHERE id = $4`,
                [payoutReference, payoutNote, admin.id, payoutId]
            );

            // Update affiliate balance
            await client.query(
                `UPDATE affiliates 
                 SET total_withdrawn = total_withdrawn + $1,
                     available_balance = available_balance - $1
                 WHERE id = $2`,
                [payout.amount, payout.affiliate_id]
            );

            // Log activity
            await client.query(
                `INSERT INTO admin_activity_logs (admin_id, action, target_type, target_id, details)
                 VALUES ($1, $2, $3, $4, $5)`,
                [admin.id, 'approve_payout', 'payout', payoutId, JSON.stringify({
                    amount: payout.amount,
                    reference: payoutReference
                })]
            );

            await client.query('COMMIT');

            res.json({
                message: 'Payout approved successfully',
                payoutReference
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Approve payout error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to approve payout'
        });
    }
});

/**
 * POST /api/admin/payouts/:payoutId/reject
 * Reject a payout request
 */
router.post('/payouts/:payoutId/reject', verifyAdminToken, async (req: Request, res: Response) => {
    try {
        const { payoutId } = req.params;
        const { reason } = req.body;
        const admin = (req as any).admin;

        if (!reason) {
            res.status(400).json({ error: 'Rejection reason is required' });
            return;
        }

        await pool.query(
            `UPDATE affiliate_payouts 
             SET status = 'rejected', 
                 rejected_reason = $1,
                 processed_by = $2,
                 processed_at = NOW()
             WHERE id = $3`,
            [reason, admin.id, payoutId]
        );

        // Log activity
        await pool.query(
            `INSERT INTO admin_activity_logs (admin_id, action, target_type, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [admin.id, 'reject_payout', 'payout', payoutId, JSON.stringify({ reason })]
        );

        res.json({ message: 'Payout rejected successfully' });
    } catch (error) {
        console.error('Reject payout error:', error);
        res.status(500).json({ error: 'Failed to reject payout' });
    }
});

export default router;
