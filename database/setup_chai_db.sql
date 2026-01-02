-- =============================================
-- COMPLETE DATABASE SETUP SCRIPT FOR chai_db
-- =============================================

-- 1. Create Database (Run this line separately if using a tool that can't switch DBs)
CREATE DATABASE chai_db;

-- 2. Connect to chai_db (In pgAdmin, right-click chai_db and open Query Tool)
-- \c chai_db

-- 3. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 4. Create Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    google_id VARCHAR(255) UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    picture TEXT,
    password_hash TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create Stores Table
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    store_name VARCHAR(255) NOT NULL,
    currency_symbol VARCHAR(10) DEFAULT '₹',
    upi_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create Store Settings Table
CREATE TABLE IF NOT EXISTS store_settings (
    store_id UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
    price_per_chai DECIMAL(10, 2) DEFAULT 10.00,
    price_per_coffee DECIMAL(10, 2) DEFAULT 15.00,
    shop_name VARCHAR(255),
    enable_notifications BOOLEAN DEFAULT false,
    show_walk_in BOOLEAN DEFAULT true,
    sound_enabled BOOLEAN DEFAULT true,
    last_notification_date VARCHAR(50),
    products JSONB DEFAULT '[]'::jsonb
);

-- 7. Create Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    office VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Billing columns (Added for future compatibility)
    total_bill_amount DECIMAL(10, 2) DEFAULT 0,
    paid_amount DECIMAL(10, 2) DEFAULT 0,
    due_amount DECIMAL(10, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'due'
);

-- 8. Create Logs Table (aligned with code)
CREATE TABLE IF NOT EXISTS logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL, -- Allow NULL for walk-ins
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    drink_type VARCHAR(50) DEFAULT 'chai', -- Code uses 'drink_type'
    quantity INTEGER DEFAULT 1,            -- Code uses 'quantity'
    price_at_time DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    timestamp BIGINT -- Kept for legacy compatibility if needed
);

-- 9. Create Payments Table (aligned with code)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    month_str VARCHAR(20),
    amount DECIMAL(10, 2) NOT NULL,
    paid_at BIGINT,
    status VARCHAR(20) DEFAULT 'completed',
    receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    payment_date TIMESTAMP WITH TIME ZONE
);

-- 10. Create Password Reset Tokens Table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_store_id ON customers(store_id);
CREATE INDEX IF NOT EXISTS idx_logs_store_id ON logs(store_id);
CREATE INDEX IF NOT EXISTS idx_payments_store_id ON payments(store_id);
