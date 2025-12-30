import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { pool } from '../config/database.js';

describe('Customers CRUD API', () => {
    let authToken: string;
    // let _userId: string;
    let createdCustomerId: string;

    const testEmail = `test_crud_${Date.now()}@example.com`;

    beforeAll(async () => {
        // Create a user for testing CRUD
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                email: testEmail,
                password: 'password123',
                name: 'CRUD Tester'
            });

        if (res.status !== 201) {
            console.error('Test user registration failed:', res.body);
        }

        authToken = res.body.token;
        // _userId = res.body.user.id;
    });

    afterAll(async () => {
        // Cleanup
        await pool.query("DELETE FROM users WHERE email = $1", [testEmail]);
        // Pool closing handled in auth test or globally in single run, 
        // but if running independently need to verify connection state.
        // For now, avoiding closing here to prevent conflict if running in parallel, 
        // or ensure --runInBand is used. 
        // Best practice: Setup/Teardown global or per file.
    });

    it('should create a new customer', async () => {
        const res = await request(app)
            .post('/api/customers')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                name: 'John Doe',
                phone: '1234567890',
                office: 'Main Office'
            });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toBe('John Doe');
        createdCustomerId = res.body.id;
    });

    it('should fetch all customers', async () => {
        const res = await request(app)
            .get('/api/customers')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        const find = res.body.find((c: any) => c.id === createdCustomerId);
        expect(find).toBeTruthy();
    });

    it('should update a customer', async () => {
        const res = await request(app)
            .patch(`/api/customers/${createdCustomerId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                name: 'John Updated',
                phone: '0987654321'
            });

        expect(res.status).toBe(200);

        // Verify update in DB
        const dbCheck = await pool.query('SELECT name, phone FROM customers WHERE id = $1', [createdCustomerId]);
        expect(dbCheck.rows[0].name).toBe('John Updated');
        expect(dbCheck.rows[0].phone).toBe('0987654321');
    });

    it('should delete a customer (soft delete)', async () => {
        const res = await request(app)
            .delete(`/api/customers/${createdCustomerId}`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);

        // Verify Soft Deletion in DB
        const dbCheck = await pool.query('SELECT is_active FROM customers WHERE id = $1', [createdCustomerId]);
        expect(dbCheck.rows[0].is_active).toBe(false);
    });
});
