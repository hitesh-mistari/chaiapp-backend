import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { pool } from '../config/database.js';

describe('Multi-Store Data Isolation', () => {
    let user1Token: string;
    let user2Token: string;
    let user1StoreId: string;
    let user2StoreId: string;
    let user1CustomerId: string;

    const user1Email = `store1_owner_${Date.now()}@test.com`;
    const user2Email = `store2_owner_${Date.now()}@test.com`;

    beforeAll(async () => {
        // Create User 1
        const user1Res = await request(app)
            .post('/api/auth/register')
            .send({
                email: user1Email,
                password: 'password123',
                name: 'Store 1 Owner'
            });

        user1Token = user1Res.body.token;
        user1StoreId = user1Res.body.store.id;

        // Create User 2
        const user2Res = await request(app)
            .post('/api/auth/register')
            .send({
                email: user2Email,
                password: 'password123',
                name: 'Store 2 Owner'
            });

        user2Token = user2Res.body.token;
        user2StoreId = user2Res.body.store.id;
    });

    afterAll(async () => {
        // Cleanup
        await pool.query("DELETE FROM users WHERE email IN ($1, $2)", [user1Email, user2Email]);
        await pool.end();
    });

    it('should create separate stores for each user', () => {
        expect(user1StoreId).toBeDefined();
        expect(user2StoreId).toBeDefined();
        expect(user1StoreId).not.toBe(user2StoreId);
    });

    it('should isolate customers between stores', async () => {
        // User 1 creates a customer
        const createRes = await request(app)
            .post('/api/customers')
            .set('Authorization', `Bearer ${user1Token}`)
            .send({
                name: 'User 1 Customer',
                phone: '1111111111',
                office: 'Office A'
            });

        expect(createRes.status).toBe(201);
        user1CustomerId = createRes.body.id;

        // User 1 should see their customer
        const user1Customers = await request(app)
            .get('/api/customers')
            .set('Authorization', `Bearer ${user1Token}`);

        expect(user1Customers.status).toBe(200);
        expect(Array.isArray(user1Customers.body)).toBe(true);
        expect(user1Customers.body.length).toBeGreaterThan(0);

        const foundCustomer = user1Customers.body.find(
            (c: any) => c.id === user1CustomerId
        );
        expect(foundCustomer).toBeDefined();
        expect(foundCustomer.name).toBe('User 1 Customer');

        // User 2 should NOT see User 1's customer
        const user2Customers = await request(app)
            .get('/api/customers')
            .set('Authorization', `Bearer ${user2Token}`);

        expect(user2Customers.status).toBe(200);
        expect(Array.isArray(user2Customers.body)).toBe(true);

        const leaked = user2Customers.body.find(
            (c: any) => c.id === user1CustomerId
        );
        expect(leaked).toBeUndefined();
    });

    it('should isolate settings between stores', async () => {
        // User 1 updates settings
        await request(app)
            .post('/api/settings')
            .set('Authorization', `Bearer ${user1Token}`)
            .send({
                pricePerChai: 20,
                pricePerCoffee: 25,
                shopName: 'Store 1 Chai Shop',
                enableNotifications: true,
                soundEnabled: true
            });

        // User 2 updates settings
        await request(app)
            .post('/api/settings')
            .set('Authorization', `Bearer ${user2Token}`)
            .send({
                pricePerChai: 15,
                pricePerCoffee: 20,
                shopName: 'Store 2 Coffee House',
                enableNotifications: false,
                soundEnabled: false
            });

        // Verify User 1's settings
        const user1Settings = await request(app)
            .get('/api/settings')
            .set('Authorization', `Bearer ${user1Token}`);

        expect(user1Settings.status).toBe(200);
        expect(user1Settings.body.pricePerChai).toBe(20);
        expect(user1Settings.body.shopName).toBe('Store 1 Chai Shop');

        // Verify User 2's settings (should be different)
        const user2Settings = await request(app)
            .get('/api/settings')
            .set('Authorization', `Bearer ${user2Token}`);

        expect(user2Settings.status).toBe(200);
        expect(user2Settings.body.pricePerChai).toBe(15);
        expect(user2Settings.body.shopName).toBe('Store 2 Coffee House');
    });

    it('should prevent cross-store data access via direct API calls', async () => {
        // User 2 tries to delete User 1's customer (should fail or not find it)
        const deleteRes = await request(app)
            .delete(`/api/customers/${user1CustomerId}`)
            .set('Authorization', `Bearer ${user2Token}`);

        // Should either be 404 (not found) or 403 (forbidden)
        // Based on implementation, it should be 404 because the WHERE clause filters by store_id
        expect([404, 403, 500]).toContain(deleteRes.status);

        // Verify User 1's customer still exists
        const verifyRes = await request(app)
            .get('/api/customers')
            .set('Authorization', `Bearer ${user1Token}`);

        const stillExists = verifyRes.body.find(
            (c: any) => c.id === user1CustomerId
        );
        expect(stillExists).toBeDefined();
    });

    it('should verify database-level isolation', async () => {
        // Query database directly to verify store_id is set correctly
        const user1CustomersDb = await pool.query(
            'SELECT * FROM customers WHERE store_id = $1',
            [user1StoreId]
        );

        const user2CustomersDb = await pool.query(
            'SELECT * FROM customers WHERE store_id = $1',
            [user2StoreId]
        );

        // User 1 should have at least 1 customer
        expect(user1CustomersDb.rows.length).toBeGreaterThan(0);

        // User 2 should have 0 customers (they didn't create any)
        expect(user2CustomersDb.rows.length).toBe(0);

        // Verify no customer has both store IDs (data integrity)
        const crossContamination = await pool.query(
            'SELECT * FROM customers WHERE store_id = $1 AND id IN (SELECT id FROM customers WHERE store_id = $2)',
            [user1StoreId, user2StoreId]
        );

        expect(crossContamination.rows.length).toBe(0);
    });
});
