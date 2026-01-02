import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables IMMEDIATELY
const result = dotenv.config();
if (result.error) {
    console.error('❌ Failed to load .env in server.ts:', result.error.message);
} else {
    console.log('✅ Loaded .env in server.ts');
}




// Import config (requires environment variables)
import { pool, closePool } from './config/database.js';

// Auto-migration on startup
(async function runMigrations() {
    try {
        console.log('--- Checking DB Schema ---');
        await pool.query('ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS customer_limit INTEGER DEFAULT 10');
        await pool.query('ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider VARCHAR(50)');
        await pool.query('ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255)');
        await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

        // Fix for referral system
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE');
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_id UUID REFERENCES users(id) ON DELETE SET NULL');

        // Backfill referral codes for existing users
        await pool.query(`UPDATE users SET referral_code = UPPER(SUBSTRING(email, 1, 4) || floor(random() * 9999 + 1000)::text) WHERE referral_code IS NULL`);

        // Enforce not null checks after backfill
        await pool.query('ALTER TABLE users ALTER COLUMN referral_code SET NOT NULL');

        console.log('✅ DB Schema verified/patched');
    } catch (err: any) {
        console.error('❌ DB Auto-Migration Failed:', err.message);
    }
})();

// Import routes
import authRoutes from './routes/auth.routes.js';
import passwordResetRoutes from './routes/password-reset.routes.js';
import customersRoutes from './routes/customers.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import adminRoutes from './routes/admin.routes.js';
import affiliateRoutes from './routes/affiliate.routes.js';
import subscriptionRoutes from './routes/subscription.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import publicRoutes from './routes/public.routes.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import security middleware
import {
    // adminRateLimiter,
    authRateLimiter,
    generalRateLimiter,
    validateRequestBody,
    getClientIP
} from './middleware/security.js';

const app = express();
// Trust the first proxy (Nginx/Cloudflare) - Critical for Rate Limiting & Secure Cookies in Prod
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3001;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// =============================================================================
// SECURITY MIDDLEWARE
// =============================================================================

// Enforce HTTPS in production
if (IS_PRODUCTION) {
    app.use((req, res, next) => {
        if (req.headers['x-forwarded-proto'] !== 'https') {
            return res.redirect(301, `https://${req.headers.host}${req.url}`);
        }
        next();
    });
}

// Enhanced security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"], // Adjust based on your needs
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: [
                "'self'",
                "data:",
                "https:",
                "http://localhost:3001",
                "http://127.0.0.1:3001",
                ...(IS_PRODUCTION ? [] : ["http://localhost:*", "http://127.0.0.1:*"])
            ],
            connectSrc: [
                "'self'",
                "http://localhost:3001",
                "http://127.0.0.1:3001",
                ...(IS_PRODUCTION ? [] : ["http://localhost:*", "http://127.0.0.1:*"])
            ],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginEmbedderPolicy: false,
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// Additional security headers
app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
});

// CORS configuration
const allowedOrigins = (IS_PRODUCTION
    ? [
        process.env.FRONTEND_URL,
        'https://chaiapp-frontend.vercel.app',
        'https://chaibook.shop',
        'https://chai.69.28.88.246.sslip.io'
    ]
    : [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3003',
        'http://localhost:3004',
        'http://localhost',
        process.env.CORS_ORIGIN,
        process.env.FRONTEND_URL
    ]).filter((origin): origin is string => !!origin);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    // allowedHeaders: Remove to allow all headers requested by client
    maxAge: 86400 // 24 hours
}));

// Body parsers with size limits
app.use(express.json({ limit: '10mb' })); // Increased for image uploads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from uploads with CORS headers
app.use('/uploads', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static(path.join(__dirname, '../public/uploads')));

// Request validation
app.use(validateRequestBody);

// Request logging (production-safe)
app.use((req, _res, next) => {
    // Skip logging for noisy polling endpoints
    if (req.path.includes('/payments/all')) {
        return next();
    }

    const ip = getClientIP(req);
    if (IS_PRODUCTION) {
        // Log only essential info in production
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - IP: ${ip}`);
    } else {
        console.log(`${req.method} ${req.path} - IP: ${ip}`);
    }
    next();
});

// =============================================================================
// ROUTES WITH RATE LIMITING
// =============================================================================

// Health check (no rate limit)
app.get('/health', async (_req, res) => {
    try {
        // Check database connection    
        await pool.query('SELECT 1');
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: 'connected',
        });
    } catch (error) {
        res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
        });
    }
});

// Admin routes - STRICT rate limiting
app.use('/api/admin', generalRateLimiter, adminRoutes);

// Auth routes - Moderate rate limiting
app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/auth', authRateLimiter, passwordResetRoutes);

// Affiliate routes - Standard rate limiting
// Affiliate routes - Standard rate limiting
app.use('/api/affiliate', generalRateLimiter, affiliateRoutes);
app.use('/api/subscription', generalRateLimiter, subscriptionRoutes);

// Webhook routes - No rate limiting (external services)
app.use('/api/webhooks', webhookRoutes);

// General API routes - Standard rate limiting
app.use('/api/customers', generalRateLimiter, customersRoutes);
app.use('/api/settings', generalRateLimiter, settingsRoutes);

// Public Ledger routes
app.use('/api/public', publicRoutes);

// History routes (SSE)
import historyRoutes from './routes/history.routes.js';
app.use('/api/history', historyRoutes);


// =============================================================================
// PRODUCTION FRONTEND SERVING (STATIC + SPA)
// =============================================================================

// 1. API 404 Handler - MUST come before the catch-all * route
// This ensures that missing API endpoints return JSON, not HTML
app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API route not found' });
});

// 2. Serve Static Files
// Serve artifacts from the frontend build directory
const frontendBuildPath = path.join(__dirname, '../../chaiapp-frontend/dist');
app.use(express.static(frontendBuildPath));

// 3. SPA Catch-All Handler
// For any other request, send back index.html so React Router can handle it
app.get('*', (_req, res) => {
    // Optional: Check if we are successfully serving the file
    res.sendFile(path.join(frontendBuildPath, 'index.html'), (err) => {
        if (err) {
            console.error('Error sending index.html:', err);
            // Fallback for development/missing build
            res.status(500).send('Frontend build not found. Please run npm run build in the frontend directory.');
        }
    });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);

    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

let server: any;

if (process.env.NODE_ENV !== 'test') {
    server = app.listen(PORT, () => {
        console.log(`✅ Backend started on port ${PORT}`);
        console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`   Frontend: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    });
}

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

process.on('SIGTERM', async () => {
    console.log('\n🛑 SIGTERM received, shutting down gracefully...');

    server.close(async () => {
        console.log('✅ HTTP server closed');
        await closePool();
        console.log('👋 Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    console.log('\n🛑 SIGINT received, shutting down gracefully...');

    server.close(async () => {
        console.log('✅ HTTP server closed');
        await closePool();
        console.log('👋 Process terminated');
        process.exit(0);
    });
});

// Unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit in production, just log
    if (process.env.NODE_ENV === 'development') {
        process.exit(1);
    }
});

export default app;
