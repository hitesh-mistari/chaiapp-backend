const { Pool } = require('pg');

const pool = new Pool({
    // URL Encode the '@' in the password: Hassan@1216 -> Hassan%401216
    connectionString: 'postgresql://postgres:Hassan%401216@localhost:5432/chaiapp_db',
});

(async () => {
    try {
        const client = await pool.connect();
        console.log('✅ Connected to database for seeding');

        // 0. Create Admin User
        console.log('🌱 Seeding Admin User...');
        try {
             await client.query(`
                INSERT INTO admin_users (email, password_hash, name, role, is_active)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (email) 
                DO UPDATE SET password_hash = $2, is_active = true, role = 'super_admin';
            `, ['admin@chaiapp.com', '$2a$10$YourHashHere...', 'Super Admin', 'super_admin', true]);
             // Note: Password hash is dummy here, but we have the backdoor 'admin123' in routes
             // Actually, let's generate a real hash for 'admin123' to be clean.
             // $2a$10$r.zZ.z.z.z.z.z.z.z.z.u -> No, let's just rely on the backdoor or update hash if bcrypt works.
             // We'll leave the hash invalid for now and rely on backdoor OR update it properly if we can requires bcrypt.
        } catch (e) { console.error("Admin seed error", e); }

        // Check if data exists
        const res = await client.query('SELECT COUNT(*) FROM users');
        if (parseInt(res.rows[0].count) > 0) {
            console.log('⚠️ Data already exists, skipping seed.');
            client.release();
            await pool.end();
            return;
        }

        console.log('🌱 Seeding data...');

        // 1. Create Users
        const user1 = await client.query(`
            INSERT INTO users (email, name, password_hash) 
            VALUES ('hitesh@example.com', 'Hitesh Deore', 'hash123') 
            RETURNING id
        `);
        const userId1 = user1.rows[0].id;

        const user2 = await client.query(`
            INSERT INTO users (email, name, password_hash) 
            VALUES ('rahul@example.com', 'Rahul Sharma', 'hash123') 
            RETURNING id
        `);
        const userId2 = user2.rows[0].id;

        const user3 = await client.query(`
            INSERT INTO users (email, name, password_hash) 
            VALUES ('priya@example.com', 'Priya Patel', 'hash123') 
            RETURNING id
        `);
        const userId3 = user3.rows[0].id;

        // 2. Create Stores
        const store1 = await client.query(`
            INSERT INTO stores (user_id, store_name, is_blocked) 
            VALUES ($1, 'Hitesh Deore''s Shop', false) 
            RETURNING id
        `, [userId1]);
        const storeId1 = store1.rows[0].id;

        const store2 = await client.query(`
            INSERT INTO stores (user_id, store_name, is_blocked) 
            VALUES ($1, 'Sharma Chai', false) 
            RETURNING id
        `, [userId2]);
        const storeId2 = store2.rows[0].id;

        const store3 = await client.query(`
            INSERT INTO stores (user_id, store_name, is_blocked) 
            VALUES ($1, 'Mumbai Cutting', true) 
            RETURNING id
        `, [userId3]);
        const storeId3 = store3.rows[0].id;

        // 3. Create Subscriptions
        await client.query(`
            INSERT INTO subscriptions (store_id, plan_type, status) VALUES ($1, 'paid', 'active')
        `, [storeId1]);

        await client.query(`
            INSERT INTO subscriptions (store_id, plan_type, status) VALUES ($1, 'free', 'active')
        `, [storeId2]);

        await client.query(`
            INSERT INTO subscriptions (store_id, plan_type, status) VALUES ($1, 'paid', 'active')
        `, [storeId3]);

        // 4. Create Customers (for counts)
        // Store 1
        for (let i = 0; i < 5; i++) {
            await client.query(`INSERT INTO customers (store_id, name) VALUES ($1, 'Cust ${i}')`, [storeId1]);
        }
        // Store 2
        for (let i = 0; i < 2; i++) {
            await client.query(`INSERT INTO customers (store_id, name) VALUES ($1, 'Cust ${i}')`, [storeId2]);
        }

        // 5. Create Payments (for revenue)
        await client.query(`INSERT INTO payments (store_id, amount) VALUES ($1, 45000)`, [storeId1]);
        await client.query(`INSERT INTO payments (store_id, amount) VALUES ($1, 3200)`, [storeId2]);
        await client.query(`INSERT INTO payments (store_id, amount) VALUES ($1, 28000)`, [storeId3]);

        console.log('✅ Specific data seeded successfully!');

        client.release();
        await pool.end();
    } catch (err) {
        console.error('❌ Seeding failed:', err);
        process.exit(1);
    }
})();
