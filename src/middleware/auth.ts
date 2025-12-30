import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';

// Extend Express Request to include auth context
export interface AuthRequest extends Request {
    context?: {
        userId: string;
        storeId: string;
        email: string;
    };
}

interface JWTPayload {
    userId: string;
    email: string;
    iat?: number;
    exp?: number;
}

/**
 * Authentication Middleware
 * 
 * Verifies JWT token and loads user + store information
 * Attaches store_id to request context for data isolation
 */
export async function authenticate(
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            // [SSE Fix] Check query param for EventSource support
            if (req.query && req.query.token) {
                // Continue execution with token from query
            } else {
                // If it's an SSE request (Accept: text/event-stream), close connection cleanly
                if (req.headers.accept === 'text/event-stream') {
                    res.end();
                    return;
                }
                res.status(401).json({ error: 'No authorization token provided' });
                return;
            }
        }

        const token = (authHeader && authHeader.startsWith('Bearer '))
            ? authHeader.substring(7)
            : (authHeader || req.query.token as string);

        if (!token) {
            if (req.headers.accept === 'text/event-stream') {
                res.end();
                return;
            }
            res.status(401).json({ error: 'Invalid authorization format' });
            return;
        }

        // Bypass for Dev Mode
        if (process.env.NODE_ENV === 'development' && token === 'mock_dev_token') {
            req.context = {
                userId: 'd0000000-0000-0000-0000-000000000001',
                storeId: 'd0000000-0000-0000-0000-000000000002', // Must match seed
                email: 'dev@chaiapp.local'
            };
            next();
            return;
        }

        // Verify JWT
        let payload: JWTPayload;
        try {
            payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
        } catch (error) {
            // [SSE Safe Error]
            if (req.headers.accept === 'text/event-stream') {
                console.log('[Auth] SSE Token verification failed, closing stream.');
                res.end();
                return;
            }

            if (error instanceof jwt.TokenExpiredError) {
                res.status(401).json({ error: 'Token expired' });
                return;
            }
            res.status(401).json({ error: 'Invalid token' });
            return;
        }

        // Fetch user and their store in a single query
        const result = await query<{ user_id: string; store_id: string; email: string }>(
            `SELECT 
        u.id as user_id,
        s.id as store_id,
        u.email
      FROM users u
      INNER JOIN stores s ON s.user_id = u.id
      WHERE u.id = $1`,
            [payload.userId]
        );

        if (result.rows.length === 0) {
            // [SSE Safe Error]
            if (req.headers.accept === 'text/event-stream') {
                res.end();
                return;
            }
            res.status(401).json({ error: 'User or store not found' });
            return;
        }

        const { user_id, store_id, email } = result.rows[0];

        // Attach context to request
        req.context = {
            userId: user_id,
            storeId: store_id,
            email: email,
        };

        // Continue to route handler
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        // [SSE Safe Error]
        if (req.headers.accept === 'text/event-stream') {
            res.end();
            return;
        }
        res.status(500).json({ error: 'Internal authentication error' });
    }
}

/**
 * Optional Authentication Middleware
 * 
 * Tries to authenticate but doesn't fail if token is missing
 * Useful for routes that change behavior based on auth status
 */
export async function optionalAuth(
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        next();
        return;
    }

    // Reuse authenticate logic but don't fail
    await authenticate(req, res, (err) => {
        if (err) {
            console.warn('Optional auth failed:', err);
        }
        next();
    });
}

/**
 * Generate JWT Token
 */
export function generateToken(userId: string, email: string): string {
    const payload: JWTPayload = {
        userId,
        email,
    };

    return jwt.sign(payload, process.env.JWT_SECRET!, {
        expiresIn: '7d', // Token valid for 7 days
    });
}

/**
 * Verify and decode token without database lookup
 */
export function verifyToken(token: string): JWTPayload | null {
    try {
        return jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    } catch (error) {
        return null;
    }
}
