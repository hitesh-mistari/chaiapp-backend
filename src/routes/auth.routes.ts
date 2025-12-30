import { Router, Request, Response } from 'express';
import { authenticateWithGoogle } from '../services/auth.service.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/google
 * 
 * Authenticate with Google OAuth
 * 
 * Body: { idToken: string }
 * 
 * Response:
 * - 200: { token, user, store, isNewUser }
 * - 400: Invalid request
 * - 401: Invalid token
 */
router.post('/google', async (req: Request, res: Response) => {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            res.status(400).json({ error: 'Google ID token is required' });
            return;
        }

        const authResponse = await authenticateWithGoogle(idToken);

        res.json(authResponse);
    } catch (error) {
        console.error('Google auth error:', error);

        if (error instanceof Error && error.message === 'Invalid Google token') {
            res.status(401).json({ error: 'Invalid Google authentication' });
            return;
        }

        res.status(500).json({ error: 'Authentication failed' });
    }
});

/**
 * POST /api/auth/guest
 * Create and login as a guest
 */
router.post('/guest', async (_req: Request, res: Response) => {
    try {
        const authResponse = await import('../services/auth.service.js').then(s => s.createGuestUser());
        res.status(201).json(authResponse);
    } catch (error) {
        console.error('Guest creation error:', error);
        res.status(500).json({ error: 'Failed to create guest account' });
    }
});

/**
 * POST /api/auth/register
 * Register with email/password
 */
router.post('/register', async (req: Request, res: Response) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password || !name) {
            res.status(400).json({ error: 'All fields are required' });
            return;
        }

        const authResponse = await import('../services/auth.service.js').then(s => s.registerWithPassword(email, password, name));
        res.status(201).json(authResponse);
    } catch (error: any) {
        if (error.message === 'User already exists') {
            res.status(409).json({ error: 'User already exists' });
        } else {
            console.error('Registration error:', error);
            res.status(500).json({ error: 'Registration failed' });
        }
    }
});

/**
 * POST /api/auth/verify-email
 */
router.post('/verify-email', async (req: Request, res: Response) => {
    try {
        const { token } = req.body;
        if (!token) {
            res.status(400).json({ error: 'Token is required' });
            return;
        }
        const { verifyEmail } = await import('../services/auth.service.js');
        await verifyEmail(token);
        res.json({ message: 'Email verified' });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/auth/login
 * Login with email/password
 */
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: 'Email and password required' });
            return;
        }

        const authResponse = await import('../services/auth.service.js').then(s => s.loginWithPassword(email, password));
        res.json(authResponse);
    } catch (error: any) {
        if (error.message === 'Invalid credentials') {
            res.status(401).json({ error: 'Invalid credentials' });
        } else if (error.message === 'Please verify your email address before logging in.') {
            res.status(403).json({ error: error.message });
        } else if (error.message === 'Use Google Login') {
            res.status(400).json({ error: 'Please sign in with Google' });
        } else {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Login failed' });
        }
    }
});

/**
 * GET /api/auth/me
 * 
 * Get current authenticated user and store
 * 
 * Headers: Authorization: Bearer <token>
 * 
 * Response:
 * - 200: { user, store }
 * - 401: Not authenticated
 */
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { userId } = req.context!;

        // Fetch full user and store data
        const { query } = await import('../config/database.js');
        const result = await query<{
            user_id: string;
            email: string;
            name: string;
            picture: string | null;
            store_id: string;
            store_name: string;
            currency_symbol: string;
            upi_id: string | null;
        }>(
            `SELECT 
        u.id as user_id,
        u.email,
        u.name,
        u.picture,
        s.id as store_id,
        s.store_name,
        s.currency_symbol,
        s.upi_id
      FROM users u
      INNER JOIN stores s ON s.user_id = u.id
      WHERE u.id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'User or store not found' });
            return;
        }

        const data = result.rows[0];

        res.json({
            user: {
                id: data.user_id,
                email: data.email,
                name: data.name,
                picture: data.picture || undefined,
            },
            store: {
                id: data.store_id,
                storeName: data.store_name,
                currencySymbol: data.currency_symbol,
                upiId: data.upi_id || undefined,
            },
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
});

/**
 * POST /api/auth/logout
 * 
 * Logout (client-side token removal, no server action needed)
 * Optional route for analytics/logging
 */
router.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
    // With JWT, logout is handled client-side by removing the token
    // This endpoint is optional and can be used for logging/analytics

    console.log(`User ${req.context!.userId} logged out`);

    res.json({ message: 'Logged out successfully' });
});

export default router;
