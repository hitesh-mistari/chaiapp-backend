import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { pool } from '../config/database.js';

describe('Auth API', () => {
    // let authToken: string;

    const testEmail = `test_auth_${Date.now()}@example.com`;

    beforeAll(async () => {
        // cleanup just in case (though unique email helps)
        await pool.query("DELETE FROM users WHERE email = $1", [testEmail]);
    });

    afterAll(async () => {
        // Cleanup: Delete test user
        await pool.query("DELETE FROM users WHERE email = $1", [testEmail]);
        await pool.end();
    });

    it('should register a new user with password', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                email: testEmail,
                password: 'password123',
                name: 'Test Setup User'
            });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('token');
        expect(res.body.user.email).toBe(testEmail);

    });

    it('should fail login if not verified', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({

                email: testEmail,
                password: 'password123'
            });

        expect(res.status).toBe(403);
        expect(res.body.error).toContain('verify your email');
    });

    it('should login with valid credentials after verification', async () => {
        // Manually verify in DB
        await pool.query("UPDATE users SET email_verified = TRUE WHERE email = $1", [testEmail]);

        const res = await request(app)
            .post('/api/auth/login')
            .send({

                email: testEmail,
                password: 'password123'
            });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
    });

    it('should fail login with invalid password', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: testEmail,
                password: 'wrongpassword'
            });

        expect(res.status).toBe(401);
    });

    it('should create a guest user', async () => {
        const res = await request(app)
            .post('/api/auth/guest');

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('token');
        expect(res.body.isNewUser).toBe(true);
        expect(res.body.user.email).toContain('@temp.local');

        // Cleanup guest
        const guestId = res.body.user.id;
        await pool.query('DELETE FROM users WHERE id = $1', [guestId]);
    });
});
