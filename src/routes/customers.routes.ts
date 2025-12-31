import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// All routes are protected with authentication middleware
router.use(authenticate);

/**
 * GET /api/customers
 * 
 * Fetch all customers for the authenticated user's store
 * Data is automatically scoped by store_id from auth middleware
 */
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { storeId } = req.context!;

        const result = await query<{
            id: string;
            name: string;
            phone: string | null;
            office: string | null;
            is_active: boolean;
            lat: number | null;
            lng: number | null;
            created_at: Date;
            store_id: string;
        }>(
            `SELECT 
        id, name, phone, office, is_active, lat, lng, created_at, store_id
      FROM customers
      WHERE store_id = $1
      ORDER BY created_at DESC`,
            [storeId]
        );

        res.json(result.rows.map(row => ({
            id: row.id,
            name: row.name,
            phone: row.phone || undefined,
            office: row.office || undefined,
            isActive: row.is_active,
            lat: row.lat || undefined,
            lng: row.lng || undefined,
            createdAt: row.created_at.toISOString(),
            storeId: row.store_id,
        })));
    } catch (error) {
        console.error('Fetch customers error:', error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

/**
 * GET /api/customers/:id
 * 
 * Fetch a single customer by ID
 * Ensures customer belongs to authenticated user's store
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { storeId } = req.context!;
        const { id } = req.params;

        const result = await query<{
            id: string;
            name: string;
            phone: string | null;
            office: string | null;
            is_active: boolean;
            lat: number | null;
            lng: number | null;
            created_at: Date;
            store_id: string;
        }>(
            `SELECT 
        id, name, phone, office, is_active, lat, lng, created_at, store_id
      FROM customers
      WHERE id = $1 AND store_id = $2`,
            [id, storeId] // Critical: Always include store_id
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Customer not found' });
            return;
        }

        const customer = result.rows[0];

        res.json({
            id: customer.id,
            name: customer.name,
            phone: customer.phone || undefined,
            office: customer.office || undefined,
            isActive: customer.is_active,
            lat: customer.lat || undefined,
            lng: customer.lng || undefined,
            createdAt: customer.created_at.toISOString(),
            storeId: customer.store_id,
        });
    } catch (error) {
        console.error('Fetch customer error:', error);
        res.status(500).json({ error: 'Failed to fetch customer' });
    }
});

/**
 * POST /api/customers
 * 
 * Create a new customer
 * Customer is automatically associated with authenticated user's store
 */
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const { storeId } = req.context!;
        const { id, name, phone, office, lat, lng } = req.body;

        // Validation
        if (!name || name.trim().length === 0) {
            res.status(400).json({ error: 'Customer name is required' });
            return;
        }

        const customerId = id || uuidv4();

        const result = await query<{ id: string }>(
            `INSERT INTO customers (
        id, store_id, name, phone, office, lat, lng, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
            [
                customerId,
                storeId, // Critical: Always use store_id from context
                name.trim(),
                phone || null,
                office || null,
                lat || null,
                lng || null,
                true,
            ]
        );

        res.status(201).json({
            id: result.rows[0].id,
            name: name.trim(),
            message: 'Customer created successfully',
        });
    } catch (error: any) {
        console.error('Create customer error:', error);

        // Handle duplicate phone number for same store
        if (error.code === '23505' && error.constraint === 'idx_customers_store_phone') {
            res.status(409).json({ error: 'A customer with this phone number already exists' });
            return;
        }

        res.status(500).json({ error: 'Failed to create customer' });
    }
});

/**
 * PATCH /api/customers/:id
 * 
 * Update a customer
 * Ensures customer belongs to authenticated user's store
 */
router.patch('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { storeId } = req.context!;
        const { id } = req.params;
        const { name, phone, office, lat, lng, isActive } = req.body;

        // Build dynamic update query
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(name.trim());
        }
        if (phone !== undefined) {
            updates.push(`phone = $${paramIndex++}`);
            values.push(phone || null);
        }
        if (office !== undefined) {
            updates.push(`office = $${paramIndex++}`);
            values.push(office || null);
        }
        if (lat !== undefined) {
            updates.push(`lat = $${paramIndex++}`);
            values.push(lat || null);
        }
        if (lng !== undefined) {
            updates.push(`lng = $${paramIndex++}`);
            values.push(lng || null);
        }
        if (isActive !== undefined) {
            updates.push(`is_active = $${paramIndex++}`);
            values.push(isActive);
        }

        if (updates.length === 0) {
            res.status(400).json({ error: 'No fields to update' });
            return;
        }

        // Add WHERE clause parameters
        values.push(id, storeId);

        const result = await query(
            `UPDATE customers
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND store_id = $${paramIndex + 1}
      RETURNING id`,
            values
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Customer not found' });
            return;
        }

        res.json({ message: 'Customer updated successfully' });
    } catch (error) {
        console.error('Update customer error:', error);
        res.status(500).json({ error: 'Failed to update customer' });
    }
});

/**
 * DELETE /api/customers/:id
 * 
 * Delete a customer (soft delete by setting is_active = false)
 * Ensures customer belongs to authenticated user's store
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { storeId } = req.context!;
        const { id } = req.params;

        // Soft delete (recommend over hard delete to preserve transaction history)
        const result = await query(
            `UPDATE customers
      SET is_active = false
      WHERE id = $1 AND store_id = $2
      RETURNING id`,
            [id, storeId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Customer not found' });
            return;
        }

        res.json({ message: 'Customer deleted successfully' });
    } catch (error) {
        console.error('Delete customer error:', error);
        res.status(500).json({ error: 'Failed to delete customer' });
    }
});

/**
 * GET /api/customers/logs/all
 * Fetch ALL logs for the authenticated store (optimized for loading state)
 */
router.get('/logs/all', async (req: AuthRequest, res: Response) => {
    try {
        const { storeId } = req.context!;
        // Initial load optimization: get last 30 days or similar limits could be applied
        // For now, getting all as requested by frontend logic
        const result = await query(
            `SELECT * 
             FROM logs
             WHERE store_id = $1
             ORDER BY created_at DESC`,
            [storeId]
        );

        // Map snake_case database to camelCase frontend
        const logs = result.rows.map(row => ({
            id: row.id,
            customerId: row.customer_id,
            timestamp: new Date(row.created_at).getTime(),
            count: row.quantity,
            productType: row.drink_type,
            priceAtTime: row.price_at_time ? parseFloat(row.price_at_time) : undefined
        }));

        res.json(logs);
    } catch (error) {
        console.error('Fetch logs error:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

/**
 * DELETE /api/customers/logs/:logId
 * Remove a log entry
 */
router.delete('/logs/:logId', async (req: AuthRequest, res: Response) => {
    try {
        const { logId } = req.params;
        const { storeId } = req.context!;

        const result = await query(
            `DELETE FROM logs 
             WHERE id = $1 AND store_id = $2
             RETURNING id`,
            [logId, storeId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Log not found' });
            return;
        }

        res.json({ message: 'Log removed successfully' });
    } catch (error) {
        console.error('Delete log error:', error);
        res.status(500).json({ error: 'Failed to delete log' });
    }
});

/**
 * POST /api/customers/:id/logs
 * Add a log entry
 */
router.post('/:id/logs', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params; // Customer ID
        const { id: logId, count, productType, priceAtTime } = req.body;
        const { storeId } = req.context!;

        // Ensure customer belongs to store (skip check for walk-in)
        if (id !== 'walk-in') {
            const customerCheck = await query('SELECT id FROM customers WHERE id = $1 AND store_id = $2', [id, storeId]);
            if (customerCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Customer not found in your store' });
            }
        }

        // For walk-in, use NULL as customer_id
        const customerId = id === 'walk-in' ? null : id;

        await query(
            `INSERT INTO logs (id, customer_id, store_id, drink_type, quantity, price_at_time)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [logId || uuidv4(), customerId, storeId, productType, count, priceAtTime]
        );

        return res.json({ message: 'Log added' });
    } catch (error) {
        console.error('Add log error:', error);
        return res.status(500).json({ error: 'Failed to add log' });
    }
});

/**
 * GET /api/customers/payments/all
 * Fetch ALL payments
 */
router.get('/payments/all', async (req: AuthRequest, res: Response) => {
    try {
        const { storeId } = req.context!;
        const result = await query(
            `SELECT p.id, p.customer_id, p.store_id, p.month_str, p.amount, 
                    p.paid_at, p.status, p.receipt_url, p.created_at, p.payment_date,
                    c.name as customer_name 
             FROM payments p
             LEFT JOIN customers c ON p.customer_id = c.id
             WHERE p.store_id = $1
             ORDER BY p.paid_at DESC, p.created_at DESC`,
            [storeId]
        );

        const payments = result.rows.map(row => ({
            id: row.id,
            customerId: row.customer_id,
            monthStr: row.month_str,
            amount: parseFloat(row.amount),
            paidAt: parseInt(row.paid_at) || new Date(row.payment_date || row.created_at).getTime(),
            status: row.status || 'completed',
            receiptUrl: row.receipt_url,
            customerName: row.customer_name // Helper for frontend
        }));

        console.log(`[DEBUG] Fetched ${payments.length} payments for store ${storeId}`);
        const sampleWithReceipt = payments.find(p => p.receiptUrl);
        if (sampleWithReceipt) {
            console.log(`[DEBUG] Sample payment with receipt:`, {
                id: sampleWithReceipt.id,
                customerName: sampleWithReceipt.customerName,
                receiptUrl: sampleWithReceipt.receiptUrl,
                status: sampleWithReceipt.status
            });
        } else {
            console.log(`[DEBUG] No payments with receipts found`);
        }

        res.json(payments);
    } catch (error) {
        console.error('Fetch payments error:', error);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

/**
 * POST /api/customers/:id/payments
 * Add a payment
 */
router.post('/:id/payments', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { id: paymentId, amount, monthStr, paidAt } = req.body;
        const { storeId } = req.context!;

        // Ensure customer belongs to store (skip check for walk-in)
        if (id !== 'walk-in') {
            const customerCheck = await query('SELECT id FROM customers WHERE id = $1 AND store_id = $2', [id, storeId]);
            if (customerCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Customer not found in your store' });
            }
        }

        // For walk-in, use NULL as customer_id
        const customerId = id === 'walk-in' ? null : id;

        // Use current timestamp if paidAt not provided
        const paymentDate = paidAt || Date.now();

        const newPayment = {
            id: paymentId || uuidv4(),
            customerId,
            storeId,
            amount,
            monthStr,
            paidAt: paymentDate,
            status: 'completed'
        };

        await query(
            `INSERT INTO payments (id, customer_id, store_id, amount, month_str, paid_at, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [newPayment.id, newPayment.customerId, newPayment.storeId, newPayment.amount, newPayment.monthStr, newPayment.paidAt, newPayment.status]
        );

        return res.json(newPayment);
    } catch (error) {
        console.error('Add payment error:', error);
        return res.status(500).json({ error: 'Failed to add payment' });
    }
});

/**
 * PATCH /api/customers/payments/:id/verify
 * Verify a payment (shop owner side)
 */
router.patch('/payments/:id/verify', async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'completed' or deleted
        const { storeId } = req.context!;

        if (status === 'completed') {
            await query(
                `UPDATE payments 
                 SET status = 'completed' 
                 WHERE id = $1 AND store_id = $2`,
                [id, storeId]
            );
            return res.json({ message: 'Payment verified' });
        } else {
            // If not completed, we assume it's rejected/deleted
            await query(
                `DELETE FROM payments 
                 WHERE id = $1 AND store_id = $2`,
                [id, storeId]
            );
            return res.json({ message: 'Payment rejected and removed' });
        }
    } catch (error) {
        console.error('Verify payment error:', error);
        res.status(500).json({ error: 'Failed to verify payment' });
    }
});

/**
 * DELETE /api/customers/payments/:id
 * Remove a payment
 */
router.delete('/payments/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { storeId } = req.context!;

        const result = await query(
            `DELETE FROM payments 
             WHERE id = $1 AND store_id = $2
             RETURNING id`,
            [id, storeId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Payment not found' });
            return;
        }

        res.json({ message: 'Payment removed successfully' });
    } catch (error) {
        console.error('Delete payment error:', error);
        res.status(500).json({ error: 'Failed to delete payment' });
    }
});

export default router;
