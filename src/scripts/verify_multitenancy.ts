import { pool, query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

async function verifyMultitenancy() {
    console.log('🧪 Starting Multi-User Isolation Test...');

    try {
        // 1. Create Tenant A
        const userA_Id = uuidv4();
        const storeA_Id = uuidv4();
        await query(`INSERT INTO users (id, email, name, google_id) VALUES ($1, $2, $3, $4)`, [userA_Id, 'a@test.com', 'User A', 'google_a']);
        await query(`INSERT INTO stores (id, user_id, store_name) VALUES ($1, $2, $3)`, [storeA_Id, userA_Id, 'Store A']);
        console.log('✅ Created Tenant A');

        // 2. Create Tenant B
        const userB_Id = uuidv4();
        const storeB_Id = uuidv4();
        await query(`INSERT INTO users (id, email, name, google_id) VALUES ($1, $2, $3, $4)`, [userB_Id, 'b@test.com', 'User B', 'google_b']);
        await query(`INSERT INTO stores (id, user_id, store_name) VALUES ($1, $2, $3)`, [storeB_Id, userB_Id, 'Store B']);
        console.log('✅ Created Tenant B');

        // 3. Add Customer to Store A
        await query(
            `INSERT INTO customers (id, store_id, name, is_active) VALUES ($1, $2, $3, $4)`,
            [uuidv4(), storeA_Id, 'Customer of A', true]
        );
        console.log('✅ Added Customer to Store A');

        // 4. Verify Store B cannot see it
        console.log('🔍 Store B attempting to fetch data...');
        const result = await query(
            `SELECT * FROM customers WHERE store_id = $1`,
            [storeB_Id]
        );

        console.log(`📊 Store A Customer Count: 1 (Expected)`);
        console.log(`📊 Store B Customer Count: ${result.rows.length} (Expected: 0)`);

        if (result.rows.length === 0) {
            console.log('🏆 SUCCESS: Data is isolated!');
        } else {
            console.error('❌ FAILURE: Data leakage detected!');
            process.exit(1);
        }

        // Cleanup
        await query(`DELETE FROM users WHERE id IN ($1, $2)`, [userA_Id, userB_Id]);

    } catch (e) {
        console.error('Test Failed:', e);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

verifyMultitenancy();
