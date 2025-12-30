import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { notificationService } from '../services/notification.service.js';

const router = Router();

/**
 * GET /api/notifications
 * Open an SSE connection for real-time updates
 */
router.get('/', authenticate, (req: AuthRequest, res: Response) => {
    const { storeId } = req.context!;

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for Nginx

    // Some browsers require strict CORS headers for EventSource
    // The main server.ts CORS middleware should handle this, but explicit check doesn't hurt
    res.flushHeaders();

    // Register client
    notificationService.addClient(res, storeId);
});

export default router;
