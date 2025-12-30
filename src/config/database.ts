import pg, { QueryResultRow } from 'pg';
import dotenv from 'dotenv';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load .env from different possible locations
const possiblePaths = [
    path.join(process.cwd(), '.env'),
    path.join(__dirname, '../../.env'),
    path.join(__dirname, '../../../.env')
];

for (const p of possiblePaths) {
    const result = dotenv.config({ path: p });
    if (!result.error) {
        console.log(`[DB CONFIG] Loaded .env from: ${p}`);
        break;
    }
}

console.log(`[DB CONFIG] NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`[DB CONFIG] DATABASE_URL: ${process.env.DATABASE_URL ? 'DEFINED' : 'UNDEFINED'}`);

const { Pool } = pg;

// Database connection pool
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/chaiapp_db',
    max: 20, // Maximum connections in pool
    idleTimeoutMillis: 30000, // Close idle connections after 30s
    connectionTimeoutMillis: 10000, // Increased to 10s for stability
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Test connection on startup
pool.on('connect', () => {
    // console.log('✅ Database connected');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
    process.exit(1);
});

// Helper function to execute queries
export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
    const start = Date.now();
    try {
        const result = await pool.query<T>(text, params);
        const duration = Date.now() - start;

        // Log slow queries (> 100ms)
        if (duration > 100) {
            console.warn(`⚠️ Slow query (${duration}ms):`, text.substring(0, 100));
        }

        return result;
    } catch (error) {
        console.error('❌ Database query error:', error);
        throw error;
    }
}

// Transaction helper
export async function transaction<T>(callback: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Graceful shutdown
export async function closePool(): Promise<void> {
    await pool.end();
    console.log('🔌 Database pool closed');
}

export default pool;
