import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { verifyToken } from '../middleware/auth';

const router = Router();

// =====================================================================
// HELPER FUNCTIONS
// =====================================================================

/**
 * Generate a unique referral code for a user
 */
async function generateReferralCode(userName: string, userId: string): Promise<string> {
    const result = await pool.query(
        'SELECT generate_referral_code($1, $2) as code',
        [userName, userId]
    );
    return result.rows[0].code;
}

/**
 * Get or create affiliate record for a user
 */
async function getOrCreateAffiliate(userId: string, storeId: string, userName: string) {
    // Check if affiliate already exists
    let result = await pool.query(
        'SELECT * FROM affiliates WHERE user_id = $1',
        [userId]
    );

    if (result.rows.length > 0) {
        return result.rows[0];
    }

    // Create new affiliate
    const referralCode = await generateReferralCode(userName, userId);

    result = await pool.query(
        `INSERT INTO affiliates (user_id, store_id, referral_code)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [userId, storeId, referralCode]
    );

    return result.rows[0];
}

// =====================================================================
// AFFILIATE ROUTES (For Shop Owners)
// =====================================================================

/**
 * GET /api/affiliate/me
 * Get current user's affiliate information
 */
router.get('/me', verifyToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const storeId = (req as any).user.storeId;
        const userName = (req as any).user.name;

        // Get or create affiliate record
        const affiliate = await getOrCreateAffiliate(userId, storeId, userName);

        // Get referral link
        const baseUrl = process.env.FRONTEND_URL || 'https://cupcount.com';
        const referralLink = `${baseUrl}/signup?ref=${affiliate.referral_code}`;

        res.json({
            affiliate: {
                id: affiliate.id,
                referralCode: affiliate.referral_code,
                referralLink,
                totalEarnings: parseFloat(affiliate.total_earnings),
                availableBalance: parseFloat(affiliate.available_balance),
                totalWithdrawn: parseFloat(affiliate.total_withdrawn),
                totalReferrals: affiliate.total_referrals,
                paidReferrals: affiliate.paid_referrals,
                pendingReferrals: affiliate.pending_referrals,
                status: affiliate.status,
                upiId: affiliate.upi_id,
                createdAt: affiliate.created_at
            }
        });
    } catch (error) {
        console.error('Get affiliate error:', error);
        res.status(500).json({ error: 'Failed to fetch affiliate information' });
    }
});

/**
 * POST /api/affiliate/update-payout-details
 * Update payout details (UPI ID, bank details)
 */
router.post('/update-payout-details', verifyToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { upiId, bankAccountNumber, bankIfsc, bankAccountHolder } = req.body;

        await pool.query(
            `UPDATE affiliates 
             SET upi_id = $1, 
                 bank_account_number = $2, 
                 bank_ifsc = $3, 
                 bank_account_holder = $4
             WHERE user_id = $5`,
            [upiId, bankAccountNumber, bankIfsc, bankAccountHolder, userId]
        );

        res.json({ message: 'Payout details updated successfully' });
    } catch (error) {
        console.error('Update payout details error:', error);
        res.status(500).json({ error: 'Failed to update payout details' });
    }
});

/**
 * GET /api/affiliate/referrals
 * Get list of referrals for current affiliate
 */
router.get('/referrals', verifyToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        const result = await pool.query(
            `SELECT 
                ar.id,
                ar.referral_code,
                u.name AS referred_name,
                u.email AS referred_email,
                s.store_name AS referred_store_name,
                ar.commission_amount,
                ar.commission_status,
                ar.referral_status,
                ar.converted_at,
                ar.created_at,
                ar.expires_at,
                sub.plan_type,
                sub.status AS subscription_status
             FROM affiliate_referrals ar
             JOIN users u ON u.id = ar.referred_user_id
             JOIN stores s ON s.id = ar.referred_store_id
             LEFT JOIN subscriptions sub ON sub.id = ar.subscription_id
             WHERE ar.referrer_user_id = $1
             ORDER BY ar.created_at DESC`,
            [userId]
        );

        res.json({
            referrals: result.rows.map(row => ({
                id: row.id,
                referralCode: row.referral_code,
                referredName: row.referred_name,
                referredEmail: row.referred_email,
                referredStoreName: row.referred_store_name,
                commissionAmount: parseFloat(row.commission_amount),
                commissionStatus: row.commission_status,
                referralStatus: row.referral_status,
                convertedAt: row.converted_at,
                createdAt: row.created_at,
                expiresAt: row.expires_at,
                planType: row.plan_type,
                subscriptionStatus: row.subscription_status
            }))
        });
    } catch (error) {
        console.error('Get referrals error:', error);
        res.status(500).json({ error: 'Failed to fetch referrals' });
    }
});

/**
 * GET /api/affiliate/earnings
 * Get earnings breakdown
 */
router.get('/earnings', verifyToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        // Get affiliate info
        const affiliateResult = await pool.query(
            'SELECT * FROM affiliates WHERE user_id = $1',
            [userId]
        );

        if (affiliateResult.rows.length === 0) {
            res.json({
                totalEarnings: 0,
                availableBalance: 0,
                totalWithdrawn: 0,
                pendingCommissions: 0,
                paidCommissions: 0
            });
            return;
        }

        const affiliate = affiliateResult.rows[0];

        // Get pending commissions
        const pendingResult = await pool.query(
            `SELECT COALESCE(SUM(commission_amount), 0) as total
             FROM affiliate_referrals
             WHERE affiliate_id = $1 AND commission_status = 'pending'`,
            [affiliate.id]
        );

        // Get paid commissions
        const paidResult = await pool.query(
            `SELECT COALESCE(SUM(commission_amount), 0) as total
             FROM affiliate_referrals
             WHERE affiliate_id = $1 AND commission_status = 'paid'`,
            [affiliate.id]
        );

        res.json({
            totalEarnings: parseFloat(affiliate.total_earnings),
            availableBalance: parseFloat(affiliate.available_balance),
            totalWithdrawn: parseFloat(affiliate.total_withdrawn),
            pendingCommissions: parseFloat(pendingResult.rows[0].total),
            paidCommissions: parseFloat(paidResult.rows[0].total)
        });
    } catch (error) {
        console.error('Get earnings error:', error);
        res.status(500).json({ error: 'Failed to fetch earnings' });
    }
});

/**
 * POST /api/affiliate/request-payout
 * Request a payout
 */
router.post('/request-payout', verifyToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { amount, payoutMethod, upiId } = req.body;

        // Validation
        if (!amount || amount < 500) {
            res.status(400).json({ error: 'Minimum payout amount is ₹500' });
            return;
        }

        if (!payoutMethod || !['upi', 'bank_transfer'].includes(payoutMethod)) {
            res.status(400).json({ error: 'Invalid payout method' });
            return;
        }

        // Get affiliate
        const affiliateResult = await pool.query(
            'SELECT * FROM affiliates WHERE user_id = $1',
            [userId]
        );

        if (affiliateResult.rows.length === 0) {
            res.status(404).json({ error: 'Affiliate account not found' });
            return;
        }

        const affiliate = affiliateResult.rows[0];

        // Check available balance
        if (parseFloat(affiliate.available_balance) < amount) {
            res.status(400).json({
                error: 'Insufficient balance',
                availableBalance: parseFloat(affiliate.available_balance)
            });
            return;
        }

        // Check for pending payouts
        const pendingPayoutResult = await pool.query(
            `SELECT COUNT(*) as count FROM affiliate_payouts
             WHERE affiliate_id = $1 AND status IN ('pending', 'processing')`,
            [affiliate.id]
        );

        if (parseInt(pendingPayoutResult.rows[0].count) > 0) {
            res.status(400).json({
                error: 'You already have a pending payout request'
            });
            return;
        }

        // Create payout request
        const payoutDetails = payoutMethod === 'upi'
            ? { upiId: upiId || affiliate.upi_id }
            : {
                accountNumber: affiliate.bank_account_number,
                ifsc: affiliate.bank_ifsc,
                accountHolder: affiliate.bank_account_holder
            };

        await pool.query(
            `INSERT INTO affiliate_payouts 
             (affiliate_id, user_id, amount, payout_method, payout_details)
             VALUES ($1, $2, $3, $4, $5)`,
            [affiliate.id, userId, amount, payoutMethod, JSON.stringify(payoutDetails)]
        );

        res.json({
            message: 'Payout request submitted successfully',
            amount,
            payoutMethod
        });
    } catch (error) {
        console.error('Request payout error:', error);
        res.status(500).json({ error: 'Failed to request payout' });
    }
});

/**
 * GET /api/affiliate/payouts
 * Get payout history
 */
router.get('/payouts', verifyToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        const result = await pool.query(
            `SELECT 
                id,
                amount,
                status,
                payout_method,
                payout_reference,
                payout_note,
                rejected_reason,
                created_at,
                processed_at
             FROM affiliate_payouts
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [userId]
        );

        res.json({
            payouts: result.rows.map(row => ({
                id: row.id,
                amount: parseFloat(row.amount),
                status: row.status,
                payoutMethod: row.payout_method,
                payoutReference: row.payout_reference,
                payoutNote: row.payout_note,
                rejectedReason: row.rejected_reason,
                createdAt: row.created_at,
                processedAt: row.processed_at
            }))
        });
    } catch (error) {
        console.error('Get payouts error:', error);
        res.status(500).json({ error: 'Failed to fetch payouts' });
    }
});

// =====================================================================
// REFERRAL TRACKING (Public - No Auth Required)
// =====================================================================

/**
 * POST /api/affiliate/track-referral
 * Track a referral when a new user signs up with a referral code
 * Called during signup process
 */
router.post('/track-referral', async (req: Request, res: Response) => {
    try {
        const { referralCode, newUserId, newStoreId } = req.body;

        if (!referralCode || !newUserId || !newStoreId) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        // Get affiliate by referral code
        const affiliateResult = await pool.query(
            'SELECT * FROM affiliates WHERE referral_code = $1 AND status = $2',
            [referralCode, 'active']
        );

        if (affiliateResult.rows.length === 0) {
            res.status(404).json({ error: 'Invalid referral code' });
            return;
        }

        const affiliate = affiliateResult.rows[0];

        // Prevent self-referral
        // Prevent self-referral
        if (affiliate.user_id === newUserId) {
            res.status(400).json({ error: 'Self-referral not allowed' });
            return;
        }

        // Check if user was already referred
        const existingReferral = await pool.query(
            'SELECT id FROM affiliate_referrals WHERE referred_user_id = $1',
            [newUserId]
        );

        if (existingReferral.rows.length > 0) {
            res.status(400).json({ error: 'User already referred' });
            return;
        }

        // Create referral record
        await pool.query(
            `INSERT INTO affiliate_referrals 
             (referrer_user_id, affiliate_id, referral_code, referred_user_id, referred_store_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [affiliate.user_id, affiliate.id, referralCode, newUserId, newStoreId]
        );

        res.json({
            message: 'Referral tracked successfully',
            referralCode
        });
    } catch (error) {
        console.error('Track referral error:', error);
        res.status(500).json({ error: 'Failed to track referral' });
    }
});

/**
 * GET /api/affiliate/validate-code/:code
 * Validate a referral code (public endpoint)
 */
router.get('/validate-code/:code', async (req: Request, res: Response) => {
    try {
        const { code } = req.params;

        const result = await pool.query(
            `SELECT a.referral_code, u.name, s.store_name
             FROM affiliates a
             JOIN users u ON u.id = a.user_id
             JOIN stores s ON s.id = a.store_id
             WHERE a.referral_code = $1 AND a.status = 'active'`,
            [code]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ valid: false });
            return;
        }

        const affiliate = result.rows[0];

        res.json({
            valid: true,
            referralCode: affiliate.referral_code,
            referrerName: affiliate.name,
            referrerStore: affiliate.store_name
        });
    } catch (error) {
        console.error('Validate code error:', error);
        res.status(500).json({ error: 'Failed to validate code' });
    }
});

export default router;
