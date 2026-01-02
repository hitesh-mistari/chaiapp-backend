import { Router, Request, Response } from 'express';
import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { notificationService } from '../services/notification.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

/**
 * POST /api/public/ledger/confirm-payment
 * Confirm a payment from the customer side
 */
router.post('/ledger/confirm-payment', async (req: Request, res: Response) => {
    try {
        const { customerId, storeId, monthStr, amount, receiptImage } = req.body;

        if (!customerId || !storeId || !monthStr || !amount) {
            const errLog = `Missing fields: ${JSON.stringify({ customerId, storeId, monthStr, amount })}\n`;
            console.error(errLog);
            try { fs.appendFileSync(path.join(__dirname, '../../error_log.txt'), `Warn ${new Date().toISOString()}: ${errLog}\n`); } catch { }
            return res.status(400).json({ error: 'Missing required fields' });
        }

        let receiptUrl = null;

        if (receiptImage && receiptImage.startsWith('data:image')) {
            // Save base64 image
            const base64Data = receiptImage.replace(/^data:image\/\w+;base64,/, "");
            const fileName = `receipt_${Date.now()}_${uuidv4().substring(0, 8)}.jpg`;
            const uploadDir = path.join(__dirname, '../../public/uploads/receipts');

            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const filePath = path.join(uploadDir, fileName);
            fs.writeFileSync(filePath, base64Data, 'base64');
            receiptUrl = `/uploads/receipts/${fileName}`;
        }

        const paymentId = uuidv4();
        const paidAt = Date.now();

        await query(
            `INSERT INTO payments (id, customer_id, store_id, month_str, amount, paid_at, status, receipt_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [paymentId, customerId, storeId, monthStr, amount, paidAt, 'pending_confirmation', receiptUrl]
        );

        return res.json({ message: 'Payment confirmation sent successfully', paymentId });

        // Notify owner via SSE (fire and forget)
        notificationService.broadcast(storeId, 'PAYMENT_RECEIVED', {
            type: 'PAYMENT_RECEIVED',
            customerName: 'Customer', // We might need to fetch the real name if available, but for now this works. Or we can query it relative to customerId if needed.
            amount: parseFloat(amount),
            paymentId,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Confirm payment error:', error);
        try {
            fs.appendFileSync(path.join(__dirname, '../../error_log.txt'), `Error ${new Date().toISOString()}: ${error}\n${(error as any).stack}\n\n`);
        } catch (e) { console.error('Failed to write log', e); }
        return res.status(500).json({ error: 'Failed to send payment confirmation' });
    }
});

/**
 * GET /api/public/ledger/:slug
 * Fetch customer ledger info publicly (limited data)
 */
router.get('/ledger/:slug', async (req: Request, res: Response): Promise<any> => {
    try {
        const { slug } = req.params;

        // Find customer by slug
        // Since slugs aren't stored, we have to match the logic: generateSlug(name)-shortId
        const customersResult = await query('SELECT * FROM customers');
        const customer = customersResult.rows.find(c => {
            const nameSlug = c.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim().replace(/^-+|-+$/g, '');
            const shortId = c.id.split('-')[0].substring(0, 4);
            return `${nameSlug}-${shortId}` === slug;
        });

        if (!customer || !customer.is_active) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Fetch logs and payments
        const [logs, payments, settings] = await Promise.all([
            query('SELECT * FROM logs WHERE customer_id = $1 ORDER BY timestamp DESC', [customer.id]),
            query('SELECT * FROM payments WHERE customer_id = $1 ORDER BY paid_at DESC', [customer.id]),
            query(`
                SELECT 
                    s.*, 
                    st.currency_symbol, 
                    st.store_name, 
                    st.upi_id as store_upi_id,
                    u.referral_code
                FROM stores st
                LEFT JOIN store_settings s ON s.store_id = st.id
                LEFT JOIN users u ON st.user_id = u.id
                WHERE st.id = $1
            `, [customer.store_id])
        ]);

        const sRow = settings.rows[0];

        return res.json({
            customer: {
                id: customer.id,
                name: customer.name,
                office: customer.office,
                storeId: customer.store_id
            },
            logs: logs.rows.map(r => ({
                id: r.id,
                customerId: r.customer_id,
                timestamp: parseInt(r.timestamp),
                count: r.count,
                productType: r.drink_type,
                priceAtTime: parseFloat(r.price_at_time)
            })),
            payments: payments.rows.map(r => ({
                id: r.id,
                customerId: r.customer_id,
                monthStr: r.month_str,
                amount: parseFloat(r.amount),
                paidAt: parseInt(r.paid_at),
                status: r.status,
                receiptUrl: r.receipt_url || null
            })),
            settings: {
                pricePerChai: parseFloat(sRow?.price_per_chai || 10),
                pricePerCoffee: parseFloat(sRow?.price_per_coffee || 15),
                shopName: sRow?.shop_name || sRow?.store_name || 'My Chai Shop',
                enableNotifications: sRow?.enable_notifications ?? false,
                currencySymbol: sRow?.currency_symbol || '₹',
                soundEnabled: sRow?.sound_enabled ?? true,
                products: Array.isArray(sRow?.products) ? sRow?.products : [],
                upiId: sRow?.store_upi_id || sRow?.upi_id || '',
                referralCode: sRow?.referral_code || ''
            }
        });
    } catch (error) {
        console.error('Fetch public ledger error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
