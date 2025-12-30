
import { query, pool } from '../config/database.js';

async function fixPankajLogs() {
    try {
        console.log('Searching for Pankaj Deore...');
        const res = await query("SELECT * FROM customers WHERE name ILIKE '%Pankaj Deore%'");

        if (res.rows.length === 0) {
            console.log('Customer not found');
            return;
        }

        const customer = res.rows[0];
        console.log('Found Customer:', customer.id, customer.name);

        console.log('Fetching payments...');
        const payments = await query("SELECT * FROM payments WHERE customer_id = $1 ORDER BY paid_at DESC", [customer.id]);

        console.log(`Found ${payments.rows.length} payments.`);

        payments.rows.forEach(p => {
            let dateStr = 'Invalid';
            try {
                const d = new Date(parseInt(p.paid_at));
                dateStr = !isNaN(d.getTime()) ? d.toISOString() : `Invalid (${p.paid_at})`;
            } catch (e) { dateStr = `Error (${p.paid_at})`; }

            console.log(`Payment ID: ${p.id}, Amount: ${p.amount}, Status: ${p.status}, Date: ${dateStr}, Month: ${p.month_str}`);
        });

        // Also fetch logs for total bill context
        const logs = await query("SELECT * FROM logs WHERE customer_id = $1", [customer.id]);
        let totalBill = 0;
        logs.rows.forEach(l => {
            // quick calc assuming price 10
            totalBill += (l.count * 10);
        });
        console.log('Approx Total Bill (assuming 10/cup):', totalBill);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

fixPankajLogs();
