import { query, transaction } from '../config/database.js';
import { generateToken } from '../middleware/auth.js';
import { AuthResponse } from './auth.service.js';

interface FacebookUser {
    id: string;
    email?: string;
    name: string;
    picture?: {
        data: {
            url: string;
        }
    };
}

/**
 * Verify Facebook Access Token and get user profile
 */
export async function verifyFacebookToken(accessToken: string): Promise<FacebookUser> {
    try {
        const fields = 'id,name,email,picture.type(large)';
        const response = await fetch(`https://graph.facebook.com/me?fields=${fields}&access_token=${accessToken}`);

        if (!response.ok) {
            const error = (await response.json()) as any;
            throw new Error(error.error?.message || 'Failed to verify Facebook token');
        }

        return (await response.json()) as FacebookUser;
    } catch (error: any) {
        console.error('Facebook token verification failed:', error);
        throw new Error(`Invalid Facebook token: ${error.message}`);
    }
}

/**
 * Authenticate user with Facebook
 */
export async function authenticateWithFacebook(accessToken: string): Promise<AuthResponse> {
    // 1. Verify Token
    const fbUser = await verifyFacebookToken(accessToken);

    // 2. Check if user exists by facebook_id OR email
    // Note: We need to handle cases where email might be missing from FB (phone signup)
    let userQuery = 'SELECT id, email, name, picture FROM users WHERE facebook_id = $1';
    let queryParams: any[] = [fbUser.id];

    if (fbUser.email) {
        userQuery += ' OR email = $2';
        queryParams.push(fbUser.email);
    }

    const existingUser = await query<{
        id: string;
        email: string;
        name: string;
        picture: string | null;
        facebook_id: string | null;
    }>(userQuery, queryParams);

    let userId: string;
    let isNewUser = false;

    if (existingUser.rows.length > 0) {
        // Existing User
        const user = existingUser.rows[0];
        userId = user.id;

        // Update facebook_id if not set (e.g. found by email)
        if (!user.facebook_id) {
            await query('UPDATE users SET facebook_id = $1 WHERE id = $2', [fbUser.id, userId]);
        }

        // Update last login
        await query(
            'UPDATE users SET last_login_at = NOW(), picture = COALESCE(picture, $1) WHERE id = $2',
            [fbUser.picture?.data.url || null, userId]
        );
    } else {
        // New User
        isNewUser = true;

        const result = await transaction(async (client) => {
            // Create user
            // If email is missing, we might generate a placeholder or require it. 
            // For now, we'll try to use the email if present, or a dummy one if allowed by schema (or require email)
            // Ideally we fallback to facebook_id@facebook.placeholder if email is missing, but let's assume email is preferred.

            const email = fbUser.email || `${fbUser.id}@facebook.com`;

            const userResult = await client.query<{ id: string }>(
                `INSERT INTO users (facebook_id, email, name, picture, email_verified)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id`,
                [fbUser.id, email, fbUser.name, fbUser.picture?.data.url || null, true]
            );

            const newUserId = userResult.rows[0].id;

            // Create store
            const defaultStoreName = `${fbUser.name}'s Shop`;
            const storeResult = await client.query<{ id: string }>(
                `INSERT INTO stores (user_id, store_name, currency_symbol)
                 VALUES ($1, $2, $3)
                 RETURNING id`,
                [newUserId, defaultStoreName, '₹']
            );

            const storeId = storeResult.rows[0].id;

            // Create settings
            await client.query(
                `INSERT INTO store_settings (
                    store_id, price_per_chai, price_per_coffee, shop_name, 
                    enable_notifications, show_walk_in, products
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [storeId, 10.00, 15.00, defaultStoreName, true, true, JSON.stringify([
                    { id: 'chai', name: 'Chai', price: 10, color: '#D97706', icon: '☕' },
                    { id: 'coffee', name: 'Coffee', price: 15, color: '#6b3308', icon: '☕' }
                ])]
            );

            return { userId: newUserId };
        });

        userId = result.userId;
    }

    // Fetch final data
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
            u.id as user_id, u.email, u.name, u.picture,
            s.id as store_id, s.store_name, s.currency_symbol
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
        isNewUser
    };
}
