import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { notificationService } from '../services/notification.service.js';

const router = Router();

/**
 * GET /api/history/stream
 * History-specific SSE stream for real-time updates
 */
router.get('/stream', authenticate, (req: AuthRequest, res: Response) => {
    const { storeId } = req.context!;

    // Set CORS headers explicitly for SSE (must be before other headers)
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5174');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for Nginx

    res.flushHeaders();

    console.log(`[SSE] Client connected from store: ${storeId}`);

    // Register client with generic notification service
    // We can reuse the same service since we only have one type of broadcast right now
    notificationService.addClient(res, storeId);
});

export default router;
