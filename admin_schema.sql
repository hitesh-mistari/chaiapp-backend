-- Add is_blocked to stores if not exists (Must be before View creation)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;

-- Admin Users Table
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin', -- 'super_admin', 'admin', 'support'
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin Activity Logs
CREATE TABLE IF NOT EXISTS admin_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES admin_users(id),
    action VARCHAR(50) NOT NULL, -- 'login', 'block_shop', etc.
    target_type VARCHAR(50), -- 'shop', 'user', 'system'
    target_id UUID, -- ID of the target entity
    details JSONB, -- JSON details of the action
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Store Blocks History
CREATE TABLE IF NOT EXISTS store_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id),
    blocked_by UUID REFERENCES admin_users(id),
    reason TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unblocked_at TIMESTAMP WITH TIME ZONE
);

-- Subscriptions Table (if not exists)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id),
    plan_type VARCHAR(50) DEFAULT 'free', -- 'free', 'paid'
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'expired', 'cancelled'
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    payment_gateway VARCHAR(50),
    payment_id VARCHAR(255),
    amount DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Affiliates Table (if not exists)
CREATE TABLE IF NOT EXISTS affiliates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'suspended'
    total_earnings DECIMAL(10, 2) DEFAULT 0,
    total_withdrawn DECIMAL(10, 2) DEFAULT 0,
    available_balance DECIMAL(10, 2) DEFAULT 0,
    joined_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Affiliate Referrals (Stores referred by affiliates)
CREATE TABLE IF NOT EXISTS affiliate_referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    affiliate_id UUID REFERENCES affiliates(id),
    store_id UUID REFERENCES stores(id),
    commission_amount DECIMAL(10, 2) DEFAULT 0,
    commission_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'paid', 'cancelled'
    payment_status VARCHAR(50) DEFAULT 'unpaid', -- Status of the shop's subscription payment
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Affiliate Payouts
CREATE TABLE IF NOT EXISTS affiliate_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    affiliate_id UUID REFERENCES affiliates(id),
    user_id UUID, -- Admin user who processed it? Or maybe the affiliate user if they have a login
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processed', 'rejected'
    payout_method VARCHAR(50), -- 'upi', 'bank_transfer'
    payout_details JSONB,
    payout_reference VARCHAR(255), -- Transaction ID
    payout_note TEXT,
    rejected_reason TEXT,
    processed_by UUID REFERENCES admin_users(id),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- VIEW: Admin Shop Overview
-- Joins stores, users, subscriptions, and aggregates stats
CREATE OR REPLACE VIEW admin_shop_overview AS
SELECT 
    s.id AS store_id,
    s.store_name,
    u.name AS owner_name,
    u.email,
    s.created_at AS signup_date,
    COALESCE(sub.plan_type, 'free') AS plan,
    COALESCE(sub.status, 'none') AS subscription_status,
    s.is_blocked,
    a.name AS affiliate_name,
    a.referral_code AS affiliate_code,
    (SELECT COUNT(*) FROM customers c WHERE c.store_id = s.id) AS total_customers,
    (SELECT COUNT(*) FROM logs l WHERE l.store_id = s.id) AS total_cups, -- Use 'logs' table for cups/transactions if it exists. Reverting from previous assumption of 'transactions'.
    (SELECT COALESCE(SUM(amount), 0) FROM payments p WHERE p.store_id = s.id) AS total_revenue -- Use 'payments' table which exists
FROM stores s
JOIN users u ON s.user_id = u.id
LEFT JOIN subscriptions sub ON sub.store_id = s.id AND sub.status = 'active'
LEFT JOIN affiliate_referrals ar ON ar.store_id = s.id
LEFT JOIN affiliates a ON ar.affiliate_id = a.id;

-- VIEW: Admin Affiliate Overview
CREATE OR REPLACE VIEW admin_affiliate_overview AS
SELECT 
    a.id AS affiliate_id,
    a.name AS affiliate_name,
    a.email,
    a.referral_code,
    a.status,
    a.joined_date,
    (SELECT COUNT(*) FROM affiliate_referrals ar WHERE ar.affiliate_id = a.id) AS total_referrals,
    a.total_earnings,
    a.total_withdrawn,
    a.available_balance
FROM affiliates a;

-- Initial Super Admin (Password: admin123)
INSERT INTO admin_users (email, password_hash, name, role)
VALUES ('admin@chaiapp.com', '$2a$10$X7.123...PLACEHOLDER', 'Super Admin', 'super_admin')
ON CONFLICT (email) DO NOTHING;
