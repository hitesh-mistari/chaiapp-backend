import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import pool from '../config/database';

const router = Router();

// Razorpay webhook secret (set in environment)
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

/**
 * Verify Razorpay webhook signature
 */
function verifyWebhookSignature(body: string, signature: string): boolean {
    if (!RAZORPAY_WEBHOOK_SECRET) {
        console.warn('RAZORPAY_WEBHOOK_SECRET not configured');
        return false;
    }

    const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
        .update(body)
        .digest('hex');

    return expectedSignature === signature;
}

/**
 * POST /api/webhooks/razorpay
 * Handle Razorpay payment webhooks
 * 
 * This endpoint processes payment success events and:
 * 1. Creates/updates subscription
 * 2. Marks referral as converted
 * 3. Credits affiliate commission
 */
router.post('/razorpay', async (req: Request, res: Response) => {
    try {
        // Verify webhook signature
        const signature = req.headers['x-razorpay-signature'] as string;
        const rawBody = JSON.stringify(req.body);

        if (!verifyWebhookSignature(rawBody, signature)) {
            console.error('Invalid webhook signature');
            res.status(400).json({ error: 'Invalid signature' });
            return;
        }

        const event = req.body;
        const eventType = event.event;

        console.log('Razorpay webhook received:', eventType);

        // Handle payment.captured event
        if (eventType === 'payment.captured') {
            const payment = event.payload.payment.entity;
            const paymentId = payment.id;
            const orderId = payment.order_id;
            const amount = payment.amount / 100; // Convert paise to rupees
            const currency = payment.currency;

            // Get user info from payment notes
            const userId = payment.notes?.user_id;
            const storeId = payment.notes?.store_id;
            const referralCode = payment.notes?.referral_code;

            if (!userId || !storeId) {
                console.error('Missing user_id or store_id in payment notes');
                res.status(400).json({ error: 'Invalid payment data' });
                return;
            }

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                // 1. Create or update subscription
                const subscriptionResult = await client.query(
                    `INSERT INTO subscriptions 
                     (store_id, user_id, plan_type, status, amount, currency, 
                      payment_gateway, payment_id, order_id, start_date, end_date, referred_by_code)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW() + INTERVAL '1 year', $10)
                     ON CONFLICT (store_id) 
                     DO UPDATE SET 
                        plan_type = $3,
                        status = $4,
                        amount = $5,
                        payment_id = $8,
                        order_id = $9,
                        start_date = NOW(),
                        end_date = NOW() + INTERVAL '1 year',
                        updated_at = NOW()
                     RETURNING id`,
                    [storeId, userId, 'paid', 'active', amount, currency,
                        'razorpay', paymentId, orderId, referralCode]
                );

                const subscriptionId = subscriptionResult.rows[0].id;

                console.log('Subscription created/updated:', subscriptionId);

                // 2. Process referral commission if referral code exists
                if (referralCode) {
                    // Find the referral record
                    const referralResult = await client.query(
                        `SELECT ar.*, a.user_id as referrer_user_id
                         FROM affiliate_referrals ar
                         JOIN affiliates a ON a.id = ar.affiliate_id
                         WHERE ar.referred_user_id = $1 
                         AND ar.referral_code = $2
                         AND ar.commission_status = 'pending'`,
                        [userId, referralCode]
                    );

                    if (referralResult.rows.length > 0) {
                        const referral = referralResult.rows[0];

                        // Update referral status to converted and commission to paid
                        await client.query(
                            `UPDATE affiliate_referrals
                             SET referral_status = 'converted',
                                 commission_status = 'paid',
                                 converted_at = NOW(),
                                 commission_paid_at = NOW(),
                                 subscription_id = $1
                             WHERE id = $2`,
                            [subscriptionId, referral.id]
                        );

                        console.log('Referral commission credited:', referral.id);

                        // Stats will be auto-updated by trigger
                    }
                }

                await client.query('COMMIT');

                console.log('Payment processed successfully:', paymentId);

                res.json({
                    status: 'success',
                    message: 'Payment processed',
                    subscriptionId
                });

            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } else {
            // Other event types (payment.failed, etc.)
            console.log('Unhandled event type:', eventType);
            res.json({ status: 'ignored', event: eventType });
        }

    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

/**
 * POST /api/webhooks/subscription-manual
 * Manual subscription creation (for testing or manual payments)
 * Requires admin authentication
 */
router.post('/subscription-manual', async (req: Request, res: Response) => {
    try {
        const { userId, storeId, planType, amount, referralCode } = req.body;

        if (!userId || !storeId || !planType) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Create subscription
            const subscriptionResult = await client.query(
                `INSERT INTO subscriptions 
                 (store_id, user_id, plan_type, status, amount, currency, 
                  payment_gateway, start_date, end_date, referred_by_code)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 
                         CASE WHEN $3 = 'paid' THEN NOW() + INTERVAL '1 year' ELSE NULL END, 
                         $8)
                 ON CONFLICT (store_id) 
                 DO UPDATE SET 
                    plan_type = $3,
                    status = $4,
                    amount = $5,
                    start_date = NOW(),
                    end_date = CASE WHEN $3 = 'paid' THEN NOW() + INTERVAL '1 year' ELSE NULL END,
                    updated_at = NOW()
                 RETURNING id`,
                [storeId, userId, planType, 'active', amount || 0, 'INR',
                    'manual', referralCode]
            );

            const subscriptionId = subscriptionResult.rows[0].id;

            // Process referral if paid plan and referral code exists
            if (planType === 'paid' && referralCode) {
                const referralResult = await client.query(
                    `SELECT ar.*, a.user_id as referrer_user_id
                     FROM affiliate_referrals ar
                     JOIN affiliates a ON a.id = ar.affiliate_id
                     WHERE ar.referred_user_id = $1 
                     AND ar.referral_code = $2
                     AND ar.commission_status = 'pending'`,
                    [userId, referralCode]
                );

                if (referralResult.rows.length > 0) {
                    const referral = referralResult.rows[0];

                    await client.query(
                        `UPDATE affiliate_referrals
                         SET referral_status = 'converted',
                             commission_status = 'paid',
                             converted_at = NOW(),
                             commission_paid_at = NOW(),
                             subscription_id = $1
                         WHERE id = $2`,
                        [subscriptionId, referral.id]
                    );
                }
            }

            await client.query('COMMIT');

            res.json({
                message: 'Subscription created successfully',
                subscriptionId
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Manual subscription error:', error);
        res.status(500).json({ error: 'Failed to create subscription' });
    }
});

export default router;
