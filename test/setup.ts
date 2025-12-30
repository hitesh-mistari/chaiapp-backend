
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve(process.cwd(), '.env');
console.log(`[TEST SETUP] CWD: ${process.cwd()}`);
console.log(`[TEST SETUP] Loading .env from: ${envPath}`);

if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (result.error) {
        console.error('[TEST SETUP] Error parsing .env:', result.error);
    } else {
        console.log('[TEST SETUP] .env loaded successfully.');
    }
} else {
    console.error('[TEST SETUP] .env file NOT FOUND at expected path!');
}

if (!process.env.DATABASE_URL) {
    console.error('[TEST SETUP] ❌ DATABASE_URL is missing in test environment!');
} else {
    console.log(`[TEST SETUP] ✅ DATABASE_URL is set (starts with): ${process.env.DATABASE_URL.substring(0, 15)}...`);
}
