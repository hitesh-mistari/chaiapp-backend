import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { query, transaction } from '../config/database.js';

const router = Router();

// Protect all settings routes
router.use(authenticate);

/**
 * GET /api/settings
 * Fetch settings for the authenticated store
 */
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { storeId } = req.context!;

        const result = await query(
            `SELECT 
                s.price_per_chai, 
                s.price_per_coffee, 
                COALESCE(s.shop_name, st.store_name) as shop_name, 
                s.enable_notifications,
                st.currency_symbol,
                s.sound_enabled,
                s.show_walk_in,
                s.products,
                st.upi_id,
                st.store_name as original_store_name
             FROM stores st
             LEFT JOIN store_settings s ON s.store_id = st.id
             WHERE st.id = $1`,
            [storeId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Store not found' });
            return;
        }

        const row = result.rows[0];

        res.json({
            pricePerChai: parseFloat(row.price_per_chai || 10),
            pricePerCoffee: parseFloat(row.price_per_coffee || 15),
            shopName: row.shop_name || row.original_store_name || 'My Chai Shop',
            enableNotifications: row.enable_notifications ?? false,
            currencySymbol: row.currency_symbol || '₹',
            soundEnabled: row.sound_enabled ?? true,
            showWalkIn: row.show_walk_in ?? true,
            products: Array.isArray(row.products) ? row.products : [],
            upiId: row.upi_id || ''
        });

    } catch (error) {
        console.error('Fetch settings error:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

/**
 * POST /api/settings
 * Update settings
 */
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const { storeId } = req.context!;
        const {
            pricePerChai,
            pricePerCoffee,
            shopName,
            enableNotifications,
            soundEnabled,
            showWalkIn,
            products,
            upiId
        } = req.body;

        await transaction(async (client: any) => {
            // Update store_settings
            await client.query(
                `INSERT INTO store_settings (
                    store_id, price_per_chai, price_per_coffee, shop_name, enable_notifications, sound_enabled, show_walk_in, products
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (store_id) 
                 DO UPDATE SET 
                    price_per_chai = EXCLUDED.price_per_chai,
                    price_per_coffee = EXCLUDED.price_per_coffee,
                    shop_name = EXCLUDED.shop_name,
                    enable_notifications = EXCLUDED.enable_notifications,
                    sound_enabled = EXCLUDED.sound_enabled,
                    show_walk_in = EXCLUDED.show_walk_in,
                    products = EXCLUDED.products`,
                [storeId, pricePerChai, pricePerCoffee, shopName, enableNotifications, soundEnabled, showWalkIn ?? true, JSON.stringify(products || [])]
            );

            // Update stores table for shop name and upi_id
            await client.query(
                `UPDATE stores SET store_name = $1, upi_id = $2 WHERE id = $3`,
                [shopName, upiId || null, storeId]
            );
        });

        res.json({ message: 'Settings updated' });

    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

export default router;
