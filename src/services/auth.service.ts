import { OAuth2Client } from 'google-auth-library';
import bcrypt from 'bcryptjs';
import { query, transaction } from '../config/database.js';
import { generateToken } from '../middleware/auth.js';
import crypto from 'crypto';
import { sendVerificationEmail, sendPasswordResetEmail } from './email.service.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export interface GoogleUser {
    googleId: string;
    email: string;
    name: string;
    picture?: string;
}

export interface AuthResponse {
    token: string;
    user: {
        id: string;
        email: string;
        name: string;
        picture?: string;
    };
    store: {
        id: string;
        storeName: string;
        currencySymbol: string;
    };
    isNewUser: boolean;
}

/**
 * Verify Google OAuth token
 * Returns user information from Google
 */
export async function verifyGoogleToken(idToken: string): Promise<GoogleUser> {
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();

        if (!payload) {
            throw new Error('Invalid token payload');
        }

        return {
            googleId: payload.sub,
            email: payload.email!,
            name: payload.name || payload.email!,
            picture: payload.picture,
        };
    } catch (error: any) {
        console.error('Google token verification failed:', error.message);
        console.error('Expected Audience:', process.env.GOOGLE_CLIENT_ID);
        // Throw the original error message to help with debugging
        throw new Error(`Invalid Google token: ${error.message}`);
    }
}

/**
 * Authenticate user with Google OAuth
 * 
 * Flow:
 * 1. Verify Google token
 * 2. Check if user exists
 * 3. If new user:
 *    - Create user record
 *    - Create store record
 *    - Create default settings
 * 4. If existing user:
 *    - Update last login
 *    - Fetch store data
 * 5. Generate JWT
 * 6. Return auth response
 */

function generateReferralCode(name: string): string {
    const prefix = name.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'USER');
    const random = Math.floor(Math.random() * 9000 + 1000); // 4 digit random
    return `${prefix}${random}`;
}

export async function authenticateWithGoogle(idToken: string, referralCode?: string): Promise<AuthResponse> {
    // Step 1: Verify Google token
    const googleUser = await verifyGoogleToken(idToken);
    console.log('DEBUG: Authenticating Google User:', { googleId: googleUser.googleId, email: googleUser.email, name: googleUser.name });


    // Step 2: Check if user exists
    const existingUser = await query<{
        id: string;
        email: string;
        name: string;
        picture: string | null;
    }>(
        'SELECT id, email, name, picture FROM users WHERE google_id = $1',
        [googleUser.googleId]
    );

    let userId: string;
    let isNewUser = false;

    if (existingUser.rows.length > 0) {
        // Existing user - update last login, name and picture
        const user = existingUser.rows[0];
        userId = user.id;

        await query(
            'UPDATE users SET last_login_at = NOW(), name = $1, picture = $2 WHERE id = $3',
            [googleUser.name, googleUser.picture || null, userId]
        );
    } else {
        // New user - create user and store in a transaction
        isNewUser = true;

        const result = await transaction(async (client) => {
            // 1. Resolve Referrer
            let referrerId: string | null = null;
            if (referralCode) {
                const referrer = await client.query('SELECT id FROM users WHERE referral_code = $1', [referralCode]);
                if (referrer.rows.length > 0) referrerId = referrer.rows[0].id;
            }

            // 2. Generate Code
            const newCode = generateReferralCode(googleUser.name);

            // 3. Create user
            const userResult = await client.query<{ id: string }>(
                `INSERT INTO users (google_id, email, name, picture, email_verified, referral_code, referred_by_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id`,
                [googleUser.googleId, googleUser.email, googleUser.name, googleUser.picture || null, true, newCode, referrerId]
            );

            const newUserId = userResult.rows[0].id;

            // Create store with default name
            const defaultStoreName = `${googleUser.name}'s Shop`;
            const storeResult = await client.query<{ id: string }>(
                `INSERT INTO stores (user_id, store_name, currency_symbol)
         VALUES ($1, $2, $3)
         RETURNING id`,
                [newUserId, defaultStoreName, '₹']
            );

            const storeId = storeResult.rows[0].id;

            // Create default settings
            await client.query(
                `INSERT INTO store_settings (
          store_id, 
          price_per_chai, 
          price_per_coffee, 
          shop_name,
          enable_notifications,
          show_walk_in,
          products
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [storeId, 10.00, 15.00, defaultStoreName, true, true, JSON.stringify([
                    { id: 'chai', name: 'Chai', price: 10, color: '#D97706', icon: '☕' },
                    { id: 'coffee', name: 'Coffee', price: 15, color: '#6b3308', icon: '☕' }
                ])]
            );

            // 4. Create Commission (Pending) if referred
            if (referrerId) {
                await client.query(
                    `INSERT INTO commissions (referrer_id, referred_user_id, amount, status)
                     VALUES ($1, $2, 200, 'PENDING')`,
                    [referrerId, newUserId]
                );
            }

            return { userId: newUserId };
        });

        userId = result.userId;
    }

    // Fetch complete user and store data
    const userData = await query<{
        user_id: string;
        email: string;
        name: string;
        picture: string | null;
        store_id: string;
        store_name: string;
        currency_symbol: string;
    }>(
        `SELECT 
      u.id as user_id,
      u.email,
      u.name,
      u.picture,
      s.id as store_id,
      s.store_name,
      s.currency_symbol
    FROM users u
    INNER JOIN stores s ON s.user_id = u.id
    WHERE u.id = $1`,
        [userId]
    );

    if (userData.rows.length === 0) {
        throw new Error('User or store not found after creation');
    }

    const data = userData.rows[0];

    // Generate JWT
    const token = generateToken(data.user_id, data.email);

    // Return auth response
    return {
        token,
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
        },
        isNewUser,
    };
}

/**
 * Get user and store data by user ID
 */
export async function getUserAndStore(userId: string) {
    const result = await query<{
        user_id: string;
        email: string;
        name: string;
        picture: string | null;
        store_id: string;
        store_name: string;
        currency_symbol: string;
    }>(
        `SELECT 
      u.id as user_id,
      u.email,
      u.name,
      u.picture,
      s.id as store_id,
      s.store_name,
      s.currency_symbol
    FROM users u
    INNER JOIN stores s ON s.user_id = u.id
    WHERE u.id = $1`,
        [userId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}

/**
 * Register a new user with Email/Password
 */
export async function registerWithPassword(email: string, password: string, name: string, referralCode?: string): Promise<AuthResponse> {
    // Check if user exists
    const existingUser = await query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
        throw new Error('User already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const result = await transaction(async (client) => {
        // 1. Resolve Referrer
        let referrerId: string | null = null;
        if (referralCode) {
            const referrer = await client.query('SELECT id FROM users WHERE referral_code = $1', [referralCode]);
            if (referrer.rows.length > 0) referrerId = referrer.rows[0].id;
        }

        // 2. Generate Code
        const newCode = generateReferralCode(name);

        // 3. Create user
        const userResult = await client.query<{ id: string }>(
            `INSERT INTO users (email, name, password_hash, verification_token, email_verified, referral_code, referred_by_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id`,
            [email, name, passwordHash, verificationToken, false, newCode, referrerId]
        );

        const newUserId = userResult.rows[0].id;

        // Create store
        const defaultStoreName = `${name}'s Shop`;
        const storeResult = await client.query<{ id: string }>(
            `INSERT INTO stores (user_id, store_name, currency_symbol)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [newUserId, defaultStoreName, '₹']
        );

        const storeId = storeResult.rows[0].id;

        // Create settings
        await client.query(
            `INSERT INTO store_settings (store_id, price_per_chai, price_per_coffee, shop_name, enable_notifications, show_walk_in, products)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [storeId, 10.00, 15.00, defaultStoreName, true, true, JSON.stringify([
                { id: 'chai', name: 'Chai', price: 10, color: '#D97706', icon: '☕' },
                { id: 'coffee', name: 'Coffee', price: 15, color: '#6b3308', icon: '☕' }
            ])]
        );

        // 4. Create Commission (Pending) if referred
        if (referrerId) {
            await client.query(
                `INSERT INTO commissions (referrer_id, referred_user_id, amount, status)
                 VALUES ($1, $2, 200, 'PENDING')`,
                [referrerId, newUserId]
            );
        }

        return { userId: newUserId };
    });

    // Send verification email (async)
    sendVerificationEmail(email, verificationToken).catch(err => {
        console.error('Failed to send verification email:', err);
    });

    return fetchFullAuthData(result.userId, true);
}

/**
 * Verify secondary verification token
 */
export async function verifyEmail(token: string): Promise<void> {
    const result = await query<{ id: string }>(
        'SELECT id FROM users WHERE verification_token = $1',
        [token]
    );

    if (result.rows.length === 0) {
        throw new Error('Invalid or expired verification token');
    }

    await query(
        'UPDATE users SET email_verified = TRUE, verification_token = NULL WHERE verification_token = $1',
        [token]
    );
}

/**
 * Login with Email/Password
 */
export async function loginWithPassword(email: string, password: string): Promise<AuthResponse> {
    const userResult = await query<{
        id: string;
        password_hash: string | null;
        email_verified: boolean;
    }>('SELECT id, password_hash, email_verified FROM users WHERE email = $1', [email]);

    if (userResult.rows.length === 0) {
        throw new Error('Invalid credentials');
    }

    const user = userResult.rows[0];

    // If no password hash, they might have signed up with Google only.
    // We strictly enforced Google-only before. Now we allow both if we want, 
    // but for now, if no hash -> "Use Google Login".
    if (!user.password_hash) {
        throw new Error('Use Google Login');
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
        throw new Error('Invalid credentials');
    }

    if (!user.email_verified) {
        throw new Error('Please verify your email address before logging in.');
    }

    return fetchFullAuthData(user.id, false);
}

// Helper to fetch full data and generate token
async function fetchFullAuthData(userId: string, isNewUser: boolean): Promise<AuthResponse> {
    const userData = await query<{
        user_id: string;
        email: string;
        name: string;
        picture: string | null;
        store_id: string;
        store_name: string;
        currency_symbol: string;
    }>(
        `SELECT 
      u.id as user_id,
      u.email,
      u.name,
      u.picture,
      s.id as store_id,
      s.store_name,
      s.currency_symbol
    FROM users u
    INNER JOIN stores s ON s.user_id = u.id
    WHERE u.id = $1`,
        [userId]
    );

    if (userData.rows.length === 0) throw new Error('User unavailable');

    const data = userData.rows[0];
    const token = generateToken(data.user_id, data.email);

    return {
        token,
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
        },
        isNewUser,
    };
}

/**
 * Create a Guest User
 */
export async function createGuestUser(): Promise<AuthResponse> {
    const { v4: uuidv4 } = await import('uuid');
    const guestId = uuidv4();
    const guestEmail = `guest_${guestId}@temp.local`;
    const guestName = 'Guest User';

    // No password for guest, and no google_id

    const result = await transaction(async (client) => {
        // Create user
        const userResult = await client.query<{ id: string }>(
            `INSERT INTO users (email, name)
             VALUES ($1, $2)
             RETURNING id`,
            [guestEmail, guestName]
        );

        const newUserId = userResult.rows[0].id;

        // Create store
        const defaultStoreName = `Guest Chai Shop`;
        const storeResult = await client.query<{ id: string }>(
            `INSERT INTO stores (user_id, store_name, currency_symbol)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [newUserId, defaultStoreName, '₹']
        );

        const storeId = storeResult.rows[0].id;

        // Create settings
        await client.query(
            `INSERT INTO store_settings (store_id, price_per_chai, price_per_coffee, shop_name, enable_notifications, show_walk_in, products)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [storeId, 10.00, 15.00, defaultStoreName, true, true, JSON.stringify([
                { id: 'chai', name: 'Chai', price: 10, color: '#D97706', icon: '☕' },
                { id: 'coffee', name: 'Coffee', price: 15, color: '#6b3308', icon: '☕' }
            ])]
        );

        return { userId: newUserId };
    });

    return fetchFullAuthData(result.userId, true);
}

/**
 * Request password reset - generates token and sends email
 */
export async function requestPasswordReset(email: string): Promise<void> {
    // Check if user exists
    const userResult = await query<{ id: string; name: string }>(
        'SELECT id, name FROM users WHERE email = $1',
        [email]
    );

    // Per user request: Show message if user not exist
    if (userResult.rows.length === 0) {
        throw new Error('User with this email not found');
    }

    const userId = userResult.rows[0].id;

    // Generate secure random token
    const crypto = await import('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Token expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Store token in database
    await query(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, resetToken, expiresAt]
    );

    // Send email
    await sendPasswordResetEmail(email, resetToken);
}

/**
 * Reset password using token
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
    // Find valid token
    const tokenResult = await query<{
        user_id: string;
        expires_at: Date;
        used: boolean;
    }>(
        `SELECT user_id, expires_at, used
         FROM password_reset_tokens
         WHERE token = $1`,
        [token]
    );

    if (tokenResult.rows.length === 0) {
        throw new Error('Invalid or expired reset token');
    }

    const tokenData = tokenResult.rows[0];

    // Check if token is already used
    if (tokenData.used) {
        throw new Error('Reset token has already been used');
    }

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
        throw new Error('Reset token has expired');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password and mark token as used in a transaction
    await transaction(async (client) => {
        // Update password
        await client.query(
            'UPDATE users SET password_hash = $1 WHERE id = $2',
            [passwordHash, tokenData.user_id]
        );

        // Mark token as used
        await client.query(
            'UPDATE password_reset_tokens SET used = true WHERE token = $1',
            [token]
        );
    });
}
