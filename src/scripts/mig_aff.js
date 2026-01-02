
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SQL_PATH = path.join(__dirname, 'migrate_affiliate.sql');

const dbUrl = 'postgresql://postgres:Hassan%401216@localhost:5432/chaiapp_db';
const client = new Client(dbUrl);

console.log('Connecting to chaiapp_db...');
client.connect()
    .then(async () => {
        console.log('✅ Connected!');
        const sql = fs.readFileSync(SQL_PATH, 'utf8');
        try {
            await client.query(sql);
            console.log('✅ Affiliate Tables Created!');
        } catch(e) {
            console.error('SQL Error:', e);
        }
        client.end();
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Connection error to chaiapp_db. Attempting chaiapp_production...', err.code);
        // Fallback
        const dbUrl2 = 'postgresql://postgres:Hassan%401216@localhost:5432/chaiapp_production';
        const client2 = new Client(dbUrl2);
        client2.connect().then(async () => {
             console.log('✅ Connected to chaiapp_production!');
             const sql = fs.readFileSync(SQL_PATH, 'utf8');
             await client2.query(sql);
             console.log('✅ Affiliate Tables Created!');
             client2.end();
             process.exit(0);
        }).catch(e2 => {
             console.error('❌ Failed both DBs.', e2);
             process.exit(1);
        });
    });

