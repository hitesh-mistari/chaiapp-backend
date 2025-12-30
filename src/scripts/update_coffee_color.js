import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    try {
        console.log('🔄 Updating coffee color in all store settings...');

        const result = await pool.query('SELECT store_id, products FROM store_settings');

        for (const row of result.rows) {
            let products = row.products;
            if (Array.isArray(products)) {
                let changed = false;
                products = products.map(p => {
                    if (p.id === 'coffee' || p.name.toLowerCase() === 'coffee') {
                        changed = true;
                        return { ...p, color: '#6b3308' };
                    }
                    return p;
                });

                if (changed) {
                    await pool.query('UPDATE store_settings SET products = $1 WHERE store_id = $2', [JSON.stringify(products), row.store_id]);
                    console.log(`✅ Updated store ${row.store_id}`);
                }
            }
        }

        console.log('✅ Color update complete');
        await pool.end();
    } catch (error) {
        console.error('❌ Update failed:', error);
        await pool.end();
        process.exit(1);
    }
}

run();
