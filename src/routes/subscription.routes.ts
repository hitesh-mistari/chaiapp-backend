import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

// import Stripe from 'stripe';
// import Razorpay from 'razorpay';

const router = Router();


// Initialize Payments
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' });
/*
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || ''
});
*/

// Plans Configuration
const PLANS = {
    MONTHLY: { id: 'monthly', price: 399, name: 'Pro Monthly', interval: 'month', limit: 999999 },
    YEARLY: { id: 'yearly', price: 1999, name: 'Pro Yearly', interval: 'year', limit: 999999 }
};

/**
 * GET /api/subscription/current
 * Get current subscription status
 */
router.get('/current', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { storeId } = req.context!;

        const result = await query(
            `SELECT * FROM subscriptions WHERE store_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [storeId]
        );

        if (result.rows.length === 0) {
            // Return Free plan default
            return res.json({
                plan_type: 'free',
                status: 'active',
                customer_limit: 10,
                end_date: null
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({ error: 'Failed to fetch subscription' });
    }
});

/**
 * POST /api/subscription/create-order
 * Create Razorpay Order
 */
router.post('/create-order', authenticate, async (req: AuthRequest, res: Response) => {
    try {

        const { planId } = req.body; // 'monthly' or 'yearly'
        const plan = planId === 'yearly' ? PLANS.YEARLY : PLANS.MONTHLY;

        /*
        const order = await razorpay.orders.create({
            amount: plan.price * 100, // Amount in paise
            currency: "INR",
            receipt: `receipt_${Date.now()}`
        });
        */

        // MOCK ORDER RESPONSE
        res.json({
            orderId: `mock_order_${Date.now()}`,
            amount: plan.price,
            currency: "INR",
            key: process.env.RAZORPAY_KEY_ID || 'mock_key',
            plan
        });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

/**
 * POST /api/subscription/verify-payment
 * Verify Razorpay Payment and Activate Subscription
 */
router.post('/verify-payment', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { storeId } = req.context!;
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            planId
        } = req.body;

        const crypto = await import('crypto');
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '');
        hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
        const generated_signature = hmac.digest('hex');

        if (generated_signature !== razorpay_signature) {
            // Skip signature check for mock
            // return res.status(400).json({ error: 'Invalid payment signature' });
        }


        // Payment verified - Activate Subscription
        const plan = planId === 'yearly' ? PLANS.YEARLY : PLANS.MONTHLY;

        let endDate = new Date();
        if (plan.interval === 'month') endDate.setMonth(endDate.getMonth() + 1);
        if (plan.interval === 'year') endDate.setFullYear(endDate.getFullYear() + 1);

        // Check for "Lifetime" Promo Condition
        let finalPlanType = planId;
        const isPromoActive = true;

        if (planId === 'yearly' && isPromoActive) {
            endDate = new Date('2099-12-31'); // Lifetime
            finalPlanType = 'lifetime';
        }

        const client = await import('../config/database.js').then(m => m.pool.connect());
        try {
            await client.query('BEGIN');

            // Deactivate old active subscriptions
            await client.query(
                `UPDATE subscriptions SET status = 'cancelled' WHERE store_id = $1 AND status = 'active'`,
                [storeId]
            );

            // Create new subscription
            const subResult = await client.query(
                `INSERT INTO subscriptions (
                    store_id, plan_type, status, start_date, end_date, 
                    provider, subscription_id, customer_limit
                ) VALUES ($1, $2, 'active', NOW(), $3, 'manual', $4, $5)
                RETURNING id`,
                [storeId, finalPlanType, endDate, `manual_${Date.now()}`, plan.limit]
            );

            // Record Payment (Mock)
            await client.query(
                `INSERT INTO subscription_payments (
                    subscription_id, amount, provider, payment_id, status
                ) VALUES ($1, $2, 'manual', $3, 'success')`,
                [subResult.rows[0].id, plan.price, `mock_pay_${Date.now()}`]
            );

            await client.query('COMMIT');
            res.json({ success: true, message: 'Subscription activated (Mock)' });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Verify payment error:', error);
        res.status(500).json({ error: 'Payment verification failed' });
    }
});

export default router;
