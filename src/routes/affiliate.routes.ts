import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

const router = Router();

router.use(authenticate);

/**
 * ------------------------------------
 * 1. GET /affiliate/me
 * Dashboard Affiliate Data
 * ------------------------------------
 */
router.get('/me', async (req: AuthRequest, res: Response) => {
    try {
        const { userId } = req.context!;

        // Get referral code & store UPI
        const userResult = await query<{
            referral_code: string;
            store_upi_id: string;
        }>(
            `SELECT u.referral_code, st.upi_id AS store_upi_id
             FROM users u
             LEFT JOIN stores st ON st.user_id = u.id
             WHERE u.id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];
        const referralCode = user.referral_code;

        /**
         * Affiliate Stats
         */
        const statsResult = await query<{
            total_earnings: string;
            pending_total: string;
            paid_total: string;
            referral_count: string;
            paid_referrals_count: string;
            pending_referrals_count: string;
        }>(
            `SELECT 
                COALESCE(SUM(amount), 0) AS total_earnings,
                COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount ELSE 0 END), 0) AS pending_total,
                COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END), 0) AS paid_total,
                COUNT(*) AS referral_count,
                COUNT(CASE WHEN status = 'PAID' THEN 1 END) AS paid_referrals_count,
                COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pending_referrals_count
             FROM commissions
             WHERE referrer_id = $1
               AND status != 'CANCELLED'`,
            [userId]
        );

        const stats = statsResult.rows[0];

        /**
         * Total Requested / Paid Payouts
         */
        const payoutsResult = await query<{ requested_total: string }>(
            `SELECT COALESCE(SUM(amount), 0) AS requested_total
             FROM payouts
             WHERE user_id = $1
               AND status IN ('REQUESTED', 'PROCESSING', 'PAID')`,
            [userId]
        );

        const requestedTotal = parseInt(payoutsResult.rows[0].requested_total);

        /**
         * Approved + Paid Commissions
         */
        const approvedResult = await query<{ approved_val: string }>(
            `SELECT COALESCE(SUM(amount), 0) AS approved_val
             FROM commissions
             WHERE referrer_id = $1
               AND status IN ('APPROVED', 'PAID')`,
            [userId]
        );

        const totalApprovedCommission = parseInt(approvedResult.rows[0].approved_val);
        const availableBalance = Math.max(totalApprovedCommission - requestedTotal, 0);

        res.json({
            affiliate: {
                id: userId,
                referralCode,
                referralLink: `${process.env.FRONTEND_URL || 'http://localhost:5174'}/?ref=${referralCode}`,
                totalEarnings: parseInt(stats.total_earnings),
                availableBalance,
                totalWithdrawn: parseInt(stats.paid_total),
                totalReferrals: parseInt(stats.referral_count),
                paidReferrals: parseInt(stats.paid_referrals_count),
                pendingReferrals: parseInt(stats.pending_referrals_count),
                status: 'active',
                upiId: user.store_upi_id || ''
            }
        });
    } catch (error) {
        console.error('Affiliate /me Error:', error);
        res.status(500).json({ error: 'Failed to load affiliate data' });
    }
});

/**
 * ------------------------------------
 * 2. GET /affiliate/referrals
 * ------------------------------------
 */
router.get('/referrals', async (req: AuthRequest, res: Response) => {
    try {
        const { userId } = req.context!;

        const result = await query(
            `SELECT 
                c.id,
                c.amount AS "commissionAmount",
                c.status AS "commissionStatus",
                u.name AS "referredName",
                u.email AS "referredEmail",
                s.store_name AS "referredStoreName",
                c.created_at AS "createdAt",
                sub.plan_type AS "planType"
             FROM commissions c
             JOIN users u ON c.referred_user_id = u.id
             LEFT JOIN stores s ON s.user_id = u.id
             LEFT JOIN subscriptions sub ON sub.store_id = s.id
             WHERE c.referrer_id = $1
             ORDER BY c.created_at DESC`,
            [userId]
        );

        res.json({
            referrals: result.rows.map(r => ({
                ...r,
                planType: r.planType || 'Free',
                referralStatus: r.commissionStatus.toLowerCase()
            }))
        });
    } catch (error) {
        console.error('Affiliate referrals error:', error);
        res.status(500).json({ error: 'Failed to load referrals' });
    }
});

/**
 * ------------------------------------
 * 3. GET /affiliate/payouts
 * ------------------------------------
 */
router.get('/payouts', async (req: AuthRequest, res: Response) => {
    try {
        const { userId } = req.context!;

        const result = await query(
            `SELECT id, amount, status, upi_id AS "payoutMethod", created_at AS "createdAt"
             FROM payouts
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [userId]
        );

        res.json({ payouts: result.rows });
    } catch (error) {
        console.error('Affiliate payouts error:', error);
        res.status(500).json({ error: 'Failed to load payouts' });
    }
});

/**
 * ------------------------------------
 * 4. POST /affiliate/request-payout
 * ------------------------------------
 */
router.post('/request-payout', async (req: AuthRequest, res: Response) => {
    try {
        const { userId } = req.context!;
        const { amount, upiId } = req.body;

        if (!amount || amount < 500) {
            return res.status(400).json({ error: 'Minimum withdrawal is ₹500' });
        }

        if (!upiId) {
            return res.status(400).json({ error: 'UPI ID required' });
        }

        await query(
            `INSERT INTO payouts (user_id, amount, upi_id, status)
             VALUES ($1, $2, $3, 'REQUESTED')`,
            [userId, amount, upiId]
        );

        res.json({ message: 'Payout request submitted successfully' });
    } catch (error) {
        console.error('Request payout error:', error);
        res.status(500).json({ error: 'Failed to request payout' });
    }
});

export default router;
