import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const API_URL = 'http://localhost:4000/api';

async function testSettings() {
    try {
        console.log('🔄 Logging in as guest...');
        const loginRes = await fetch(`${API_URL}/auth/guest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test User' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;
        console.log('✅ Logged in.');

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        console.log('🔄 Saving settings with UPI ID...');
        const upiId = 'test@upi';
        const saveRes = await fetch(`${API_URL}/settings`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                pricePerChai: 12,
                pricePerCoffee: 18,
                shopName: 'Test Shop',
                enableNotifications: true,
                soundEnabled: false,
                showWalkIn: true,
                products: [],
                upiId: upiId
            })
        });
        const saveData = await saveRes.json();
        console.log('✅ Settings saved response:', saveData);

        console.log('🔄 Fetching settings back...');
        const fetchRes = await fetch(`${API_URL}/settings`, { headers });
        const fetchData = await fetchRes.json();
        console.log('Fetched Settings:', JSON.stringify(fetchData, null, 2));

        if (fetchData.upiId === upiId) {
            console.log('🎉 SUCCESS: UPI ID persistency confirmed!');
        } else {
            console.error('❌ FAILURE: UPI ID was not returned correctly.');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testSettings();
