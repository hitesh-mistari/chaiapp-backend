import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/chaiapp_db',
});

async function migrate() {
    try {
        console.log('🔄 Fetching all store settings...');
        const res = await pool.query('SELECT store_id, products FROM store_settings');

        for (const row of res.rows) {
            let products = row.products;
            if (typeof products === 'string') {
                products = JSON.parse(products);
            }

            if (Array.isArray(products)) {
                let updated = false;
                products = products.map(p => {
                    if (p.id === 'chai') {
                        p.color = '#D97706';
                        updated = true;
                    }
                    return p;
                });

                if (updated) {
                    console.log(`✅ Updating Chai color for store: ${row.store_id}`);
                    await pool.query('UPDATE store_settings SET products = $1 WHERE store_id = $2', [JSON.stringify(products), row.store_id]);
                }
            }
        }
        console.log('✨ All stores updated successfully.');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await pool.end();
    }
}

migrate();
