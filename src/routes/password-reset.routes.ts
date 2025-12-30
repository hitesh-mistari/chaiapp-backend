import { Router, Request, Response } from 'express';
import { requestPasswordReset, resetPassword } from '../services/auth.service.js';

const router = Router();

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        if (!email) {
            res.status(400).json({ error: 'Email is required' });
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            res.status(400).json({ error: 'Invalid email format' });
            return;
        }

        await requestPasswordReset(email);

        // Always return success (don't reveal if email exists)
        res.json({
            message: 'If an account exists with this email, a password reset link has been sent.'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process password reset request' });
    }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req: Request, res: Response) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            res.status(400).json({ error: 'Token and new password are required' });
            return;
        }

        // Password validation
        if (newPassword.length < 6) {
            res.status(400).json({ error: 'Password must be at least 6 characters long' });
            return;
        }

        await resetPassword(token, newPassword);

        res.json({ message: 'Password has been reset successfully' });
    } catch (error: any) {
        console.error('Reset password error:', error);

        if (error.message.includes('Invalid') || error.message.includes('expired') || error.message.includes('used')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Failed to reset password' });
        }
    }
});

export default router;
