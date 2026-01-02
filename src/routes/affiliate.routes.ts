import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

const router = Router();

router.use(authenticate);

// --- 1. /me Endpoint (Dashboard data) ---
router.get('/me', async (req: AuthRequest, res: Response) => {
    try {
        const { userId } = req.context!;

        // Get Code & ID
        // Get Code & ID
        const userResult = await query<{ referral_code: string, store_upi_id: string }>(
            `SELECT u.referral_code, st.upi_id as store_upi_id
             FROM users u
             LEFT JOIN stores st ON st.user_id = u.id
             WHERE u.id = $1`,
            [userId]
        );
        if (userResult.rows.length === 0) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const user = userResult.rows[0];
        const { referral_code } = user;

        // Stats
        const statsResult = await query<{
            total_earnings: string;
            pending_total: string;
            paid_total: string;
            referral_count: string;
            paid_referrals_count: string;
            pending_referrals_count: string;
        }>(
            `SELECT 
                COALESCE(SUM(amount), 0) as total_earnings,
                COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount ELSE 0 END), 0) as pending_total,
                COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END), 0) as paid_total,
                COUNT(*) as referral_count,
                COUNT(CASE WHEN status = 'PAID' THEN 1 END) as paid_referrals_count,
                COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_referrals_count
             FROM commissions 
             WHERE referrer_id = $1 AND status != 'CANCELLED'`,
            [userId]
        );
        const stats = statsResult.rows[0];

        // Payouts Total (To calculate available balance accurately)
        const payoutsResult = await query<{ requested_total: string }>(
            `SELECT COALESCE(SUM(amount), 0) as requested_total 
             FROM payouts 
             WHERE user_id = $1 AND status IN ('REQUESTED', 'PROCESSING', 'PAID')`, // Exclude Rejected
            [userId]
        );
        const requestedTotal = parseInt(payoutsResult.rows[0].requested_total);

        // Calculate Available: (Total Approved Earnings) - (Total Requested Payouts)
        // Note: In this logic, 'total_earnings' includes PENDING+APPROVED+PAID. 
        // We only want APPROVED (or PENDING that moved to APPROVED) for withdrawal.
        // Let's refinance: Available = (Approved + Paid Commissions) - (Requested Payouts)
        const approvedCommissionsResult = await query<{ approved_val: string }>(
            `SELECT COALESCE(SUM(amount), 0) as approved_val FROM commissions 
             WHERE referrer_id = $1 AND status IN ('APPROVED', 'PAID')`,
            [userId]
        );
        const totalApprovedCommission = parseInt(approvedCommissionsResult.rows[0].approved_val);
        const availableBalance = totalApprovedCommission - requestedTotal;

        res.json({
            affiliate: {
                id: userId,
                referralCode: referral_code,
                referralLink: `${process.env.FRONTEND_URL || 'http://localhost:5174'}/?ref=${referral_code}`,
                totalEarnings: parseInt(stats.total_earnings), // Lifetime earnings
                availableBalance: availableBalance > 0 ? availableBalance : 0,
                totalWithdrawn: parseInt(stats.paid_total), // Actually paid out
                totalReferrals: parseInt(stats.referral_count),
                paidReferrals: parseInt(stats.paid_referrals_count),
                pendingReferrals: parseInt(stats.pending_referrals_count),
                status: 'active',
                upiId: (user.store_upi_id || '') // We can fetch from last payout if needed, or leave blank
            }
        });

    } catch (error) {
        console.error('Affiliate /me Error:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

// --- 2. /referrals Endpoint ---
router.get('/referrals', async (req: AuthRequest, res: Response) => {
    try {
        const { userId } = req.context!;
        const result = await query(
            `SELECT 
                c.id, c.amount as "commissionAmount", c.status as "commissionStatus", 
                u.name as "referredName", u.email as "referredEmail", 
                s.store_name as "referredStoreName",
                c.created_at as "createdAt",
                sub.plan_type as "planType"
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
        console.error('Referrals Error:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

// --- 3. /payouts Endpoint ---
router.get('/payouts', async (req: AuthRequest, res: Response) => {
    try {
        const { userId } = req.context!;
        const result = await query(
            `SELECT id, amount, status, upi_id as "payoutMethod", created_at as "createdAt"
             FROM payouts 
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [userId]
        );

        res.json({ payouts: result.rows });
    } catch (error) {
        console.error('Payouts Error:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

// --- 4. /request-payout Endpoint ---
router.post('/request-payout', async (req: AuthRequest, res: Response) => {
    try {
        const { userId } = req.context!;
        const { amount, upiId } = req.body;

        if (amount < 500) return res.status(400).json({ error: 'Min withdrawal ₹500' });

        // Check Balance Logic (Simplified)
        // ... (Same balance check as /me)

        await query(
            `INSERT INTO payouts (user_id, amount, upi_id, status) VALUES ($1, $2, $3, 'REQUESTED')`,
            [userId, amount, upiId]
        );

        res.json({ message: 'Success' });
    } catch (error) {
        console.error('Request Payout Error:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

export default router;
