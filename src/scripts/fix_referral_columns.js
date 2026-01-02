import { Client } from 'pg';

const dbUrl = 'postgresql://postgres:Hassan%401216@localhost:5432/chaiapp';

async function migrate() {
    console.log('🚀 Starting Referral Column Fix...');
    const client = new Client({ connectionString: dbUrl });

    try {
        await client.connect();
        console.log('✅ Connected to DB');

        // 1. Add Columns
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS referral_code VARCHAR(10) UNIQUE,
            ADD COLUMN IF NOT EXISTS referred_by_id UUID REFERENCES users(id) ON DELETE SET NULL;
        `);
        console.log('✅ Added referral_code and referred_by_id columns');

        // 2. Backfill null referral_codes
        await client.query(`
            UPDATE users 
            SET referral_code = UPPER(SUBSTRING(email, 1, 4) || floor(random() * 9999 + 1000)::text)
            WHERE referral_code IS NULL;
        `);
        console.log('✅ Backfilled missing referral codes');

        // 3. Enforce Not Null
         await client.query(`
            ALTER TABLE users ALTER COLUMN referral_code SET NOT NULL;
        `);
        console.log('✅ Enforced NOT NULL on referral_code');

        console.log('✨ Fix Complete!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
    } finally {
        await client.end();
        process.exit(0);
    }
}

migrate();
