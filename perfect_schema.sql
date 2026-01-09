-- ============================================================================
-- PERFECT SCHEMA - RESET & REBUILD
-- ============================================================================

-- DANGER: Drop everything to ensure a clean slate
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. USERS & AUTH
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    google_id VARCHAR(255) UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    picture TEXT,
    password_hash VARCHAR(255),
    email_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255),
    referral_code VARCHAR(20) UNIQUE,
    referred_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 2. STORES & SETTINGS
-- ============================================================================

CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    store_name VARCHAR(255) NOT NULL,
    currency_symbol VARCHAR(10) DEFAULT '₹',
    upi_id VARCHAR(255),
    is_blocked BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE store_settings (
    store_id UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
    price_per_chai DECIMAL(10, 2) DEFAULT 10.00,
    price_per_coffee DECIMAL(10, 2) DEFAULT 15.00,
    shop_name VARCHAR(255),
    enable_notifications BOOLEAN DEFAULT false,
    sound_enabled BOOLEAN DEFAULT true,
    show_walk_in BOOLEAN DEFAULT true,
    products JSONB DEFAULT '[]'::jsonb,
    last_notification_date VARCHAR(50)
);

-- ============================================================================
-- 3. CUSTOMER DATA
-- ============================================================================

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    office VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000),
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION
);

CREATE TABLE logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    timestamp BIGINT NOT NULL,
    count INTEGER NOT NULL,
    product_type VARCHAR(50) DEFAULT 'chai'
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE, -- Often needed for easier querying
    month_str VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    amount DECIMAL(10, 2) NOT NULL,
    paid_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- ============================================================================
-- 4. SUBSCRIPTIONS & COMMISSIONS
-- ============================================================================

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    plan_type VARCHAR(50) DEFAULT 'free',
    status VARCHAR(50) DEFAULT 'active',
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    provider VARCHAR(50),
    subscription_id VARCHAR(255),
    customer_limit INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    referred_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 5. ADMIN & EXTRAS
-- ============================================================================

CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE admin_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES admin_users(id),
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(50),
    target_id UUID,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE affiliates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    total_earnings DECIMAL(10, 2) DEFAULT 0,
    total_withdrawn DECIMAL(10, 2) DEFAULT 0,
    available_balance DECIMAL(10, 2) DEFAULT 0,
    joined_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE affiliate_referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    affiliate_id UUID REFERENCES affiliates(id),
    store_id UUID REFERENCES stores(id),
    commission_amount DECIMAL(10, 2) DEFAULT 0,
    commission_status VARCHAR(50) DEFAULT 'pending',
    payment_status VARCHAR(50) DEFAULT 'unpaid',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initial Super Admin
INSERT INTO admin_users (email, password_hash, name, role)
VALUES ('admin@chaiapp.com', '$2a$10$X7.123...PLACEHOLDER', 'Super Admin', 'super_admin')
ON CONFLICT (email) DO NOTHING;

-- Views
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
    (SELECT COUNT(*) FROM customers c WHERE c.store_id = s.id) AS total_customers
FROM stores s
JOIN users u ON s.user_id = u.id
LEFT JOIN subscriptions sub ON sub.store_id = s.id AND sub.status = 'active';
