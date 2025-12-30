import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

// =============================================================================
// ADMIN EMAIL WHITELIST (FOUNDER-ONLY ACCESS)
// =============================================================================
const ADMIN_WHITELIST = [
    'admin@chaiapp.com',
    // Add your founder email here
    // 'founder@yourdomain.com',
];

// Optional: IP Allowlist for admin access (leave empty to disable)
const ADMIN_IP_ALLOWLIST: string[] = [
    // '203.0.113.1', // Example: Your office IP
    // '198.51.100.0/24', // Example: Your VPN range
];

// =============================================================================
// ADMIN ACCESS CONTROL
// =============================================================================

/**
 * Verify that the email is in the admin whitelist
 */
export const verifyAdminEmail = (email: string): boolean => {
    return ADMIN_WHITELIST.includes(email.toLowerCase());
};

/**
 * Check if IP is in the allowlist (if allowlist is configured)
 */
export const verifyAdminIP = (req: Request): boolean => {
    // If no IP allowlist configured, skip IP check
    if (ADMIN_IP_ALLOWLIST.length === 0) {
        return true;
    }

    const clientIP = getClientIP(req);

    // Simple IP matching (for production, use a proper IP matching library)
    return ADMIN_IP_ALLOWLIST.some(allowedIP => {
        if (allowedIP.includes('/')) {
            // CIDR range - simplified check (use 'ip-range-check' package in production)
            const [network] = allowedIP.split('/');
            return clientIP.startsWith(network.split('.').slice(0, 3).join('.'));
        }
        return clientIP === allowedIP;
    });
};

/**
 * Get client IP from request (handles proxies)
 */
export const getClientIP = (req: Request): string => {
    return (
        (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
        (req.headers['x-real-ip'] as string) ||
        req.socket.remoteAddress ||
        'unknown'
    );
};

// =============================================================================
// RATE LIMITERS
// =============================================================================

/**
 * Strict rate limiter for admin routes
 * 20 requests per 15 minutes per IP
 */
export const adminRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: 'Too many admin requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    handler: (req, res) => {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
            ip: getClientIP(req),
            path: req.path,
            type: 'admin'
        });
        res.status(429).json({ error: 'Too many requests, please try again later' });
    }
});

/**
 * Very strict rate limiter for admin login
 * 5 attempts per 15 minutes per IP
 */
export const adminLoginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many login attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful logins
    handler: (req, res) => {
        logSecurityEvent('LOGIN_RATE_LIMIT_EXCEEDED', {
            ip: getClientIP(req),
            email: req.body.email
        });
        res.status(429).json({ error: 'Too many login attempts, please try again in 15 minutes' });
    }
});

/**
 * Rate limiter for auth endpoints
 * 100 requests per 15 minutes per IP (Increased for development/active usage)
 */
export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logSecurityEvent('AUTH_RATE_LIMIT_EXCEEDED', {
            ip: getClientIP(req),
            path: req.path
        });
        res.status(429).json({ error: 'Too many authentication attempts, please try again in 15 minutes' });
    }
});

/**
 * Rate limiter for affiliate endpoints
 * 100 requests per hour per IP
 */
export const affiliateRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
        res.status(429).json({ error: 'Too many affiliate requests, please try again later' });
    }
});

/**
 * General API rate limiter
 * 300 requests per 15 minutes per IP
 */
export const generalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
        res.status(429).json({ error: 'Too many requests, please try again later' });
    }
});

// =============================================================================
// REQUEST VALIDATION
// =============================================================================

/**
 * Validate request body size and structure
 */
export const validateRequestBody = (req: Request, res: Response, next: NextFunction): any => {
    if (req.body && typeof req.body === 'object') {
        const bodyStr = JSON.stringify(req.body);

        // Skip check for very large payloads (likely base64) to avoid false positives
        if (bodyStr.length < 50000) {
            const suspiciousPatterns = [
                /<script/i,
                /javascript:/i,
                /on\w+\s*=/i,
                /\$\{.*\}/,
                /__proto__/,
                /constructor/i,
            ];

            if (suspiciousPatterns.some(pattern => pattern.test(bodyStr))) {
                logSecurityEvent('SUSPICIOUS_PAYLOAD', {
                    ip: getClientIP(req),
                    path: req.path,
                    body: bodyStr.substring(0, 200)
                });
                return res.status(400).json({ error: 'Invalid request payload' });
            }
        }
    }

    next();
};

// =============================================================================
// SECURITY LOGGING
// =============================================================================

interface SecurityEvent {
    timestamp: Date;
    event: string;
    details: any;
}

const securityLogs: SecurityEvent[] = [];
const MAX_LOGS = 10000; // Keep last 10k events in memory

/**
 * Log security events
 */
export const logSecurityEvent = (event: string, details: any) => {
    const logEntry: SecurityEvent = {
        timestamp: new Date(),
        event,
        details: maskSensitiveData(details)
    };

    // Add to in-memory log
    securityLogs.push(logEntry);

    // Trim old logs
    if (securityLogs.length > MAX_LOGS) {
        securityLogs.shift();
    }

    // In production, send to external logging service
    if (process.env.NODE_ENV === 'production') {
        console.log(`[SECURITY] ${event}:`, JSON.stringify(logEntry));
        // TODO: Send to logging service (e.g., Datadog, Sentry, CloudWatch)
    } else {
        console.log(`[SECURITY] ${event}:`, logEntry);
    }
};

/**
 * Get recent security logs (admin only)
 */
export const getSecurityLogs = (limit: number = 100): SecurityEvent[] => {
    return securityLogs.slice(-limit).reverse();
};

/**
 * Mask sensitive data in logs
 */
const maskSensitiveData = (data: any): any => {
    if (!data || typeof data !== 'object') return data;

    const masked = { ...data };
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard'];

    for (const key in masked) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
            masked[key] = '***REDACTED***';
        } else if (key === 'email' && masked[key]) {
            // Partially mask email
            const email = masked[key];
            const [user, domain] = email.split('@');
            masked[key] = `${user.substring(0, 2)}***@${domain}`;
        }
    }

    return masked;
};

// =============================================================================
// ABUSE DETECTION
// =============================================================================

interface AbuseTracker {
    [key: string]: {
        count: number;
        firstSeen: Date;
        lastSeen: Date;
    };
}

const signupTracker: AbuseTracker = {};
const SIGNUP_THRESHOLD = 3; // Max signups per IP per hour
const SIGNUP_WINDOW = 60 * 60 * 1000; // 1 hour

/**
 * Track and detect suspicious signup patterns
 */
export const detectSignupAbuse = (req: Request): boolean => {
    const ip = getClientIP(req);
    const now = new Date();

    if (!signupTracker[ip]) {
        signupTracker[ip] = {
            count: 1,
            firstSeen: now,
            lastSeen: now
        };
        return false;
    }

    const tracker = signupTracker[ip];
    const timeSinceFirst = now.getTime() - tracker.firstSeen.getTime();

    // Reset if window expired
    if (timeSinceFirst > SIGNUP_WINDOW) {
        signupTracker[ip] = {
            count: 1,
            firstSeen: now,
            lastSeen: now
        };
        return false;
    }

    // Increment count
    tracker.count++;
    tracker.lastSeen = now;

    // Check if threshold exceeded
    if (tracker.count > SIGNUP_THRESHOLD) {
        logSecurityEvent('SIGNUP_ABUSE_DETECTED', {
            ip,
            count: tracker.count,
            timeWindow: timeSinceFirst
        });
        return true;
    }

    return false;
};

/**
 * Detect affiliate self-referral attempts
 */
export const detectAffiliateSelfReferral = async (
    affiliateId: string,
    _userId: string,
    userEmail: string,
    pool: any
): Promise<boolean> => {
    try {
        // Check if affiliate email matches user email
        const result = await pool.query(
            'SELECT email FROM affiliates WHERE id = $1',
            [affiliateId]
        );

        if (result.rows.length > 0) {
            const affiliateEmail = result.rows[0].email.toLowerCase();
            if (affiliateEmail === userEmail.toLowerCase()) {
                logSecurityEvent('AFFILIATE_SELF_REFERRAL', {
                    affiliateId,
                    email: userEmail
                });
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error('Error detecting self-referral:', error);
        return false;
    }
};

// =============================================================================
// CSRF PROTECTION
// =============================================================================

/**
 * Generate CSRF token
 */
export const generateCSRFToken = (): string => {
    return require('crypto').randomBytes(32).toString('hex');
};

/**
 * Verify CSRF token for state-changing requests
 */
export const verifyCSRFToken = (req: Request, res: Response, next: NextFunction) => {
    // Skip for GET, HEAD, OPTIONS
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }

    const tokenFromHeader = req.headers['x-csrf-token'] as string;
    const tokenFromBody = req.body?._csrf;

    // In production, verify against session token
    // For now, just check if token exists
    if (!tokenFromHeader && !tokenFromBody) {
        logSecurityEvent('CSRF_TOKEN_MISSING', {
            ip: getClientIP(req),
            path: req.path,
            method: req.method
        });
        return res.status(403).json({ error: 'CSRF token missing' });
    }

    next();
};

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    verifyAdminEmail,
    verifyAdminIP,
    getClientIP,
    adminRateLimiter,
    adminLoginRateLimiter,
    authRateLimiter,
    affiliateRateLimiter,
    generalRateLimiter,
    validateRequestBody,
    logSecurityEvent,
    getSecurityLogs,
    detectSignupAbuse,
    detectAffiliateSelfReferral,
    generateCSRFToken,
    verifyCSRFToken
};
